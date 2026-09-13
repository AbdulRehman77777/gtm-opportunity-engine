import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AIProvider } from '@gtm/ai';
import { ContactRepository, createDatabase, ResearchRepository } from '@gtm/db';
import { Worker } from '../apps/worker/src/worker.js';

async function main(){const connection=createDatabase(':memory:');
for(const file of fs.readdirSync(path.resolve('packages/db/drizzle')).filter((name)=>/^\d+.*\.sql$/.test(name)).sort())connection.sqlite.exec(fs.readFileSync(path.resolve('packages/db/drizzle',file),'utf8').replaceAll('--> statement-breakpoint',''));
const now=new Date().toISOString(),companyId=randomUUID();
connection.sqlite.prepare(`INSERT INTO companies(id,canonical_name,normalized_name,domain,research_status,first_discovered_at,last_observed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(companyId,'Lium','lium','lium.ai','NOT_RESEARCHED',now,now,now,now);
const ai:AIProvider={name:'smoke',modelInfo:()=>({provider:'smoke',model:'none',baseUrl:'local'}),healthCheck:async()=>({status:'unavailable',provider:'smoke',model:'none'}),generateStructured:async()=>{throw new Error('AI disabled for deterministic smoke test');}};
const research=new ResearchRepository(connection),contacts=new ContactRepository(connection),worker=new Worker(connection,ai);
research.queueResearch(companyId,{manual:true,force:true});
const researchJobs=await drain(worker);
contacts.queue(companyId,{manual:true,force:true});
const contactJobs=await drain(worker);
const result=contacts.getCompanyIntelligence(companyId);if(!result.people.length)throw new Error('No public people discovered');
console.log(JSON.stringify({company:'Lium',run:result.runs[0]?.status,jobs:{research:researchJobs,contacts:contactJobs},primary:result.decisionMaker?{name:result.decisionMaker.primaryName,title:result.decisionMaker.primaryTitle,score:result.decisionMaker.score}:null,people:result.people.map((item)=>({name:item.fullName,title:item.title,score:item.decisionMakerScore,evidence:item.evidenceText,source:item.sourceUrl})),contacts:result.contacts.map((item)=>({value:item.contactValue,status:item.status,confidence:item.confidence,mx:item.mxStatus,source:item.sourceUrl}))},null,2));
connection.sqlite.close();
}
async function drain(worker:Worker){let processed=0;while(processed<30&&await worker.runOnce())processed+=1;return processed;}
main().catch((error)=>{console.error(error);process.exitCode=1;});
