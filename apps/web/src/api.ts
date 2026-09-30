export interface Opportunity {
  id: string; jobOpportunityId: string; clientOpportunityId: string; companyId: string; companyName: string; companyDomain: string | null; title: string; location: string; country: string | null;
  remoteType: string; postedAt: string | null; discoveredAt: string; jobScore: number; clientScore: number;
  initialJobScore: number; initialClientScore: number; researchStatus: string; researchConfidence: number | null; lastResearchedAt: string | null;
  companySummary: string | null; whatIsHappening: string | null; whyItMatters: string | null; whyMatch: string | null; recommendedNextStep: string | null;
  recommendedAction: 'CLIENT_OUTREACH' | 'JOB_APPLICATION' | 'BOTH' | 'RESEARCH' | 'SKIP'; sourceUrl: string;
  sourceName: string; sourceKind: string; jobReasons: string[]; clientReasons: string[];
}
export interface DashboardData {
  summary: { discoveredToday: number; highPriorityJobs: number; highPriorityLeads: number; activeOpportunities: number; runningSources: number; researchedToday: number; researchFailures: number; researchInProgress: number; exceptionalResearchedLeads: number };
  opportunities: Opportunity[];
}

export interface CompanyIntelligence {
  company: { id: string; canonicalName: string; domain: string | null; resolvedDomain: string | null; industry: string | null; researchStatus: string; lastResearchedAt: string | null; domainConfidence: number | null };
  profile: null | { summary: string | null; industry: string | null; businessModel: string | null; stage: string | null; researchConfidence: number; aiRelevance: number; engineeringNeed: number; contactability: number; technicalFocus: string[]; products: string[]; services: string[]; whatIsHappening: string; whyItMatters: string; whyMatch: string; recommendedNextStep: string; aiAnalysis: unknown };
  evidence: Array<{ id: string; type: string; classification: string; claim: string; evidenceText: string; sourceUrl: string; sourceQuality: string; confidence: number; extractor: string }>;
  signals: Array<{ id: string; type: string; claim: string; severity: string; weight: number; confidence: number; sourceQuality: string }>;
  jobs: Array<{ id: string; title: string; location: string; postedAt: string | null }>;
  runs: Array<{ id: string; status: string; trigger: string; pagesFetched: number; evidenceCount: number; signalCount: number; researchConfidence: number | null; aiStatus: string; createdAt: string; errorJson: string | null }>;
  pages: Array<{ id: string; url: string; pageType: string; title: string | null; httpStatus: number | null; fetchedAt: string | null; errorJson: string | null }>;
  scoreHistory: Array<{ funnel: string; total: number; components: Record<string, number>; reasons: string[]; version: string; createdAt: string }>;
  activities: Array<{ id: string; type: string; fromStatus: string | null; toStatus: string | null; occurredAt: string }>;
  contactIntelligence: {
    people: Array<{ id:string; fullName:string; title:string; normalizedTitle:string; department:string; seniority:string; decisionMakerScore:number; decisionMakerReason:string|null; confidence:number; linkedinUrl:string|null; githubUrl:string|null; lastVerifiedAt:string; sourceUrl:string|null; evidenceText:string|null }>;
    contacts: Array<{ id:string; personId:string|null; contactValue:string; status:'PUBLIC_NAMED'|'PUBLIC_GENERAL'|'PATTERN_INFERRED'|'UNKNOWN'; confidence:number; patternUsed:string|null; sourceUrl:string|null; syntaxValid:boolean|null; domainMatches:boolean|null; disposable:boolean|null; dnsStatus:string|null; mxStatus:string|null; mxHosts:string[]; lastCheckedAt:string }>;
    decisionMaker: null | { primaryPersonId:string; secondaryPersonId:string|null; primaryName:string; primaryTitle:string; secondaryName:string|null; secondaryTitle:string|null; score:number; reason:string; confidence:number; selectedBy:string; createdAt:string };
    runs: Array<{id:string;status:string;trigger:string;peopleFound:number;contactsFound:number;createdAt:string;completedAt:string|null;errorJson:string|null}>;
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const response = await fetch('/api/dashboard');
  if (!response.ok) throw new Error('Could not load opportunity intelligence');
  return response.json() as Promise<DashboardData>;
}

export async function runAllDiscovery(): Promise<{ count: number }> {
  const response = await fetch('/api/discovery-runs/all', { method: 'POST' });
  if (!response.ok) throw new Error('Could not queue discovery');
  return response.json() as Promise<{ count: number }>;
}

export async function createSource(input: { kind: 'GREENHOUSE' | 'LEVER' | 'ASHBY'; name: string; config: Record<string, string> }) {
  const response = await fetch('/api/sources', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, enabled: true }) });
  if (!response.ok) throw new Error('Could not save source');
  return response.json();
}

