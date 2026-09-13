import { createHash } from 'node:crypto';
import { z } from 'zod';

export const SERVICE_CATALOG = [
  ['fractional-ai-engineering', 'Fractional AI Engineering'], ['llm-engineering', 'LLM Engineering'], ['rag-development', 'RAG Development'],
  ['ai-agent-development', 'AI Agent Development'], ['ai-chatbot', 'AI Chatbot'], ['ai-saas-development', 'AI SaaS Development'],
  ['full-stack-ai-development', 'Full-Stack AI Development'], ['saas-development', 'SaaS Development'], ['mvp-development', 'MVP Development'],
  ['python-fastapi-development', 'Python/FastAPI Development'], ['workflow-automation', 'Workflow Automation'], ['ai-integration', 'AI Integration'],
  ['api-integration', 'API Integration'], ['internal-tools', 'Internal Tools'], ['white-label-engineering', 'White-label Engineering'], ['technical-partnership', 'Technical Partnership']
] as const;

export type ServiceSignal = { id?: string; type: string; claim?: string; confidence: number };
const serviceRules: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: 'rag-development', patterns: [/rag|retrieval|knowledge base/i] },
  { slug: 'llm-engineering', patterns: [/llm|generative ai|genai/i] },
  { slug: 'ai-agent-development', patterns: [/agent|agentic/i] },
  { slug: 'white-label-engineering', patterns: [/agency|marketing agency|web agency/i] },
  { slug: 'api-integration', patterns: [/api|integration/i] },
  { slug: 'workflow-automation', patterns: [/automation|workflow/i] },
  { slug: 'full-stack-ai-development', patterns: [/full.?stack|product engineer/i] },
  { slug: 'fractional-ai-engineering', patterns: [/hiring|engineer|team expansion|founding/i] }
];

export function matchService(signals: ServiceSignal[], title = '') {
  const haystack = `${title} ${signals.map((s) => `${s.type} ${s.claim ?? ''}`).join(' ')}`;
  const ranked = serviceRules.map((rule) => ({ slug: rule.slug, score: rule.patterns.reduce((sum, pattern) => sum + (pattern.test(haystack) ? 25 : 0), 0) }))
    .sort((a, b) => b.score - a.score);
  const primary = ranked[0]?.score ? ranked[0] : { slug: 'technical-partnership', score: 20 };
  const secondary = ranked.find((item) => item.slug !== primary.slug && item.score > 0);
  const evidenceIds = signals.filter((signal) => ruleMatches(primary.slug, `${signal.type} ${signal.claim ?? ''}`)).flatMap((signal) => signal.id ? [signal.id] : []);
  return { primarySlug: primary.slug, secondarySlug: secondary?.slug, confidence: Math.min(.95, .55 + primary.score / 100), reason: serviceReason(primary.slug, haystack), evidenceIds };
}

function ruleMatches(slug: string, value: string) { return serviceRules.find((rule) => rule.slug === slug)?.patterns.some((pattern) => pattern.test(value)) ?? false; }
function serviceReason(slug: string, context: string) {
  const name = SERVICE_CATALOG.find(([key]) => key === slug)?.[1] ?? slug;
  const why = /hiring/i.test(context) ? 'active technical hiring' : /agency/i.test(context) ? 'agency delivery capacity' : 'the strongest observed technical signal';
  return `${name} best matches ${why}.`;
}

export function buildOutreachStrategy(input: { opportunityId: string; companyId: string; personId: string; contactId?: string; serviceName: string; serviceMatchId: string; signals: ServiceSignal[]; evidenceHash: string }) {
  const signal = [...input.signals].sort((a, b) => b.confidence - a.confidence)[0];
  const primarySignal = signal?.type ?? 'TECHNICAL_OPPORTUNITY';
  const angle = /HIRING/i.test(primarySignal) ? 'additional engineering capacity while the team is hiring' : `focused help with ${input.serviceName}`;
  return { ...input, primarySignal, angle, cta: 'Would it be useful if I sent two relevant examples?', confidence: Math.min(.98, .6 + (signal?.confidence ?? .4) * .35), promptVersion: 'outreach-v1' };
}

export const outreachBundleSchema = z.object({
  subjects: z.array(z.string().min(1)).min(2).max(3), coldEmail: z.string().min(20), linkedIn: z.string().min(10), followups: z.array(z.string().min(10)).length(3)
});
export type OutreachBundle = z.infer<typeof outreachBundleSchema>;

