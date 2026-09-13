import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { CrawlResult } from '@gtm/crawler';
import type { CompanyAnalysis } from '@gtm/ai';
import type { DomainResolution, EvidenceDraft, ProfileDraft } from '@gtm/research';
import type { DetectedSignal } from '@gtm/signals';
import { enrichClientScore, enrichJobScore, recommendedAction, type ScoreResult } from '@gtm/scoring';
import { contentHash } from '@gtm/shared';
import type { DatabaseConnection } from './client.js';
import { activities, aiRuns, clientOpportunities, clientScores, companies, companyPages, companyPageVersions, companyProfiles, companyResearchRuns, domainResolutions, evidence, evidenceSignals, jobOpportunities, jobs, jobScores, researchRunPages, signals, workerJobs } from './schema.js';

const activeResearchStates = ['QUEUED','RESOLVING_DOMAIN','CRAWLING','EXTRACTING','AI_ANALYSIS','SCORING'];

export class ResearchRepository {
  constructor(private readonly connection: DatabaseConnection) {}
  private get db() { return this.connection.db; }

  queueResearch(companyId: string, options: { force?: boolean; manual?: boolean; minJobScore?: number; minClientScore?: number } = {}) {
    const company = this.db.select().from(companies).where(eq(companies.id, companyId)).get(); if (!company) throw new Error('Company not found');
    const scores = this.connection.sqlite.prepare(`SELECT MAX(jo.current_score) jobScore, MAX(co.current_score) clientScore FROM jobs j LEFT JOIN job_opportunities jo ON jo.job_id=j.id LEFT JOIN client_opportunities co ON co.company_id=j.company_id WHERE j.company_id=?`).get(companyId) as { jobScore: number | null; clientScore: number | null };
    const eligible = options.manual || (scores.jobScore ?? 0) >= (options.minJobScore ?? 65) || (scores.clientScore ?? 0) >= (options.minClientScore ?? 60);
    if (!eligible) return { queued: false, reason: 'NOT_ELIGIBLE' as const, runId: null };
    if (!options.force && company.nextResearchAfter && company.nextResearchAfter > iso()) return { queued: false, reason: 'FRESH' as const, runId: null };
    const active = this.db.select().from(companyResearchRuns).where(and(eq(companyResearchRuns.companyId, companyId), inArray(companyResearchRuns.status, activeResearchStates))).get();
    if (active) return { queued: false, reason: 'ALREADY_QUEUED' as const, runId: active.id };
    const priority = options.manual ? 100 : Math.max(scores.jobScore ?? 0, scores.clientScore ?? 0); const now = iso(); const runId = randomUUID();
    this.db.transaction((tx) => {
      tx.insert(companyResearchRuns).values({ id: runId, companyId, status: 'QUEUED', trigger: options.manual ? 'MANUAL' : 'ELIGIBILITY', priority, forceRefresh: options.force ?? false, createdAt: now, updatedAt: now }).run();
      tx.update(companies).set({ researchStatus: 'QUEUED', updatedAt: now }).where(eq(companies.id, companyId)).run();
      tx.insert(workerJobs).values({ id: randomUUID(), type: 'RESOLVE_COMPANY_DOMAIN', payloadJson: JSON.stringify({ companyId, researchRunId: runId }), status: 'PENDING', priority, maxAttempts: 3, attempts: 0, runAfter: now, idempotencyKey: `research:${runId}:resolve`, createdAt: now }).run();
      tx.insert(activities).values({ id: randomUUID(), entityType: 'COMPANY', entityId: companyId, type: 'RESEARCH_QUEUED', toStatus: 'QUEUED', actor: options.manual ? 'USER' : 'SYSTEM', metadataJson: JSON.stringify({ researchRunId: runId, priority }), occurredAt: now, createdAt: now }).run();
    });
    return { queued: true, reason: null, runId };
  }

  queueEligible(options: { minJobScore: number; minClientScore: number }) {
    const rows = this.connection.sqlite.prepare(`SELECT DISTINCT c.id FROM companies c JOIN jobs j ON j.company_id=c.id LEFT JOIN job_opportunities jo ON jo.job_id=j.id LEFT JOIN client_opportunities co ON co.company_id=c.id WHERE jo.current_score>=? OR co.current_score>=?`).all(options.minJobScore, options.minClientScore) as Array<{ id: string }>;
    return rows.map((row) => this.queueResearch(row.id, options)).filter((item) => item.queued).length;
  }

