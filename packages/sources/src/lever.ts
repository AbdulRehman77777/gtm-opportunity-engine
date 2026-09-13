import { z } from 'zod';
import { inferCountry, inferRemoteType, normalizeDomain, normalizedOpportunitySchema } from '@gtm/shared';
import { fetchJson } from './http.js';
import { optionalString, requiredString, type DiscoveryContext, type OpportunitySource } from './types.js';

const leverJobSchema = z.object({
  id: z.string(), text: z.string(), hostedUrl: z.string().url(), createdAt: z.number().optional(),
  descriptionPlain: z.string().optional(), description: z.string().optional(),
  categories: z.object({ location: z.string().optional(), commitment: z.string().optional(), team: z.string().optional() }).optional()
});

export class LeverSource implements OpportunitySource {
  readonly kind = 'LEVER' as const;
  async *discover(config: Record<string, unknown>, context: DiscoveryContext = {}) {
    const site = requiredString(config, 'site');
    const companyName = optionalString(config, 'companyName') ?? site;
    const companyDomain = normalizeDomain(optionalString(config, 'companyDomain'));
    let skip = Number(context.checkpoint ?? 0);
    const limit = 100;
    while (true) {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json&limit=${limit}&skip=${skip}`;
      const jobs = z.array(leverJobSchema).parse(await fetchJson(url, { signal: context.signal, onRateLimit: context.onRateLimit }));
      const now = new Date().toISOString();
      const records = jobs.map((job) => {
        const location = job.categories?.location ?? 'Unknown';
        return normalizedOpportunitySchema.parse({
          source: this.kind, externalId: job.id, sourceUrl: job.hostedUrl, companyName, companyDomain,
          title: job.text, description: job.descriptionPlain ?? stripHtml(job.description ?? ''), location,
          country: inferCountry(location), remoteType: inferRemoteType(location), employmentType: job.categories?.commitment ?? null,
          postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null, discoveredAt: now, rawData: job
        });
      });
      skip += jobs.length;
      const done = jobs.length < limit;
      yield { records, checkpoint: done ? null : String(skip), done, rawRecordCount: jobs.length };
      if (done) break;
    }
  }
}

function stripHtml(value: string): string { return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