export function groundedOutreachFallback(input: { firstName: string; companyName: string; evidenceClaim: string; serviceName: string; angle: string; cta: string }): OutreachBundle {
  const fact = cleanClaim(input.evidenceClaim);
  return {
    subjects: [`${input.companyName} — ${input.serviceName}`, `Quick thought on ${fact.toLowerCase()}`, `Engineering capacity at ${input.companyName}`],
    coldEmail: `Hi ${input.firstName},\n\nI noticed ${fact}. I help teams with ${input.serviceName.toLowerCase()}, and thought ${input.angle} may be useful.\n\n${input.cta}\n\nBest,`,
    linkedIn: `Hi ${input.firstName} — I noticed ${fact}. I work on ${input.serviceName.toLowerCase()} and would be glad to share a relevant example.`,
    followups: [`Hi ${input.firstName}, just following up on my note about ${fact}. Happy to send a concise example if useful.`, `One additional thought: ${input.angle} can help teams keep momentum without changing the hiring plan. Worth sending details?`, `Hi ${input.firstName}, I’ll close the loop here. If ${input.serviceName.toLowerCase()} becomes useful, I’m happy to compare notes.`]
  };
}
function cleanClaim(value: string) { return value.replace(/\s+/g, ' ').trim().replace(/[.!]+$/, ''); }

export type SendGuardInput = { status: string; suppressed: boolean; unsubscribed: boolean; permanentlyBounced: boolean; contactConfidence: number; minimumConfidence: number; inferred: boolean; inferredConfirmed: boolean; sentCountHour: number; sentCountDay: number; hourlyLimit: number; dailyLimit: number; alreadySent: boolean };
export function assertSendAllowed(input: SendGuardInput) {
  if (input.status !== 'APPROVED') throw new Error('Message must be approved before sending');
  if (input.suppressed || input.unsubscribed || input.permanentlyBounced) throw new Error('Recipient is suppressed');
  if (input.contactConfidence < input.minimumConfidence) throw new Error('Contact confidence is below the configured minimum');
  if (input.inferred && !input.inferredConfirmed) throw new Error('Pattern-inferred contact requires explicit confirmation');
  if (input.sentCountHour >= input.hourlyLimit || input.sentCountDay >= input.dailyLimit) throw new Error('Email sending limit reached');
  if (input.alreadySent) throw new Error('Message version was already sent');
}

export function normalizeSubject(subject: string) { return subject.toLowerCase().replace(/^\s*((re|fw|fwd):\s*)+/i, '').replace(/\s+/g, ' ').trim(); }
export function threadMatch(input: { inReplyTo?: string | null; references?: string[]; sender: string; subject: string }, candidates: Array<{ id: string; messageIds: string[]; contact?: string | null; normalizedSubject: string }>) {
  const refs = new Set([input.inReplyTo, ...(input.references ?? [])].filter(Boolean));
  return candidates.find((candidate) => candidate.messageIds.some((id) => refs.has(id)))
    ?? candidates.find((candidate) => candidate.contact?.toLowerCase() === input.sender.toLowerCase() && candidate.normalizedSubject === normalizeSubject(input.subject))
    ?? candidates.find((candidate) => candidate.normalizedSubject === normalizeSubject(input.subject));
}

export const replyCategorySchema = z.enum(['INTERESTED','QUESTION','NEEDS_MORE_INFO','NOT_NOW','NOT_INTERESTED','REFERRAL','WRONG_PERSON','UNSUBSCRIBE','OUT_OF_OFFICE','BOUNCE','OTHER']);
export function classifyReplyDeterministically(text: string) {
  const value = text.toLowerCase();
  const rules: Array<[z.infer<typeof replyCategorySchema>, RegExp, number]> = [
    ['UNSUBSCRIBE', /unsubscribe|remove me|stop emailing/, .99], ['BOUNCE', /undeliverable|delivery status notification|mailbox (?:does not exist|unavailable)/, .98],
    ['OUT_OF_OFFICE', /out of (?:the )?office|automatic reply/, .97], ['WRONG_PERSON', /wrong person|not the right person/, .94], ['REFERRAL', /(?:speak|contact|reach out) to|looping in/, .86],
    ['NOT_INTERESTED', /not interested|no thanks|please don't/, .96], ['NOT_NOW', /not (?:right )?now|circle back|later this/, .9], ['INTERESTED', /interested|schedule|availability|book a|let's talk|send (?:me )?(?:examples|details)/, .91],
    ['NEEDS_MORE_INFO', /send more|more information|portfolio|case stud/, .88], ['QUESTION', /\?/, .82]
  ];
  const match = rules.find(([, pattern]) => pattern.test(value));
  return match ? { classification: match[0], confidence: match[2], reason: 'Matched an explicit reply phrase.', classifier: 'DETERMINISTIC' as const } : { classification: 'OTHER' as const, confidence: .45, reason: 'No deterministic intent phrase matched.', classifier: 'DETERMINISTIC' as const };
}
export function isHighIntent(category: string) { return ['INTERESTED','QUESTION','NEEDS_MORE_INFO','REFERRAL'].includes(category); }

