import type { CompanyAnalysis } from '@gtm/ai';
import type { EvidenceDraft } from './evidence.js';

export interface ProfileDraft { summary: string | null; industry: string | null; businessModel: string | null; stage: string | null; locations: string[]; products: string[]; services: string[]; customerTypes: string[]; technicalFocus: string[]; aiRelevance: number; engineeringNeed: number; contactability: number; researchConfidence: number; growthSignals: string[]; hiringSignals: string[]; whatIsHappening: string; whyItMatters: string; whyMatch: string; recommendedNextStep: string; aiAnalysis: CompanyAnalysis | null; }
export function buildCompanyProfile(input: { companyName: string; domainConfidence: number; pagesFetched: number; pagesAttempted: number; evidence: EvidenceDraft[]; signalTypes: string[]; ai: CompanyAnalysis | null }): ProfileDraft {
  const { evidence, ai } = input; const types = new Set(input.signalTypes); const descriptions = evidence.filter((item) => item.type === 'COMPANY_DESCRIPTION').map((item) => item.evidenceText);
  const technicalFocus = [...new Set(['AI_PRODUCT','LLM_RELEVANCE','RAG_RELEVANCE','AGENT_RELEVANCE','API_PRODUCT','INTEGRATION_HEAVY_PRODUCT','SAAS_PRODUCT'].filter((item) => types.has(item)).map(label))];
  const aiRelevance = ai?.aiRelevance ?? clamp((types.has('AI_PRODUCT') ? .35 : 0) + (types.has('LLM_RELEVANCE') ? .3 : 0) + (types.has('RAG_RELEVANCE') || types.has('AGENT_RELEVANCE') ? .2 : 0));
  const engineeringNeed = ai?.engineeringNeed ?? clamp(.25 + (technicalFocus.length * .1) + ([...types].some((type) => type.includes('HIRING')) ? .3 : 0));
  const contactability = clamp((types.has('CONTACT_PAGE') ? .45 : 0) + (types.has('PUBLIC_EMAIL') ? .4 : 0) + (types.has('LEADERSHIP_PAGE') ? .15 : 0));
  const usefulRatio = input.pagesAttempted ? input.pagesFetched / input.pagesAttempted : 0; const evidenceFactor = Math.min(1, evidence.length / 8);
  const researchConfidence = clamp(input.domainConfidence * .3 + usefulRatio * .3 + evidenceFactor * .25 + (ai?.confidence ?? 0) * .15);
  const hiring = [...types].filter((type) => type.includes('HIRING') || type === 'CAREERS_PAGE'); const growth = [...types].filter((type) => ['PARTNERSHIP','FUNDING','RECENT_LAUNCH','TEAM_EXPANSION','PRODUCT_EXPANSION'].includes(type));
  const strongest = [...types].filter((type) => !['COMPANY_DESCRIPTION'].includes(type)).slice(0, 3).map(label);
  return {
    summary: ai?.companySummary || descriptions[0] || null, industry: ai?.industry ?? null, businessModel: ai?.businessModel ?? (types.has('AGENCY') ? 'Agency / client services' : types.has('SAAS_PRODUCT') ? 'Software as a service' : null), stage: ai?.companyStage ?? null,
    locations: [], products: ai?.products ?? [], services: ai?.recommendedServices.map((item) => item.text) ?? [], customerTypes: ai?.customerTypes ?? [], technicalFocus: ai?.technicalFocus.length ? ai.technicalFocus : technicalFocus,
    aiRelevance, engineeringNeed, contactability, researchConfidence, growthSignals: growth, hiringSignals: hiring,
    whatIsHappening: strongest.length ? `${input.companyName} shows ${strongest.join(', ')}.` : `${input.companyName} has limited public technical evidence.`,
    whyItMatters: engineeringNeed >= .65 ? 'The combined product and hiring evidence indicates meaningful engineering delivery demand.' : 'The available evidence warrants targeted validation before outreach.',
    whyMatch: technicalFocus.length ? `Relevant capabilities include ${technicalFocus.join(', ')}.` : 'The current evidence does not yet establish a strong technical-service match.',
    recommendedNextStep: researchConfidence < .45 ? 'RESEARCH_MORE' : aiRelevance >= .55 || engineeringNeed >= .65 ? 'CLIENT_OUTREACH' : 'REVIEW', aiAnalysis: ai
  };
}
function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function label(value: string) { return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
