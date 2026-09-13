import { describe,expect,it } from 'vitest';
import { GtmRepository,OperationsRepository } from '@gtm/db';
import { normalizeManual } from '@gtm/sources';
import { createMigratedTestDatabase } from './db-helper';

describe('operational history',()=>{
  it('creates cached outreach versions and application history without external I/O',()=>{
    const connection=createMigratedTestDatabase(),base=new GtmRepository(connection),operations=new OperationsRepository(connection),now=new Date().toISOString();
    const source=base.createSource({kind:'MANUAL_URL',name:'Manual',config:{}});base.ingest(source.id,null,normalizeManual({url:'https://acme.test/jobs/llm',companyName:'Acme',companyDomain:'acme.test',title:'Senior LLM Engineer',description:'Build RAG systems with Python and TypeScript',location:'Remote US'}));
    const ids=connection.sqlite.prepare(`SELECT c.id companyId,co.id clientId,jo.id jobId FROM companies c JOIN client_opportunities co ON co.company_id=c.id JOIN jobs j ON j.company_id=c.id JOIN job_opportunities jo ON jo.job_id=j.id`).get() as {companyId:string;clientId:string;jobId:string};
    connection.sqlite.prepare(`INSERT INTO company_research_runs(id,company_id,status,trigger,priority,created_at,updated_at) VALUES('run',?,'COMPLETE','TEST',100,?,?)`).run(ids.companyId,now,now);
    connection.sqlite.prepare(`INSERT INTO evidence(id,company_id,research_run_id,type,classification,claim,evidence_text,source_url,source_quality,confidence,extractor,content_hash,created_at) VALUES('ev',?,'run','AI_HIRING','FACT','Acme is hiring a Senior LLM Engineer','Senior LLM Engineer','https://acme.test/jobs/llm','FIRST_PARTY_HIGH',1,'ats','hash',?)`).run(ids.companyId,now);
    connection.sqlite.prepare(`INSERT INTO people(id,company_id,full_name,normalized_name,first_name,last_name,title,normalized_title,department,seniority,decision_maker_score,confidence,first_discovered_at,last_verified_at,created_at,updated_at) VALUES('person',?,'Jane Doe','jane doe','Jane','Doe','CTO','cto','ENGINEERING','EXECUTIVE',95,.98,?,?,?,?)`).run(ids.companyId,now,now,now,now);
    connection.sqlite.prepare(`INSERT INTO contacts(id,company_id,person_id,type,contact_value,normalized_value,status,confidence,first_discovered_at,last_checked_at,created_at,updated_at) VALUES('contact',?,'person','EMAIL','jane@acme.test','jane@acme.test','PUBLIC_NAMED',96,?,?,?,?)`).run(ids.companyId,now,now,now,now);
    connection.sqlite.prepare(`INSERT INTO decision_maker_selections(id,company_id,primary_person_id,score,reason,confidence,selected_by,active,created_at) VALUES('selection',?,'person',95,'Technical owner',.98,'SYSTEM',1,?)`).run(ids.companyId,now);
    const prepared=operations.prepareClient(ids.clientId);expect(prepared.cached).toBe(false);expect(connection.sqlite.prepare(`SELECT COUNT(*) count FROM outreach_messages`).get()).toMatchObject({count:5});expect(operations.prepareClient(ids.clientId).cached).toBe(true);expect(operations.prepareClient(ids.clientId,{force:true}).cached).toBe(false);expect(connection.sqlite.prepare(`SELECT COUNT(*) count FROM outreach_messages`).get()).toMatchObject({count:5});
    const profile=operations.saveCandidateProfile({name:'Candidate',professionalTitle:'AI Engineer',summary:'I build production AI applications.',skills:['Python','TypeScript'],technologies:['RAG','React'],experience:[],projects:[{name:'Search',description:'RAG search',technologies:['RAG','Python']}]});expect(profile.active).toBe(true);const application=operations.prepareApplication(ids.jobId);expect(application.cached).toBe(false);expect(operations.prepareApplication(ids.jobId).cached).toBe(true);operations.markApplied(ids.jobId,{packageId:application.package!.id,applicationUrl:'https://acme.test/jobs/llm',source:'MANUAL'});expect(connection.sqlite.prepare(`SELECT COUNT(*) count FROM conversion_events WHERE stage='JOB_APPLIED'`).get()).toMatchObject({count:1});
    connection.sqlite.close();
  });
});