  getRun(runId: string) { return this.db.select().from(companyResearchRuns).where(eq(companyResearchRuns.id, runId)).get() ?? null; }
  setRunStatus(runId: string, status: string, patch: Partial<typeof companyResearchRuns.$inferInsert> = {}) {
    const run = this.getRun(runId); if (!run) throw new Error('Research run not found'); const now = iso();
    this.db.transaction((tx) => { tx.update(companyResearchRuns).set({ status, updatedAt: now, ...(status === 'RESOLVING_DOMAIN' && !run.startedAt ? { startedAt: now } : {}), ...patch }).where(eq(companyResearchRuns.id, runId)).run(); tx.update(companies).set({ researchStatus: status, updatedAt: now }).where(eq(companies.id, run.companyId)).run(); tx.insert(activities).values({ id: randomUUID(), entityType: 'COMPANY', entityId: run.companyId, type: 'RESEARCH_STATUS_CHANGED', fromStatus: run.status, toStatus: status, metadataJson: JSON.stringify({ researchRunId: runId }), occurredAt: now, createdAt: now }).run(); });
  }
  failRun(runId: string, error: unknown) { const run = this.getRun(runId); const partial = Boolean(run?.deterministicComplete); this.setRunStatus(runId, partial ? 'PARTIAL' : 'FAILED', { completedAt: iso(), errorJson: JSON.stringify(serializeError(error)) }); }

  getResearchContext(companyId: string) {
    const company = this.db.select().from(companies).where(eq(companies.id, companyId)).get(); if (!company) throw new Error('Company not found');
    const jobRows = this.db.select().from(jobs).where(eq(jobs.companyId, companyId)).all();
    const jobSourceRows = this.connection.sqlite.prepare(`SELECT j.id jobId,js.source_url sourceUrl FROM jobs j JOIN job_sources js ON js.job_id=j.id WHERE j.company_id=? AND js.id=(SELECT x.id FROM job_sources x WHERE x.job_id=j.id ORDER BY x.last_seen_at DESC,x.id DESC LIMIT 1)`).all(companyId) as Array<{ jobId: string; sourceUrl: string }>;
    const jobUrls = new Map(jobSourceRows.map((row) => [row.jobId, row.sourceUrl]));
    const descriptions = jobRows.flatMap((job) => extractUrls(job.description));
    const sourceRows = this.connection.sqlite.prepare(`SELECT cs.raw_data_json rawData, cs.source_url sourceUrl FROM company_sources cs WHERE cs.company_id=?`).all(companyId) as Array<{ rawData: string | null; sourceUrl: string | null }>;
    const sourceDomains = sourceRows.flatMap((row) => { try { const raw = JSON.parse(row.rawData ?? '{}') as Record<string, unknown>; return [raw.companyDomain, raw.website, raw.companyUrl].filter((item): item is string => typeof item === 'string'); } catch { return []; } });
    return { company, jobs: jobRows, jobUrls, descriptionUrls: descriptions, sourceDomains };
  }

  saveDomainResolution(runId: string, resolution: DomainResolution) {
    const run = this.getRun(runId); if (!run) throw new Error('Research run not found'); const now = iso();
    const existing = this.db.select().from(domainResolutions).where(and(eq(domainResolutions.researchRunId, runId), eq(domainResolutions.method, resolution.method))).get(); if (existing?.candidateDomain === resolution.domain && existing.accepted === resolution.accepted) return;
    this.db.transaction((tx) => { tx.insert(domainResolutions).values({ id: randomUUID(), companyId: run.companyId, researchRunId: runId, candidateDomain: resolution.domain, method: resolution.method, confidence: resolution.confidence, evidenceUrl: resolution.evidenceUrl, accepted: resolution.accepted, resolvedAt: now, createdAt: now }).run(); if (resolution.accepted) tx.update(companies).set({ resolvedDomain: resolution.domain, domainResolutionMethod: resolution.method, domainConfidence: resolution.confidence, domainResolvedAt: now, updatedAt: now }).where(eq(companies.id, run.companyId)).run(); });
  }

