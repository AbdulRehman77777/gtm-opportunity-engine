import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AIProvider } from '@gtm/ai';
import { AcademicRepository } from '@gtm/db';
import { MemoryEmailProvider } from '@gtm/email';
import { Worker } from '../apps/worker/src/worker';
import { createMigratedTestDatabase } from './db-helper';

const observation=(text:string,evidenceIds:string[],classification:'FACT'|'HYPOTHESIS'|'UNKNOWN'='FACT')=>({text,classification,evidenceIds});

function fixture(){
  const connection=createMigratedTestDatabase(),repo=new AcademicRepository(connection);
  const university=repo.upsertUniversity({name:'Evidence University',country:'Germany',officialUrl:'https://example.edu'});
  const professor=repo.upsertProfessor({universityId:university.id,fullName:'Dr. Ada Researcher',publicEmail:'ada@example.edu',officialProfileUrl:'https://example.edu/ada'});
  const professorCase=repo.createProfessorCase({professorId:professor.id})!;
  const source=repo.saveSource({kind:'MANUAL_URL',name:'Official profile',url:'https://example.edu/ada',canonicalUrl:'https://example.edu/ada',official:true});
  const evidence=repo.saveEvidence({sourceId:source.id,entityType:'PROFESSOR',entityId:professor.id,claimType:'RESEARCH_AREA',claim:'The lab studies language model memory.',sourceUrl:'https://example.edu/ada',confidence:1});
  return{connection,repo,professorCase,evidence};
}

describe('academic AI workflows',()=>{
  it('grounds output, persists actual provider metadata, and reuses valid cache',async()=>{
    const{connection,repo,professorCase,evidence}=fixture();const unsupported=randomUUID();
    const provider:AIProvider={name:'test',modelInfo:()=>({provider:'test',model:'configured',baseUrl:'local'}),healthCheck:async()=>({status:'available',provider:'groq',model:'openai/gpt-oss-120b'}),generateStructured:async input=>({provider:'groq',model:'openai/gpt-oss-120b',latencyMs:17,promptTokens:11,completionTokens:7,data:input.schema.parse({plainEnglishResearchSummary:'Verified work on language model memory.',summaryEvidenceIds:[evidence.id,unsupported],relevantResearchAreas:[observation('Language model memory',[evidence.id])],applicantOverlap:[observation('Shared memory interest',[evidence.id])],manuscriptOverlap:[observation('Possible recursive-memory direction',[],'HYPOTHESIS')],relevantExperience:[observation('Applicant has relevant systems experience',[],'UNKNOWN')],possibleResearchDirections:[observation('Evaluate memory for repair agents',[],'HYPOTHESIS')],outreachAngle:'Ask about evidence-backed overlap.',concerns:[observation('Recruiting status is not verified',[unsupported])],evidenceIds:[evidence.id,unsupported],confidence:.8})})};
    repo.queueAcademicAi('ANALYZE_PROFESSOR_AI',professorCase.id);expect(await new Worker(connection,provider).runOnce()).toBe(true);
    const [run]=repo.listAcademicAiRuns('PROFESSOR_CASE',professorCase.id);expect(run).toMatchObject({provider:'groq',model:'openai/gpt-oss-120b',status:'COMPLETED',promptTokens:11,completionTokens:7});
    const output=run!.output as {concerns:Array<{classification:string;evidenceIds:string[]}>;evidenceIds:string[]};expect(output.evidenceIds).toEqual([evidence.id]);expect(output.concerns[0]).toMatchObject({classification:'UNKNOWN',evidenceIds:[]});
    const input=repo.getProfessorAiContext(professorCase.id,25);expect(repo.findCachedAcademicAi('PROFESSOR_ANALYSIS',input,30)).toMatchObject({provider:'groq',model:'openai/gpt-oss-120b'});connection.sqlite.close();
  });

  it('generates a draft without sending and preserves approval as a separate action',async()=>{
    const{connection,repo,professorCase,evidence}=fixture();const email=new MemoryEmailProvider();
    const provider:AIProvider={name:'test',modelInfo:()=>({provider:'test',model:'configured',baseUrl:'local'}),healthCheck:async()=>({status:'available',provider:'ollama',model:'qwen2.5:7b'}),generateStructured:async input=>({provider:'ollama',model:'qwen2.5:7b',latencyMs:5,data:input.schema.parse({subjects:['Research on language model memory','Prospective PhD research overlap','Inquiry about memory research'],email:'Dear Dr. Ada Researcher,\n\nI am writing about your verified work on language model memory and its overlap with my research background. I would value the chance to discuss potential graduate research directions.\n\nBest,\nAbdul Rehman',followup:'Dear Dr. Ada Researcher, I am following up briefly on my earlier research inquiry. Best, Abdul Rehman',evidenceIds:[evidence.id]})})};
    repo.queueAcademicAi('GENERATE_ACADEMIC_OUTREACH_AI',professorCase.id);expect(await new Worker(connection,provider,undefined,email).runOnce()).toBe(true);
    const outreach=repo.listOutreach();expect(outreach).toHaveLength(1);expect(outreach[0]).toMatchObject({status:'DRAFT'});expect(email.sent).toHaveLength(0);connection.sqlite.close();
  });

  it('completes deterministically when no provider is available',async()=>{
    const{connection,repo,professorCase}=fixture();const unavailable:AIProvider={name:'none',modelInfo:()=>({provider:'none',model:'none',baseUrl:'local'}),healthCheck:async()=>({status:'unavailable',provider:'none',model:'none'}),generateStructured:async()=>{throw new Error('must not run')}};
    repo.queueAcademicAi('ANALYZE_PROFESSOR_AI',professorCase.id);expect(await new Worker(connection,unavailable).runOnce()).toBe(true);expect(repo.listAcademicAiRuns('PROFESSOR_CASE',professorCase.id)[0]).toMatchObject({status:'SKIPPED',provider:'none'});connection.sqlite.close();
  });
});
