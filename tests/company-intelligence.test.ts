import { describe, expect, it } from 'vitest';
import { cleanHtml, classifyPage, hashCleanPage, rankInternalLinks } from '@gtm/crawler';
import { buildCompanyProfile, extractDeterministicEvidence, extractJobEvidence, resolveCompanyDomain } from '@gtm/research';
import { detectSignals } from '@gtm/signals';

const html = `<!doctype html><html><head><title>Acme AI Platform</title><meta name="description" content="Acme provides an AI assistant and developer API for support teams."><script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script></head><body><header><nav>Noise <a href="/products">Product</a><a href="/about">About</a><a href="/careers">Jobs</a></nav></header><main><h1>AI support automation</h1><p>Connect our LLM assistant using APIs, webhooks, and integrations. Start a free trial.</p><a href="mailto:hello@acme.com">Contact us</a></main><footer>Repeated footer noise</footer></body></html>`;

describe('company crawler cleaning and discovery', () => {
  it('removes layout noise and extracts useful structured fields', () => {
    const page = cleanHtml(html, 'https://acme.com/');
    expect(page.textContent).not.toContain('Repeated footer noise'); expect(page.metaDescription).toContain('AI assistant'); expect(page.emails).toContain('hello@acme.com'); expect(page.structuredData).toHaveLength(1); expect(hashCleanPage(page)).toHaveLength(64);
  });
  it('classifies and ranks high-value internal pages', () => {
    const page = cleanHtml(html, 'https://acme.com/'); const ranked = rankInternalLinks(page);
    expect(classifyPage('https://acme.com/pricing')).toBe('PRICING'); expect(ranked.map((item) => item.pageType)).toEqual(expect.arrayContaining(['PRODUCT','ABOUT','CAREERS'])); expect(ranked[0]?.pageType).toBe('PRODUCT');
  });
});

describe('evidence-first research', () => {
  it('resolves only supported domains with explicit confidence', () => {
    expect(resolveCompanyDomain({ companyName: 'Acme', existingDomain: 'https://www.acme.com' })).toMatchObject({ domain: 'acme.com', method: 'EXISTING_DOMAIN', confidence: 1, accepted: true });
    expect(resolveCompanyDomain({ companyName: 'Acme', descriptionUrls: ['https://linkedin.com/company/acme'] })).toMatchObject({ domain: null, accepted: false });
    expect(resolveCompanyDomain({ companyName: 'Acme Labs', descriptionUrls: ['https://acmelabs.io/platform'] })).toMatchObject({ domain: 'acmelabs.io', method: 'JOB_DESCRIPTION_LINK', accepted: true });
  });
  it('extracts concise first-party evidence and severity-weighted signals', () => {
    const evidence = extractDeterministicEvidence(cleanHtml(html, 'https://acme.com/'));
    expect(evidence.some((item) => item.type === 'AI_PRODUCT' && item.classification === 'FACT')).toBe(true);
    const signals = detectSignals(evidence); expect(signals.find((item) => item.type === 'AI_PRODUCT')).toMatchObject({ severity: 'VERY_HIGH', weight: 22 });
  });
  it('turns ATS hiring facts into critical signals and a deterministic profile', () => {
    const evidence = extractJobEvidence([{ title: 'Senior LLM Engineer', description: 'Build RAG agents', sourceUrl: 'https://jobs.acme.com/1' }]); const signals = detectSignals(evidence);
    expect(signals[0]).toMatchObject({ type: 'LLM_ENGINEER_HIRING', severity: 'CRITICAL' });
    const profile = buildCompanyProfile({ companyName: 'Acme', domainConfidence: 1, pagesFetched: 3, pagesAttempted: 4, evidence, signalTypes: signals.map((item) => item.type), ai: null });
    expect(profile.whatIsHappening).toContain('Llm Engineer Hiring'); expect(profile.researchConfidence).toBeGreaterThan(0.5); expect(profile.aiAnalysis).toBeNull();
  });
});
