import {randomUUID} from 'node:crypto';
import {db} from './services.mjs';
import {decryptIdentity} from './candidate-crypto.mjs';
import {parseQuery} from './client-search.mjs';
import {rank} from './client-sources.mjs';
import {showDemoProfiles,forStaff} from './demo-visibility.mjs';
import {sampleCandidates} from './sample-candidates.mjs';

const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
const now=()=>new Date().toISOString();
const candidateSelect='id,source,crm_slug,level,seniority,years_bucket,region,firm_type,sector,pay_band,scope,sector_history,skills,summary,fictional,publication';
export async function listCandidateRows(){
 const all=[];
 let last='';
 for(let guard=0;guard<40;guard++){
  const page=await rows(`sp_candidates?select=${candidateSelect}&order=id.asc&limit=500${last?`&id=gt.${last}`:''}`);
  if(!page.length)break;
  all.push(...page);
  if(page.length<500)break;
  const next=page.at(-1)?.id;
  if(!next||next===last)break;
  last=next;
 }
 return all;
}
async function pool(){
 if(!(await rows('sp_candidates?select=id&limit=1')).length)await db('sp_candidates',{method:'POST',body:sampleCandidates.map(row=>({...row,created_at:now()}))});
 return forStaff(await listCandidateRows(),await showDemoProfiles());
}
async function identityFor(id){
 const stored=(await rows(`sp_candidate_identity?candidate_id=eq.${id}&limit=1`))[0];
 if(!stored)return null;
 try{
  const secret=decryptIdentity(stored);
  const name=String(secret.name||'').trim(),employer=String(secret.employer||'').trim();
  if(!name&&!employer)return null;
  return {name:name.slice(0,80),employer:employer.slice(0,120),fictional:secret.fictional===true};
 }catch{return null;}
}
function crmLink(slug){
 return /^[a-zA-Z0-9_-]{1,128}$/.test(slug||'')?`https://app.recruitcrm.io/v1/candidate/${slug}`:'';
}
async function logView(user,candidateId){
 await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:user.id,action:'identity_view',entity:`candidate:${candidateId}`,at:now(),meta:{candidate_id:candidateId}}});
}
export async function staffSearch(user,body){
 const parsed=await parseQuery(body?.query||'senior researcher');
 const filters=body?.filters||parsed.filters;
 const people=await pool();
 const ranked=rank(people,filters).slice(0,10);
 const cards=[];
 for(const row of ranked){
  const source=people.find(item=>item.id===row.id)||{};
  const identity=await identityFor(row.id);
  if(identity)await logView(user,row.id);
  cards.push({...row,demo:source.fictional===true,publication:source.publication||'published',identity,crm:identity?crmLink(source.crm_slug):'',label:source.fictional===true?'Demo profile. Not a real person.':'Imported profile. Unpublished for clients until an admin publishes it.'});
 }
 return {filters,model:body?.filters?'edited':parsed.model,matches:cards,demo:await showDemoProfiles()};
}
export async function staffCandidate(user,id){
 if(!/^[a-f0-9-]{36}$/i.test(id||''))throw Error('validation');
 const person=(await pool()).find(row=>row.id===id);
 if(!person)throw Error('not_found');
 const identity=await identityFor(id);
 await logView(user,id);
 return {candidate:{...person,demo:person.fictional===true,identity,crm:crmLink(person.crm_slug),label:person.fictional===true?'Demo profile. Not a real person.':'Imported profile.'}};
}
