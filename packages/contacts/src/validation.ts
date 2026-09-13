import { resolveAny, resolveMx } from 'node:dns/promises';
import { normalizeDomain } from '@gtm/shared';
import type { ContactStatus, ContactValidationResult } from './types.js';

const disposable = new Set(['mailinator.com','guerrillamail.com','10minutemail.com','temp-mail.org','yopmail.com','trashmail.com']);
export async function validateEmail(email: string, companyDomain: string | null, resolver: { resolveAny: typeof resolveAny; resolveMx: typeof resolveMx } = { resolveAny, resolveMx }): Promise<ContactValidationResult> {
  const {syntaxValid,domain,domainMatches,disposable:isDisposable}=basicEmailChecks(email,companyDomain);
  if (!syntaxValid || !domain) return { syntaxValid, domainMatches, disposable: isDisposable, dnsStatus: 'INVALID', mxStatus: 'INVALID', mxHosts: [] };
  let dnsStatus: ContactValidationResult['dnsStatus'] = 'UNKNOWN'; let mxStatus: ContactValidationResult['mxStatus'] = 'UNKNOWN'; let mxHosts: string[] = []; const errors: string[] = [];
  try { await resolver.resolveAny(domain); dnsStatus = 'VALID'; } catch (error) { dnsStatus = dnsErrorStatus(error); errors.push(message(error)); }
  try { const records = await resolver.resolveMx(domain); mxHosts = records.sort((a,b) => a.priority-b.priority).map((item) => item.exchange); mxStatus = mxHosts.length ? 'VALID' : 'INVALID'; if(mxStatus==='VALID')dnsStatus='VALID'; } catch (error) { mxStatus = dnsErrorStatus(error); errors.push(message(error)); }
  return { syntaxValid, domainMatches, disposable: isDisposable, dnsStatus, mxStatus, mxHosts, ...(errors.length ? { error: errors.join('; ') } : {}) };
}
export function basicEmailChecks(email:string,companyDomain:string|null){const syntaxValid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);const domain=normalizeDomain(email.split('@')[1]);return {syntaxValid,domain,domainMatches:Boolean(domain&&domain===normalizeDomain(companyDomain)),disposable:Boolean(domain&&disposable.has(domain))};}
export function contactConfidence(input: { status: ContactStatus; sourceOfficial: boolean; domainMatches: boolean; syntaxValid: boolean; disposable: boolean; dnsStatus: string; mxStatus: string; personConfidence?: number | null; patternConfidence?: number | null }) {
  let score = input.status === 'PUBLIC_NAMED' ? 58 : input.status === 'PUBLIC_GENERAL' ? 42 : input.status === 'PATTERN_INFERRED' ? 30 : 12;
  if (input.sourceOfficial) score += 12; if (input.domainMatches) score += 10; if (input.syntaxValid) score += 5; if (input.dnsStatus === 'VALID') score += 5; if (input.mxStatus === 'VALID') score += 7; if (input.disposable) score -= 35;
  score += Math.round((input.personConfidence ?? 0) * 5 + (input.patternConfidence ?? 0) * 5); return Math.max(0, Math.min(100, score));
}
function dnsErrorStatus(error: unknown): 'INVALID' | 'UNKNOWN' { const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''; return ['ENOTFOUND','ENODATA','ENOTIMP'].includes(code) ? 'INVALID' : 'UNKNOWN'; }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
