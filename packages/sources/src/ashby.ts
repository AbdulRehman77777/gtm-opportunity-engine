import { z } from 'zod';
import { inferCountry, inferRemoteType, normalizeDomain, normalizedOpportunitySchema } from '@gtm/shared';
import { fetchJson } from './http.js';
import { optionalString, requiredString, type DiscoveryContext, type OpportunitySource } from './types.js';

const responseSchema = z.object({
  jobs: z.array(z.object({
    id: z.string(), title: z.string(), jobUrl: z.string().url(), location: z.string().optional(),
    descriptionPlain: z.string().optional(), descriptionHtml: z.string().optional(),
    publishedAt: z.string().optional(), employmentType: z.string().optional(), isRemote: z.boolean().optional()
  }))
});

export class AshbySource implements OpportunitySource {
  readonly kind = 'ASHBY' as const;
  async *discover(config: Record<string, unknown>, context: DiscoveryContext = {}) {
    const boardName = requiredString(config, 'boardName');
    const companyName = optionalString(config, 'companyName') ?? boardName;
    const companyDomain = normalizeDomain(optionalString(config, 'companyDomain'));
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardName)}?includeCompensation=true`;
    const response = responseSchema.parse(await fetchJson(url, { signal: context.signal, onRateLimit: context.onRateLimit }));
    const now = new Date().toISOString();
    const records = response.jobs.map((job) => {
      const location = job.location ?? (job.isRemote ? 'Remote' : 'Unknown');
      return normalizedOpportunitySchema.parse({
        source: this.kind, externalId: job.id, sourceUrl: job.jobUrl, companyName, companyDomain, title: job.title,
        description: job.descriptionPlain ?? stripHtml(job.descriptionHtml ?? ''), location, country: inferCountry(location),
        remoteType: job.isRemote ? 'REMOTE' : inferRemoteType(location), employmentType: job.employmentType ?? null,
        postedAt: job.publishedAt ? new Date(job.publishedAt).toISOString() : null, discoveredAt: now, rawData: job
      });
    });
    yield { records, checkpoint: null, done: true, rawRecordCount: response.jobs.length };
  }
}

function stripHtml(value: string): string { return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
