import {ensureCandidates} from './client-journey.mjs';
import {db,demoMode} from './services.mjs';
import {parseQuery} from './client-search.mjs';
import {databaseSource,assertClientSources,marketMap,clientCandidate} from './client-sources.mjs';
import {showDemoProfiles,forClients} from './demo-visibility.mjs';
import {track} from './analytics.mjs';

const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
export function kBuckets(list,key,k=5){
 const bag={};
 for(const row of list||[]){
  const name=String(row?.[key]||'').trim();
  if(!name)continue;
  bag[name]=(bag[name]||0)+1;
 }
 return Object.entries(bag).filter(([,total])=>total>=k).map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total);
}
async function census(){
 const all=[];
 let last='';
 for(let guard=0;guard<40;guard++){
  const page=await rows(`sp_candidates?select=id,sector,fictional&order=id.asc&limit=500${last?`&id=gt.${last}`:''}`);
  if(!page.length)break;
  all.push(...page);
  if(page.length<500)break;
  const next=page.at(-1)?.id;
  if(!next||next===last)break;
  last=next;
 }
 const real=all.filter(row=>row.fictional!==true);
 return {profiles:real.length,sectors:new Set(real.map(row=>row.sector).filter(Boolean)).size};
}
export async function publicTeaser(body){
 await ensureCandidates();
 const visible=forClients(await rows('sp_candidates?select=id,source,level,seniority,years_bucket,region,firm_type,sector,pay_band,scope,sector_history,skills,summary,fictional,publication&limit=300'),await showDemoProfiles());
 const parsed=await parseQuery(body?.query||'senior quantitative researcher');
 const source=databaseSource(visible);
 assertClientSources([source]);
 const matches=source.search(parsed.filters,500);
 const counted=await census();
 const market=counted.profiles?counted:demoMode()?{profiles:86,sectors:8}:null;
 if(body?.counts!==true){await track(null,'teaser_search',{matched:matches.length});await track(null,'capture_started',{matched:matches.length});}
 return {filters:parsed.filters,total:visible.length,matched:matches.length,market,chart:{seniority:kBuckets(matches,'level'),pay:kBuckets(matches,'pay_band')},map:marketMap(matches.map(clientCandidate)),cards:matches.slice(0,3).map(row=>({level:row.level,firm_type:row.firm_type,region:row.region,pay_band:row.pay_band})),message:'Counts and bands from Spearpoint’s database. Identity pending approval.'};
}
