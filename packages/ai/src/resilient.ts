import type { z } from 'zod';
import { GroqProvider } from './groq.js';
import { OllamaProvider } from './ollama.js';
import { AIProviderError, type AIHealth, type AIProvider, type StructuredGeneration } from './types.js';

export class DisabledAIProvider implements AIProvider{readonly name='none';modelInfo(){return{provider:'none',model:'none',baseUrl:'local'};}async healthCheck():Promise<AIHealth>{return{status:'misconfigured',provider:'none',model:'none',detail:'AI is disabled'}}async generateStructured<T>(_input:{system:string;prompt:string;schema:z.ZodType<T>;schemaName:string;temperature?:number}):Promise<StructuredGeneration<T>>{throw new AIProviderError('AI is disabled','MISCONFIGURED','none');}}

export class ResilientAIProvider implements AIProvider{
  readonly name='auto';
  constructor(readonly providers:AIProvider[]){}
  modelInfo(){const first=this.providers[0]?.modelInfo();return first??{provider:'none',model:'none',baseUrl:'local'};}
  async healthCheck():Promise<AIHealth>{const report=await this.healthReport();if(report.status==='available')return{status:'available',provider:report.activeProvider!,model:report.model!};return{status:'unavailable',provider:'none',model:'none',detail:'No configured AI provider is available'};}
  async healthReport(){const checks=[] as AIHealth[];for(const provider of this.providers)checks.push(await provider.healthCheck());const active=checks.find(item=>item.status==='available');return{status:active?'available' as const:'unavailable' as const,activeProvider:active?.provider??null,model:active?.model??null,providers:checks,fallback:checks[1]?{provider:checks[1].provider,status:checks[1].status,model:checks[1].model}:null};}
  async generateStructured<T>(input:{system:string;prompt:string;schema:z.ZodType<T>;schemaName:string;temperature?:number}){const failures:string[]=[];for(const provider of this.providers){const health=await provider.healthCheck();if(health.status!=='available'){failures.push(`${provider.name}:${health.status}`);continue;}try{return await provider.generateStructured(input);}catch(error){failures.push(`${provider.name}:${error instanceof AIProviderError?error.code:'failed'}`);continue;}}throw new AIProviderError(`No AI provider completed the request (${failures.join(', ')})`,'UPSTREAM','none');}
}

export type AIProviderConfig={AI_PROVIDER:'auto'|'groq'|'ollama'|'none';GROQ_API_KEY?:string|undefined;GROQ_BASE_URL:string;GROQ_MODEL:string;OLLAMA_BASE_URL:string;OLLAMA_MODEL:string;AI_REQUEST_TIMEOUT_MS?:number|undefined};
export function createAIProvider(config:AIProviderConfig,options:{fetcher?:typeof fetch}={}):AIProvider{const fetcher=options.fetcher??fetch;const groq=new GroqProvider(config.GROQ_BASE_URL,config.GROQ_MODEL,config.GROQ_API_KEY,config.AI_REQUEST_TIMEOUT_MS??60_000,fetcher);const ollama=new OllamaProvider(config.OLLAMA_BASE_URL,config.OLLAMA_MODEL,fetcher);if(config.AI_PROVIDER==='groq')return groq;if(config.AI_PROVIDER==='ollama')return ollama;if(config.AI_PROVIDER==='none')return new DisabledAIProvider();return new ResilientAIProvider([groq,ollama]);}
export async function getAIHealthReport(provider:AIProvider){if(provider instanceof ResilientAIProvider)return provider.healthReport();const health=await provider.healthCheck();return{status:health.status==='available'?'available' as const:'unavailable' as const,activeProvider:health.status==='available'?health.provider:null,model:health.status==='available'?health.model:null,providers:[health],fallback:null};}
