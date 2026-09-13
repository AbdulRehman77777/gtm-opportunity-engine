import type { z } from 'zod';
import { clientStatusSchema, jobStatusSchema } from './schemas.js';

type ClientStatus = z.infer<typeof clientStatusSchema>;
type JobStatus = z.infer<typeof jobStatusSchema>;

const clientTransitions: Record<ClientStatus, ClientStatus[]> = {
  DISCOVERED: ['RESEARCHING', 'QUALIFIED', 'LOST'], RESEARCHING: ['QUALIFIED', 'LOST'], QUALIFIED: ['CONTACT_FOUND', 'READY_TO_CONTACT', 'LOST'],
  CONTACT_FOUND: ['READY_TO_CONTACT', 'LOST'], READY_TO_CONTACT: ['DRAFT_READY', 'AWAITING_APPROVAL', 'LOST'],
  DRAFT_READY: ['AWAITING_APPROVAL', 'LOST'], AWAITING_APPROVAL: ['APPROVED', 'DRAFT_READY', 'LOST'], APPROVED: ['CONTACTED', 'DRAFT_READY', 'LOST'], CONTACTED: ['FOLLOW_UP', 'REPLIED', 'LOST'],
  FOLLOW_UP: ['REPLIED', 'LOST'], REPLIED: ['POSITIVE_REPLY', 'LOST'], POSITIVE_REPLY: ['MEETING', 'LOST'], MEETING: ['PROPOSAL', 'WON', 'LOST'],
  PROPOSAL: ['WON', 'LOST'], WON: [], LOST: ['RESEARCHING']
};
const jobTransitions: Record<JobStatus, JobStatus[]> = {
  DISCOVERED: ['QUALIFIED', 'EXPIRED'], QUALIFIED: ['READY_TO_APPLY', 'EXPIRED'], READY_TO_APPLY: ['APPLIED', 'WITHDRAWN', 'EXPIRED'],
  APPLIED: ['FOLLOWED_UP', 'RECRUITER_REPLY', 'REJECTED', 'WITHDRAWN', 'EXPIRED'], FOLLOWED_UP: ['RECRUITER_REPLY', 'REJECTED', 'WITHDRAWN'],
  RECRUITER_REPLY: ['SCREENING', 'REJECTED', 'WITHDRAWN'], SCREENING: ['INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['TECHNICAL_INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'], TECHNICAL_INTERVIEW: ['FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  FINAL_INTERVIEW: ['OFFER', 'REJECTED', 'WITHDRAWN'], OFFER: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'], ACCEPTED: [], REJECTED: [], WITHDRAWN: [], EXPIRED: []
};

export function canTransition(funnel: 'CLIENT' | 'JOB', from: string, to: string): boolean {
  if (funnel === 'CLIENT') {
    const parsedFrom = clientStatusSchema.safeParse(from); const parsedTo = clientStatusSchema.safeParse(to);
    return parsedFrom.success && parsedTo.success && clientTransitions[parsedFrom.data].includes(parsedTo.data);
  }
  const parsedFrom = jobStatusSchema.safeParse(from); const parsedTo = jobStatusSchema.safeParse(to);
  return parsedFrom.success && parsedTo.success && jobTransitions[parsedFrom.data].includes(parsedTo.data);
}

export function assertTransition(funnel: 'CLIENT' | 'JOB', from: string, to: string): void {
  if (!canTransition(funnel, from, to)) throw new Error(`Invalid ${funnel} transition: ${from} -> ${to}`);
}
