import { z } from 'zod';

export const sourceKindSchema = z.enum(['GREENHOUSE', 'LEVER', 'ASHBY', 'MANUAL_URL', 'CSV']);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const remoteTypeSchema = z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN']);
export const recommendedActionSchema = z.enum(['CLIENT_OUTREACH', 'JOB_APPLICATION', 'BOTH', 'RESEARCH', 'SKIP']);

export const normalizedOpportunitySchema = z.object({
  type: z.literal('JOB').default('JOB'),
  source: sourceKindSchema,
  externalId: z.string().min(1),
  sourceUrl: z.string().url(),
  companyName: z.string().min(1),
  companyDomain: z.string().nullable().default(null),
  title: z.string().min(1),
  description: z.string().default(''),
  location: z.string().default('Unknown'),
  country: z.string().nullable().default(null),
  remoteType: remoteTypeSchema.default('UNKNOWN'),
  employmentType: z.string().nullable().default(null),
  compensation: z.string().nullable().default(null),
  postedAt: z.string().datetime().nullable().default(null),
  discoveredAt: z.string().datetime(),
  rawData: z.record(z.string(), z.unknown())
});
export type NormalizedOpportunity = z.infer<typeof normalizedOpportunitySchema>;

export const sourceConfigSchema = z.object({
  id: z.string().uuid(),
  kind: sourceKindSchema,
  name: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown())
});

export const manualImportSchema = z.object({
  url: z.string().url(),
  companyName: z.string().min(1),
  companyDomain: z.string().optional(),
  title: z.string().min(1),
  description: z.string().default(''),
  location: z.string().default('Unknown'),
  postedAt: z.string().datetime().optional()
});

export const sourceRunRequestSchema = z.object({ sourceId: z.string().uuid() });

export const clientStatusSchema = z.enum([
  'DISCOVERED', 'RESEARCHING', 'QUALIFIED', 'CONTACT_FOUND', 'READY_TO_CONTACT',
  'DRAFT_READY', 'AWAITING_APPROVAL', 'APPROVED', 'CONTACTED', 'FOLLOW_UP', 'REPLIED',
  'POSITIVE_REPLY', 'MEETING', 'PROPOSAL', 'WON', 'LOST'
]);
export const jobStatusSchema = z.enum([
  'DISCOVERED', 'QUALIFIED', 'READY_TO_APPLY', 'APPLIED', 'FOLLOWED_UP', 'RECRUITER_REPLY',
  'SCREENING', 'INTERVIEW', 'TECHNICAL_INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'ACCEPTED',
  'REJECTED', 'WITHDRAWN', 'EXPIRED'
]);
