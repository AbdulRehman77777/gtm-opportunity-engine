import { z } from 'zod';
import { inferCountry, inferRemoteType, normalizeDomain, normalizedOpportunitySchema } from '@gtm/shared';
import { fetchJson } from './http.js';
import { optionalString, requiredString, type DiscoveryContext, type OpportunitySource } from './types.js';

const responseSchema = z.object({
  jobs: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    absolute_url: z.string().url(),
    updated_at: z.string().optional(),
    location: z.object({ name: z.string().default('Unknown') }).optional(),
    content: z.string().optional(),
    metadata: z.array(z.unknown()).optional()
  }))
});

export class GreenhouseSource implements OpportunitySource {
  readonly kind = 'GREENHOUSE' as const;

  async *discover(config: Record<string, unknown>, context: DiscoveryContext = {}) {
    const boardToken = requiredString(config, 'boardToken');
    const companyName = optionalString(config, 'companyName') ?? boardToken;
    const companyDomain = normalizeDomain(optionalString(config, 'companyDomain'));
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
    const parsed = responseSchema.parse(await fetchJson(url, { signal: context.signal, onRateLimit: context.onRateLimit }));
    const now = new Date().toISOString();
    const records = parsed.jobs.map((job) => {
      const location = job.location?.name ?? 'Unknown';
      return normalizedOpportunitySchema.parse({
        source: this.kind, externalId: String(job.id), sourceUrl: job.absolute_url, companyName, companyDomain,
        title: job.title, description: stripHtml(job.content ?? ''), location, country: inferCountry(location),
        remoteType: inferRemoteType(location), postedAt: job.updated_at ? new Date(job.updated_at).toISOString() : null,
        discoveredAt: now, rawData: job
      });
    });
    yield { records, checkpoint: null, done: true, rawRecordCount: parsed.jobs.length };
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
