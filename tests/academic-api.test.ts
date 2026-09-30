import { describe,expect,it } from 'vitest';
import type { AIProvider } from '@gtm/ai';
import { buildApp } from '../apps/api/src/app';
import { createMigratedTestDatabase } from './db-helper';
const ai:AIProvider={name:'none',modelInfo:()=>({provider:'none',model:'none',baseUrl:'local'}),healthCheck:async()=>({status:'misconfigured',provider:'none',model:'none'}),generateStructured:async()=>{throw new Error('disabled')}};
describe('academic API',()=>{it('serves seeded profile and keeps academic records isolated',async()=>{const connection=createMigratedTestDatabase(),app=await buildApp({connection,logger:false,aiProvider:ai});const profile=await app.inject({method:'GET',url:'/api/academic/profile'});expect(profile.statusCode).toBe(200);expect(profile.json().data.name).toBe('Abdul Rehman');const university=await app.inject({method:'POST',url:'/api/academic/universities',payload:{name:'API University',country:'Germany'}});expect(university.statusCode).toBe(201);const gtm=await app.inject({method:'GET',url:'/api/opportunities'});expect(gtm.json().data).toHaveLength(0);await app.close();});});
