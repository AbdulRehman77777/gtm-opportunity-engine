import { DEFAULT_EXCLUDED_KEYWORDS, DEFAULT_JOB_KEYWORDS, normalizeText, type NormalizedOpportunity } from '@gtm/shared';

export interface ScoreResult {
  total: number;
  components: Record<string, number>;
  reasons: string[];
  matchedKeywords: string[];
  version: string;
}
export interface EnrichmentInput {
  prior: ScoreResult;
  signals: Array<{ type: string; weight: number; confidence: number }>;
  researchConfidence: number;
  aiRelevance: number;
  engineeringNeed: number;
  contactability: number;
}

const aiTerms = ['ai', 'artificial intelligence', 'llm', 'genai', 'generative ai', 'rag', 'machine learning', 'nlp'];
const stackTerms = ['python', 'fastapi', 'typescript', 'react', 'node', 'api', 'full stack', 'full-stack', 'saas', 'automation'];

function matches(haystack: string, terms: string[]): string[] {
  return [...new Set(terms.filter((term) => haystack.includes(normalizeText(term))))];
}

export function isRelevantJob(job: NormalizedOpportunity, include = DEFAULT_JOB_KEYWORDS, exclude = DEFAULT_EXCLUDED_KEYWORDS): boolean {
  const text = normalizeText(`${job.title} ${job.description}`);
  return matches(text, include).length > 0 && matches(normalizeText(job.title), exclude).length === 0;
}

export function scoreJob(job: NormalizedOpportunity, now = new Date()): ScoreResult {
  const text = normalizeText(`${job.title} ${job.description}`);
  const title = normalizeText(job.title);
  const matchedAi = matches(text, aiTerms);
  const matchedStack = matches(text, stackTerms);
  const targetMatches = matches(text, DEFAULT_JOB_KEYWORDS);
  const components = {
    technicalSkillMatch: Math.min(30, matchedStack.length * 5 + (targetMatches.length ? 10 : 0)),
    aiLlmRelevance: Math.min(20, matchedAi.length * 5),
    experienceMatch: /senior|lead|staff|principal/.test(title) ? 15 : 11,
    seniorityMatch: /senior|lead|staff/.test(title) ? 10 : 7,
    remoteLocationMatch: job.remoteType === 'REMOTE' ? 10 : job.country === 'US' ? 8 : 3,
    compensationFit: job.compensation ? 5 : 0,
    companyAttractiveness: 3,
    postingFreshness: freshness(job.postedAt, now, 5)
  };
  return result(components, [
    ...targetMatches.slice(0, 4).map((term) => `Matched ${term}`),
    ...(job.remoteType === 'REMOTE' ? ['Remote role'] : []),
    ...(job.country === 'US' ? ['United States target market'] : [])
  ], [...matchedAi, ...matchedStack]);
}

export function scoreClient(job: NormalizedOpportunity): ScoreResult {
  const text = normalizeText(`${job.title} ${job.description}`);
  const matchedAi = matches(text, aiTerms);
  const matchedStack = matches(text, stackTerms);
  const founding = /founding|first engineer/.test(text);
  const contract = /contract|contractor|consultant|fractional/.test(text);
  const components = {
    icpFit: Math.min(20, 8 + matchedStack.length * 2),
    buyingIntent: Math.min(25, 12 + matchedAi.length * 3 + (founding ? 4 : 0) + (contract ? 4 : 0)),
    technicalOpportunity: Math.min(20, 8 + matchedStack.length * 2 + matchedAi.length),
    urgency: job.postedAt ? 7 : 4,
    abilityToPay: 2,
    companyQuality: 3,
    decisionMakerFound: 0,
    contactability: job.companyDomain ? 2 : 0,
    evidenceConfidence: 4
  };
  return result(components, [
    `Active hiring for ${job.title}`,
    ...matchedAi.slice(0, 3).map((term) => `AI investment signal: ${term}`),
    ...(contract ? ['Contract or consulting language detected'] : []),
    ...(founding ? ['Founding engineering hire indicates build urgency'] : [])
  ], [...matchedAi, ...matchedStack]);
}

