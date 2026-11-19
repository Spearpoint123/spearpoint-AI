import {ensureCandidates} from './client-journey.mjs';
import {db,demoMode} from './services.mjs';
import {parseQuery} from './client-search.mjs';
import {databaseSource,assertClientSources,marketMap,clientCandidate} from './client-sources.mjs';
import {suggestMustHaves,normaliseMustHaves} from './must-haves.mjs';
import {widerForClient} from './client-external.mjs';
import {presentCards,mixCards} from './present-cards.mjs';
import {loadClientCandidates} from './demo-visibility.mjs';
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
export async function publicTeaser(body,visitor={}){
 await ensureCandidates();
 const visible=await loadClientCandidates();
 const parsed=await parseQuery(body?.query||'senior quantitative researcher');
 const suggestions=suggestMustHaves(body?.query||'',parsed.filters);
 if(body?.counts===true){const counted=await census();return {filters:parsed.filters,suggestions,market:counted.profiles?counted:demoMode()?{profiles:86,sectors:8}:null};}
 if(body?.preview===true)return {filters:parsed.filters,suggestions,preview:true};
 const source=databaseSource(visible);
 assertClientSources([source,{id:'rocketreach',kind:'snapshot',label:'Wider market'}],{clientSearch:true});
 const matches=source.search(parsed.filters,40);
 const musts=normaliseMustHaves(body?.must_haves??body?.mustHaves,suggestions);
 let wider=[];
 try{const found=await widerForClient({query:body?.query||'senior',cohort:visible,anonymous:visitor.anonymous!==false,verified:false,ip:visitor.ip||'local'});wider=found.rows||[];}catch{wider=[];}
 const cards=mixCards(await presentCards(matches,wider,musts,visible),4,2);
 const counted=await census();
 const market=counted.profiles?counted:demoMode()?{profiles:86,sectors:8}:null;
 if(body?.counts!==true){await track(null,'teaser_search',{matched:matches.length});await track(null,'capture_started',{matched:matches.length});}
 return {filters:parsed.filters,suggestions,must_haves:musts,total:visible.length,matched:matches.length,market,chart:{seniority:kBuckets(matches,'level'),pay:kBuckets(matches,'pay_band')},map:marketMap(matches.map(clientCandidate)),cards,message:'Counts and bands from Spearpoint’s database. Wider market cards are anonymised snapshots. Identity pending approval.'};
}