  saveCrawlResults(runId: string, results: CrawlResult[], ttlDays: number) {
    const run = this.getRun(runId); if (!run) throw new Error('Research run not found'); const now = iso(); let fetched = 0; let reused = 0;
    this.db.transaction((tx) => { for (const result of results) {
      const canonicalUrl = result.page?.canonicalUrl ?? result.url; let page = tx.select().from(companyPages).where(and(eq(companyPages.companyId, run.companyId), eq(companyPages.canonicalUrl, canonicalUrl))).get();
      if (!page) { const pageId = randomUUID(); tx.insert(companyPages).values({ id: pageId, companyId: run.companyId, url: result.url, canonicalUrl, pageType: result.page?.pageType ?? 'OTHER', firstFetchedAt: now, lastFetchedAt: now, expiresAt: addDays(now, ttlDays), createdAt: now, updatedAt: now }).run(); page = tx.select().from(companyPages).where(eq(companyPages.id, pageId)).get()!; }
      const priorVersion = result.contentHash ? tx.select().from(companyPageVersions).where(and(eq(companyPageVersions.pageId, page.id), eq(companyPageVersions.contentHash, result.contentHash))).get() : undefined;
      let versionId = priorVersion?.id ?? null; const outcome = result.error ? 'FAILED' : priorVersion ? 'REUSED' : 'FETCHED';
      if (!priorVersion) { versionId = randomUUID(); tx.insert(companyPageVersions).values({ id: versionId, pageId: page.id, httpStatus: result.httpStatus, contentType: result.contentType, title: result.page?.title, metaDescription: result.page?.metaDescription, textContent: result.page?.textContent, headingsJson: JSON.stringify(result.page?.headings ?? []), linksJson: JSON.stringify(result.page?.links ?? []), emailsJson: JSON.stringify(result.page?.emails ?? []), socialUrlsJson: JSON.stringify(result.page?.socialUrls ?? []), structuredDataJson: JSON.stringify(result.page?.structuredData ?? []), contentHash: result.contentHash, fetchedAt: now, fetchDurationMs: result.fetchDurationMs, errorJson: result.error ? JSON.stringify({ message: result.error }) : null, createdAt: now }).run(); fetched += result.error ? 0 : 1; } else reused += 1;
      tx.update(companyPages).set({ currentVersionId: versionId, lastFetchedAt: now, expiresAt: addDays(now, ttlDays), updatedAt: now }).where(eq(companyPages.id, page.id)).run();
      tx.insert(researchRunPages).values({ id: randomUUID(), researchRunId: runId, pageId: page.id, pageVersionId: versionId, outcome, relevanceScore: result.relevanceScore, createdAt: now }).onConflictDoNothing().run();
    } tx.update(companyResearchRuns).set({ pagesAttempted: results.length, pagesFetched: fetched, pagesReused: reused, updatedAt: now }).where(eq(companyResearchRuns.id, runId)).run(); });
    return { fetched, reused, attempted: results.length };
  }

  getRunPages(runId: string) {
    const rows = this.connection.sqlite.prepare(`SELECT p.id pageId,p.url,p.page_type pageType,v.title,v.meta_description metaDescription,v.text_content textContent,v.headings_json headingsJson,v.links_json linksJson,v.emails_json emailsJson,v.social_urls_json socialUrlsJson,v.structured_data_json structuredDataJson FROM research_run_pages rp JOIN company_pages p ON p.id=rp.page_id JOIN company_page_versions v ON v.id=rp.page_version_id WHERE rp.research_run_id=? AND v.error_json IS NULL`).all(runId) as Record<string, unknown>[];
    return rows.map((row) => ({ pageId: String(row.pageId), url: String(row.url), canonicalUrl: String(row.url), pageType: String(row.pageType), title: row.title ? String(row.title) : null, metaDescription: row.metaDescription ? String(row.metaDescription) : null, textContent: String(row.textContent ?? ''), headings: parseArray(row.headingsJson), links: parseArray(row.linksJson), emails: parseArray(row.emailsJson), socialUrls: parseArray(row.socialUrlsJson), structuredData: parseArray(row.structuredDataJson) }));
  }

