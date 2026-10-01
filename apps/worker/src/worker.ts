import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import pino from "pino";
import { CompanyCrawler } from "@gtm/crawler";
import {
  companyAnalysisSchema,
  createAIProvider,
  GroqProvider,
  AIProviderError,
  type AIProvider,
} from "@gtm/ai";
import {
  basicEmailChecks,
  contactConfidence,
  detectEmailPattern,
  discoverPublicContacts,
  extractPeople,
  inferEmail,
  rankDecisionMakers,
  validateEmail,
  type ContactValidationResult,
} from "@gtm/contacts";
import {
  AcademicRepository,
  ContactRepository,
  createDatabase,
  FinalRepository,
  GtmRepository,
  ResearchRepository,
  type DatabaseConnection,
} from "@gtm/db";
import {
  DEFAULT_EXCLUDED_KEYWORDS,
  DEFAULT_JOB_KEYWORDS,
  loadConfig,
} from "@gtm/shared";
import { getSourceAdapter, SourceHttpError } from "@gtm/sources";
import { isRelevantJob } from "@gtm/scoring";
import {
  buildCompanyProfile,
  extractDeterministicEvidence,
  extractJobEvidence,
  resolveCompanyDomain,
  type EvidenceDraft,
} from "@gtm/research";
import { detectSignals } from "@gtm/signals";
import {
  ImapInboxProvider,
  SMTPProvider,
  type EmailInboxProvider,
  type EmailProvider,
} from "@gtm/email";
import {
  classifyReplyDeterministically,
  outreachBundleSchema,
} from "@gtm/operations";
import { OperationsRepository } from "@gtm/db";
import {
  academicEmailDraftSchema,
  academicOpportunityAnalysisSchema,
  professorAnalysisSchema,
} from "@gtm/academic";
import { contentHash } from "@gtm/shared";
import { z, type ZodType } from "zod";

const academicPageExtractionSchema=z.object({universityName:z.string().min(2),country:z.string().min(2),programTitle:z.string().min(3),degreeLevel:z.enum(['PHD','MASTERS','MS_PHD','RESEARCH','FELLOWSHIP']),fundingCategory:z.enum(['CONFIRMED_FULL_FUNDING','TUITION_FREE_FUNDING_REQUIRED','PARTIAL_FUNDING','POTENTIAL_FUNDING_UNCONFIRMED','SELF_FUNDED','UNKNOWN']),deadline:z.string().datetime().nullable(),requirements:z.array(z.string()).default([]),researchAreas:z.array(z.string()).default([]),professors:z.array(z.object({name:z.string(),researchAreas:z.array(z.string()).default([])})).default([])}).strict();

export class Worker {
  private readonly connection: DatabaseConnection;
  private readonly repository: GtmRepository;
  private readonly researchRepository: ResearchRepository;
  private readonly contactRepository: ContactRepository;
  private readonly operationsRepository: OperationsRepository;
  private readonly finalRepository: FinalRepository;
  private readonly academicRepository: AcademicRepository;
  private readonly id = `worker-${randomUUID()}`;
  private stopped = false;
  private readonly log;
  private readonly config;
  private readonly aiProvider: AIProvider;
  private readonly contactValidator: (
    email: string,
    companyDomain: string | null,
  ) => Promise<ContactValidationResult>;
  private readonly emailProvider: EmailProvider;
  private readonly inboxProvider: EmailInboxProvider;

  constructor(
    connection?: DatabaseConnection,
    aiProvider?: AIProvider,
    contactValidator = validateEmail,
    emailProvider?: EmailProvider,
    inboxProvider?: EmailInboxProvider,
  ) {
    this.config = loadConfig();
    this.connection = connection ?? createDatabase(this.config.DATABASE_URL);
    this.repository = new GtmRepository(this.connection);
    this.researchRepository = new ResearchRepository(this.connection);
    this.contactRepository = new ContactRepository(this.connection);
    this.operationsRepository = new OperationsRepository(this.connection);
    this.finalRepository = new FinalRepository(this.connection);
    this.academicRepository = new AcademicRepository(this.connection);
    this.aiProvider = aiProvider ?? createAIProvider(this.config);
    this.contactValidator = contactValidator;
    this.emailProvider =
      emailProvider ??
      new SMTPProvider({
        host: this.config.SMTP_HOST,
        port: this.config.SMTP_PORT,
        secure: this.config.SMTP_SECURE,
        user: this.config.SMTP_USER,
        password: this.config.SMTP_PASSWORD,
      });
    this.inboxProvider =
      inboxProvider ??
      new ImapInboxProvider({
        host: this.config.IMAP_HOST,
        port: this.config.IMAP_PORT,
        secure: this.config.IMAP_SECURE,
        user: this.config.IMAP_USER,
        password: this.config.IMAP_PASSWORD,
      });
    this.log = pino({
      level: this.config.LOG_LEVEL,
      base: { service: "worker", workerId: this.id },
    });
  }

