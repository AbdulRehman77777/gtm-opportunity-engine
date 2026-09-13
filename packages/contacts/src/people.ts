import { contentHash, normalizeText } from '@gtm/shared';
import type { Department, PersonDraft, Seniority } from './types.js';

const rolePattern = /(co-?founder|founder|chief (?:executive|technology|product|ai) officer|ceo|cto|cpo|vp (?:of )?(?:engineering|product|ai)|vice president (?:of )?(?:engineering|product|ai)|head of (?:engineering|development|ai|artificial intelligence|product)|director of (?:engineering|ai|artificial intelligence|product)|technical director|managing director)/i;
const namePattern = /\b([A-Z][a-z'’-]{1,30}(?:\s+[A-Z][a-z'’-]{1,30}){1,2})\b/;
const nonNameWords = new Set(['leadership','team','people','company','about','meet','co-founder','founder','president','ceo','cto','chief','officer','director','head','vice','vp']);

export function normalizePersonName(value: string) { return normalizeText(value.replace(/\s+/g, ' ').trim()); }
export function splitName(fullName: string) { const parts = fullName.trim().split(/\s+/); return { firstName: parts[0] ?? '', lastName: parts.at(-1) ?? '' }; }
export function normalizeRole(title: string): { normalizedTitle: string; department: Department; seniority: Seniority } {
  const normalizedTitle = normalizeText(title); let department: Department = 'OTHER'; let seniority: Seniority = 'OTHER';
  if (/founder/.test(normalizedTitle)) seniority = 'FOUNDER'; else if (/\b(ceo|cto|cpo|chief)\b/.test(normalizedTitle)) seniority = 'C_LEVEL'; else if (/\b(vp|vice president)\b/.test(normalizedTitle)) seniority = 'VP'; else if (/head of/.test(normalizedTitle)) seniority = 'HEAD'; else if (/director/.test(normalizedTitle)) seniority = 'DIRECTOR'; else if (/manager/.test(normalizedTitle)) seniority = 'MANAGER';
  if (/\b(ai|artificial intelligence|machine learning)\b/.test(normalizedTitle)) department = 'AI'; else if (/engineering|development|technology|technical|cto/.test(normalizedTitle)) department = 'ENGINEERING'; else if (/product|cpo/.test(normalizedTitle)) department = 'PRODUCT'; else if (/agency|managing director/.test(normalizedTitle)) department = 'AGENCY'; else if (/founder|chief executive|ceo/.test(normalizedTitle)) department = 'EXECUTIVE';
  return { normalizedTitle, department, seniority };
}

export function extractPeople(pages: Array<{ pageId?: string; url: string; pageType: string; textContent: string; headings?: unknown[]; links?: unknown[]; structuredData?: unknown[]; socialUrls?: unknown[] }>): PersonDraft[] {
  const found = new Map<string, PersonDraft>();
  for (const page of pages) {
    for (const node of flattenJson(page.structuredData ?? [])) {
      if (String(node['@type'] ?? '').toLowerCase() !== 'person') continue;
      add(found, draft(String(node.name ?? ''), String(node.jobTitle ?? node.title ?? ''), page, JSON.stringify(node).slice(0, 500), .98, profile(node, 'linkedin.com'), profile(node, 'github.com')));
    }
    if(page.pageType==='TEAM'&&isLeadershipPage(page.url)){const linkTexts=(page.links??[]).map((item)=>typeof item==='object'&&item&&'text' in item?String((item as {text:unknown}).text):'').filter((text)=>text.length<=180&&rolePattern.test(text));const source=linkTexts.length?linkTexts.join('. '):page.textContent;for(const candidate of textPeople(source))add(found,draft(candidate.name,candidate.title,page,candidate.evidence,.94));}
  }
  return [...found.values()];
}
function textPeople(text:string){const found:Array<{name:string;title:string;evidence:string}>=[];const roles=new RegExp(rolePattern.source,'gi');for(const match of text.matchAll(roles)){const start=match.index??0;const prefix=text.slice(Math.max(0,start-100),start).replace(/[|•·–—,:+]+\s*$/,' ').trim();const names=[...prefix.matchAll(new RegExp(namePattern.source,'g'))];const raw=names.at(-1)?.[1];if(!raw)continue;const parts=raw.split(/\s+/).filter((part)=>!nonNameWords.has(part.toLowerCase()));if(parts.length<2||parts.length>3)continue;const name=parts.join(' ');const nameStart=Math.max(0,start-prefix.length+prefix.lastIndexOf(raw));found.push({name,title:match[0],evidence:text.slice(nameStart,Math.min(text.length,start+match[0].length+40)).replace(/\s+/g,' ').trim()});}return found;}
function isLeadershipPage(value:string){try{const path=new URL(value).pathname.toLowerCase().replace(/^\/+|\/+$/g,'');return ['team','our-team','leadership','people','management','about/team','about/leadership'].includes(path);}catch{return false;}}

function draft(name: string, title: string, page: { pageId?: string | undefined; url: string; pageType: string }, evidenceText: string, confidence: number, linkedinUrl?: string | null, githubUrl?: string | null): PersonDraft | null {
  const fullName = name.replace(/\s+/g, ' ').trim(); const cleanTitle = title.replace(/\s+/g, ' ').trim();
  if (!fullName || !cleanTitle || !rolePattern.test(cleanTitle) || !namePattern.test(fullName)) return null;
  const { firstName, lastName } = splitName(fullName); const role = normalizeRole(cleanTitle);
  return { fullName, firstName, lastName, normalizedName: normalizePersonName(fullName), title: cleanTitle, ...role, sourceUrl: page.url, sourceType: page.pageType === 'TEAM' ? 'OFFICIAL_TEAM' : 'OFFICIAL_COMPANY_PAGE', pageId: page.pageId, evidenceText: evidenceText.replace(/\s+/g, ' ').trim().slice(0, 500), confidence, linkedinUrl, githubUrl };
}
function add(map: Map<string, PersonDraft>, value: PersonDraft | null) { if (!value) return; const prior = map.get(value.normalizedName); if (!prior || prior.confidence < value.confidence) map.set(value.normalizedName, value); }
function flattenJson(input: unknown[]): Array<Record<string, unknown>> { const out: Array<Record<string, unknown>> = []; const visit = (value: unknown) => { if (Array.isArray(value)) return value.forEach(visit); if (value && typeof value === 'object') { const row = value as Record<string, unknown>; out.push(row); if ('@graph' in row) visit(row['@graph']); } }; visit(input); return out; }
function profile(node: Record<string, unknown>, host: string) { const values = [node.url, ...(Array.isArray(node.sameAs) ? node.sameAs : [])].filter((item): item is string => typeof item === 'string'); return values.find((url) => url.includes(host)) ?? null; }
export function personEvidenceHash(person: PersonDraft) { return contentHash([person.normalizedName, person.normalizedTitle, person.sourceUrl, person.evidenceText]); }
