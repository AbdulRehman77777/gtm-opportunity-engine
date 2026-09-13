import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {describe,expect,it}from'vitest';
import {cohortAnalysis,evaluateProbability,modelEligibility,predictProbability,trainLogisticRegression}from'@gtm/analytics';
import {FinalRepository}from'@gtm/db';
import {createMigratedTestDatabase}from'./db-helper';

describe('final intelligence safeguards',()=>{
 it('computes cohorts with sample and reliability',()=>{const rows=Array.from({length:60},(_,i)=>({group:i<30?'CTO':'CEO',win:i<15}));const cohorts=cohortAnalysis(rows,row=>row.group,row=>row.win,10);expect(cohorts[0]?.cohort).toBe('CTO');expect(cohorts[0]?.sampleSize).toBe(30);expect(cohorts[0]?.reliability).toBe('MEDIUM');});
 it('keeps probabilities gated until meaningful historical data exists',()=>{const tiny=Array.from({length:12},()=>({features:[.5],label:0 as const,occurredAt:'2026-01-01'}));expect(modelEligibility(tiny,100,15).eligible).toBe(false);const rows=Array.from({length:120},(_,i)=>({features:[i%2],label:(i%2)as 0|1,occurredAt:`2026-01-${String(i%28+1).padStart(2,'0')}`}));const model=trainLogisticRegression(rows,100);const probability=predictProbability(model,[1]);expect(probability).toBeGreaterThan(.5);expect(evaluateProbability(rows.map(r=>r.label),rows.map(r=>predictProbability(model,r.features))).brierScore).toBeLessThan(.3);});
 it('persists IMAP checkpoints monotonically and produces non-overwriting backups',async()=>{const connection=createMigratedTestDatabase(),repository=new FinalRepository(connection);repository.saveCheckpoint('IMAP','INBOX',12,'x');repository.saveCheckpoint('IMAP','INBOX',8,'x');expect(repository.getCheckpoint().lastUid).toBe(12);const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gtm-backup-'));const first=await repository.backup(directory);const second=await repository.backup(directory);expect(fs.existsSync(first.path)).toBe(true);expect(fs.existsSync(second.path)).toBe(true);expect(first.path).not.toBe(second.path);connection.sqlite.close();});
});