  async runOnce(): Promise<boolean> {
    this.finalRepository.scheduleRecurring({
      imapEnabled: Boolean(
        this.config.IMAP_HOST &&
          this.config.IMAP_USER &&
          this.config.IMAP_PASSWORD,
      ),
    });
    this.academicRepository.queueDueSourceRefreshes();
    const queued = this.repository.claimNext(this.id);
    if (!queued) return false;
    try {
      const payload = JSON.parse(queued.payloadJson) as Record<string, unknown>;
      let result: unknown;
      switch (queued.type) {
        case "DISCOVER_SOURCE":
          result = await this.discover(String(payload.sourceId));
          break;
        case "RESOLVE_COMPANY_DOMAIN":
          result = await this.resolveDomain(
            String(payload.companyId),
            String(payload.researchRunId),
          );
          break;
        case "CRAWL_COMPANY":
          result = await this.crawlCompany(
            String(payload.companyId),
            String(payload.researchRunId),
          );
          break;
        case "EXTRACT_COMPANY_FACTS":
          result = await this.extractFacts(
            String(payload.companyId),
            String(payload.researchRunId),
          );
          break;
        case "DETECT_SIGNALS":
          result = await this.detectCompanySignals(
            String(payload.companyId),
            String(payload.researchRunId),
          );
          break;
        case "ANALYZE_COMPANY_AI":
          result = await this.analyzeCompany(
            String(payload.companyId),
            String(payload.researchRunId),
          );
          break;
        case "RECALCULATE_SCORES":
          result = await this.finalizeResearch(
            String(payload.companyId),
            String(payload.researchRunId),
          );
          break;
        case "DISCOVER_COMPANY_PEOPLE":
          result = await this.discoverPeople(
            String(payload.companyId),
            String(payload.contactResearchRunId),
          );
          break;
        case "RANK_DECISION_MAKERS":
          result = await this.rankPeople(
            String(payload.companyId),
            String(payload.contactResearchRunId),
          );
          break;
        case "DISCOVER_CONTACTS":
          result = await this.discoverContacts(
            String(payload.companyId),
            String(payload.contactResearchRunId),
          );
          break;
        case "DETECT_EMAIL_PATTERN":
          result = await this.detectPattern(
            String(payload.companyId),
            String(payload.contactResearchRunId),
          );
          break;
        case "VALIDATE_CONTACT":
          result = await this.validateContact(
            String(payload.companyId),
            String(payload.contactResearchRunId),
            String(payload.contactId),
          );
          break;
        case "REFRESH_CONTACT_INTELLIGENCE":
          result = await this.finalizeContacts(
            String(payload.companyId),
            String(payload.contactResearchRunId),
          );
          break;
        case "MATCH_SERVICE":
          result = this.operationsRepository.prepareClient(
            String(payload.opportunityId),
            { force: Boolean(payload.force) },
          );
          break;
        case "GENERATE_OUTREACH":
          result = await this.generateOutreach(
            String(payload.opportunityId),
            Boolean(payload.force),
          );
          break;
        case "SEND_EMAIL":
          result = await this.sendEmail(String(payload.messageId));
          break;
        case "PROCESS_FOLLOWUP":
          result = this.operationsRepository.processDueFollowups();
          break;
        case "PROCESS_INCOMING_EMAIL":
          result = this.processIncoming(payload);
          break;
        case "CLASSIFY_REPLY":
          result = this.classifyReply(
            String(payload.emailMessageId),
            String(payload.textBody),
          );
          break;
        case "GENERATE_APPLICATION_PACKAGE":
          result = this.operationsRepository.prepareApplication(
            String(payload.opportunityId),
            Boolean(payload.force),
          );
          break;
        case "POLL_INBOX":
          result = await this.pollInbox();
          break;
        case "CALCULATE_ANALYTICS":
          result = this.finalRepository.analytics();
          break;
        case "EVALUATE_MODELS":
          result = this.evaluateModels();
          break;
        case "RESEARCH_ACADEMIC_URL":
          result = await this.researchAcademicUrl(String(payload.sourceId));
          break;
        case "SEND_ACADEMIC_OUTREACH":
          result = await this.sendAcademicOutreach(String(payload.outreachId));
          break;
        case "ANALYZE_ACADEMIC_OPPORTUNITY_AI":
          result = await this.analyzeAcademicOpportunity(
            String(payload.opportunityId),
            Boolean(payload.force),
          );
          break;
        case "ANALYZE_PROFESSOR_AI":
          result = await this.analyzeProfessor(
            String(payload.professorCaseId),
            Boolean(payload.force),
          );
          break;
        case "GENERATE_ACADEMIC_OUTREACH_AI":
          result = await this.generateAcademicOutreach(
            String(payload.professorCaseId),
            Boolean(payload.force),
          );
          break;
        case "RUN_ACADEMIC_SEARCH":
          result = await this.runAcademicDiscovery(String(payload.searchId));
          break;
        default:
          throw new Error(`Unknown worker job type: ${queued.type}`);
      }
      this.repository.completeWorkerJob(queued.id, result);
      this.log.info(
        { workerJobId: queued.id, type: queued.type },
        "Worker job completed",
      );
    } catch (error) {
      const retryAfter =
        error instanceof SourceHttpError
          ? (error.retryAfterMs ?? undefined)
          : undefined;
      this.repository.failWorkerJob(
        queued.id,
        queued.attempts,
        queued.maxAttempts,
        error,
        retryAfter,
      );
      const payload = JSON.parse(queued.payloadJson) as Record<string, unknown>;
      if (
        queued.attempts >= queued.maxAttempts &&
        typeof payload.researchRunId === "string"
      )
        this.researchRepository.failRun(payload.researchRunId, error);
      if (
        queued.attempts >= queued.maxAttempts &&
        typeof payload.contactResearchRunId === "string"
      )
        this.contactRepository.fail(payload.contactResearchRunId, error);
      if (
        queued.attempts >= queued.maxAttempts &&
        typeof payload.searchId === "string"
      )
        this.academicRepository.failAcademicSearch(payload.searchId, error);
      this.log.error(
        { err: error, workerJobId: queued.id, type: queued.type },
        "Worker job failed",
      );
    }
    return true;
  }

