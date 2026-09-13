import { randomUUID } from 'node:crypto';
import { and, desc, eq, lte, or, sql } from 'drizzle-orm';
import { contentHash, jobFingerprint, normalizeCompanyName, normalizeDomain, normalizeText, type NormalizedOpportunity } from '@gtm/shared';
import { recommendedAction, scoreClient, scoreJob } from '@gtm/scoring';
import type { DatabaseConnection } from './client.js';
import { activities, clientOpportunities, clientScores, companies, companySources, jobOpportunities, jobScores, jobs, jobSources, signals, signalEvidence, sourceRuns, sources, workerJobs } from './schema.js';

export class GtmRepository {
  constructor(private readonly connection: DatabaseConnection) {}
  get db() { return this.connection.db; }

  listSources() { return this.db.select().from(sources).orderBy(desc(sources.createdAt)).all().map(parseSource); }
  getSource(id: string) { const row = this.db.select().from(sources).where(eq(sources.id, id)).get(); return row ? parseSource(row) : null; }

  createSource(input: { kind: string; name: string; enabled?: boolean; config: Record<string, unknown> }) {
    const now = iso(); const id = randomUUID();
    this.db.insert(sources).values({ id, kind: input.kind, name: input.name, enabled: input.enabled ?? true, configJson: JSON.stringify(input.config), createdAt: now, updatedAt: now }).run();
    return this.getSource(id)!;
  }

  beginSourceRun(sourceId: string) {
    const id = randomUUID(); const now = iso();
    this.db.insert(sourceRuns).values({ id, sourceId, status: 'RUNNING', startedAt: now, createdAt: now }).run();
    return id;
  }

  updateSourceRun(id: string, patch: Partial<typeof sourceRuns.$inferInsert>) { this.db.update(sourceRuns).set(patch).where(eq(sourceRuns.id, id)).run(); }
  finishSourceRun(id: string, status: 'COMPLETED' | 'FAILED', metrics: Record<string, unknown>) {
    const completedAt = iso();
    this.db.update(sourceRuns).set({ status, completedAt, ...metrics } as Partial<typeof sourceRuns.$inferInsert>).where(eq(sourceRuns.id, id)).run();
  }

  ingestMany(sourceId: string, sourceRunId: string | null, records: NormalizedOpportunity[]) {
    const summary = { created: 0, updated: 0, duplicates: 0, skipped: 0 };
    for (const record of records) {
      const outcome = this.ingest(sourceId, sourceRunId, record);
      summary[outcome] += 1;
    }
    return summary;
  }

