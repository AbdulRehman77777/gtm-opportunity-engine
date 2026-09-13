import type { PersonDraft, RankedPerson } from './types.js';

export function rankDecisionMakers(people: PersonDraft[], context: { businessModel?: string | null; stage?: string | null; technicalFocus?: string[]; recommendedServices?: string[] }): RankedPerson[] {
  const agency = /agency|services/i.test(context.businessModel ?? ''); const small = /early|seed|startup|small/i.test(context.stage ?? ''); const ai = [...(context.technicalFocus ?? []), ...(context.recommendedServices ?? [])].some((item) => /ai|llm|rag|agent/i.test(item));
  return people.map((person) => {
    let score = baseRole(person.normalizedTitle); const reasons: string[] = [];
    if (person.seniority === 'FOUNDER' && (small || agency)) { score += 12; reasons.push(agency ? 'agency owner' : 'startup owner'); }
    if (person.department === 'AI' && ai) { score += 14; reasons.push('owns AI delivery'); }
    if (person.department === 'ENGINEERING') { score += 9; reasons.push('owns technical delivery'); }
    if (person.department === 'PRODUCT' && !ai) { score += 5; reasons.push('owns product outcomes'); }
    score += Math.round(person.confidence * 8); score = clamp(score);
    return { ...person, score, confidence: Math.min(.99, person.confidence * .7 + score / 100 * .3), reason: `${titleReason(person.normalizedTitle)}${reasons.length ? `; ${reasons.join(', ')}` : ''}.` };
  }).filter((person) => person.score >= 35).sort((a, b) => b.score - a.score || b.confidence - a.confidence);
}
function baseRole(title: string) { if (/head of (ai|artificial intelligence)|director of (ai|artificial intelligence)/.test(title)) return 82; if (/\bcto\b|chief technology/.test(title)) return 84; if (/vp (of )?engineering|vice president (of )?engineering|head of engineering/.test(title)) return 78; if (/technical director|head of development/.test(title)) return 74; if (/founder|co founder/.test(title)) return 72; if (/\bceo\b|chief executive|managing director/.test(title)) return 65; if (/head of product|vp (of )?product|chief product/.test(title)) return 62; if (/director/.test(title)) return 50; return 20; }
function titleReason(title: string) { if (/ai|artificial intelligence/.test(title)) return 'Direct owner for AI initiatives'; if (/cto|technology|engineering|development|technical/.test(title)) return 'Technical decision maker appropriate for engineering services'; if (/founder|ceo|managing director/.test(title)) return 'Commercial owner appropriate for a strategic engagement'; return 'Relevant product decision maker'; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }

