import { normalizeCompanyName, normalizeDomain } from '@gtm/shared';

const excluded = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'linkedin.com', 'indeed.com', 'glassdoor.com', 'github.com', 'facebook.com', 'twitter.com', 'x.com'];
export interface DomainResolution { domain: string | null; method: 'EXISTING_DOMAIN' | 'SOURCE_METADATA' | 'JOB_DESCRIPTION_LINK' | 'UNRESOLVED'; confidence: number; evidenceUrl: string | null; accepted: boolean; }

export function resolveCompanyDomain(input: { companyName: string; existingDomain?: string | null; sourceDomains?: string[]; descriptionUrls?: string[] }): DomainResolution {
  const existing = safe(input.existingDomain); if (existing) return { domain: existing, method: 'EXISTING_DOMAIN', confidence: 1, evidenceUrl: null, accepted: true };
  for (const candidate of input.sourceDomains ?? []) { const domain = safe(candidate); if (domain) return { domain, method: 'SOURCE_METADATA', confidence: 0.92, evidenceUrl: candidate, accepted: true }; }
  const companyTokens = normalizeCompanyName(input.companyName).split(' ').filter((token) => token.length > 2);
  for (const candidate of input.descriptionUrls ?? []) { const domain = safe(candidate); if (!domain) continue; const lexicalMatch = companyTokens.some((token) => domain.includes(token)); const confidence = lexicalMatch ? 0.72 : 0.55; return { domain, method: 'JOB_DESCRIPTION_LINK', confidence, evidenceUrl: candidate, accepted: confidence >= 0.7 }; }
  return { domain: null, method: 'UNRESOLVED', confidence: 0, evidenceUrl: null, accepted: false };
}
function safe(value?: string | null) { const domain = normalizeDomain(value); return domain && !excluded.some((item) => domain === item || domain.endsWith(`.${item}`)) ? domain : null; }
