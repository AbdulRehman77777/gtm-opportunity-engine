import { describe, expect, it } from 'vitest';
import { extractDomainFromUrl, jobFingerprint, normalizeDomain, normalizeText } from '@gtm/shared';

describe('normalization', () => {
  it.each([
    ['https://www.Example.com/path', 'example.com'], ['http://example.com/', 'example.com'], ['www.example.com', 'example.com'], ['example.com', 'example.com']
  ])('normalizes %s', (input, expected) => expect(normalizeDomain(input)).toBe(expected));
  it('returns null for invalid or empty domains', () => { expect(normalizeDomain('not a domain / bad')).toBeNull(); expect(extractDomainFromUrl('')).toBeNull(); });
  it('normalizes punctuation and spacing', () => expect(normalizeText('Senior  AI/LLM—Engineer')).toBe('senior ai llm engineer'));
  it('creates the same job fingerprint across URL variants and senior abbreviations', () => {
    const first = jobFingerprint({ companyName: 'Acme Inc.', companyDomain: 'https://www.acme.com', title: 'Sr. AI Engineer', location: 'Remote - US' });
    const second = jobFingerprint({ companyName: 'Acme', companyDomain: 'acme.com', title: 'Senior AI Engineer', location: 'Remote US' });
    expect(first).toBe(second);
  });
});
