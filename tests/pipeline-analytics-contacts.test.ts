import { describe, expect, it } from 'vitest';
import { calculateFunnelConversions, revenuePerAction } from '@gtm/analytics';
import { classifyContact, extractEmails } from '@gtm/contacts';
import { canTransition, normalizedOpportunitySchema } from '@gtm/shared';

describe('boundary schemas and pipeline rules', () => {
  it('rejects invalid source URLs', () => expect(normalizedOpportunitySchema.safeParse({ source: 'CSV', externalId: 'x', sourceUrl: 'bad', companyName: 'Acme', title: 'AI Engineer', discoveredAt: new Date().toISOString(), rawData: {} }).success).toBe(false));
  it('allows valid funnel progress and blocks stage skipping', () => { expect(canTransition('CLIENT', 'CONTACTED', 'REPLIED')).toBe(true); expect(canTransition('CLIENT', 'DISCOVERED', 'WON')).toBe(false); expect(canTransition('JOB', 'APPLIED', 'RECRUITER_REPLY')).toBe(true); });
});

describe('conversion metrics', () => {
  it('calculates adjacent funnel rates without inventing rates for zero denominators', () => {
    const metrics = calculateFunnelConversions(['DISCOVERED', 'QUALIFIED', 'APPLIED'], [{ stage: 'DISCOVERED', count: 100 }, { stage: 'QUALIFIED', count: 40 }, { stage: 'APPLIED', count: 20 }]);
    expect(metrics.map((item) => item.rate)).toEqual([0.4, 0.5]); expect(revenuePerAction(1800000, 60)).toBe(30000); expect(revenuePerAction(1, 0)).toBeNull();
  });
});

describe('contact parsing and confidence', () => {
  it('extracts and deduplicates public emails', () => expect(extractEmails('Email HELLO@acme.com or hello@acme.com.')).toEqual(['hello@acme.com']));
  it('never marks inferred patterns verified', () => { expect(classifyContact({ email: 'david.chen@acme.com', companyDomain: 'acme.com', inferred: true, patternUsed: 'first.last' })).toBe('PROBABLE_PATTERN'); expect(classifyContact({ email: 'hello@acme.com', companyDomain: 'acme.com', publicSourceUrl: 'https://acme.com/contact' })).toBe('PUBLIC_VERIFIED_SOURCE'); });
});