  ingest(sourceId: string, sourceRunId: string | null, record: NormalizedOpportunity): 'created' | 'updated' | 'duplicates' | 'skipped' {
    const now = record.discoveredAt;
    return this.db.transaction((tx) => {
      const domain = normalizeDomain(record.companyDomain);
      const normalizedName = normalizeCompanyName(record.companyName);
      let company = domain ? tx.select().from(companies).where(eq(companies.domain, domain)).get() : undefined;
      company ??= tx.select().from(companies).where(eq(companies.normalizedName, normalizedName)).get();
      if (!company) {
        const id = randomUUID();
        tx.insert(companies).values({ id, canonicalName: record.companyName, normalizedName, domain, country: record.country, firstDiscoveredAt: now, lastObservedAt: now, createdAt: now, updatedAt: now }).run();
        company = tx.select().from(companies).where(eq(companies.id, id)).get()!;
      } else {
        tx.update(companies).set({ lastObservedAt: now, updatedAt: now, ...(company.domain ? {} : { domain }) }).where(eq(companies.id, company.id)).run();
      }
      const companyMapping = tx.select().from(companySources).where(and(eq(companySources.companyId, company.id), eq(companySources.sourceId, sourceId))).get();
      if (companyMapping) tx.update(companySources).set({ lastSeenAt: now, observationCount: companyMapping.observationCount + 1, updatedAt: now }).where(eq(companySources.id, companyMapping.id)).run();
      else tx.insert(companySources).values({ id: randomUUID(), companyId: company.id, sourceId, externalId: record.companyName, sourceUrl: record.sourceUrl, rawDataJson: JSON.stringify(record.rawData), firstSeenAt: now, lastSeenAt: now, createdAt: now, updatedAt: now }).run();

      const fingerprint = jobFingerprint(record);
      let job = tx.select().from(jobs).where(eq(jobs.fingerprint, fingerprint)).get();
      const existed = Boolean(job);
      if (!job) {
        const id = randomUUID();
        tx.insert(jobs).values({ id, companyId: company.id, fingerprint, title: record.title, normalizedTitle: normalizeText(record.title), description: record.description, location: record.location, country: record.country, remoteType: record.remoteType, employmentType: record.employmentType, compensation: record.compensation, postedAt: record.postedAt, firstDiscoveredAt: now, lastObservedAt: now, createdAt: now, updatedAt: now }).run();
        job = tx.select().from(jobs).where(eq(jobs.id, id)).get()!;
      } else {
        tx.update(jobs).set({ lastObservedAt: now, updatedAt: now, description: record.description || job.description, postedAt: record.postedAt ?? job.postedAt }).where(eq(jobs.id, job.id)).run();
      }

      const sourceMapping = tx.select().from(jobSources).where(and(eq(jobSources.sourceId, sourceId), eq(jobSources.externalId, record.externalId))).get();
      if (sourceMapping) {
        tx.update(jobSources).set({ jobId: job.id, sourceRunId, lastSeenAt: now, observationCount: sourceMapping.observationCount + 1, rawDataJson: JSON.stringify(record.rawData), contentHash: contentHash(record.rawData), updatedAt: now }).where(eq(jobSources.id, sourceMapping.id)).run();
      } else {
        tx.insert(jobSources).values({ id: randomUUID(), jobId: job.id, sourceId, sourceRunId, externalId: record.externalId, sourceUrl: record.sourceUrl, rawDataJson: JSON.stringify(record.rawData), contentHash: contentHash(record.rawData), firstSeenAt: now, lastSeenAt: now, createdAt: now, updatedAt: now }).run();
      }
      if (existed) return sourceMapping ? 'updated' : 'duplicates';

      const jobResult = scoreJob(record); const clientResult = scoreClient(record); const action = recommendedAction(clientResult.total, jobResult.total);
      const jobOpportunityId = randomUUID(); const clientOpportunityId = randomUUID();
      tx.insert(jobOpportunities).values({ id: jobOpportunityId, jobId: job.id, initialScore: jobResult.total, currentScore: jobResult.total, recommendedAction: action, discoveredAt: now, lastActivityAt: now, createdAt: now, updatedAt: now }).run();
      tx.insert(jobScores).values({ id: randomUUID(), opportunityId: jobOpportunityId, total: jobResult.total, componentsJson: JSON.stringify(jobResult.components), reasonsJson: JSON.stringify(jobResult.reasons), modelVersion: jobResult.version, createdAt: now }).run();
      tx.insert(clientOpportunities).values({ id: clientOpportunityId, companyId: company.id, triggerJobId: job.id, initialScore: clientResult.total, currentScore: clientResult.total, recommendedAction: action, discoveredAt: now, lastActivityAt: now, createdAt: now, updatedAt: now }).run();
      tx.insert(clientScores).values({ id: randomUUID(), opportunityId: clientOpportunityId, total: clientResult.total, componentsJson: JSON.stringify(clientResult.components), reasonsJson: JSON.stringify(clientResult.reasons), modelVersion: clientResult.version, createdAt: now }).run();
      const signalId = randomUUID();
      tx.insert(signals).values({ id: signalId, companyId: company.id, jobId: job.id, type: 'ACTIVE_TECHNICAL_HIRING', claim: `${company.canonicalName} is actively hiring for ${record.title}`, severity: 'HIGH', weight: 15, sourceQuality: 'FIRST_PARTY_HIGH', confidence: 0.95, observedAt: now, detectedAt: now, createdAt: now }).run();
      tx.insert(signalEvidence).values({ id: randomUUID(), signalId, sourceUrl: record.sourceUrl, evidenceText: `${record.title} — ${record.location}`, observedAt: now, contentHash: contentHash([record.title, record.location, record.sourceUrl]), createdAt: now }).run();
      for (const [entityType, entityId] of [['JOB_OPPORTUNITY', jobOpportunityId], ['CLIENT_OPPORTUNITY', clientOpportunityId]] as const) {
        tx.insert(activities).values({ id: randomUUID(), entityType, entityId, type: 'DISCOVERED', toStatus: 'DISCOVERED', metadataJson: JSON.stringify({ sourceId, jobId: job.id }), occurredAt: now, createdAt: now }).run();
      }
      return 'created';
    });
  }

  listRanked(limit = 100) {
    const rows = this.db.all(sql`
      SELECT j.id, jo.id AS jobOpportunityId, co.id AS clientOpportunityId, c.id AS companyId, c.canonical_name AS companyName, COALESCE(c.resolved_domain,c.domain) AS companyDomain, c.research_status AS researchStatus, c.last_researched_at AS lastResearchedAt,
             cp.research_confidence AS researchConfidence, cp.summary AS companySummary, cp.what_is_happening AS whatIsHappening, cp.why_it_matters AS whyItMatters, cp.why_match AS whyMatch, cp.recommended_next_step AS recommendedNextStep,
             j.title, j.location, j.country,
             j.remote_type AS remoteType, j.posted_at AS postedAt, j.first_discovered_at AS discoveredAt,
             jo.initial_score AS initialJobScore, co.initial_score AS initialClientScore, jo.current_score AS jobScore, co.current_score AS clientScore, jo.recommended_action AS recommendedAction,
             js.source_url AS sourceUrl, s.name AS sourceName, s.kind AS sourceKind,
             jsc.reasons_json AS jobReasons, csc.reasons_json AS clientReasons
      FROM job_opportunities jo
      JOIN jobs j ON j.id = jo.job_id
      JOIN companies c ON c.id = j.company_id
      LEFT JOIN company_profiles cp ON cp.id = c.current_profile_id
      JOIN client_opportunities co ON co.trigger_job_id = j.id
      JOIN job_sources js ON js.job_id = j.id
      JOIN sources s ON s.id = js.source_id
      JOIN job_scores jsc ON jsc.opportunity_id = jo.id
      JOIN client_scores csc ON csc.opportunity_id = co.id
      WHERE jsc.created_at = (SELECT MAX(x.created_at) FROM job_scores x WHERE x.opportunity_id = jo.id)
        AND csc.created_at = (SELECT MAX(x.created_at) FROM client_scores x WHERE x.opportunity_id = co.id)
        AND js.id = (SELECT y.id FROM job_sources y WHERE y.job_id = j.id ORDER BY y.last_seen_at DESC, y.created_at DESC, y.id DESC LIMIT 1)
      ORDER BY MAX(jo.current_score, co.current_score) DESC, COALESCE(j.posted_at, j.first_discovered_at) DESC
      LIMIT ${limit}
    `) as Record<string, unknown>[];
    return rows.map((row) => ({ ...row, jobReasons: JSON.parse(String(row.jobReasons)), clientReasons: JSON.parse(String(row.clientReasons)) }));
  }

