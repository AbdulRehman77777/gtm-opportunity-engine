import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIProvider } from '@gtm/ai';
import { GtmRepository, ResearchRepository } from '@gtm/db';
import { normalizeManual } from '@gtm/sources';
import { Worker } from '../apps/worker/src/worker';
import { createMigratedTestDatabase } from './db-helper';

afterEach(() => vi.unstubAllGlobals());
const unavailableAi: AIProvider = {
  name: 'test-ai', modelInfo: () => ({ provider: 'test-ai', model: 'none', baseUrl: 'local' }),
  healthCheck: async () => ({ status: 'unavailable', provider: 'test-ai', model: 'none', detail: 'offline' }),
  generateStructured: async () => { throw new Error('must not be called'); }
};

describe('staged research worker', () => {
  it('completes deterministic research when AI is unavailable', async () => {
    const connection = createMigratedTestDatabase(); const gtm = new GtmRepository(connection); const research = new ResearchRepository(connection);
    const source = gtm.createSource({ kind: 'MANUAL_URL', name: 'Manual', config: {} });
    gtm.ingest(source.id, null, normalizeManual({ url: 'https://acme.com/jobs/llm', companyName: 'Acme', companyDomain: 'acme.com', title: 'Senior LLM Engineer', description: 'Build RAG and agent workflows with Python', location: 'Remote US' }));
    const companyId = (connection.sqlite.prepare('SELECT id FROM companies').get() as { id: string }).id; const queued = research.queueResearch(companyId, { manual: true });
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input); if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /', { status: 200, headers: { 'content-type': 'text/plain' } });
      if (url.endsWith('/sitemap.xml')) return new Response('<urlset></urlset>', { status: 200, headers: { 'content-type': 'application/xml' } });
      return new Response('<html><head><title>Acme AI</title><meta name="description" content="Acme builds an AI support assistant."></head><body><main><h1>AI automation</h1><p>Our LLM assistant connects through APIs and integrations.</p><a href="/contact">Contact</a></main></body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    }));
    const worker = new Worker(connection, unavailableAi); for (let step = 0; step < 6; step += 1) expect(await worker.runOnce()).toBe(true);
    const intelligence = research.getCompanyIntelligence(companyId)!;
    expect(intelligence.company.researchStatus).toBe('COMPLETE'); expect(intelligence.profile?.aiAnalysis).toBeNull(); expect(intelligence.evidence.length).toBeGreaterThan(0); expect(intelligence.signals.some((signal) => signal.type === 'LLM_ENGINEER_HIRING')).toBe(true);
    expect(connection.sqlite.prepare("SELECT COUNT(*) count FROM ai_runs WHERE status='SKIPPED'").get()).toMatchObject({ count: 1 }); expect(queued.runId).toBeTruthy();
  });
});
