import { createHash } from 'node:crypto';

const corporateSuffixes = /\b(incorporated|corporation|corp|inc|llc|ltd|limited|company|co)\.?$/i;

export function normalizeDomain(value?: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const candidate = value.includes('://') ? value : `https://${value}`;
    const hostname = new URL(candidate).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    return hostname || null;
  } catch {
    return null;
  }
}

export function extractDomainFromUrl(value?: string | null): string | null {
  return normalizeDomain(value);
}

export function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function normalizeCompanyName(value: string): string {
  return normalizeText(value).replace(corporateSuffixes, '').trim();
}

export function jobFingerprint(input: {
  companyDomain?: string | null;
  companyName: string;
  title: string;
  location?: string | null;
  sourceUrl?: string | null;
}): string {
  const company = normalizeDomain(input.companyDomain) ?? normalizeCompanyName(input.companyName);
  const title = normalizeText(input.title).replace(/\b(sr|jr)\b/g, (part) => part === 'sr' ? 'senior' : 'junior');
  const location = normalizeText(input.location ?? 'unknown');
  const material = [company, title, location].join('|');
  return createHash('sha256').update(material).digest('hex');
}

export function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function inferCountry(location: string): string | null {
  const normalized = normalizeText(location);
  if (/\b(united states|usa|us|remote us|new york|san francisco|california|texas|massachusetts|washington|florida|illinois|colorado)\b/.test(normalized)) return 'US';
  return null;
}

export function inferRemoteType(location: string): 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN' {
  const text = normalizeText(location);
  if (text.includes('remote')) return 'REMOTE';
  if (text.includes('hybrid')) return 'HYBRID';
  if (text && text !== 'unknown') return 'ONSITE';
  return 'UNKNOWN';
}