  saveEvidence(runId: string, drafts: Array<EvidenceDraft & { pageId?: string | null }>) {
    const run = this.getRun(runId); if (!run) throw new Error('Research run not found'); const now = iso(); const ids = new Map<string, string>();
    this.db.transaction((tx) => { for (const item of drafts) { const id = randomUUID(); tx.insert(evidence).values({ id, companyId: run.companyId, researchRunId: runId, pageId: item.pageId ?? null, type: item.type, classification: item.classification, claim: item.claim, evidenceText: item.evidenceText, sourceUrl: item.sourceUrl, sourceQuality: item.sourceQuality, confidence: item.confidence, extractor: item.extractor, contentHash: item.contentHash, createdAt: now }).onConflictDoNothing().run(); const stored = tx.select().from(evidence).where(and(eq(evidence.researchRunId, runId), eq(evidence.contentHash, item.contentHash))).get(); if (stored) ids.set(item.contentHash, stored.id); } tx.update(companyResearchRuns).set({ evidenceCount: ids.size, updatedAt: now }).where(eq(companyResearchRuns.id, runId)).run(); }); return ids;
  }
  getEvidence(runId: string) { return this.db.select().from(evidence).where(eq(evidence.researchRunId, runId)).orderBy(desc(evidence.confidence)).all(); }
  saveSignals(runId: string, detected: DetectedSignal[]) {
    const run = this.getRun(runId); if (!run) throw new Error('Research run not found'); const rows = this.getEvidence(runId); const byHash = new Map(rows.map((row) => [row.contentHash, row])); const now = iso();
    const existing = this.getSignalsForRun(runId); if (existing.length) return;
    this.db.transaction((tx) => { for (const item of detected) { const source = byHash.get(item.evidenceHash); if (!source) continue; const id = randomUUID(); tx.insert(signals).values({ id, companyId: run.companyId, type: item.type, claim: item.claim, severity: item.severity, weight: item.weight, sourceQuality: item.sourceQuality, confidence: item.confidence, observedAt: now, detectedAt: now, createdAt: now }).run(); tx.insert(evidenceSignals).values({ id: randomUUID(), signalId: id, evidenceId: source.id, createdAt: now }).run(); } tx.update(companyResearchRuns).set({ signalCount: detected.length, deterministicComplete: true, updatedAt: now }).where(eq(companyResearchRuns.id, runId)).run(); });
  }
  getSignalsForRun(runId: string) { return this.connection.sqlite.prepare(`SELECT s.* FROM signals s JOIN evidence_signals es ON es.signal_id=s.id JOIN evidence e ON e.id=es.evidence_id WHERE e.research_run_id=? ORDER BY s.weight*s.confidence DESC`).all(runId) as Array<{ id: string; type: string; weight: number; confidence: number; claim: string }> ; }

  saveAiRun(input: { runId: string; task: string; provider: string; model: string; promptVersion: string; input: unknown; output?: unknown; status: string; latencyMs: number; promptTokens?: number | null; completionTokens?: number | null; error?: unknown }) {
    const run = this.getRun(input.runId); if (!run) throw new Error('Research run not found'); const serialized = JSON.stringify(input.input);
    this.db.insert(aiRuns).values({ id: randomUUID(), companyId: run.companyId, researchRunId: input.runId, task: input.task, provider: input.provider, model: input.model, promptVersion: input.promptVersion, inputHash: contentHash(input.input), inputJson: serialized, outputJson: input.output ? JSON.stringify(input.output) : null, status: input.status, latencyMs: input.latencyMs, promptTokens: input.promptTokens, completionTokens: input.completionTokens, errorJson: input.error ? JSON.stringify(serializeError(input.error)) : null, createdAt: iso() }).run();
  }
  getLatestAiAnalysis(runId: string): CompanyAnalysis | null {
    const row = this.db.select().from(aiRuns).where(and(eq(aiRuns.researchRunId, runId), eq(aiRuns.status, 'COMPLETED'))).orderBy(desc(aiRuns.createdAt)).get();
    return row?.outputJson ? JSON.parse(row.outputJson) as CompanyAnalysis : null;
  }
  findCachedAiAnalysis(task: string, input: unknown): { output: CompanyAnalysis; provider: string; model: string } | null {
    const row = this.db.select().from(aiRuns).where(and(eq(aiRuns.task, task), eq(aiRuns.inputHash, contentHash(input)), eq(aiRuns.status, 'COMPLETED'))).orderBy(desc(aiRuns.createdAt)).get();
    return row?.outputJson ? { output: JSON.parse(row.outputJson) as CompanyAnalysis, provider: row.provider, model: row.model } : null;
  }

