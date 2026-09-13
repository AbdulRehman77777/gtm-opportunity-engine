export type ContactStatus = 'PUBLIC_NAMED' | 'PUBLIC_GENERAL' | 'PATTERN_INFERRED' | 'UNKNOWN';
export type Department = 'EXECUTIVE' | 'ENGINEERING' | 'AI' | 'PRODUCT' | 'AGENCY' | 'OTHER';
export type Seniority = 'FOUNDER' | 'C_LEVEL' | 'VP' | 'HEAD' | 'DIRECTOR' | 'MANAGER' | 'OTHER';
export interface PersonDraft { fullName: string; firstName: string; lastName: string; normalizedName: string; title: string; normalizedTitle: string; department: Department; seniority: Seniority; sourceUrl: string; sourceType: string; pageId?: string | null | undefined; evidenceText: string; confidence: number; linkedinUrl?: string | null | undefined; githubUrl?: string | null | undefined; }
export interface RankedPerson extends PersonDraft { score: number; reason: string; confidence: number; }
export interface ContactDraft { personNormalizedName?: string | null | undefined; value: string; status: ContactStatus; sourceUrl: string; sourceType: string; pageId?: string | null | undefined; patternUsed?: string | null | undefined; confidence: number; }
export interface EmailPattern { pattern: string; domain: string; evidenceEmails: string[]; confidence: number; }
export interface ContactValidationResult { syntaxValid: boolean; domainMatches: boolean; disposable: boolean; dnsStatus: 'VALID' | 'INVALID' | 'UNKNOWN'; mxStatus: 'VALID' | 'INVALID' | 'UNKNOWN'; mxHosts: string[]; error?: string; }
