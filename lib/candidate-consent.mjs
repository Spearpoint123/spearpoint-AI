import {createHash,randomUUID} from 'node:crypto';
import {db} from './services.mjs';
import {revealEntity} from './portal-sample.mjs';
import {track} from './analytics.mjs';

const now=()=>new Date().toISOString();
const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
async function linkFor(token){
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('not_found');
 const hash=createHash('sha256').update(token).digest('hex');
 const link=(await rows(`sp_candidate_links?token_hash=eq.${hash}&limit=1`))[0];
 if(!link||Date.parse(link.expires_at)<=Date.now())throw Error('not_found');
 return link;
}
async function view(link){
 const org=(await rows(`sp_organisations?id=eq.${link.organisation_id}&limit=1`))[0];
 const search=(await rows(`sp_searches?id=eq.${link.search_id}&limit=1`))[0];
 const approval=(await rows(`sp_reveal_approvals?candidate_id=eq.${link.candidate_id}&organisation_id=eq.${link.organisation_id}&search_id=eq.${link.search_id}&limit=1`))[0];
 const decision=!approval?'pending':approval.withdrawn_at?'withdrawn':'approved';
 return {employer:org?.legal_name||'The employer',searchTitle:search?.title||'A search',decision,fictional:true};
}
async function consent(candidateId,purpose){
 const existing=(await rows(`sp_consents?candidate_id=eq.${candidateId}&purpose=eq.${purpose}&limit=5`)).find(row=>!row.withdrawn_at);
 if(!existing)await db('sp_consents',{method:'POST',body:{id:randomUUID(),candidate_id:candidateId,purpose,granted_at:now(),withdrawn_at:null,evidence:'In-app approval'}});
}
export async function consentApi(body){
 const link=await linkFor(String(body?.token||''));
 const decision=String(body?.decision||'');
 if(!decision)return view(link);
 if(!['approve','decline','withdraw'].includes(decision))throw Error('validation');
 const current=(await rows(`sp_reveal_approvals?candidate_id=eq.${link.candidate_id}&organisation_id=eq.${link.organisation_id}&search_id=eq.${link.search_id}&limit=1`))[0];
 if(decision==='approve'){
  await consent(link.candidate_id,'in_database');
  await consent(link.candidate_id,'anonymised_matching');
  if(current)await db(`sp_reveal_approvals?id=eq.${current.id}`,{method:'PATCH',body:{approved_at:now(),withdrawn_at:null}});
  else await db('sp_reveal_approvals',{method:'POST',body:{id:randomUUID(),candidate_id:link.candidate_id,organisation_id:link.organisation_id,search_id:link.search_id,approved_at:now(),withdrawn_at:null}});
  await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:link.created_by,action:'reveal',entity:revealEntity(link.candidate_id,link.organisation_id,link.search_id),at:now(),meta:{candidate_id:link.candidate_id,organisation_id:link.organisation_id,search_id:link.search_id,via:'candidate_page'}}});
  await track(link.created_by,'consent_decided',{approved:true});
 }else{
  if(current)await db(`sp_reveal_approvals?id=eq.${current.id}`,{method:'PATCH',body:{withdrawn_at:now()}});
  else await db('sp_reveal_approvals',{method:'POST',body:{id:randomUUID(),candidate_id:link.candidate_id,organisation_id:link.organisation_id,search_id:link.search_id,approved_at:now(),withdrawn_at:now()}});
  await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:link.created_by,action:'consent',entity:`consent:${link.candidate_id}:${link.search_id}`,at:now(),meta:{decision,candidate_id:link.candidate_id,search_id:link.search_id}}});
  await track(link.created_by,'consent_decided',{approved:false});
 }
 return view(link);
}