  async run(intervalMs = 1_000) {
    this.log.info("Worker started");
    while (!this.stopped) {
      const worked = await this.runOnce();
      if (!worked)
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  stop() {
    this.stopped = true;
  }
  close() {
    this.connection.sqlite.close();
  }

  private async sendEmail(messageId: string) {
    const sending = this.operationsRepository.beginSend(messageId, {
      minimumConfidence: this.config.MIN_CONTACT_CONFIDENCE,
      hourlyLimit: this.config.EMAILS_PER_HOUR,
      dailyLimit: this.config.EMAILS_PER_DAY,
    });
    try {
      const result = await this.emailProvider.send({
        from:
          this.config.SMTP_FROM ?? this.config.SMTP_USER ?? "local@localhost",
        replyTo: this.config.SMTP_REPLY_TO,
        to: sending.contact.contactValue,
        subject: String(sending.subject),
        text: sending.version.textBody,
        html: sending.version.htmlBody,
      });
      return this.operationsRepository.finishSend(sending.attemptId, result);
    } catch (error) {
      this.operationsRepository.failSend(sending.attemptId, error);
      throw error;
    }
  }
  private async researchAcademicUrl(sourceId: string) {
    const run = this.academicRepository.beginAcademicResearch(sourceId);
    const domain = new URL(run.source.url).hostname;
    const crawler = new CompanyCrawler({
      maxPages: Math.min(8, this.config.MAX_PAGES_PER_COMPANY),
      maxDepth: 1,
      timeoutMs: this.config.REQUEST_TIMEOUT_MS,
      maxResponseBytes: this.config.MAX_RESPONSE_BYTES,
      requestsPerDomain: this.config.REQUESTS_PER_DOMAIN,
      globalConcurrency: this.config.GLOBAL_CONCURRENCY,
      userAgent: "NorthstarAcademicResearch/0.1 (+public-evidence-only)",
    });
    const results = await crawler.crawl(domain);
    const pages = results
      .filter((result) => result.page && result.contentHash)
      .map((result) => ({
        contentHash: result.contentHash!,
        title: result.page!.title,
        textContent: result.page!.textContent,
        httpStatus: result.httpStatus,
        url: result.page!.url,
      }));
    if (!pages.length)
      throw new Error("No usable public academic pages were retrieved");
    return this.academicRepository.finishAcademicResearch(
      run.id,
      sourceId,
      pages,
    );
  }
  private async runAcademicDiscovery(searchId: string) {
    const search = this.academicRepository.beginAcademicSearch(searchId);
    if (!this.config.GROQ_BROWSER_SEARCH_ENABLED || !this.config.GROQ_API_KEY) {
      const deterministic = this.academicRepository.runAcademicSearch(searchId);
      this.academicRepository.updateAcademicSearch(searchId,{status:'DISCOVERY_DISABLED',progress:{discoveryQueries:0,candidateUrls:0,pagesRetrieved:0,officialPagesVerified:0,opportunitiesCreated:deterministic.resultCount,fundingVerified:0,aiAnalysesCompleted:0,failures:0}});
      return { ...deterministic,status:'DISCOVERY_DISABLED', discovery: "disabled" };
    }
    if (
      this.academicRepository.aiRequestsToday() >=
      this.config.AI_MAX_DAILY_REQUESTS
    ) {
      const deterministic = this.academicRepository.runAcademicSearch(searchId);
      this.academicRepository.updateAcademicSearch(searchId,{status:'PARTIAL',errorCategory:'RATE_LIMITED'});
      return { ...deterministic,status:'PARTIAL', discovery: "daily-limit" };
    }
    const profile = this.academicRepository.ensureDefaultProfile();
    const groq = new GroqProvider(
      this.config.GROQ_BASE_URL,
      this.config.GROQ_MODEL,
      this.config.GROQ_API_KEY,
      30_000,
    );
    const maximum = Math.min(12, this.config.AI_MAX_RESEARCH_ITEMS_PER_RUN);
    let discoveryProvider = "deterministic";
    let discoveryModel = "official-source-catalog";
    const query=`Official current ${search.filters.degree} opportunities in ${search.filters.countries.join(', ')}. Funding intent: ${search.filters.funding}. Research areas: ${search.filters.researchAreas.join(', ')}. Return official university, government, or research institute URLs.`;
    let candidates:Array<{url:string;title:string;snippet:string;officialUrl:string;universityName:string;country:string;programTitle:string;degreeLevel:'PHD'|'MASTERS'|'MS_PHD'|'RESEARCH'|'FELLOWSHIP'}>=fallbackAcademicCandidates(search.filters.countries).map(item=>({...item,url:item.officialUrl,title:item.programTitle,snippet:'Curated official fallback'}));
    let discoveryErrorCategory:string|null=null;
    const progress={discoveryQueries:1,candidateUrls:0,pagesRetrieved:0,officialPagesVerified:0,opportunitiesCreated:0,fundingVerified:0,aiAnalysesCompleted:0,failures:0};
    try {
      const discovered = await groq.browserDiscover({query,maxResults:Math.min(10,maximum)});
      candidates = discovered.results.map(item=>({...item,officialUrl:item.url,universityName:'Pending extraction',country:search.filters.countries[0]??'Unknown',programTitle:item.title,degreeLevel:(search.filters.degree==='PHD'?'PHD':'RESEARCH') as 'PHD'|'RESEARCH'}));
      discoveryProvider = discovered.provider;
      discoveryModel = discovered.model;
      progress.candidateUrls=candidates.length;
      this.academicRepository.updateAcademicSearch(searchId,{status:'VERIFYING',progress,provider:discoveryProvider,model:discoveryModel,errorCategory:null});
    } catch (error) {
      discoveryErrorCategory=error instanceof AIProviderError?(error.code==='MISCONFIGURED'?'AUTH':error.code):'UPSTREAM';
      progress.failures++;
      progress.candidateUrls=candidates.length;
      this.academicRepository.updateAcademicSearch(searchId,{status:'VERIFYING',progress,provider:'fallback',model:'official-source-catalog',errorCategory:discoveryErrorCategory});
      this.log.warn(
        { provider: "groq", reason: error instanceof Error ? error.message : "failed" },
        "Groq discovery unavailable; using curated official sources",
      );
    }
    const crawler = new CompanyCrawler({
      maxPages: 1,
      maxDepth: 0,
      timeoutMs: this.config.REQUEST_TIMEOUT_MS,
      maxResponseBytes: this.config.MAX_RESPONSE_BYTES,
      requestsPerDomain: 1,
      globalConcurrency: 1,
      userAgent: "NorthstarAcademicResearch/0.1 (+public-evidence-only)",
    });
    for(const candidate of candidates)this.academicRepository.saveDiscoveryCandidate({searchId,query,url:candidate.officialUrl,title:candidate.title,snippet:candidate.snippet,provider:discoveryProvider,model:discoveryModel});
    let verified = 0;
    for (const candidate of candidates.slice(0, maximum)) {
      if (!isAcceptableAcademicSource(candidate.officialUrl)) continue;
      const fetched = await crawler.crawlUrl(candidate.officialUrl);
      if (!fetched.page || !fetched.contentHash) continue;
      progress.pagesRetrieved++;
      const pageText = fetched.page.textContent.slice(0, 100_000);
      if (pageText.trim().length < 300) continue;
      progress.officialPagesVerified++;
      let extracted:z.infer<typeof academicPageExtractionSchema>;
      try{
        const generated=await this.aiProvider.generateStructured({system:'Extract only facts supported by the independently retrieved official page. Use UNKNOWN when funding is not proven.',prompt:JSON.stringify({url:candidate.officialUrl,title:fetched.page.title,text:pageText.slice(0,50000),searchIntent:search.filters,applicantInterests:[...(profile.primaryInterests as string[]),...(profile.secondaryInterests as string[])]}),schema:academicPageExtractionSchema,schemaName:'academic_page_extraction'});
        extracted=generated.data;
      }catch{
        extracted={universityName:candidate.universityName,country:candidate.country,programTitle:candidate.programTitle,degreeLevel:candidate.degreeLevel,fundingCategory:classifyFundingFromPage(pageText),deadline:null,requirements:[],researchAreas:search.filters.researchAreas,professors:[]};
        progress.failures++;
      }
      const source = this.academicRepository.saveSource({
        kind: "GROQ_DISCOVERY",
        name: new URL(candidate.officialUrl).hostname,
        url: candidate.officialUrl,
        canonicalUrl: fetched.page.canonicalUrl,
        official: true,
        metadata: { searchId, discoveredBy: "groq-browser-search" },
      });
      const run = this.academicRepository.beginAcademicResearch(source.id);
      this.academicRepository.finishAcademicResearch(run.id, source.id, [
        {
          contentHash: fetched.contentHash,
          title: fetched.page.title,
          textContent: pageText,
          httpStatus: fetched.httpStatus,
          url: fetched.page.url,
        },
      ]);
      const university = this.academicRepository.upsertUniversity({
        name: extracted.universityName,
        country: extracted.country,
        officialUrl: `${new URL(candidate.officialUrl).protocol}//${new URL(candidate.officialUrl).host}`,
        confidence: 0.75,
      });
      const program = this.academicRepository.upsertProgram({
        universityId: university.id,
        name: extracted.programTitle,
        degreeLevel: extracted.degreeLevel,
        websiteUrl: candidate.officialUrl,
        requirements: { discoveryStatus: "REVIEW_REQUIRED",requirements:extracted.requirements,researchAreas:extracted.researchAreas },
      });
      const fundingCategory = extracted.fundingCategory;
      const opportunity = this.academicRepository.createOpportunity({
        universityId: university.id,
        programId: program.id,
        title: extracted.programTitle,
        degreeLevel: extracted.degreeLevel,
        country: extracted.country,
        ...(extracted.deadline?{deadline:extracted.deadline}:{}),
        fundingCategory,
        sourceUrl: candidate.officialUrl,
        notes:
          "Discovered from an official public page; detailed eligibility and funding require evidence review.",
      });
      const opportunityId = String((opportunity as unknown as { id: string }).id);
      this.academicRepository.associateSearchResult({searchId,opportunityId,discoveryQuery:query,candidateUrl:candidate.officialUrl,status:'VERIFIED',relevanceScore:0.75});
      progress.opportunitiesCreated++;
      if(fundingCategory==='CONFIRMED_FULL_FUNDING')progress.fundingVerified++;
      this.academicRepository.updateAcademicSearch(searchId,{status:'ANALYZING',progress});
      this.academicRepository.saveEvidence({
        sourceId: source.id,
        entityType: "OPPORTUNITY",
        entityId: opportunityId,
        claimType: "OFFICIAL_PROGRAM_PAGE",
        claim: `Official page for ${extracted.programTitle}`,
        excerpt: relevantExcerpt(pageText, extracted.programTitle),
        sourceUrl: candidate.officialUrl,
        classification: "FACT",
        confidence: 0.8,
      });
      this.academicRepository.queueAcademicAi(
        "ANALYZE_ACADEMIC_OPPORTUNITY_AI",
        opportunityId,
      );
      verified++;
    }
    const results = this.academicRepository.listSearchOpportunities(searchId,search.filters);
    this.academicRepository.updateAcademicSearch(searchId,{progress});
    this.academicRepository.completeAcademicSearch(searchId, results.length,discoveryErrorCategory?'PARTIAL':'COMPLETED');
    return {
      searchId,
      status: discoveryErrorCategory?'PARTIAL':"COMPLETED",
      candidates: candidates.length,
      verified,
      results: results.length,
      provider: discoveryProvider,
      model: discoveryModel,
    };
  }
  private async sendAcademicOutreach(outreachId: string) {
    const sending = this.academicRepository.beginAcademicSend(outreachId, {
      hourly: this.config.EMAILS_PER_HOUR,
      daily: this.config.EMAILS_PER_DAY,
    });
    try {
      const documents = this.academicRepository.getDocuments(
        sending.documentIds,
      );
      if (documents.length !== sending.documentIds.length)
        throw new Error(
          "One or more approved academic attachments are unavailable",
        );
      const directory = resolve(this.config.ACADEMIC_DOCUMENT_DIRECTORY);
      const attachments = documents.map((document) => ({
        filename: document.original_filename,
        path: resolve(directory, document.storage_key),
        contentType: document.mime_type,
      }));
      const result = await this.emailProvider.send({
        from:
          this.config.SMTP_FROM ?? this.config.SMTP_USER ?? "local@localhost",
        replyTo: this.config.SMTP_REPLY_TO,
        to: sending.recipientEmail!,
        subject: sending.subjects[0] ?? "Prospective graduate research inquiry",
        text: sending.textBody,
        attachments,
      });
      return this.academicRepository.finishAcademicSend(outreachId, result);
    } catch (error) {
      this.academicRepository.failAcademicSend(outreachId, error);
      throw error;
    }
  }
  private processIncoming(payload: Record<string, unknown>) {
    const saved = this.operationsRepository.ingestReply({
      threadId: String(payload.threadId),
      messageId: String(payload.messageId),
      ...(typeof payload.inReplyTo === "string"
        ? { inReplyTo: payload.inReplyTo }
        : {}),
      references: Array.isArray(payload.references)
        ? payload.references.map(String)
        : [],
      sender: String(payload.sender),
      recipients: Array.isArray(payload.recipients)
        ? payload.recipients.map(String)
        : [],
      subject: String(payload.subject),
      textBody: String(payload.textBody),
      ...(typeof payload.occurredAt === "string"
        ? { occurredAt: payload.occurredAt }
        : {}),
    });
    if (!saved.cached)
      this.repository.enqueue(
        "CLASSIFY_REPLY",
        {
          emailMessageId: saved.emailMessageId,
          textBody: String(payload.textBody),
        },
        `classify:${saved.emailMessageId}`,
        100,
      );
    return saved;
  }
  private classifyReply(emailMessageId: string, textBody: string) {
    return this.operationsRepository.saveReplyClassification(
      emailMessageId,
      classifyReplyDeterministically(textBody),
    );
  }
  private async generateOutreach(opportunityId: string, force: boolean) {
    const prepared = this.operationsRepository.prepareClient(opportunityId, {
      force,
    });
    if (prepared.cached) return prepared;
    const health = await this.aiProvider.healthCheck();
    if (health.status !== "available") return { ...prepared, ai: "FALLBACK" };
    try {
      const messages = this.operationsRepository.getClientOperations(
        opportunityId,
      ).messages as Array<Record<string, unknown>>;
      const result = await this.aiProvider.generateStructured({
        schema: outreachBundleSchema,
        schemaName: "outreach_bundle",
        temperature: 0.2,
        system:
          "Write concise human B2B outreach. Use only facts present in the supplied grounded drafts and strategy. Never add claims, praise, problems, pricing, availability, or experience. Return JSON matching the schema.",
        prompt: JSON.stringify({
          strategy: prepared.strategy,
          groundedDrafts: messages.map((message) => ({
            channel: message.channel,
            followupNumber: message.followup_number,
            text: message.textBody,
            subjects: message.subjectsJson,
          })),
        }),
      });
      const email = messages.find(
          (message) =>
            message.channel === "EMAIL" &&
            Number(message.followup_number) === 0,
        ),
        linkedin = messages.find((message) => message.channel === "LINKEDIN"),
        followups = messages
          .filter(
            (message) =>
              message.channel === "EMAIL" &&
              Number(message.followup_number) > 0,
          )
          .sort(
            (a, b) => Number(a.followup_number) - Number(b.followup_number),
          );
      if (email)
        this.operationsRepository.editMessage(String(email.id), {
          textBody: result.data.coldEmail,
          subjects: result.data.subjects,
        });
      if (linkedin)
        this.operationsRepository.editMessage(String(linkedin.id), {
          textBody: result.data.linkedIn,
        });
      followups.forEach((message, index) =>
        this.operationsRepository.editMessage(String(message.id), {
          textBody: result.data.followups[index] ?? String(message.textBody),
        }),
      );
      return {
        ...prepared,
        ai: result.provider.toUpperCase(),
        model: result.model,
      };
    } catch {
      this.log.warn(
        { provider: this.aiProvider.name, opportunityId },
        "AI outreach failed; deterministic drafts retained",
      );
      return { ...prepared, ai: "FALLBACK" };
    }
  }
  private async pollInbox() {
    const checkpoint = this.finalRepository.getCheckpoint(),
      result = await this.inboxProvider.poll({ lastUid: checkpoint.lastUid });
    for (const message of result.messages) {
      const thread = this.finalRepository.matchInbound({
        ...(message.inReplyTo ? { inReplyTo: message.inReplyTo } : {}),
        references: message.references,
        sender: message.sender,
        subject: message.subject,
      });
      if (thread)
        this.repository.enqueue(
          "PROCESS_INCOMING_EMAIL",
          { threadId: thread.id, ...message },
          `incoming:${message.messageId}`,
          100,
        );
    }
    this.finalRepository.saveCheckpoint(
      "IMAP",
      "INBOX",
      result.lastUid,
      result.uidValidity,
    );
    return {
      seen: result.messages.length,
      matched: result.messages.filter((message) =>
        Boolean(
          this.finalRepository.matchInbound({
            ...(message.inReplyTo ? { inReplyTo: message.inReplyTo } : {}),
            references: message.references,
            sender: message.sender,
            subject: message.subject,
          }),
        ),
      ).length,
      lastUid: result.lastUid,
    };
  }
  private evaluateModels() {
    const minimum = Number(process.env.MIN_MODEL_SAMPLES ?? 100);
    return {
      client: [
        "CLIENT_REPLIED",
        "CLIENT_POSITIVE_REPLY",
        "CLIENT_MEETING",
        "CLIENT_WON",
      ].map((target) =>
        this.finalRepository.evaluateModel("CLIENT", target, minimum),
      ),
      job: ["JOB_REPLY", "JOB_INTERVIEW", "JOB_OFFER"].map((target) =>
        this.finalRepository.evaluateModel("JOB", target, minimum),
      ),
      recommendations: this.finalRepository.generateRecommendations(),
    };
  }

  private async discover(sourceId: string) {
    const source = this.repository.getSource(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);
    const runId = this.repository.beginSourceRun(sourceId);
    const started = Date.now();
    const metrics = {
      pagesProcessed: 0,
      recordsSeen: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      duplicatesDetected: 0,
      errors: 0,
      rateLimitEvents: 0,
    };
    try {
      const adapter = getSourceAdapter(source.kind);
      const includeKeywords =
        stringArray(source.config.includeKeywords) ?? DEFAULT_JOB_KEYWORDS;
      const excludeKeywords =
        stringArray(source.config.excludeKeywords) ?? DEFAULT_EXCLUDED_KEYWORDS;
      for await (const page of adapter.discover(source.config, {
        checkpoint: source.checkpoint,
        onRateLimit: () => {
          metrics.rateLimitEvents += 1;
        },
      })) {
        const relevantRecords = page.records.filter((record) =>
          isRelevantJob(record, includeKeywords, excludeKeywords),
        );
        const ingested = this.repository.ingestMany(
          sourceId,
          runId,
          relevantRecords,
        );
        metrics.pagesProcessed += 1;
        metrics.recordsSeen += page.rawRecordCount;
        metrics.recordsCreated += ingested.created;
        metrics.recordsUpdated += ingested.updated;
        metrics.duplicatesDetected += ingested.duplicates;
        this.repository.updateSourceRun(runId, {
          ...metrics,
          checkpoint: page.checkpoint,
        });
      }
      this.repository.finishSourceRun(runId, "COMPLETED", {
        ...metrics,
        runtimeMs: Date.now() - started,
        checkpoint: null,
      });
      this.researchRepository.queueEligible({
        minJobScore: this.config.MIN_RESEARCH_JOB_SCORE,
        minClientScore: this.config.MIN_RESEARCH_CLIENT_SCORE,
      });
      return metrics;
    } catch (error) {
      metrics.errors += 1;
      this.repository.finishSourceRun(runId, "FAILED", {
        ...metrics,
        runtimeMs: Date.now() - started,
        errorJson: JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
        }),
      });
      throw error;
    }
  }

