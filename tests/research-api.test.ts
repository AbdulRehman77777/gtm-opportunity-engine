import { describe, expect, it } from 'vitest';
import type { AIProvider } from '@gtm/ai';
import { GtmRepository } from '@gtm/db';
import { normalizeManual } from '@gtm/sources';
import { buildApp } from '../apps/api/src/app';
import { createMigratedTestDatabase } from './db-helper';

const unavailableAi: AIProvider = { name: 'ollama', modelInfo: () => ({ provider: 'ollama', model: 'missing', baseUrl: 'local' }), healthCheck: async () => ({ status: 'misconfigured', provider: 'ollama', model: 'missing', detail: 'not installed' }), generateStructured: async () => { throw new Error('not available'); } };

describe('company intelligence API', () => {
  it('reports Ollama state and queues manual research asynchronously', async () => {
    const connection = createMigratedTestDatabase(); const repository = new GtmRepository(connection); const source = repository.createSource({ kind: 'MANUAL_URL', name: 'Manual', config: {} });
    repository.ingest(source.id, null, normalizeManual({ url: 'https://acme.com/jobs/1', companyName: 'Acme', companyDomain: 'acme.com', title: 'LLM Engineer', description: 'Python and RAG', location: 'Remote US' }));
    const companyId = (connection.sqlite.prepare('SELECT id FROM companies').get() as { id: string }).id; const app = await buildApp({ connection, logger: false, aiProvider: unavailableAi });
    const health = await app.inject({ method: 'GET', url: '/health/ollama' }); expect(health.statusCode).toBe(200); expect(health.json()).toMatchObject({ status: 'misconfigured' });
    const queued = await app.inject({ method: 'POST', url: `/api/companies/${companyId}/research`, payload: { force: false } }); expect(queued.statusCode).toBe(202); expect(queued.json().data.queued).toBe(true);
    const detail = await app.inject({ method: 'GET', url: `/api/companies/${companyId}` }); expect(detail.statusCode).toBe(200); expect(detail.json().data.company.researchStatus).toBe('QUEUED'); await app.close();
  });
});
