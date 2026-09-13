import { contentHash, normalizeText } from '@gtm/shared';
import type { CleanPage } from '@gtm/crawler';

export type EvidenceClassification = 'FACT' | 'OBSERVATION' | 'HYPOTHESIS';
export type SourceQuality = 'FIRST_PARTY_HIGH' | 'SECONDARY_MEDIUM' | 'INFERRED_LOWER';
export interface EvidenceDraft { type: string; classification: EvidenceClassification; claim: string; evidenceText: string; sourceUrl: string; sourceQuality: SourceQuality; confidence: number; extractor: string; contentHash: string; }

const rules: Array<{ type: string; pattern: RegExp; claim: string; confidence?: number }> = [
  { type: 'AI_PRODUCT', pattern: /\b(ai-powered|artificial intelligence|generative ai|machine learning platform|ai assistant)\b/i, claim: 'The company publicly describes an AI-enabled product or capability' },
  { type: 'LLM_RELEVANCE', pattern: /\b(large language model|llms?|generative ai|gpt-?[34]|claude)\b/i, claim: 'The company publicly references LLM or generative AI technology' },
  { type: 'RAG_RELEVANCE', pattern: /\b(retrieval[- ]augmented|\brag\b|vector database|semantic search)\b/i, claim: 'The company references retrieval or semantic-search technology' },
  { type: 'AGENT_RELEVANCE', pattern: /\b(ai agents?|agentic|autonomous workflow)\b/i, claim: 'The company references AI agents or agentic workflows' },
  { type: 'API_PRODUCT', pattern: /\b(api|developer platform|developer docs|sdk|webhooks?)\b/i, claim: 'The company exposes API or developer integration capabilities' },
  { type: 'INTEGRATION_HEAVY_PRODUCT', pattern: /\b(integrations?|connects? with|syncs? with|webhooks?)\b/i, claim: 'The product emphasizes integrations with other systems' },
  { type: 'SAAS_PRODUCT', pattern: /\b(saas|software as a service|subscription platform|cloud platform)\b/i, claim: 'The company describes a software or cloud platform' },
  { type: 'PRICING', pattern: /\b(pricing|per month|annual plan|free trial|enterprise plan)\b/i, claim: 'The company publishes commercial pricing or plan language' },
  { type: 'CUSTOMER_PROOF', pattern: /\b(case stud(?:y|ies)|customer stor(?:y|ies)|trusted by|our customers)\b/i, claim: 'The company publishes customer or case-study evidence' },
  { type: 'PARTNERSHIP', pattern: /\b(partnered with|partnership|strategic partner)\b/i, claim: 'The company mentions a partnership', confidence: 0.86 },
  { type: 'RECENT_LAUNCH', pattern: /\b(launched|announcing|introducing|now available|new release)\b/i, claim: 'The company announces a product or feature launch', confidence: 0.82 },
  { type: 'AGENCY', pattern: /\b(agency|client services|digital marketing|web design agency)\b/i, claim: 'The company presents itself as an agency or client-services business' }
];

export function extractDeterministicEvidence(page: CleanPage): EvidenceDraft[] {
  const text = `${page.title ?? ''}. ${page.metaDescription ?? ''}. ${page.headings.join('. ')}. ${page.textContent}`; const output: EvidenceDraft[] = [];
  if (page.metaDescription) output.push(draft('COMPANY_DESCRIPTION', 'FACT', 'The company publishes this description', page.metaDescription, page.url, 0.98, 'meta-description'));
  for (const rule of rules) { const match = text.match(rule.pattern); if (match?.index !== undefined) output.push(draft(rule.type, 'FACT', rule.claim, excerpt(text, match.index), page.url, rule.confidence ?? 0.9, `deterministic:${rule.type.toLowerCase()}`)); }
  if (page.pageType === 'CAREERS') output.push(draft('CAREERS_PAGE', 'FACT', 'The company maintains a careers or jobs page', page.title ?? page.url, page.url, 1, 'page-type'));
  if (page.pageType === 'TEAM') output.push(draft('LEADERSHIP_PAGE', 'FACT', 'The company maintains a team or leadership page', page.title ?? page.url, page.url, 1, 'page-type'));
  if (page.pageType === 'CONTACT') output.push(draft('CONTACT_PAGE', 'FACT', 'The company maintains a public contact page', page.title ?? page.url, page.url, 1, 'page-type'));
  for (const email of page.emails.slice(0, 10)) output.push(draft('PUBLIC_EMAIL', 'FACT', 'The company publishes a contact email', email, page.url, 1, 'email-parser'));
  return unique(output);
}

export function extractJobEvidence(jobs: Array<{ title: string; description: string; sourceUrl: string }>): EvidenceDraft[] {
  const output: EvidenceDraft[] = []; const nowClaim = (title: string) => `The company is publicly hiring for ${title}`;
  for (const job of jobs) {
    const title = normalizeText(job.title); const type = /\bllm|large language model\b/.test(title) ? 'LLM_ENGINEER_HIRING' : /\bgenai|generative ai\b/.test(title) ? 'GENAI_ENGINEER_HIRING' : /\bai engineer|artificial intelligence\b/.test(title) ? 'AI_ENGINEER_HIRING' : /\bmachine learning|\bml engineer\b/.test(title) ? 'ML_ENGINEER_HIRING' : /\bfull stack|fullstack|product engineer\b/.test(title) ? 'FULLSTACK_HIRING' : null;
    if (type) output.push(draft(type, 'FACT', nowClaim(job.title), `${job.title}. ${job.description.slice(0, 300)}`, job.sourceUrl, 1, 'ats'));
    if (/\bfounding|first engineer\b/.test(title)) output.push(draft('FOUNDING_ENGINEER_HIRING', 'FACT', nowClaim(job.title), job.title, job.sourceUrl, 1, 'ats'));
    if (/\bcontract|contractor|consultant|fractional\b/.test(`${title} ${normalizeText(job.description)}`)) output.push(draft('CONTRACTOR_HIRING', 'FACT', 'The job posting explicitly mentions contract or consulting work', excerpt(job.description, 0), job.sourceUrl, .98, 'ats'));
  }
  const engineering = jobs.filter((job) => /engineer|developer|technical|machine learning|\bai\b/i.test(job.title));
  if (engineering.length >= 2) output.push(draft('MULTIPLE_ENGINEERING_ROLES', 'FACT', `The company has ${engineering.length} observed technical openings`, engineering.slice(0, 5).map((job) => job.title).join('; '), engineering[0]!.sourceUrl, 1, 'ats-aggregate'));
  return unique(output);
}

function draft(type: string, classification: EvidenceClassification, claim: string, evidenceText: string, sourceUrl: string, confidence: number, extractor: string): EvidenceDraft { const concise = evidenceText.replace(/\s+/g, ' ').trim().slice(0, 420); return { type, classification, claim, evidenceText: concise, sourceUrl, sourceQuality: 'FIRST_PARTY_HIGH', confidence, extractor, contentHash: contentHash([type, normalizeText(claim), normalizeText(concise), sourceUrl]) }; }
function excerpt(text: string, at: number) { return text.slice(Math.max(0, at - 90), Math.min(text.length, at + 280)).replace(/\s+/g, ' ').trim(); }
function unique(items: EvidenceDraft[]) { const seen = new Set<string>(); return items.filter((item) => seen.has(item.contentHash) ? false : (seen.add(item.contentHash), true)); }