  private async resolveDomain(companyId: string, runId: string) {
    this.researchRepository.setRunStatus(runId, "RESOLVING_DOMAIN");
    const context = this.researchRepository.getResearchContext(companyId);
    const resolution = resolveCompanyDomain({
      companyName: context.company.canonicalName,
      existingDomain: context.company.resolvedDomain ?? context.company.domain,
      sourceDomains: context.sourceDomains,
      descriptionUrls: context.descriptionUrls,
    });
    this.researchRepository.saveDomainResolution(runId, resolution);
    if (!resolution.accepted || !resolution.domain)
      throw new Error(
        "Company domain could not be resolved with sufficient confidence",
      );
    this.enqueueStage("CRAWL_COMPANY", companyId, runId);
    return resolution;
  }
  private async crawlCompany(companyId: string, runId: string) {
    this.researchRepository.setRunStatus(runId, "CRAWLING");
    const context = this.researchRepository.getResearchContext(companyId);
    const domain = context.company.resolvedDomain;
    if (!domain) throw new Error("Research run has no resolved company domain");
    const crawler = new CompanyCrawler({
      maxPages: this.config.MAX_PAGES_PER_COMPANY,
      maxDepth: this.config.MAX_CRAWL_DEPTH,
      timeoutMs: this.config.REQUEST_TIMEOUT_MS,
      maxResponseBytes: this.config.MAX_RESPONSE_BYTES,
      requestsPerDomain: this.config.REQUESTS_PER_DOMAIN,
      globalConcurrency: this.config.GLOBAL_CONCURRENCY,
    });
    const results = await crawler.crawl(domain);
    const summary = this.researchRepository.saveCrawlResults(
      runId,
      results,
      this.config.CACHE_TTL_DAYS,
    );
    if (!summary.fetched && !summary.reused)
      throw new Error("No usable public company pages were retrieved");
    this.enqueueStage("EXTRACT_COMPANY_FACTS", companyId, runId);
    return summary;
  }
  private async extractFacts(companyId: string, runId: string) {
    this.researchRepository.setRunStatus(runId, "EXTRACTING");
    const pages = this.researchRepository.getRunPages(runId);
    const context = this.researchRepository.getResearchContext(companyId);
    const drafts = [
      ...pages.flatMap((page) =>
        extractDeterministicEvidence(
          page as Parameters<typeof extractDeterministicEvidence>[0],
        ).map((item) => ({ ...item, pageId: page.pageId })),
      ),
      ...extractJobEvidence(
        context.jobs.flatMap((job) => {
          const sourceUrl = context.jobUrls.get(job.id);
          return sourceUrl
            ? [{ title: job.title, description: job.description, sourceUrl }]
            : [];
        }),
      ),
    ];
    this.researchRepository.saveEvidence(runId, drafts);
    this.enqueueStage("DETECT_SIGNALS", companyId, runId);
    return { evidence: drafts.length };
  }
  private async detectCompanySignals(companyId: string, runId: string) {
    const rows = this.researchRepository.getEvidence(runId);
    const drafts = rows.map((row) => ({
      type: row.type,
      classification: row.classification,
      claim: row.claim,
      evidenceText: row.evidenceText,
      sourceUrl: row.sourceUrl,
      sourceQuality: row.sourceQuality,
      confidence: row.confidence,
      extractor: row.extractor,
      contentHash: row.contentHash,
    })) as EvidenceDraft[];
    const detected = detectSignals(drafts);
    this.researchRepository.saveSignals(runId, detected);
    this.enqueueStage("ANALYZE_COMPANY_AI", companyId, runId);
    return { signals: detected.length };
  }
  private async analyzeCompany(companyId: string, runId: string) {
    this.researchRepository.setRunStatus(runId, "AI_ANALYSIS");
    const context = this.researchRepository.getResearchContext(companyId);
    const evidence = this.researchRepository.getEvidence(runId).slice(0, 60);
    const aiInput = {
      company: context.company.canonicalName,
      evidence: evidence.map((item) => ({
        id: item.id,
        type: item.type,
        classification: item.classification,
        claim: item.claim,
        evidenceText: item.evidenceText,
        sourceUrl: item.sourceUrl,
        confidence: item.confidence,
      })),
    };
    const cached = this.researchRepository.findCachedAiAnalysis(
      "COMPANY_ANALYSIS",
      aiInput,
    );
    if (cached) {
      this.researchRepository.saveAiRun({
        runId,
        task: "COMPANY_ANALYSIS",
        provider: cached.provider,
        model: cached.model,
        promptVersion: "company-analysis-v1",
        input: aiInput,
        output: cached.output,
        status: "COMPLETED",
        latencyMs: 0,
      });
      this.researchRepository.setRunStatus(runId, "AI_ANALYSIS", {
        aiStatus: "CACHED",
      });
      this.enqueueStage("RECALCULATE_SCORES", companyId, runId);
      return { cached: true };
    }
    const health = await this.aiProvider.healthCheck();
    if (health.status !== "available") {
      this.researchRepository.saveAiRun({
        runId,
        task: "COMPANY_ANALYSIS",
        provider: health.provider,
        model: health.model,
        promptVersion: "company-analysis-v1",
        input: aiInput,
        status: "SKIPPED",
        latencyMs: 0,
        error: health.detail ?? health.status,
      });
      this.researchRepository.setRunStatus(runId, "AI_ANALYSIS", {
        aiStatus: health.status.toUpperCase(),
      });
      this.enqueueStage("RECALCULATE_SCORES", companyId, runId);
      return health;
    }
    const started = Date.now();
    try {
      const generated = await this.aiProvider.generateStructured({
        schema: companyAnalysisSchema,
        schemaName: "company_analysis",
        temperature: 0.1,
        system:
          "You analyze company evidence. Use only supplied evidence. Distinguish FACT, OBSERVATION, and HYPOTHESIS. FACT items must cite evidenceIds. Never invent products, funding, people, customers, or needs.",
        prompt: JSON.stringify(aiInput),
      });
      const grounded = groundAnalysis(
        generated.data,
        new Set(evidence.map((item) => item.id)),
      );
      this.researchRepository.saveAiRun({
        runId,
        task: "COMPANY_ANALYSIS",
        provider: generated.provider,
        model: generated.model,
        promptVersion: "company-analysis-v1",
        input: aiInput,
        output: grounded,
        status: "COMPLETED",
        latencyMs: generated.latencyMs,
        promptTokens: generated.promptTokens,
        completionTokens: generated.completionTokens,
      });
      this.researchRepository.setRunStatus(runId, "AI_ANALYSIS", {
        aiStatus: "COMPLETED",
      });
    } catch (error) {
      this.researchRepository.saveAiRun({
        runId,
        task: "COMPANY_ANALYSIS",
        provider: this.aiProvider.name,
        model: this.aiProvider.modelInfo().model,
        promptVersion: "company-analysis-v1",
        input: aiInput,
        status: "FAILED",
        latencyMs: Date.now() - started,
        error,
      });
      this.researchRepository.setRunStatus(runId, "AI_ANALYSIS", {
        aiStatus: "FAILED",
      });
    }
    this.enqueueStage("RECALCULATE_SCORES", companyId, runId);
    return { analyzed: true };
  }
  private async finalizeResearch(companyId: string, runId: string) {
    this.researchRepository.setRunStatus(runId, "SCORING");
    const context = this.researchRepository.getResearchContext(companyId);
    const run = this.researchRepository.getRun(runId)!;
    const evidenceRows = this.researchRepository.getEvidence(runId);
    const evidence = evidenceRows.map((row) => ({
      type: row.type,
      classification: row.classification,
      claim: row.claim,
      evidenceText: row.evidenceText,
      sourceUrl: row.sourceUrl,
      sourceQuality: row.sourceQuality,
      confidence: row.confidence,
      extractor: row.extractor,
      contentHash: row.contentHash,
    })) as EvidenceDraft[];
    const detected = this.researchRepository.getSignalsForRun(runId);
    const ai = this.researchRepository.getLatestAiAnalysis(runId);
    const profile = buildCompanyProfile({
      companyName: context.company.canonicalName,
      domainConfidence: context.company.domainConfidence ?? 0,
      pagesFetched: run.pagesFetched + run.pagesReused,
      pagesAttempted: run.pagesAttempted,
      evidence,
      signalTypes: detected.map((item) => item.type),
      ai,
    });
    const profileId = this.researchRepository.finalize(runId, profile);
    const contacts = this.contactRepository.queue(companyId, {
      minClientScore: this.config.MIN_CONTACT_CLIENT_SCORE,
      ttlDays: this.config.CONTACT_CACHE_TTL_DAYS,
    });
    return {
      profileId,
      researchConfidence: profile.researchConfidence,
      contactIntelligenceQueued: contacts.queued,
    };
  }
  private enqueueStage(type: string, companyId: string, runId: string) {
    const run = this.researchRepository.getRun(runId);
    this.repository.enqueue(
      type,
      { companyId, researchRunId: runId },
      `research:${runId}:${type.toLowerCase()}`,
      run?.priority ?? 0,
    );
  }

