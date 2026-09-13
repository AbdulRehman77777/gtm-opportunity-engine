import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { inferCountry, inferRemoteType, normalizeDomain, normalizedOpportunitySchema, type NormalizedOpportunity } from '@gtm/shared';

export function normalizeManual(input: {
  url: string; companyName: string; companyDomain?: string | undefined; title: string; description?: string | undefined; location?: string | undefined; postedAt?: string | undefined;
}): NormalizedOpportunity {
  const location = input.location ?? 'Unknown';
  return normalizedOpportunitySchema.parse({
    source: 'MANUAL_URL', externalId: createHash('sha256').update(input.url).digest('hex'), sourceUrl: input.url,
    companyName: input.companyName, companyDomain: normalizeDomain(input.companyDomain), title: input.title,
    description: input.description ?? '', location, country: inferCountry(location), remoteType: inferRemoteType(location),
    postedAt: input.postedAt ?? null, discoveredAt: new Date().toISOString(), rawData: input
  });
}

export interface CsvImportResult { records: NormalizedOpportunity[]; errors: Array<{ row: number; message: string }>; }

export function parseCsvImport(csv: string): CsvImportResult {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const records: NormalizedOpportunity[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  rows.forEach((row, index) => {
    try {
      const sourceUrl = row.source_url || row.url;
      if (!sourceUrl) throw new Error('Missing source_url');
      const location = row.location || 'Unknown';
      records.push(normalizedOpportunitySchema.parse({
        source: 'CSV', externalId: row.external_id || createHash('sha256').update(sourceUrl).digest('hex'), sourceUrl,
        companyName: row.company_name, companyDomain: normalizeDomain(row.company_domain), title: row.title,
        description: row.description || '', location, country: row.country || inferCountry(location), remoteType: row.remote_type || inferRemoteType(location),
        employmentType: row.employment_type || null, compensation: row.compensation || null,
        postedAt: row.posted_at ? new Date(row.posted_at).toISOString() : null, discoveredAt: new Date().toISOString(), rawData: row
      }));
    } catch (error) { errors.push({ row: index + 2, message: error instanceof Error ? error.message : 'Invalid row' }); }
  });
  return { records, errors };
}