export async function getCompanyIntelligence(companyId: string): Promise<CompanyIntelligence> {
  const response = await fetch(`/api/companies/${companyId}`); if (!response.ok) throw new Error('Could not load company intelligence');
  const body = await response.json() as { data: CompanyIntelligence }; return body.data;
}
export async function researchCompany(companyId: string, force = false) {
  const response = await fetch(`/api/companies/${companyId}/research`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ force }) });
  if (!response.ok) throw new Error('Could not queue company research'); return response.json();
}
export async function researchContacts(companyId:string,force=false){const response=await fetch(`/api/companies/${companyId}/contacts/research`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({force})});if(!response.ok)throw new Error('Could not queue contact intelligence');return response.json();}
export async function selectDecisionMaker(companyId:string,primaryPersonId:string,secondaryPersonId?:string|null){const response=await fetch(`/api/companies/${companyId}/decision-maker`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({primaryPersonId,secondaryPersonId:secondaryPersonId??null})});if(!response.ok)throw new Error('Could not select decision maker');return response.json();}

export type ActionCenterData={counts:{exceptionalClientLeads:number;messagesAwaitingApproval:number;approvedEmailsReady:number;followupsDue:number;positiveReplies:number;meetings:number;highPriorityJobs:number;applicationsReady:number;applicationsFollowup:number;recruiterReplies:number;interviews:number};items:Array<{id:string;type:string;entityType:string;entityId:string;priority:number;dueAt:string|null;status:string}>};
export async function getActionCenter():Promise<ActionCenterData>{const response=await fetch('/api/action-center');if(!response.ok)throw new Error('Could not load action center');return response.json();}
export async function prepareOutreach(opportunityId:string,force=false){const response=await fetch(`/api/client-opportunities/${opportunityId}/outreach`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({force})});if(!response.ok)throw new Error(await errorMessage(response));return response.json();}
export async function prepareApplication(opportunityId:string,force=false){const response=await fetch(`/api/job-opportunities/${opportunityId}/package`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({force})});if(!response.ok)throw new Error(await errorMessage(response));return response.json();}
export async function getClientOperations(opportunityId:string){const response=await fetch(`/api/client-opportunities/${opportunityId}/operations`);if(!response.ok)throw new Error('Could not load outreach');return (await response.json()).data;}
export async function approveMessage(messageId:string,confirmInferred=false){const response=await fetch(`/api/outreach/messages/${messageId}/approve`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmInferred})});if(!response.ok)throw new Error(await errorMessage(response));return response.json();}
export async function queueMessageSend(messageId:string){const response=await fetch(`/api/outreach/messages/${messageId}/send`,{method:'POST'});if(!response.ok)throw new Error(await errorMessage(response));return response.json();}
async function errorMessage(response:Response){try{const value=await response.json() as {message?:string};return value.message??'Request failed';}catch{return 'Request failed';}}
export interface AnalyticsData{client:Record<string,number|Record<string,number|null>>;job:Record<string,number|Record<string,number|null>>;revenue:{totalWonRevenue:number;wonDeals:number;averageDealValue:number;revenuePerLead:number|null;revenuePerContacted:number|null};sources:Array<Record<string,string|number|null>>;cohorts:Record<string,Array<{cohort:string;sampleSize:number;successCount:number;rate:number;baselineRate:number;difference:number;reliability:string}>>;insights:Array<{dimension:string;cohort:string;sampleSize:number;successCount:number;rate:number;baselineRate:number;reliability:string;message:string}>}
export async function getAnalytics(){const response=await fetch('/api/analytics/operational');if(!response.ok)throw new Error('Could not load analytics');return response.json() as Promise<AnalyticsData>;}
export async function getDataQuality(){const response=await fetch('/api/data-quality');if(!response.ok)throw new Error('Could not load data quality');return response.json() as Promise<Record<string,number>>;}
export interface CampaignRow{id:string;name:string;status:string;serviceName:string|null;members:number;contacted:number;positiveReplies:number;wins:number;revenueCents:number;targetingJson:string;messageStrategy:string|null}
export async function getCampaigns(){const response=await fetch('/api/campaigns');if(!response.ok)throw new Error('Could not load campaigns');return (await response.json() as {data:CampaignRow[]}).data;}
export async function createCampaign(input:{name:string;targeting:Record<string,unknown>;messageStrategy?:string}){const response=await fetch('/api/campaigns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});if(!response.ok)throw new Error('Could not create campaign');return response.json();}
export async function updateCampaign(id:string,input:Record<string,unknown>){const response=await fetch(`/api/campaigns/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(input)});if(!response.ok)throw new Error('Could not update campaign');return response.json();}

export type AcademicOpportunity={id:string;title:string;country:string;degree_level:string;deadline:string|null;status:string;funding_category:string;eligibility_status:string;current_score:number;university_name:string;source_url:string|null};
export type AcademicProfile={id:string;name:string;nationality:string;location:string;education:Array<{degree:string;institution:string;status:string;cgpa?:number}>;manuscripts:Array<{title:string;status:'MANUSCRIPT'|'PREPRINT'|'SUBMITTED'|'ACCEPTED'|'PUBLISHED'}>;background:Record<string,unknown>;primaryInterests:string[];secondaryInterests:string[];countryPriorities:Record<string,string[]>;updatedAt:string};
export type AcademicToday={counts:{active_opportunities:number;professors_ready:number;drafts_awaiting_approval:number;followups_due:number;changed_sources:number};opportunities:AcademicOpportunity[];deadlines:Array<{id:string;kind:string;deadlineAt:string;opportunityId:string}>;professorCases:Array<Record<string,unknown>>};
async function academic<T>(path:string,init?:RequestInit){const response=await fetch(`/api/academic${path}`,init);if(!response.ok)throw new Error(await errorMessage(response));return(await response.json() as {data:T}).data;}
export const getAcademicToday=()=>academic<AcademicToday>('/today');
export const getAcademicOpportunities=()=>academic<AcademicOpportunity[]>('/opportunities');
export const getAcademicUniversities=()=>academic<Array<{id:string;canonicalName:string;country:string;city:string|null;officialUrl:string|null;confidence:number}>>('/universities');
export const getProfessorCases=()=>academic<Array<Record<string,unknown>>>('/professor-cases');
export const getAcademicProfile=()=>academic<AcademicProfile>('/profile');
export const updateAcademicProfile=(profile:Omit<AcademicProfile,'id'|'updatedAt'>)=>academic<AcademicProfile>('/profile',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(profile)});
export const getAcademicDeadlines=()=>academic<Array<{id:string;kind:string;deadlineAt:string;opportunityId:string;status:string}>>('/deadlines');
export const getAcademicOutreach=()=>academic<Array<Record<string,unknown>>>('/outreach');
