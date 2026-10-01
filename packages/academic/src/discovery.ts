import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AcademicSearchFilters } from './index.js';

export type DiscoveryProvenance='TAVILY_DISCOVERY'|'GROQ_DISCOVERY'|'CURATED_FALLBACK'|'MANUAL_SOURCE';
export type DiscoveryCandidate={url:string;title:string;snippet:string;score:number|null;provider:DiscoveryProvenance;providerMetadata:Record<string,unknown>;discoveredAt:string;query:string};
export type DiscoveryFailure='AUTH'|'RATE_LIMITED'|'TIMEOUT'|'MALFORMED_RESPONSE'|'UPSTREAM'|'MISCONFIGURED';

export class TavilyDiscoveryError extends Error {
  constructor(public readonly category:DiscoveryFailure,message:string,public readonly status?:number){super(message);this.name='TavilyDiscoveryError';}
}

const responseSchema=z.object({results:z.array(z.object({url:z.string().url(),title:z.string().default('Untitled result'),content:z.string().default(''),score:z.number().nullable().optional()}))});

export class TavilyDiscoveryProvider {
  constructor(private readonly options:{apiKey?:string;baseUrl:string;searchDepth:'basic'|'advanced';timeoutMs:number;fetchImpl?:typeof fetch}){}
  async search(query:string,maxResults:number):Promise<DiscoveryCandidate[]> {
    if(!this.options.apiKey)throw new TavilyDiscoveryError('MISCONFIGURED','Tavily API key is not configured');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.options.timeoutMs);
    try{
      const response=await (this.options.fetchImpl??fetch)(`${this.options.baseUrl.replace(/\/$/,'')}/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({api_key:this.options.apiKey,query,search_depth:this.options.searchDepth,max_results:maxResults,include_answer:false,include_raw_content:false}),signal:controller.signal});
      if(response.status===401||response.status===403)throw new TavilyDiscoveryError('AUTH','Tavily authentication failed',response.status);
      if(response.status===429)throw new TavilyDiscoveryError('RATE_LIMITED','Tavily rate limit reached',response.status);
      if(!response.ok)throw new TavilyDiscoveryError('UPSTREAM',`Tavily request failed with status ${response.status}`,response.status);
      let json:unknown;try{json=await response.json();}catch{throw new TavilyDiscoveryError('MALFORMED_RESPONSE','Tavily returned invalid JSON');}
      const parsed=responseSchema.safeParse(json);if(!parsed.success)throw new TavilyDiscoveryError('MALFORMED_RESPONSE','Tavily response did not match the search result schema');
      const discoveredAt=new Date().toISOString();
      return parsed.data.results.map(item=>({url:normalizeAcademicUrl(item.url),title:item.title,snippet:item.content,score:item.score??null,provider:'TAVILY_DISCOVERY',providerMetadata:{searchDepth:this.options.searchDepth},discoveredAt,query}));
    }catch(error){
      if(error instanceof TavilyDiscoveryError)throw error;
      if(error instanceof Error&&error.name==='AbortError')throw new TavilyDiscoveryError('TIMEOUT','Tavily request timed out');
      throw new TavilyDiscoveryError('UPSTREAM',error instanceof Error?error.message:'Tavily request failed');
    }finally{clearTimeout(timer);}
  }
}

export function normalizeAcademicUrl(value:string):string {
  const url=new URL(value);url.protocol='https:';url.hash='';
  for(const key of [...url.searchParams.keys()])if(/^utm_|^(gclid|fbclid|ref|source)$/i.test(key))url.searchParams.delete(key);
  url.hostname=url.hostname.toLowerCase().replace(/^www\./,'');
  url.pathname=url.pathname.replace(/\/{2,}/g,'/').replace(/\/$/,'')||'/';
  url.searchParams.sort();return url.toString();
}

export function discoveryCacheKey(query:string,maxResults:number,depth:string):string{return createHash('sha256').update(`${query.toLowerCase().replace(/\s+/g,' ').trim()}|${maxResults}|${depth}`).digest('hex');}

const domains:Record<string,string[]>={
  'United States':['site:.edu'], 'United Kingdom':['site:.ac.uk'], Germany:['site:.de','site:daad.de','site:mpg.de','site:helmholtz.de','site:fraunhofer.de'],
  'Erasmus Mundus / Multi-country Europe':['site:europa.eu','site:euraxess.ec.europa.eu'], Saudi:['site:.edu.sa'], 'Saudi Arabia':['site:.edu.sa'], UAE:['site:.ac.ae'], Qatar:['site:.edu.qa'], Japan:['site:.ac.jp'], 'South Korea':['site:.ac.kr'], China:['site:.edu.cn']
};
export function generateAcademicDiscoveryQueries(filters:AcademicSearchFilters,limit=6):string[]{
  const countries=filters.countries.length?filters.countries:['United States'];const degree=filters.degree==='PHD'?'PhD':filters.degree.replaceAll('_',' ');
  const topics=(filters.researchAreas.length?filters.researchAreas:['artificial intelligence']).slice(0,4);
  const funding=filters.funding==='ANY'?'graduate funding':filters.funding.replaceAll('_',' ').toLowerCase();
  const queries:string[]=[];
  for(const country of countries){const scopes=domains[country]??[`official university ${country}`];for(const scope of scopes.slice(0,2)){
    queries.push(`${scope} computer science ${degree} ${topics.slice(0,2).join(' ')} ${funding} stipend tuition assistantship`);
    queries.push(`${scope} ${degree} ${topics.slice(2).join(' ')||topics[0]} research program funding international students`);
    queries.push(`${scope} computer science graduate funding tuition stipend ${degree}`);
    queries.push(`${scope} ${degree} machine learning research assistantship teaching assistantship admissions`);
  }}
  const primaryCountry=countries[0]??'United States';
  if(filters.keyword.trim())queries.push(`${domains[primaryCountry]?.[0]??`official university ${primaryCountry}`} ${degree} ${filters.keyword.trim()}`);
  return [...new Set(queries.map(q=>q.replace(/\s+/g,' ').trim()))].slice(0,Math.max(4,Math.min(8,limit)));
}

export function isLikelyOfficialAcademicUrl(value:string,countries:string[]):boolean{
  let host:string;try{host=new URL(value).hostname.toLowerCase();}catch{return false;}
  if(/(^|\.)(edu|ac\.uk|edu\.sa|ac\.ae|edu\.qa|ac\.jp|ac\.kr|edu\.cn)$/.test(host))return true;
  if(countries.includes('Germany')&&(/\.de$/.test(host)||['daad.de','mpg.de','helmholtz.de','fraunhofer.de'].some(d=>host===d||host.endsWith(`.${d}`))))return true;
  return ['euraxess.ec.europa.eu','erasmus-plus.ec.europa.eu'].some(d=>host===d||host.endsWith(`.${d}`));
}
