import { normalizeDomain } from '@gtm/shared';
import type { ContactDraft, EmailPattern, PersonDraft } from './types.js';

export function extractEmails(text: string): string[] { return [...new Set((text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi) ?? []).map((email) => email.toLowerCase().replace(/[),.;:]+$/, '')))]; }
/** Backward-compatible Milestone 1 provenance classifier. New persisted contacts use ContactStatus. */
export function classifyContact(input:{email:string;companyDomain?:string|null;publicSourceUrl?:string|null;inferred?:boolean;patternUsed?:string|null}):'PUBLIC_VERIFIED_SOURCE'|'PUBLIC_GENERAL'|'PROBABLE_PATTERN'|'INFERRED'|'UNKNOWN'{if(input.inferred)return input.patternUsed?'PROBABLE_PATTERN':'INFERRED';const emailDomain=normalizeDomain(input.email.split('@')[1]);const companyDomain=normalizeDomain(input.companyDomain);if(input.publicSourceUrl&&emailDomain&&emailDomain===companyDomain)return 'PUBLIC_VERIFIED_SOURCE';if(input.publicSourceUrl)return 'PUBLIC_GENERAL';return 'UNKNOWN';}
export function discoverPublicContacts(pages: Array<{ pageId?: string; url: string; pageType: string; textContent: string; emails?: unknown[] }>, people: PersonDraft[], companyDomain: string): ContactDraft[] {
  const results = new Map<string, ContactDraft>();
  for (const page of pages) for (const value of [...new Set([...extractEmails(page.textContent), ...(page.emails ?? []).map(String).map((item) => item.toLowerCase())])]) {
    const person = people.find((candidate) => emailMatchesPerson(value, candidate)); const domainMatch = normalizeDomain(value.split('@')[1]) === normalizeDomain(companyDomain);
    const generic = /^(info|hello|contact|support|sales|press|media|careers|jobs|team|office|admin)@/.test(value); const status = person && domainMatch ? 'PUBLIC_NAMED' : 'PUBLIC_GENERAL';
    const confidence = person && domainMatch ? 92 : domainMatch ? (generic ? 78 : 73) : 55;
    const current: ContactDraft = { personNormalizedName: person?.normalizedName ?? null, value, status, sourceUrl: page.url, sourceType: page.pageType === 'TEAM' ? 'OFFICIAL_TEAM' : 'OFFICIAL_COMPANY_PAGE', pageId: page.pageId, confidence };
    const prior = results.get(value); if (!prior || prior.confidence < confidence) results.set(value, current);
  }
  return [...results.values()];
}
export function detectEmailPattern(named: Array<{ email: string; person: Pick<PersonDraft, 'firstName' | 'lastName'> }>, companyDomain: string): EmailPattern | null {
  const domain = normalizeDomain(companyDomain); if (!domain) return null; const groups = new Map<string, string[]>();
  for (const item of named) { const [local = '', emailDomain = ''] = item.email.toLowerCase().split('@'); const pattern = identifyPattern(local, item.person); if (!pattern || normalizeDomain(emailDomain) !== domain) continue; const list = groups.get(pattern) ?? []; list.push(item.email); groups.set(pattern, list); }
  const winner = [...groups.entries()].filter(([, emails]) => new Set(emails).size >= 2).sort((a,b) => b[1].length-a[1].length)[0];
  return winner ? { pattern: winner[0], domain, evidenceEmails: [...new Set(winner[1])], confidence: Math.min(.92, .7 + winner[1].length * .07) } : null;
}
export function inferEmail(pattern: EmailPattern, person: Pick<PersonDraft, 'firstName' | 'lastName' | 'normalizedName'>): ContactDraft {
  const first = token(person.firstName); const last = token(person.lastName); const local = pattern.pattern.replace('{first}', first).replace('{last}', last).replace('{f}', first[0] ?? '').replace('{l}', last[0] ?? '');
  return { personNormalizedName: person.normalizedName, value: `${local}@${pattern.domain}`, status: 'PATTERN_INFERRED', sourceUrl: `pattern://${pattern.domain}/${pattern.pattern}`, sourceType: 'EMAIL_PATTERN', patternUsed: pattern.pattern, confidence: Math.round(pattern.confidence * 68) };
}
export function emailMatchesPerson(email: string, person: Pick<PersonDraft, 'firstName' | 'lastName'>) { const local = (email.toLowerCase().split('@')[0] ?? '').replace(/[^a-z]/g, ''); const first = token(person.firstName); const last = token(person.lastName); return Boolean(first && last && (local === `${first}${last}` || local === `${last}${first}` || local === `${first[0] ?? ''}${last}` || local === `${first}${last[0] ?? ''}` || local === first)); }
function identifyPattern(local: string, person: Pick<PersonDraft, 'firstName' | 'lastName'>) { const first=token(person.firstName), last=token(person.lastName); const variants: Array<[string,string]> = [[`${first}.${last}`,'{first}.{last}'],[`${first}_${last}`,'{first}_{last}'],[`${first}-${last}`,'{first}-{last}'],[`${first}${last}`,'{first}{last}'],[`${first[0] ?? ''}${last}`,'{f}{last}'],[`${first}.${last[0] ?? ''}`,'{first}.{l}'],[first,'{first}']]; return variants.find(([value]) => value === local)?.[1] ?? null; }
function token(value: string) { return value.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, ''); }