export type Candidate = { summary: string; skills: string[]; technologies: string[]; experience: unknown[]; projects: Array<{ id: string; name: string; description: string; technologies: string[]; results?: string | null }> };
export function matchCandidate(candidate: Candidate, job: { title: string; description: string; location?: string }) {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const known = [...new Set([...candidate.skills, ...candidate.technologies])];
  const strongSkills = known.filter((skill) => haystack.includes(skill.toLowerCase()));
  const requested = [...haystack.matchAll(/\b(?:typescript|javascript|python|fastapi|react|node(?:\.js)?|llm|rag|ai agents?|sql|aws|docker|kubernetes)\b/gi)].map((match) => match[0].toLowerCase());
  const missingSkills = [...new Set(requested)].filter((skill) => !known.some((knownSkill) => knownSkill.toLowerCase() === skill));
  const relevantProjects = candidate.projects.map((project) => ({ ...project, relevance: project.technologies.filter((technology) => haystack.includes(technology.toLowerCase())).length })).filter((project) => project.relevance > 0).sort((a, b) => b.relevance - a.relevance).slice(0, 3);
  const matchScore = Math.min(100, 35 + strongSkills.length * 8 + relevantProjects.length * 7 - missingSkills.length * 4);
  return { matchScore, strongSkills, missingSkills, relevantProjects, seniorityFit: /senior|lead|staff/i.test(job.title) ? 'REVIEW_EXPERIENCE' : 'MATCH', locationFit: 'REVIEW', recommendedPositioning: strongSkills.length ? `Lead with ${strongSkills.slice(0, 3).join(', ')} and the most relevant projects.` : 'Review manually; deterministic skill overlap is limited.' };
}

export function groundedApplicationFallback(candidate: Candidate, job: { title: string; companyName: string }, match: ReturnType<typeof matchCandidate>) {
  return { tailoredSummary: candidate.summary, skillsToEmphasize: match.strongSkills, projectsToEmphasize: match.relevantProjects.map((project) => project.name), projectOrder: match.relevantProjects.map((project) => project.id), resumeRecommendations: match.missingSkills.length ? [`Do not claim these unmatched requirements: ${match.missingSkills.join(', ')}`] : ['Place matched skills near the top.'], coverLetter: `I’m applying for the ${job.title} role at ${job.companyName}. ${candidate.summary} My relevant strengths include ${match.strongSkills.join(', ') || 'the experience documented in my profile'}. I would welcome a conversation about the role.`, applicationNote: `Interested in the ${job.title} role. My background aligns through ${match.strongSkills.slice(0, 4).join(', ') || 'the projects in my submitted profile'}.`, recruiterMessage: `Hi — I applied for the ${job.title} role and wanted to introduce myself. My most relevant experience is reflected in ${match.strongSkills.slice(0, 3).join(', ') || 'my application'}.`, hiringManagerMessage: `Hi — I applied for the ${job.title} role. I’d be glad to share relevant project details if helpful.`, linkedInMessage: `Hi — I recently applied for the ${job.title} role at ${job.companyName}. I’d be glad to connect.`, followupMessage: `Hi — I’m following up on my application for the ${job.title} role. I remain interested and am happy to provide any additional context.` };
}

export function stableHash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function followupDates(sentAt: Date, days = [4, 9, 16]) { return days.map((day) => new Date(sentAt.getTime() + day * 86_400_000).toISOString()); }