  dashboardSummary() {
    const row = this.connection.sqlite.prepare(`SELECT
      (SELECT COUNT(*) FROM jobs WHERE date(first_discovered_at) = date('now')) discoveredToday,
      (SELECT COUNT(*) FROM job_opportunities WHERE current_score >= 80) highPriorityJobs,
      (SELECT COUNT(*) FROM client_opportunities WHERE current_score >= 80) highPriorityLeads,
      (SELECT COUNT(*) FROM jobs WHERE expired_at IS NULL) activeOpportunities,
      (SELECT COUNT(*) FROM source_runs WHERE status = 'RUNNING') runningSources,
      (SELECT COUNT(*) FROM company_research_runs WHERE date(completed_at)=date('now') AND status IN ('COMPLETE','PARTIAL')) researchedToday,
      (SELECT COUNT(*) FROM company_research_runs WHERE status='FAILED' AND date(updated_at)=date('now')) researchFailures,
      (SELECT COUNT(*) FROM company_research_runs WHERE status IN ('QUEUED','RESOLVING_DOMAIN','CRAWLING','EXTRACTING','AI_ANALYSIS','SCORING')) researchInProgress,
      (SELECT COUNT(*) FROM client_opportunities co WHERE co.current_score>=90 AND EXISTS (SELECT 1 FROM companies c WHERE c.id=co.company_id AND c.research_status='COMPLETE')) exceptionalResearchedLeads`).get();
    return row;
  }

  enqueue(type: string, payload: Record<string, unknown>, idempotencyKey?: string, priority = 0) {
    const now = iso(); const id = randomUUID();
    try { this.db.insert(workerJobs).values({ id, type, payloadJson: JSON.stringify(payload), idempotencyKey, priority, runAfter: now, createdAt: now }).run(); }
    catch (error) { if (idempotencyKey) return this.db.select().from(workerJobs).where(eq(workerJobs.idempotencyKey, idempotencyKey)).get()!; throw error; }
    return this.db.select().from(workerJobs).where(eq(workerJobs.id, id)).get()!;
  }

  claimNext(workerId: string) {
    const now = iso();
    return this.db.transaction((tx) => {
      const job = tx.select().from(workerJobs).where(and(or(eq(workerJobs.status, 'PENDING'), eq(workerJobs.status, 'RETRY')), lte(workerJobs.runAfter, now))).orderBy(desc(workerJobs.priority), workerJobs.createdAt).get();
      if (!job) return null;
      tx.update(workerJobs).set({ status: 'RUNNING', startedAt: now, lockedBy: workerId, attempts: job.attempts + 1 }).where(and(eq(workerJobs.id, job.id), or(eq(workerJobs.status, 'PENDING'), eq(workerJobs.status, 'RETRY')))).run();
      return tx.select().from(workerJobs).where(eq(workerJobs.id, job.id)).get() ?? null;
    });
  }

  completeWorkerJob(id: string, result: unknown) { this.db.update(workerJobs).set({ status: 'COMPLETED', resultJson: JSON.stringify(result), finishedAt: iso() }).where(eq(workerJobs.id, id)).run(); }
  failWorkerJob(id: string, attempts: number, maxAttempts: number, error: unknown, retryAfterMs?: number) {
    const final = attempts >= maxAttempts; const now = new Date();
    this.db.update(workerJobs).set({ status: final ? 'FAILED' : 'RETRY', errorJson: JSON.stringify(serializeError(error)), finishedAt: final ? now.toISOString() : null, runAfter: new Date(now.getTime() + (retryAfterMs ?? Math.min(300_000, 2 ** attempts * 1000))).toISOString() }).where(eq(workerJobs.id, id)).run();
  }
}

function parseSource<T extends { configJson: string }>(row: T) { return { ...row, config: JSON.parse(row.configJson) as Record<string, unknown> }; }
function iso() { return new Date().toISOString(); }
function serializeError(error: unknown) { return error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) }; }