  finalize(runId: string, profile: ProfileDraft) {
    const run = this.getRun(runId); if (!run) throw new Error('Research run not found'); const now = iso(); const profileId = randomUUID(); const detected = this.getSignalsForRun(runId);
    const existing = this.db.select().from(companyProfiles).where(eq(companyProfiles.researchRunId, runId)).get(); if (existing) return existing.id;
    this.db.transaction((tx) => {
      tx.insert(companyProfiles).values({ id: profileId, companyId: run.companyId, researchRunId: runId, summary: profile.summary, industry: profile.industry, businessModel: profile.businessModel, stage: profile.stage, locationsJson: JSON.stringify(profile.locations), productsJson: JSON.stringify(profile.products), servicesJson: JSON.stringify(profile.services), customerTypesJson: JSON.stringify(profile.customerTypes), technicalFocusJson: JSON.stringify(profile.technicalFocus), growthSignalsJson: JSON.stringify(profile.growthSignals), hiringSignalsJson: JSON.stringify(profile.hiringSignals), aiRelevance: profile.aiRelevance, engineeringNeed: profile.engineeringNeed, contactability: profile.contactability, researchConfidence: profile.researchConfidence, whatIsHappening: profile.whatIsHappening, whyItMatters: profile.whyItMatters, whyMatch: profile.whyMatch, recommendedNextStep: profile.recommendedNextStep, aiAnalysisJson: profile.aiAnalysis ? JSON.stringify(profile.aiAnalysis) : null, createdAt: now }).run();
      const jobRows = tx.select().from(jobs).where(eq(jobs.companyId, run.companyId)).all();
      for (const job of jobRows) {
        const jobOpp = tx.select().from(jobOpportunities).where(eq(jobOpportunities.jobId, job.id)).get(); const clientOpp = tx.select().from(clientOpportunities).where(and(eq(clientOpportunities.companyId, run.companyId), eq(clientOpportunities.triggerJobId, job.id))).get(); if (!jobOpp || !clientOpp) continue;
        const latestJobScore = tx.select().from(jobScores).where(eq(jobScores.opportunityId, jobOpp.id)).orderBy(desc(jobScores.createdAt)).get(); const latestClientScore = tx.select().from(clientScores).where(eq(clientScores.opportunityId, clientOpp.id)).orderBy(desc(clientScores.createdAt)).get(); if (!latestJobScore || !latestClientScore) continue;
        const enrichment = { signals: detected, researchConfidence: profile.researchConfidence, aiRelevance: profile.aiRelevance, engineeringNeed: profile.engineeringNeed, contactability: profile.contactability };
        const newJob = enrichJobScore({ ...enrichment, prior: scoreRow(latestJobScore) }); const newClient = enrichClientScore({ ...enrichment, prior: scoreRow(latestClientScore) }); const action = recommendedAction(newClient.total, newJob.total);
        tx.insert(jobScores).values({ id: randomUUID(), opportunityId: jobOpp.id, total: newJob.total, componentsJson: JSON.stringify(newJob.components), reasonsJson: JSON.stringify(newJob.reasons), modelVersion: newJob.version, createdAt: now }).run();
        tx.insert(clientScores).values({ id: randomUUID(), opportunityId: clientOpp.id, total: newClient.total, componentsJson: JSON.stringify(newClient.components), reasonsJson: JSON.stringify(newClient.reasons), modelVersion: newClient.version, createdAt: now }).run();
        tx.update(jobOpportunities).set({ currentScore: newJob.total, recommendedAction: action, updatedAt: now }).where(eq(jobOpportunities.id, jobOpp.id)).run(); tx.update(clientOpportunities).set({ currentScore: newClient.total, recommendedAction: action, updatedAt: now }).where(eq(clientOpportunities.id, clientOpp.id)).run();
      }
      tx.update(companies).set({ currentProfileId: profileId, researchStatus: 'COMPLETE', lastResearchedAt: now, nextResearchAfter: addDays(now, 14), description: profile.summary, industry: profile.industry, updatedAt: now }).where(eq(companies.id, run.companyId)).run();
      tx.update(companyResearchRuns).set({ status: 'COMPLETE', completedAt: now, researchConfidence: profile.researchConfidence, aiStatus: profile.aiAnalysis ? 'COMPLETED' : run.aiStatus, updatedAt: now }).where(eq(companyResearchRuns.id, runId)).run();
      tx.insert(activities).values({ id: randomUUID(), entityType: 'COMPANY', entityId: run.companyId, type: 'RESEARCH_COMPLETED', fromStatus: 'SCORING', toStatus: 'COMPLETE', metadataJson: JSON.stringify({ researchRunId: runId, profileId, researchConfidence: profile.researchConfidence }), occurredAt: now, createdAt: now }).run();
    }); return profileId;
  }

