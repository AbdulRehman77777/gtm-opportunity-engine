import type { EvidenceDraft } from '@gtm/research';
export type SignalSeverity = 'CRITICAL' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface DetectedSignal { type: string; severity: SignalSeverity; weight: number; confidence: number; claim: string; evidenceHash: string; sourceQuality: string; }

const definitions: Record<string, { signal: string; severity: SignalSeverity; weight: number }> = {
  AI_ENGINEER_HIRING: { signal: 'AI_ENGINEER_HIRING', severity: 'CRITICAL', weight: 25 }, LLM_ENGINEER_HIRING: { signal: 'LLM_ENGINEER_HIRING', severity: 'CRITICAL', weight: 25 }, GENAI_ENGINEER_HIRING: { signal: 'GENAI_ENGINEER_HIRING', severity: 'CRITICAL', weight: 25 },
  ML_ENGINEER_HIRING: { signal: 'ML_ENGINEER_HIRING', severity: 'VERY_HIGH', weight: 22 }, FULLSTACK_HIRING: { signal: 'FULLSTACK_HIRING', severity: 'HIGH', weight: 17 }, MULTIPLE_ENGINEERING_ROLES: { signal: 'MULTIPLE_ENGINEERING_ROLES', severity: 'VERY_HIGH', weight: 21 },
  FOUNDING_ENGINEER_HIRING: { signal: 'FOUNDING_ENGINEER_HIRING', severity: 'CRITICAL', weight: 25 }, CONTRACTOR_HIRING: { signal: 'CONTRACTOR_HIRING', severity: 'VERY_HIGH', weight: 22 },
  AI_PRODUCT: { signal: 'AI_PRODUCT', severity: 'VERY_HIGH', weight: 22 }, LLM_RELEVANCE: { signal: 'LLM_RELEVANCE', severity: 'VERY_HIGH', weight: 20 }, RAG_RELEVANCE: { signal: 'RAG_RELEVANCE', severity: 'HIGH', weight: 17 },
  AGENT_RELEVANCE: { signal: 'AGENT_RELEVANCE', severity: 'HIGH', weight: 17 }, API_PRODUCT: { signal: 'API_PRODUCT', severity: 'MEDIUM', weight: 10 }, INTEGRATION_HEAVY_PRODUCT: { signal: 'INTEGRATION_HEAVY_PRODUCT', severity: 'HIGH', weight: 15 },
  SAAS_PRODUCT: { signal: 'SAAS_PRODUCT', severity: 'HIGH', weight: 14 }, RECENT_LAUNCH: { signal: 'RECENT_LAUNCH', severity: 'VERY_HIGH', weight: 19 }, PARTNERSHIP: { signal: 'PARTNERSHIP', severity: 'MEDIUM', weight: 9 },
  AGENCY: { signal: 'AGENCY', severity: 'HIGH', weight: 14 }, CAREERS_PAGE: { signal: 'TEAM_EXPANSION', severity: 'MEDIUM', weight: 9 }, LEADERSHIP_PAGE: { signal: 'LEADERSHIP_PAGE', severity: 'MEDIUM', weight: 7 },
  CONTACT_PAGE: { signal: 'CONTACT_PAGE', severity: 'MEDIUM', weight: 7 }, PUBLIC_EMAIL: { signal: 'PUBLIC_EMAIL', severity: 'MEDIUM', weight: 8 }, PRICING: { signal: 'SAAS_PRODUCT', severity: 'MEDIUM', weight: 7 }, CUSTOMER_PROOF: { signal: 'CUSTOMER_GROWTH', severity: 'MEDIUM', weight: 8 }
};
export function detectSignals(evidence: EvidenceDraft[]): DetectedSignal[] {
  const best = new Map<string, DetectedSignal>();
  for (const item of evidence) { const definition = definitions[item.type]; if (!definition) continue; const candidate = { type: definition.signal, severity: definition.severity, weight: definition.weight, confidence: item.confidence, claim: item.claim, evidenceHash: item.contentHash, sourceQuality: item.sourceQuality }; const prior = best.get(candidate.type); if (!prior || prior.confidence < candidate.confidence) best.set(candidate.type, candidate); }
  return [...best.values()].sort((a, b) => b.weight * b.confidence - a.weight * a.confidence);
}
