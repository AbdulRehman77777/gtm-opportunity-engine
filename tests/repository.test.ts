import { beforeEach, describe, expect, it } from 'vitest';
import { GtmRepository } from '@gtm/db';
import { normalizeManual } from '@gtm/sources';
import { createMigratedTestDatabase } from './db-helper';

describe('historical ingestion and deduplication', () => {
  let connection: ReturnType<typeof createMigratedTestDatabase>; let repository: GtmRepository;
  beforeEach(() => { connection = createMigratedTestDatabase(); repository = new GtmRepository(connection); });

  it('merges canonical jobs but keeps both source mappings', () => {
    const first = repository.createSource({ kind: 'MANUAL_URL', name: 'Manual', config: {} }); const second = repository.createSource({ kind: 'CSV', name: 'CSV', config: {} });
    const base = normalizeManual({ url: 'https://acme.com/jobs/ai-1', companyName: 'Acme Inc', companyDomain: 'https://www.acme.com', title: 'Senior AI Engineer', location: 'Remote US', description: 'LLM, RAG, Python and React' });
    expect(repository.ingest(first.id, null, base)).toBe('created');
    expect(repository.ingest(second.id, null, { ...base, source: 'CSV', externalId: 'csv-9', sourceUrl: 'https://jobs.example.com/acme-ai' })).toBe('duplicates');
    expect(connection.sqlite.prepare('SELECT COUNT(*) count FROM jobs').get()).toMatchObject({ count: 1 });
    expect(connection.sqlite.prepare('SELECT COUNT(*) count FROM job_sources').get()).toMatchObject({ count: 2 });
    expect(connection.sqlite.prepare('SELECT COUNT(*) count FROM activities').get()).toMatchObject({ count: 2 });
    expect(repository.listRanked(10)).toHaveLength(1);
  });

  it('updates repeat observations instead of duplicating source history', () => {
    const source = repository.createSource({ kind: 'MANUAL_URL', name: 'Manual', config: {} });
    const record = normalizeManual({ url: 'https://acme.com/jobs/1', companyName: 'Acme', companyDomain: 'acme.com', title: 'LLM Engineer', location: 'Remote US' });
    repository.ingest(source.id, null, record); expect(repository.ingest(source.id, null, record)).toBe('updated');
    expect(connection.sqlite.prepare('SELECT observation_count count FROM job_sources').get()).toMatchObject({ count: 2 });
  });
});