  private async discoverPeople(companyId: string, runId: string) {
    this.contactRepository.setStatus(runId, "DISCOVERING_PEOPLE");
    const pages = this.contactRepository.getCurrentPages(companyId);
    const drafts = extractPeople(pages);
    const count = this.contactRepository.savePeople(runId, drafts);
    this.enqueueContactStage("RANK_DECISION_MAKERS", companyId, runId);
    return { peopleFound: count };
  }
  private async rankPeople(companyId: string, runId: string) {
    this.contactRepository.setStatus(runId, "RANKING");
    const context = this.contactRepository.getCompanyContext(companyId);
    const people = this.contactRepository.getPersonDrafts(companyId);
    const ids = new Map(
      people.map((person) => [person.normalizedName, person.id]),
    );
    const ranked = rankDecisionMakers(people, context.profile ?? {}).map(
      (person) => ({ ...person, id: ids.get(person.normalizedName)! }),
    );
    const count = this.contactRepository.saveRanking(runId, ranked);
    this.enqueueContactStage("DISCOVER_CONTACTS", companyId, runId);
    return { ranked: count, primary: ranked[0]?.fullName ?? null };
  }
  private async discoverContacts(companyId: string, runId: string) {
    this.contactRepository.setStatus(runId, "DISCOVERING_CONTACTS");
    const context = this.contactRepository.getCompanyContext(companyId);
    const domain = context.company.resolvedDomain ?? context.company.domain;
    if (!domain) throw new Error("Company domain is unresolved");
    const pages = this.contactRepository.getCurrentPages(companyId);
    const people = this.contactRepository.getPersonDrafts(companyId);
    const drafts = discoverPublicContacts(pages, people, domain);
    const count = this.contactRepository.saveContacts(runId, drafts);
    this.enqueueContactStage("DETECT_EMAIL_PATTERN", companyId, runId);
    return { contactsFound: count };
  }
  private async detectPattern(companyId: string, runId: string) {
    this.contactRepository.setStatus(runId, "DETECTING_PATTERN");
    const context = this.contactRepository.getCompanyContext(companyId);
    const domain = context.company.resolvedDomain ?? context.company.domain;
    if (!domain) throw new Error("Company domain is unresolved");
    const named = this.contactRepository.getNamedForPattern(companyId);
    const pattern = detectEmailPattern(
      named.map((item) => ({ email: item.email, person: item })),
      domain,
    );
    let inferred = 0;
    if (pattern) {
      this.contactRepository.savePattern(runId, pattern);
      const people =
        this.contactRepository.getUncontactedDecisionMakers(companyId);
      inferred = this.contactRepository.saveContacts(
        runId,
        people.map((person) =>
          inferEmail(pattern, {
            firstName: person.firstName,
            lastName: person.lastName,
            normalizedName: person.normalizedName,
          }),
        ),
      );
    }
    const contacts = this.contactRepository.getContactsForRun(runId);
    for (const contact of contacts)
      this.enqueueContactStage("VALIDATE_CONTACT", companyId, runId, {
        contactId: contact.id,
      });
    this.enqueueContactStage(
      "REFRESH_CONTACT_INTELLIGENCE",
      companyId,
      runId,
      {},
      -1,
    );
    return {
      pattern: pattern?.pattern ?? null,
      inferred,
      validationJobs: contacts.length,
    };
  }
  private async validateContact(
    companyId: string,
    runId: string,
    contactId: string,
  ) {
    this.contactRepository.setStatus(runId, "VALIDATING");
    const contact = this.contactRepository.getContact(contactId);
    if (!contact) throw new Error("Contact not found");
    const cached = this.contactRepository.getFreshValidation(contactId);
    if (cached) return { cached: true };
    const context = this.contactRepository.getCompanyContext(companyId);
    const companyDomain =
      context.company.resolvedDomain ?? context.company.domain;
    const basics = basicEmailChecks(contact.contactValue, companyDomain);
    const cachedDns = basics.domain
      ? this.contactRepository.getFreshDns(basics.domain)
      : null;
    const result = cachedDns
      ? {
          ...basics,
          dnsStatus: cachedDns.dnsStatus,
          mxStatus: cachedDns.mxStatus,
          mxHosts: cachedDns.mxHosts,
        }
      : await this.contactValidator(contact.contactValue, companyDomain);
    if (!cachedDns && basics.domain)
      this.contactRepository.saveDns(
        basics.domain,
        result,
        this.config.DNS_CACHE_TTL_DAYS,
      );
    const pattern = this.contactRepository.getLatestPattern(companyId);
    const confidence = contactConfidence({
      status: contact.status as Parameters<
        typeof contactConfidence
      >[0]["status"],
      sourceOfficial: contact.status !== "PATTERN_INFERRED",
      domainMatches: result.domainMatches,
      syntaxValid: result.syntaxValid,
      disposable: result.disposable,
      dnsStatus: result.dnsStatus,
      mxStatus: result.mxStatus,
      personConfidence: contact.personId ? 1 : null,
      patternConfidence:
        contact.status === "PATTERN_INFERRED"
          ? (pattern?.confidence ?? null)
          : null,
    });
    this.contactRepository.saveValidation(
      contactId,
      result,
      this.config.DNS_CACHE_TTL_DAYS,
      confidence,
    );
    return result;
  }
  private async analyzeAcademicOpportunity(
    opportunityId: string,
    force: boolean,
  ) {
    const aiInput = this.academicRepository.getOpportunityAiContext(
      opportunityId,
      this.config.AI_MAX_RESEARCH_ITEMS_PER_RUN,
    );
    return this.runAcademicAi({
      task: "ACADEMIC_OPPORTUNITY_ANALYSIS",
      entityType: "ACADEMIC_OPPORTUNITY",
      entityId: opportunityId,
      promptVersion: "academic-opportunity-v1",
      aiInput,
      schema: academicOpportunityAnalysisSchema,
      schemaName: "academic_opportunity_analysis",
      force,
      system:
        "Analyze a graduate or research opportunity using only supplied applicant data and evidence. Every factual university, program, eligibility, funding, or professor statement must cite evidenceIds. Use UNKNOWN for missing facts and HYPOTHESIS for proposed research ideas. Never claim admission probability.",
      onComplete: () => this.academicRepository.recordSearchAnalysisCompleted(opportunityId),
    });
  }
  private async analyzeProfessor(professorCaseId: string, force: boolean) {
    const aiInput = this.academicRepository.getProfessorAiContext(
      professorCaseId,
      this.config.AI_MAX_RESEARCH_ITEMS_PER_RUN,
    );
    return this.runAcademicAi({
      task: "PROFESSOR_ANALYSIS",
      entityType: "PROFESSOR_CASE",
      entityId: professorCaseId,
      promptVersion: "professor-analysis-v1",
      aiInput,
      schema: professorAnalysisSchema,
      schemaName: "professor_analysis",
      force,
      system:
        "Analyze this professor case using only the supplied applicant profile and verified evidence. Cite evidenceIds for every factual professor, work, recruiting, or funding claim. Proposed directions must be HYPOTHESIS. Use UNKNOWN when evidence is insufficient. Do not fabricate publications, grants, positions, or interests.",
      onComplete: (analysis) =>
        this.academicRepository.applyProfessorAnalysis(
          professorCaseId,
          analysis,
        ),
    });
  }
  private async generateAcademicOutreach(
    professorCaseId: string,
    force: boolean,
  ) {
    const context = this.academicRepository.getProfessorAiContext(
      professorCaseId,
      this.config.AI_MAX_RESEARCH_ITEMS_PER_RUN,
    );
    const analyses = this.academicRepository
      .listAcademicAiRuns("PROFESSOR_CASE", professorCaseId)
      .filter((item) => item.status === "COMPLETED")
      .slice(0, 2);
    const aiInput = { ...context, analyses };
    const result = await this.runAcademicAi({
      task: "ACADEMIC_OUTREACH_DRAFT",
      entityType: "PROFESSOR_CASE",
      entityId: professorCaseId,
      promptVersion: "academic-outreach-v1",
      aiInput,
      schema: academicEmailDraftSchema,
      schemaName: "academic_email_draft",
      force,
      system:
        "Create a draft only: exactly 3 subject options, a concise professional professor email, and optional follow-up. Use the professor's real name. Mention only verified research and cite its evidence IDs. Connect Abdul's background naturally and mention his manuscript only when relevant. Avoid exaggerated praise or fabricated familiarity. Never claim recruiting or funding unless supported. Do not send anything.",
      onComplete: () => undefined,
    });
    if (result.output) {
      const draft = academicEmailDraftSchema.parse(result.output);
      return {
        ...result,
        draft: this.academicRepository.saveGeneratedAcademicDraft(
          professorCaseId,
          contentHash(aiInput),
          draft,
        ),
      };
    }
    return result;
  }
  private async runAcademicAi<T>(options: {
    task: string;
    entityType: string;
    entityId: string;
    promptVersion: string;
    aiInput: unknown;
    schema: ZodType<T>;
    schemaName: string;
    force: boolean;
    system: string;
    onComplete: (output: T) => void;
  }) {
    if (!options.force) {
      const cached = this.academicRepository.findCachedAcademicAi(
        options.task,
        options.aiInput,
        this.config.AI_CACHE_TTL_DAYS,
      );
      if (cached) {
        const output = options.schema.parse(cached.output);
        options.onComplete(output);
        return {
          cached: true,
          output,
          provider: cached.provider,
          model: cached.model,
        };
      }
    }
    if (
      this.academicRepository.aiRequestsToday() >=
      this.config.AI_MAX_DAILY_REQUESTS
    )
      return { deterministic: true, reason: "AI_DAILY_LIMIT_REACHED" };
    const health = await this.aiProvider.healthCheck();
    if (health.status !== "available") {
      this.academicRepository.saveAcademicAiRun({
        entityType: options.entityType,
        entityId: options.entityId,
        task: options.task,
        provider: health.provider,
        model: health.model,
        promptVersion: options.promptVersion,
        aiInput: options.aiInput,
        status: "SKIPPED",
        latencyMs: 0,
        error: health.detail ?? health.status,
        ttlDays: this.config.AI_CACHE_TTL_DAYS,
      });
      return { deterministic: true, reason: "AI_UNAVAILABLE" };
    }
    const started = Date.now();
    try {
      const generated = await this.aiProvider.generateStructured({
        system: options.system,
        prompt: JSON.stringify(options.aiInput),
        schema: options.schema,
        schemaName: options.schemaName,
        temperature: 0.1,
      });
      const output = groundAcademicOutput(
        generated.data,
        collectEvidenceIds(options.aiInput),
      );
      this.academicRepository.saveAcademicAiRun({
        entityType: options.entityType,
        entityId: options.entityId,
        task: options.task,
        provider: generated.provider,
        model: generated.model,
        promptVersion: options.promptVersion,
        aiInput: options.aiInput,
        output,
        status: "COMPLETED",
        latencyMs: generated.latencyMs,
        promptTokens: generated.promptTokens,
        completionTokens: generated.completionTokens,
        ttlDays: this.config.AI_CACHE_TTL_DAYS,
      });
      options.onComplete(output);
      return {
        cached: false,
        output,
        provider: generated.provider,
        model: generated.model,
      };
    } catch (error) {
      this.academicRepository.saveAcademicAiRun({
        entityType: options.entityType,
        entityId: options.entityId,
        task: options.task,
        provider: this.aiProvider.name,
        model: this.aiProvider.modelInfo().model,
        promptVersion: options.promptVersion,
        aiInput: options.aiInput,
        status: "FAILED",
        latencyMs: Date.now() - started,
        error,
        ttlDays: this.config.AI_CACHE_TTL_DAYS,
      });
      return { deterministic: true, reason: "AI_FAILED" };
    }
  }
  private async finalizeContacts(_companyId: string, runId: string) {
    const summary = this.contactRepository.validationJobSummary(runId);
    if ((summary.remaining ?? 0) > 0)
      throw new Error("Contact validations still pending");
    const status = (summary.failed ?? 0) > 0 ? "PARTIAL" : "COMPLETE";
    this.contactRepository.finalize(runId, status);
    return { status };
  }
  private enqueueContactStage(
    type: string,
    companyId: string,
    runId: string,
    extra: Record<string, unknown> = {},
    priorityOffset = 0,
  ) {
    const run = this.contactRepository.getRun(runId);
    this.repository.enqueue(
      type,
      { companyId, contactResearchRunId: runId, ...extra },
      `contacts:${runId}:${type.toLowerCase()}:${String(extra.contactId ?? "stage")}`,
      (run?.priority ?? 0) + priorityOffset,
    );
  }
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}
function groundAnalysis<
  T extends {
    possiblePainPoints: Array<{
      classification: string;
      evidenceIds: string[];
    }>;
    recommendedServices: Array<{
      classification: string;
      evidenceIds: string[];
    }>;
    signals: Array<{ classification: string; evidenceIds: string[] }>;
    risks: Array<{ classification: string; evidenceIds: string[] }>;
  },
