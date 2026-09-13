import { afterEach, describe, expect, it, vi } from 'vitest';
import { AshbySource, GreenhouseSource, LeverSource, parseCsvImport } from '@gtm/sources';

afterEach(() => vi.unstubAllGlobals());
function response(body: unknown) { return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); }

describe('source adapters', () => {
  it('normalizes Greenhouse public jobs and preserves raw data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ jobs: [{ id: 42, title: 'LLM Engineer', absolute_url: 'https://boards.greenhouse.io/acme/jobs/42', updated_at: '2026-09-12T10:00:00Z', location: { name: 'Remote - US' }, content: '<p>Build RAG systems</p>' }] })));
    const pages = []; for await (const page of new GreenhouseSource().discover({ boardToken: 'acme', companyName: 'Acme', companyDomain: 'acme.com' })) pages.push(page);
    expect(pages[0]?.records[0]).toMatchObject({ source: 'GREENHOUSE', externalId: '42', companyDomain: 'acme.com', remoteType: 'REMOTE' });
    expect(pages[0]?.records[0]?.description).toBe('Build RAG systems');
  });
  it('normalizes Lever pagination', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([{ id: 'lever-1', text: 'Full-Stack AI Engineer', hostedUrl: 'https://jobs.lever.co/acme/lever-1', createdAt: 1_789_000_000_000, descriptionPlain: 'Python and React', categories: { location: 'New York, NY', commitment: 'Full-time' } }])));
    const pages = []; for await (const page of new LeverSource().discover({ site: 'acme', companyName: 'Acme' })) pages.push(page);
    expect(pages).toHaveLength(1); expect(pages[0]?.done).toBe(true); expect(pages[0]?.records[0]?.employmentType).toBe('Full-time');
  });
  it('normalizes Ashby remote jobs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ jobs: [{ id: 'ashby-1', title: 'AI Product Engineer', jobUrl: 'https://jobs.ashbyhq.com/acme/ashby-1', location: 'Americas', isRemote: true, descriptionPlain: 'LLM agents' }] })));
    const pages = []; for await (const page of new AshbySource().discover({ boardName: 'acme', companyName: 'Acme' })) pages.push(page);
    expect(pages[0]?.records[0]).toMatchObject({ source: 'ASHBY', remoteType: 'REMOTE', title: 'AI Product Engineer' });
  });
  it('imports valid CSV rows and reports row-level validation errors', () => {
    const result = parseCsvImport('company_name,title,source_url,location\nAcme,LLM Engineer,https://acme.com/jobs/1,Remote US\nBroken,,not-a-url,Nowhere');
    expect(result.records).toHaveLength(1); expect(result.errors).toHaveLength(1); expect(result.errors[0]?.row).toBe(3);
  });
});
