import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError, z } from 'zod';
import { createAIProvider, getAIHealthReport, OllamaProvider, type AIProvider } from '@gtm/ai';
import { AcademicRepository, ContactRepository, createDatabase, FinalRepository, GtmRepository, OperationsRepository, ResearchRepository, type DatabaseConnection } from '@gtm/db';
import { ImapInboxProvider, SMTPProvider } from '@gtm/email';
import { loadConfig, manualImportSchema, sourceKindSchema, sourceRunRequestSchema } from '@gtm/shared';
import { normalizeManual, parseCsvImport } from '@gtm/sources';
import { registerAcademicRoutes } from './academic-routes.js';

const createSourceSchema = z.object({
  kind: sourceKindSchema, name: z.string().min(1), enabled: z.boolean().default(true), config: z.record(z.string(), z.unknown()).default({})
});
const csvSchema = z.object({ csv: z.string().min(1), sourceName: z.string().default('CSV import') });

export async function buildApp(options: { connection?: DatabaseConnection; logger?: boolean; aiProvider?: AIProvider } = {}) {
  const config = loadConfig();
  const connection = options.connection ?? createDatabase(config.DATABASE_URL);
  const repository = new GtmRepository(connection);
  const researchRepository = new ResearchRepository(connection);
  const contactRepository = new ContactRepository(connection);
  const operationsRepository = new OperationsRepository(connection);
  const finalRepository=new FinalRepository(connection);
  const academicRepository=new AcademicRepository(connection);
  const aiProvider = options.aiProvider ?? createAIProvider(config);
  const ollamaProvider = aiProvider.name==='ollama' ? aiProvider : new OllamaProvider(config.OLLAMA_BASE_URL,config.OLLAMA_MODEL);
  const smtpProvider=new SMTPProvider({host:config.SMTP_HOST,port:config.SMTP_PORT,secure:config.SMTP_SECURE,user:config.SMTP_USER,password:config.SMTP_PASSWORD});
  const imapProvider=new ImapInboxProvider({host:config.IMAP_HOST,port:config.IMAP_PORT,secure:config.IMAP_SECURE,user:config.IMAP_USER,password:config.IMAP_PASSWORD});
  const app = Fastify({ logger: options.logger === false ? false : { level: config.LOG_LEVEL } });
  const allowedOrigins=config.ALLOWED_ORIGINS.split(',').map(value=>value.trim()).filter(Boolean);
  await app.register(cors, { origin: config.NODE_ENV==='development' ? true : allowedOrigins });
  const requestBuckets=new Map<string,{minute:number;count:number}>();
  app.addHook('onRequest',async(request,reply)=>{const minute=Math.floor(Date.now()/60_000),key=request.ip;const bucket=requestBuckets.get(key);if(!bucket||bucket.minute!==minute)requestBuckets.set(key,{minute,count:1});else if(++bucket.count>config.API_REQUESTS_PER_MINUTE)return reply.status(429).send({error:'RATE_LIMITED'});});

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.status(400).send({ error: 'VALIDATION_ERROR', details: error.issues });
    app.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unexpected error' });
  });

  app.get('/health', async () => ({ status: 'ok', service: 'api', timestamp: new Date().toISOString() }));
  app.get('/health/db', async () => ({ status: connection.sqlite.prepare('SELECT 1 AS ok').get() ? 'ok' : 'error' }));
  app.get('/health/workers', async () => ({ status: 'ok', queue: connection.sqlite.prepare(`SELECT status, COUNT(*) count FROM worker_jobs GROUP BY status`).all() }));
  app.get('/health/ollama', async () => ollamaProvider.healthCheck());
  app.get('/health/ai', async () => ({...(await getAIHealthReport(aiProvider)),discoveryEnabled:config.ACADEMIC_SEARCH_PROVIDER!=='none',discoveryProvider:config.ACADEMIC_SEARCH_PROVIDER}));
  app.get('/health/smtp', async () => config.SMTP_HOST ? smtpProvider.healthCheck() : {status:'misconfigured',detail:'SMTP_HOST is not configured'});
  app.get('/health/imap', async () => config.IMAP_HOST ? imapProvider.healthCheck() : {status:'misconfigured',detail:'IMAP_HOST is not configured'});
  app.get('/health/scheduler',async()=>finalRepository.schedulerHealth());
  registerAcademicRoutes(app,academicRepository,config);
  app.get('/api/action-center', async () => operationsRepository.actionCenter());
  app.get('/api/analytics/operational', async(request)=>{const query=z.object({from:z.string().datetime().optional(),to:z.string().datetime().optional()}).parse(request.query);return finalRepository.analytics(query.from,query.to);});
  app.get('/api/data-quality',async()=>finalRepository.dataQuality());
  app.get('/api/campaigns',async()=>({data:finalRepository.listCampaigns()}));
  app.post('/api/campaigns',async(request,reply)=>{const body=z.object({name:z.string().min(1),primaryServiceId:z.string().uuid().optional(),targeting:z.record(z.string(),z.unknown()).default({}),messageStrategy:z.string().optional()}).parse(request.body);return reply.status(201).send({data:finalRepository.createCampaign(body as Parameters<FinalRepository['createCampaign']>[0])});});
  app.patch('/api/campaigns/:campaignId',async(request)=>{const{campaignId}=z.object({campaignId:z.string().uuid()}).parse(request.params);const body=z.object({name:z.string().min(1).optional(),primaryServiceId:z.string().uuid().nullable().optional(),targeting:z.record(z.string(),z.unknown()).optional(),messageStrategy:z.string().nullable().optional(),status:z.enum(['DRAFT','ACTIVE','PAUSED','ARCHIVED']).optional()}).parse(request.body);return{data:finalRepository.updateCampaign(campaignId,body as Parameters<FinalRepository['updateCampaign']>[1])};});
  app.get('/api/learning/recommendations',async()=>({data:finalRepository.listRecommendations()}));
  app.post('/api/learning/recommendations/:id/decision',async(request)=>{const{id}=z.object({id:z.string().uuid()}).parse(request.params);const{status}=z.object({status:z.enum(['ACCEPTED','REJECTED','IGNORED'])}).parse(request.body);return{data:finalRepository.decideRecommendation(id,status)};});
  app.post('/api/models/evaluate',async(_request,reply)=>reply.status(202).send({data:repository.enqueue('EVALUATE_MODELS',{},`model-evaluation:${new Date().toISOString().slice(0,10)}`,30)}));
  app.post('/api/inbox/poll',async(_request,reply)=>reply.status(202).send({data:repository.enqueue('POLL_INBOX',{},`imap-manual:${Date.now()}`,100)}));
  app.get('/api/exports/:kind.csv',async(request,reply)=>{const{kind}=z.object({kind:z.enum(['clients','jobs','applications','contacts','campaigns','conversions'])}).parse(request.params);return reply.type('text/csv').header('content-disposition',`attachment; filename="${kind}.csv"`).send(finalRepository.exportCsv(kind));});
  app.post('/api/backups',async(_request,reply)=>reply.status(201).send({data:await finalRepository.backup(config.BACKUP_DIRECTORY)}));
  app.get('/api/dashboard', async () => ({ summary: repository.dashboardSummary(), opportunities: repository.listRanked(12) }));
  app.get('/api/opportunities', async (request) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(request.query);
    return { data: repository.listRanked(query.limit) };
  });
  app.get('/api/sources', async () => ({ data: repository.listSources() }));
  app.get('/api/companies/:companyId', async (request, reply) => {
    const { companyId } = z.object({ companyId: z.string().uuid() }).parse(request.params); const data = researchRepository.getCompanyIntelligence(companyId);
    return data ? { data: { ...data, contactIntelligence: contactRepository.getCompanyIntelligence(companyId) } } : reply.status(404).send({ error: 'COMPANY_NOT_FOUND' });
  });
  app.get('/api/client-opportunities/:opportunityId/operations',async(request)=>{const {opportunityId}=z.object({opportunityId:z.string().uuid()}).parse(request.params);return{data:operationsRepository.getClientOperations(opportunityId)};});
  app.post('/api/client-opportunities/:opportunityId/outreach',async(request,reply)=>{const{opportunityId}=z.object({opportunityId:z.string().uuid()}).parse(request.params);const body=z.object({force:z.boolean().default(false)}).parse(request.body??{});const job=repository.enqueue('GENERATE_OUTREACH',{opportunityId,force:body.force},`outreach:${opportunityId}:${body.force?Date.now():'current'}`,95);return reply.status(202).send({data:job});});
  app.patch('/api/outreach/messages/:messageId',async(request)=>{const{messageId}=z.object({messageId:z.string().uuid()}).parse(request.params);const body=z.object({textBody:z.string().min(1),subjects:z.array(z.string()).optional()}).parse(request.body);return{data:operationsRepository.editMessage(messageId,{textBody:body.textBody,...(body.subjects?{subjects:body.subjects}:{})})};});
  app.post('/api/outreach/messages/:messageId/approve',async(request)=>{const{messageId}=z.object({messageId:z.string().uuid()}).parse(request.params);const body=z.object({confirmInferred:z.boolean().default(false)}).parse(request.body??{});return{data:operationsRepository.approveMessage(messageId,body.confirmInferred)};});
  app.post('/api/outreach/messages/:messageId/send',async(request,reply)=>{const{messageId}=z.object({messageId:z.string().uuid()}).parse(request.params);return reply.status(202).send({data:operationsRepository.queueSend(messageId)});});
  app.post('/api/outreach/messages/:messageId/linkedin-sent',async(request)=>{const{messageId}=z.object({messageId:z.string().uuid()}).parse(request.params);return{data:operationsRepository.editMessage(messageId,{textBody:'Manually sent on LinkedIn'})};});
  app.post('/api/client-opportunities/:opportunityId/outcome',async(request)=>{const{opportunityId}=z.object({opportunityId:z.string().uuid()}).parse(request.params);const body=z.object({status:z.enum(['MEETING','PROPOSAL','WON','LOST']),valueCents:z.number().int().nonnegative().optional(),currency:z.string().length(3).optional(),notes:z.string().optional(),serviceId:z.string().uuid().optional(),campaignId:z.string().uuid().optional(),personId:z.string().uuid().optional()}).parse(request.body);operationsRepository.recordClientOutcome(opportunityId,body as Parameters<OperationsRepository['recordClientOutcome']>[1]);return{data:{updated:true}};});
  app.post('/api/email/simulate-reply',async(request,reply)=>{if(config.NODE_ENV==='production')return reply.status(403).send({error:'TEST_ENDPOINT_DISABLED'});const body=z.object({threadId:z.string().uuid(),messageId:z.string().min(1),sender:z.string().email(),recipients:z.array(z.string().email()),subject:z.string(),textBody:z.string(),inReplyTo:z.string().optional(),references:z.array(z.string()).optional()}).parse(request.body);const job=repository.enqueue('PROCESS_INCOMING_EMAIL',body,`incoming:${body.messageId}`,100);return reply.status(202).send({data:job});});
  app.get('/api/job-opportunities/:opportunityId/operations',async(request)=>{const{opportunityId}=z.object({opportunityId:z.string().uuid()}).parse(request.params);return{data:operationsRepository.getJobOperations(opportunityId)};});
  app.post('/api/candidate-profile',async(request,reply)=>{const body=z.object({name:z.string().min(1),professionalTitle:z.string().min(1),summary:z.string().min(1),skills:z.array(z.string()),technologies:z.array(z.string()),experience:z.array(z.unknown()),portfolioUrl:z.string().url().optional(),githubUrl:z.string().url().optional(),linkedinUrl:z.string().url().optional(),preferences:z.record(z.string(),z.unknown()).optional(),projects:z.array(z.object({name:z.string(),description:z.string(),problem:z.string().optional(),solution:z.string().optional(),technologies:z.array(z.string()),aiCapabilities:z.array(z.string()).optional(),industry:z.string().optional(),url:z.string().url().optional(),repositoryUrl:z.string().url().optional(),results:z.string().optional()})).optional()}).parse(request.body);return reply.status(201).send({data:operationsRepository.saveCandidateProfile(body as Parameters<OperationsRepository['saveCandidateProfile']>[0])});});
  app.post('/api/job-opportunities/:opportunityId/package',async(request,reply)=>{const{opportunityId}=z.object({opportunityId:z.string().uuid()}).parse(request.params);const body=z.object({force:z.boolean().default(false)}).parse(request.body??{});return reply.status(202).send({data:repository.enqueue('GENERATE_APPLICATION_PACKAGE',{opportunityId,force:body.force},`application:${opportunityId}:${body.force?Date.now():'current'}`,90)});});
  app.post('/api/job-opportunities/:opportunityId/applied',async(request,reply)=>{const{opportunityId}=z.object({opportunityId:z.string().uuid()}).parse(request.params);const body=z.object({packageId:z.string().uuid().optional(),applicationUrl:z.string().url(),source:z.string(),resumeVersionId:z.string().uuid().optional(),notes:z.string().optional()}).parse(request.body);return reply.status(201).send({data:operationsRepository.markApplied(opportunityId,body as Parameters<OperationsRepository['markApplied']>[1])});});
  app.post('/api/job-opportunities/:opportunityId/status',async(request)=>{const{opportunityId}=z.object({opportunityId:z.string().uuid()}).parse(request.params);const body=z.object({status:z.enum(['FOLLOWED_UP','RECRUITER_REPLY','SCREENING','INTERVIEW','TECHNICAL_INTERVIEW','FINAL_INTERVIEW','OFFER','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED'])}).parse(request.body);return{data:operationsRepository.setJobStatus(opportunityId,body.status)};});
  app.get('/api/companies/:companyId/people', async (request, reply) => {
    const { companyId } = z.object({ companyId: z.string().uuid() }).parse(request.params); if(!researchRepository.getCompanyIntelligence(companyId))return reply.status(404).send({error:'COMPANY_NOT_FOUND'});return { data: contactRepository.getCompanyIntelligence(companyId) };
  });
  app.get('/api/people/:personId/evidence', async (request) => {
    const { personId } = z.object({ personId: z.string().uuid() }).parse(request.params); return { data: contactRepository.getPersonEvidence(personId) };
  });
  app.post('/api/companies/:companyId/contacts/research', async (request, reply) => {
    const { companyId } = z.object({ companyId: z.string().uuid() }).parse(request.params); const body=z.object({force:z.boolean().default(false)}).parse(request.body??{});
    try { const data=contactRepository.queue(companyId,{manual:true,force:body.force,minClientScore:config.MIN_CONTACT_CLIENT_SCORE,ttlDays:config.CONTACT_CACHE_TTL_DAYS});return reply.status(data.queued?202:200).send({data}); }
    catch(error){if(error instanceof Error&&error.message==='Company not found')return reply.status(404).send({error:'COMPANY_NOT_FOUND'});throw error;}
  });
  app.post('/api/companies/:companyId/decision-maker', async (request, reply) => {
    const {companyId}=z.object({companyId:z.string().uuid()}).parse(request.params);const body=z.object({primaryPersonId:z.string().uuid(),secondaryPersonId:z.string().uuid().nullable().optional()}).parse(request.body);
    try{contactRepository.manualSelect(companyId,body.primaryPersonId,body.secondaryPersonId);return reply.status(200).send({data:{selected:true}});}catch(error){if(error instanceof Error&&error.message==='Person not found for company')return reply.status(404).send({error:'PERSON_NOT_FOUND'});throw error;}
  });
  app.post('/api/companies/:companyId/research', async (request, reply) => {
    const { companyId } = z.object({ companyId: z.string().uuid() }).parse(request.params); const body = z.object({ force: z.boolean().default(false) }).parse(request.body ?? {});
    try { const data = researchRepository.queueResearch(companyId, { force: body.force, manual: true, minJobScore: config.MIN_RESEARCH_JOB_SCORE, minClientScore: config.MIN_RESEARCH_CLIENT_SCORE }); return reply.status(data.queued ? 202 : 200).send({ data }); }
    catch (error) { if (error instanceof Error && error.message === 'Company not found') return reply.status(404).send({ error: 'COMPANY_NOT_FOUND' }); throw error; }
  });
  app.post('/api/sources', async (request, reply) => reply.status(201).send({ data: repository.createSource(createSourceSchema.parse(request.body)) }));
  app.post('/api/discovery-runs', async (request, reply) => {
    const { sourceId } = sourceRunRequestSchema.parse(request.body);
    const source = repository.getSource(sourceId);
    if (!source) return reply.status(404).send({ error: 'SOURCE_NOT_FOUND' });
    if (!source.enabled) return reply.status(409).send({ error: 'SOURCE_DISABLED' });
    const bucket = new Date().toISOString().slice(0, 13);
    const job = repository.enqueue('DISCOVER_SOURCE', { sourceId }, `discover:${sourceId}:${bucket}`);
    return reply.status(202).send({ data: job });
  });
  app.post('/api/discovery-runs/all', async (_request, reply) => {
    const bucket = new Date().toISOString().slice(0, 13);
    const queued = repository.listSources().filter((source) => source.enabled && ['GREENHOUSE', 'LEVER', 'ASHBY'].includes(source.kind))
      .map((source) => repository.enqueue('DISCOVER_SOURCE', { sourceId: source.id }, `discover:${source.id}:${bucket}`));
    return reply.status(202).send({ data: queued, count: queued.length });
  });
  app.post('/api/imports/manual', async (request, reply) => {
    const record = normalizeManual(manualImportSchema.parse(request.body));
    let source = repository.listSources().find((candidate) => candidate.kind === 'MANUAL_URL');
    source ??= repository.createSource({ kind: 'MANUAL_URL', name: 'Manual URL imports', config: {} });
    const runId = repository.beginSourceRun(source.id);
    const result = repository.ingestMany(source.id, runId, [record]);
    repository.finishSourceRun(runId, 'COMPLETED', { pagesProcessed: 1, recordsSeen: 1, recordsCreated: result.created, recordsUpdated: result.updated, duplicatesDetected: result.duplicates, runtimeMs: 0 });
    researchRepository.queueEligible({ minJobScore: config.MIN_RESEARCH_JOB_SCORE, minClientScore: config.MIN_RESEARCH_CLIENT_SCORE });
    return reply.status(201).send({ data: result });
  });
  app.post('/api/imports/csv', async (request, reply) => {
    const input = csvSchema.parse(request.body); const parsed = parseCsvImport(input.csv);
    let source = repository.listSources().find((candidate) => candidate.kind === 'CSV' && candidate.name === input.sourceName);
    source ??= repository.createSource({ kind: 'CSV', name: input.sourceName, config: {} });
    const runId = repository.beginSourceRun(source.id); const result = repository.ingestMany(source.id, runId, parsed.records);
    repository.finishSourceRun(runId, parsed.errors.length ? 'FAILED' : 'COMPLETED', { pagesProcessed: 1, recordsSeen: parsed.records.length + parsed.errors.length, recordsCreated: result.created, recordsUpdated: result.updated, duplicatesDetected: result.duplicates, errors: parsed.errors.length, runtimeMs: 0, errorJson: parsed.errors.length ? JSON.stringify(parsed.errors) : null });
    researchRepository.queueEligible({ minJobScore: config.MIN_RESEARCH_JOB_SCORE, minClientScore: config.MIN_RESEARCH_CLIENT_SCORE });
    return reply.status(parsed.errors.length ? 207 : 201).send({ data: result, errors: parsed.errors });
  });

  app.addHook('onClose', async () => connection.sqlite.close());
  return app;
}
