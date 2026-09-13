import { beforeEach, describe, expect, it } from 'vitest';
import { GtmRepository, ResearchRepository } from '@gtm/db';
import { cleanHtml, hashCleanPage } from '@gtm/crawler';
import { extractDeterministicEvidence } from '@gtm/research';
import { detectSignals } from '@gtm/signals';
import { normalizeManual } from '@gtm/sources';
import { createMigratedTestDatabase } from './db-helper';

describe('research repository history', () => {
  let connection: ReturnType<typeof createMigratedTestDatabase>; let gtm: GtmRepository; let research: ResearchRepository; let companyId: string;
  beforeEach(() => { connection = createMigratedTestDatabase(); gtm = new GtmRepository(connection); research = new ResearchRepository(connection); const source = gtm.createSource({ kind: 'MANUAL_URL', name: 'Manual', config: {} }); gtm.ingest(source.id, null, normalizeManual({ url: 'https://acme.com/jobs/1', companyName: 'Acme', companyDomain: 'acme.com', title: 'Senior LLM Engineer', description: 'Build RAG agents with Python and React', location: 'Remote US' })); companyId = (connection.sqlite.prepare('SELECT id FROM companies').get() as { id: string }).id; });

  it('queues eligible research once with value-based priority', () => {
    const first = research.queueResearch(companyId, { minJobScore: 65, minClientScore: 60 }); const second = research.queueResearch(companyId, { minJobScore: 65, minClientScore: 60 });
    expect(first.queued).toBe(true); expect(second).toMatchObject({ queued: false, reason: 'ALREADY_QUEUED', runId: first.runId });
    expect(connection.sqlite.prepare('SELECT priority,type FROM worker_jobs').get()).toMatchObject({ type: 'RESOLVE_COMPANY_DOMAIN' });
  });
  it('preserves page versions and reuses unchanged content', () => {
    const queued = research.queueResearch(companyId, { manual: true }); const runId = queued.runId!; const page = cleanHtml('<html><head><title>Acme</title></head><body><main>AI assistant with API integrations</main></body></html>', 'https://acme.com/');
    const crawl = { page, url: page.url, httpStatus: 200, contentType: 'text/html', fetchDurationMs: 5, contentHash: hashCleanPage(page), error: null, relevanceScore: 100 };
    expect(research.saveCrawlResults(runId, [crawl], 14)).toMatchObject({ fetched: 1, reused: 0 }); expect(research.saveCrawlResults(runId, [crawl], 14)).toMatchObject({ fetched: 0, reused: 1 });
    expect(connection.sqlite.prepare('SELECT COUNT(*) count FROM company_page_versions').get()).toMatchObject({ count: 1 });
  });
  it('links evidence to signals without losing the source URL', () => {
    const runId = research.queueResearch(companyId, { manual: true }).runId!; const page = cleanHtml('<main>Our AI assistant connects through APIs and integrations.</main>', 'https://acme.com/'); const drafts = extractDeterministicEvidence(page); research.saveEvidence(runId, drafts); const detected = detectSignals(drafts); research.saveSignals(runId, detected);
    const intelligence = research.getCompanyIntelligence(companyId)!; expect(intelligence.evidence[0]?.sourceUrl).toBe('https://acme.com/'); expect(intelligence.signals.length).toBeGreaterThan(0);
  });
});
