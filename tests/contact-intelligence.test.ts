import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIProvider } from '@gtm/ai';
import { contactConfidence, detectEmailPattern, discoverPublicContacts, extractPeople, inferEmail, normalizePersonName, normalizeRole, rankDecisionMakers, validateEmail } from '@gtm/contacts';
import { ContactRepository, GtmRepository, ResearchRepository } from '@gtm/db';
import { normalizeManual } from '@gtm/sources';
import { Worker } from '../apps/worker/src/worker';
import { buildApp } from '../apps/api/src/app';
import { createMigratedTestDatabase } from './db-helper';

afterEach(() => vi.unstubAllGlobals());
const unavailableAi: AIProvider = { name:'test',modelInfo:()=>({provider:'test',model:'none',baseUrl:'local'}),healthCheck:async()=>({status:'unavailable',provider:'test',model:'none'}),generateStructured:async()=>{throw new Error('unused');} };

describe('deterministic contact intelligence', () => {
  it('extracts, normalizes, deduplicates, and ranks relevant leaders', () => {
    const pages=[{pageId:'p1',url:'https://acme.ai/team',pageType:'TEAM',textContent:'John Smith — CTO. Jane Doe, Head of AI.',headings:[],socialUrls:[],structuredData:[{'@type':'Person',name:'John Smith',jobTitle:'Chief Technology Officer',sameAs:['https://linkedin.com/in/john-smith']}]}];
    const extracted=extractPeople(pages); expect(extracted).toHaveLength(2); expect(normalizePersonName('  John  Smith ')).toBe('john smith'); expect(normalizeRole('Chief Product & Technology Officer')).toMatchObject({seniority:'C_LEVEL',department:'ENGINEERING'});
    const ranked=rankDecisionMakers(extracted,{stage:'Seed startup',technicalFocus:['LLM Engineering']}); expect(ranked[0]).toMatchObject({fullName:'John Smith'}); expect(ranked[0]!.score).toBeGreaterThan(85);
  });

  it('keeps public and inferred email classifications separate', () => {
    const people=extractPeople([{url:'https://acme.ai/team',pageType:'TEAM',textContent:'John Smith — CTO. Jane Doe — VP Engineering.',emails:[],structuredData:[]}]);
    const publicContacts=discoverPublicContacts([{url:'https://acme.ai/team',pageType:'TEAM',textContent:'john.smith@acme.ai jane.doe@acme.ai info@acme.ai',emails:[]}],people,'acme.ai');
    expect(publicContacts.find((item)=>item.value==='john.smith@acme.ai')?.status).toBe('PUBLIC_NAMED'); expect(publicContacts.find((item)=>item.value==='info@acme.ai')?.status).toBe('PUBLIC_GENERAL');
    const pattern=detectEmailPattern([{email:'john.smith@acme.ai',person:{firstName:'John',lastName:'Smith'}},{email:'jane.doe@acme.ai',person:{firstName:'Jane',lastName:'Doe'}}],'acme.ai');
    expect(pattern?.pattern).toBe('{first}.{last}'); expect(inferEmail(pattern!,{firstName:'David',lastName:'Chen',normalizedName:'david chen'})).toMatchObject({value:'david.chen@acme.ai',status:'PATTERN_INFERRED'});
  });

  it('handles DNS/MX results and calculates confidence without SMTP probing', async () => {
    const result=await validateEmail('john@acme.ai','acme.ai',{resolveAny:vi.fn(async()=>[{address:'1.1.1.1',ttl:60}]) as never,resolveMx:vi.fn(async()=>[{exchange:'mx.acme.ai',priority:10}])});
    expect(result).toMatchObject({syntaxValid:true,domainMatches:true,dnsStatus:'VALID',mxStatus:'VALID'}); expect(contactConfidence({status:'PUBLIC_NAMED',sourceOfficial:true,domainMatches:true,syntaxValid:true,disposable:false,dnsStatus:'VALID',mxStatus:'VALID',personConfidence:.95})).toBeGreaterThan(90);
  });
});

