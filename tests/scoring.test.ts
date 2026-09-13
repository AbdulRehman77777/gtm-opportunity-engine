import { describe, expect, it } from 'vitest';
import { normalizedOpportunitySchema } from '@gtm/shared';
import { isRelevantJob, recommendedAction, scoreClient, scoreJob } from '@gtm/scoring';

const job = normalizedOpportunitySchema.parse({
  source: 'MANUAL_URL', externalId: '1', sourceUrl: 'https://acme.com/jobs/1', companyName: 'Acme AI', companyDomain: 'acme.com',
  title: 'Senior LLM Engineer', description: 'Build RAG agents with Python, FastAPI, TypeScript, React and APIs.', location: 'Remote - United States',
  country: 'US', remoteType: 'REMOTE', compensation: '$170k–$210k', postedAt: new Date().toISOString(), discoveredAt: new Date().toISOString(), rawData: {}
});

describe('scoring', () => {
  it('scores components transparently and within 0-100', () => {
    const result = scoreJob(job); expect(result.total).toBe(Object.values(result.components).reduce((a, b) => a + b, 0)); expect(result.total).toBeGreaterThanOrEqual(80); expect(result.total).toBeLessThanOrEqual(100);
  });
  it('creates a distinct client hiring-intent score', () => { const result = scoreClient(job); expect(result.components.buyingIntent).toBeGreaterThan(12); expect(result.reasons[0]).toContain('hiring'); });
  it('filters excluded roles', () => expect(isRelevantJob({ ...job, title: 'AI Sales Engineer' })).toBe(false));
  it('recommends two-funnel actions without mixing scores', () => { expect(recommendedAction(75, 82)).toBe('BOTH'); expect(recommendedAction(45, 82)).toBe('JOB_APPLICATION'); expect(recommendedAction(75, 42)).toBe('CLIENT_OUTREACH'); });
});