export function recommendedAction(client: number, job: number): 'CLIENT_OUTREACH' | 'JOB_APPLICATION' | 'BOTH' | 'RESEARCH' | 'SKIP' {
  if (client >= 70 && job >= 70) return 'BOTH';
  if (job >= 70) return 'JOB_APPLICATION';
  if (client >= 70) return 'CLIENT_OUTREACH';
  if (Math.max(client, job) >= 50) return 'RESEARCH';
  return 'SKIP';
}

export function enrichClientScore(input: EnrichmentInput): ScoreResult {
  const signalTypes = new Set(input.signals.map((item) => item.type)); const weightedStrength = input.signals.reduce((sum, item) => sum + item.weight * item.confidence, 0);
  const components = {
    icpFit: capped(20, Number(input.prior.components.icpFit ?? 0) + input.aiRelevance * 5),
    buyingIntent: capped(25, Number(input.prior.components.buyingIntent ?? 0) + Math.min(8, weightedStrength / 12)),
    technicalOpportunity: capped(20, Number(input.prior.components.technicalOpportunity ?? 0) + input.engineeringNeed * 6),
    urgency: capped(10, Number(input.prior.components.urgency ?? 0) + (signalTypes.has('RECENT_LAUNCH') ? 3 : 0)),
    abilityToPay: capped(5, Number(input.prior.components.abilityToPay ?? 0) + (signalTypes.has('SAAS_PRODUCT') || signalTypes.has('CUSTOMER_GROWTH') ? 2 : 0)),
    companyQuality: capped(5, Number(input.prior.components.companyQuality ?? 0) + (input.researchConfidence >= .7 ? 2 : 1)),
    decisionMakerFound: capped(5, Number(input.prior.components.decisionMakerFound ?? 0) + (signalTypes.has('LEADERSHIP_PAGE') ? 2 : 0)),
    contactability: capped(5, Number(input.prior.components.contactability ?? 0) + input.contactability * 3),
    evidenceConfidence: capped(5, Math.round(input.researchConfidence * 5))
  };
  return result(components, [`Research confidence ${Math.round(input.researchConfidence * 100)}%`, ...input.signals.slice(0, 4).map((item) => `Evidence-backed signal: ${item.type.replaceAll('_', ' ').toLowerCase()}`)], input.signals.map((item) => item.type), 'heuristic-v2');
}

export function enrichJobScore(input: EnrichmentInput): ScoreResult {
  const components = { ...input.prior.components,
    companyAttractiveness: capped(5, Number(input.prior.components.companyAttractiveness ?? 0) + input.researchConfidence * 2),
    aiLlmRelevance: capped(20, Number(input.prior.components.aiLlmRelevance ?? 0) + input.aiRelevance * 3)
  };
  return result(components, [...input.prior.reasons, `Company research confidence ${Math.round(input.researchConfidence * 100)}%`], input.prior.matchedKeywords, 'heuristic-v2');
}

function freshness(postedAt: string | null, now: Date, maximum: number): number {
  if (!postedAt) return 1;
  const days = Math.max(0, (now.getTime() - new Date(postedAt).getTime()) / 86_400_000);
  return days <= 3 ? maximum : days <= 7 ? maximum - 1 : days <= 14 ? maximum - 2 : days <= 30 ? 2 : 0;
}

function result(components: Record<string, number>, reasons: string[], matchedKeywords: string[], version = 'heuristic-v1'): ScoreResult {
  const rounded = Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value)]));
  return { total: Math.min(100, Object.values(rounded).reduce((sum, value) => sum + value, 0)), components: rounded, reasons, matchedKeywords: [...new Set(matchedKeywords)], version };
}
function capped(maximum: number, value: number) { return Math.max(0, Math.min(maximum, value)); }