>(analysis: T, validIds: Set<string>): T {
  for (const collection of [
    analysis.possiblePainPoints,
    analysis.recommendedServices,
    analysis.signals,
    analysis.risks,
  ])
    for (const item of collection) {
      item.evidenceIds = item.evidenceIds.filter((id) => validIds.has(id));
      if (item.classification === "FACT" && item.evidenceIds.length === 0)
        item.classification = "HYPOTHESIS";
    }
  return analysis;
}
function collectEvidenceIds(value: unknown) {
  const ids = new Set<string>();
  const visit = (item: unknown) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id === "string" &&
      typeof row.sourceUrl === "string" &&
      typeof row.claim === "string"
    )
      ids.add(row.id);
    Object.values(row).forEach(visit);
  };
  visit(value);
  return ids;
}
function isAcceptableAcademicSource(value: string) {
  const host = new URL(value).hostname.toLowerCase();
  return ![
    "medium.com",
    "linkedin.com",
    "facebook.com",
    "reddit.com",
    "scholarshiproar.com",
    "findaphd.com",
    "mastersportal.com",
    "phdportal.com",
  ].some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}
function classifyFundingFromPage(text: string) {
  const value = text.toLowerCase();
  if (/fully[- ]funded|full financial support/.test(value))
    return "CONFIRMED_FULL_FUNDING";
  const tuition =
    /(full tuition|tuition (?:is )?(?:covered|waived)|tuition waiver|no tuition fee)/.test(
      value,
    );
  const living =
    /(monthly|annual)?\s*(stipend|salary)|living allowance|funded position|research assistantship|teaching assistantship/.test(
      value,
    );
  if (tuition && living) return "CONFIRMED_FULL_FUNDING";
  if (tuition) return "TUITION_FREE_FUNDING_REQUIRED";
  if (living) return "POTENTIAL_FUNDING_UNCONFIRMED";
  return "UNKNOWN";
}
function relevantExcerpt(text: string, needle: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  const token = needle
    .split(/\W+/)
    .find((value) => value.length > 5)
    ?.toLowerCase();
  const index = token ? compact.toLowerCase().indexOf(token) : -1;
  return compact.slice(
    Math.max(0, index < 0 ? 0 : index - 220),
    Math.min(compact.length, (index < 0 ? 0 : index - 220) + 900),
  );
}