  getCompanyIntelligence(companyId: string) {
    const company = this.db.select().from(companies).where(eq(companies.id, companyId)).get(); if (!company) return null;
    const profile = company.currentProfileId ? this.db.select().from(companyProfiles).where(eq(companyProfiles.id, company.currentProfileId)).get() : null;
    const runs = this.db.select().from(companyResearchRuns).where(eq(companyResearchRuns.companyId, companyId)).orderBy(desc(companyResearchRuns.createdAt)).all();
    const pages = this.connection.sqlite.prepare(`SELECT p.*,v.title,v.http_status httpStatus,v.content_type contentType,v.fetched_at fetchedAt,v.error_json errorJson FROM company_pages p LEFT JOIN company_page_versions v ON v.id=p.current_version_id WHERE p.company_id=? ORDER BY p.last_fetched_at DESC`).all(companyId);
    const evidenceRows = this.db.select().from(evidence).where(eq(evidence.companyId, companyId)).orderBy(desc(evidence.createdAt), desc(evidence.confidence)).limit(100).all();
    const signalRows = this.db.select().from(signals).where(eq(signals.companyId, companyId)).orderBy(desc(signals.createdAt)).limit(100).all();
    const jobRows = this.db.select().from(jobs).where(eq(jobs.companyId, companyId)).orderBy(desc(jobs.postedAt)).all();
    const activityRows = this.db.select().from(activities).where(and(eq(activities.entityType, 'COMPANY'), eq(activities.entityId, companyId))).orderBy(desc(activities.occurredAt)).limit(100).all();
    const scoreHistory = this.connection.sqlite.prepare(`SELECT 'CLIENT' funnel,cs.total,cs.components_json components,cs.reasons_json reasons,cs.model_version version,cs.created_at createdAt FROM client_scores cs JOIN client_opportunities co ON co.id=cs.opportunity_id WHERE co.company_id=? UNION ALL SELECT 'JOB',js.total,js.components_json,js.reasons_json,js.model_version,js.created_at FROM job_scores js JOIN job_opportunities jo ON jo.id=js.opportunity_id JOIN jobs j ON j.id=jo.job_id WHERE j.company_id=? ORDER BY createdAt DESC`).all(companyId, companyId) as Record<string, unknown>[];
    return { company, profile: profile ? parseProfile(profile) : null, runs, pages, evidence: evidenceRows, signals: signalRows, jobs: jobRows, activities: activityRows, scoreHistory: scoreHistory.map((row) => ({ ...row, components: JSON.parse(String(row.components)), reasons: JSON.parse(String(row.reasons)) })) };
  }
}

function scoreRow(row: { total: number; componentsJson: string; reasonsJson: string; modelVersion: string }): ScoreResult { return { total: row.total, components: JSON.parse(row.componentsJson), reasons: JSON.parse(row.reasonsJson), matchedKeywords: [], version: row.modelVersion }; }
function parseProfile(row: typeof companyProfiles.$inferSelect) { return { ...row, locations: parseArray(row.locationsJson), products: parseArray(row.productsJson), services: parseArray(row.servicesJson), customerTypes: parseArray(row.customerTypesJson), technicalFocus: parseArray(row.technicalFocusJson), growthSignals: parseArray(row.growthSignalsJson), hiringSignals: parseArray(row.hiringSignalsJson), aiAnalysis: row.aiAnalysisJson ? JSON.parse(row.aiAnalysisJson) : null }; }
function parseArray(value: unknown): any[] { try { return JSON.parse(String(value ?? '[]')) as any[]; } catch { return []; } }
function extractUrls(text: string) { return text.match(/https?:\/\/[^\s<>)"']+/gi) ?? []; }
function addDays(value: string, days: number) { return new Date(new Date(value).getTime() + days * 86_400_000).toISOString(); }
function iso() { return new Date().toISOString(); }
function serializeError(error: unknown) { return error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) }; }