describe('contact pipeline history and idempotency', () => {
  it('runs the staged pipeline once and preserves selection history', async () => {
    const connection=createMigratedTestDatabase(),gtm=new GtmRepository(connection),research=new ResearchRepository(connection),contacts=new ContactRepository(connection); const source=gtm.createSource({kind:'MANUAL_URL',name:'Manual',config:{}});
    gtm.ingest(source.id,null,normalizeManual({url:'https://acme.ai/jobs/1',companyName:'Acme AI',companyDomain:'acme.ai',title:'Senior LLM Engineer',description:'Build LLM and RAG systems',location:'Remote US'})); const companyId=(connection.sqlite.prepare('SELECT id FROM companies').get() as {id:string}).id;
    const researchRun=research.queueResearch(companyId,{manual:true});
    vi.stubGlobal('fetch',vi.fn(async(input:string|URL|Request)=>{const url=String(input);if(url.endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /',{headers:{'content-type':'text/plain'}});if(url.endsWith('/sitemap.xml'))return new Response('<urlset></urlset>',{headers:{'content-type':'application/xml'}});return new Response(`<html><head><title>Acme AI</title></head><body><main><h1>AI platform</h1><p>John Smith — CTO. Jane Doe — VP Engineering. john.smith@acme.ai jane.doe@acme.ai</p><a href="/team">Leadership</a></main></body></html>`,{headers:{'content-type':'text/html'}});}));
    const validator=vi.fn(async():Promise<ContactValidationResultLike>=>({syntaxValid:true,domainMatches:true,disposable:false,dnsStatus:'VALID',mxStatus:'VALID',mxHosts:['mx.acme.ai']})); const worker=new Worker(connection,unavailableAi,validator);
    while(await worker.runOnce()) { /* drain */ }
    const queued=contacts.queue(companyId,{manual:true,force:true}); expect(queued.queued).toBe(true); expect(contacts.queue(companyId,{manual:true,force:true})).toMatchObject({queued:false,reason:'ALREADY_QUEUED',runId:queued.runId}); while(await worker.runOnce()) { /* drain */ }
    const intelligence=contacts.getCompanyIntelligence(companyId); expect(intelligence.decisionMaker?.primaryName).toBeTruthy(); expect(intelligence.people.find((person)=>person.id===intelligence.decisionMaker?.primaryPersonId)?.decisionMakerScore).toBeGreaterThanOrEqual(intelligence.people.find((person)=>person.id===intelligence.decisionMaker?.secondaryPersonId)?.decisionMakerScore??0); expect(intelligence.contacts.some((item)=>item.status==='PUBLIC_NAMED'&&item.mxStatus==='VALID')).toBe(true); expect(validator).toHaveBeenCalledTimes(1); expect(contacts.getPersonEvidence(intelligence.people[0]!.id).length).toBeGreaterThan(0);
    expect(contacts.queue(companyId,{manual:true,force:true}).queued).toBe(true);while(await worker.runOnce()){/* refresh */}expect(contacts.getPersonEvidence(intelligence.people[0]!.id).length).toBeGreaterThan(1);expect(validator).toHaveBeenCalledTimes(1);
    contacts.manualSelect(companyId,intelligence.people[1]!.id,intelligence.people[0]!.id); expect(connection.sqlite.prepare('SELECT COUNT(*) count FROM decision_maker_selections WHERE company_id=?').get(companyId)).toMatchObject({count:3}); expect(researchRun.queued).toBe(true);
  });

  it('queues from the API without synchronous contact research', async () => {
    const connection=createMigratedTestDatabase(),gtm=new GtmRepository(connection);const source=gtm.createSource({kind:'MANUAL_URL',name:'Manual',config:{}});gtm.ingest(source.id,null,normalizeManual({url:'https://acme.ai/jobs/1',companyName:'Acme AI',companyDomain:'acme.ai',title:'LLM Engineer',description:'LLM',location:'Remote US'}));const companyId=(connection.sqlite.prepare('SELECT id FROM companies').get() as {id:string}).id;const app=await buildApp({connection,logger:false,aiProvider:unavailableAi});
    const response=await app.inject({method:'POST',url:`/api/companies/${companyId}/contacts/research`,payload:{force:true}});expect(response.statusCode).toBe(202);expect(response.json().data.queued).toBe(true);expect(connection.sqlite.prepare("SELECT COUNT(*) count FROM worker_jobs WHERE type='DISCOVER_COMPANY_PEOPLE'").get()).toMatchObject({count:1});await app.close();
  });
});

type ContactValidationResultLike = { syntaxValid:boolean;domainMatches:boolean;disposable:boolean;dnsStatus:'VALID';mxStatus:'VALID';mxHosts:string[] };