function fallbackAcademicCandidates(countries:string[]){const all=countries.includes("All Countries")||countries.length===0;return[
  {universityName:"Stanford University",country:"United States",programTitle:"Computer Science PhD",degreeLevel:"PHD" as const,officialUrl:"https://www.cs.stanford.edu/phd-program-overview/funding"},
  {universityName:"Massachusetts Institute of Technology",country:"United States",programTitle:"EECS PhD",degreeLevel:"PHD" as const,officialUrl:"https://www.eecs.mit.edu/academics/graduate-programs/admission-process/graduate-admissions-faqs/"},
  {universityName:"Max Planck Graduate Center for Computer and Information Science",country:"Germany",programTitle:"CS@max planck Doctoral Program",degreeLevel:"PHD" as const,officialUrl:"https://www.cis.mpg.de/csmaxplanck-overview/"},
  {universityName:"Technical University of Munich",country:"Germany",programTitle:"PhD in Visual Computing and Artificial Intelligence",degreeLevel:"PHD" as const,officialUrl:"https://application.vc.in.tum.de/"},
  {universityName:"Technical University of Munich",country:"Germany",programTitle:"Computer Vision and Artificial Intelligence PhD Positions",degreeLevel:"PHD" as const,officialUrl:"https://cvai.cit.tum.de/jobs/advert"},
  {universityName:"Technical University of Munich",country:"Germany",programTitle:"Doctoral Research Associate in Software Engineering and AI",degreeLevel:"PHD" as const,officialUrl:"https://www.cs.cit.tum.de/en/seai/open-positions/"},
].filter(candidate=>all||countries.includes(candidate.country));}
function groundAcademicOutput<T>(output: T, validIds: Set<string>): T {
  const visit = (item: unknown) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    if (Array.isArray(row.evidenceIds)) {
      const grounded = row.evidenceIds.filter(
        (id) => typeof id === "string" && validIds.has(id),
      );
      row.evidenceIds = grounded;
      if (row.classification === "FACT" && grounded.length === 0)
        row.classification = "UNKNOWN";
    }
    if (Array.isArray(row.summaryEvidenceIds))
      row.summaryEvidenceIds = row.summaryEvidenceIds.filter(
        (id) => typeof id === "string" && validIds.has(id),
      );
    Object.values(row).forEach(visit);
  };
  visit(output);
  return output;
}
