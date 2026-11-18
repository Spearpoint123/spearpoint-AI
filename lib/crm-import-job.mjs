import {randomUUID} from 'node:crypto';
import {db} from './services.mjs';
import {candidatePage} from './services.mjs';
import {prepareImport} from './crm-import.mjs';
import {encryptIdentity} from './candidate-crypto.mjs';

const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
const now=()=>new Date().toISOString();
async function job(){
 const current=(await rows('sp_import_jobs?status=eq.running&order=updated_at.desc&limit=1'))[0];
 if(current)return current;
 const created={id:randomUUID(),status:'running',page:1,imported:0,updated_count:0,skipped:0,last_error:'',updated_at:now()};
 await db('sp_import_jobs',{method:'POST',body:created});
 return created;
}
function progress(row,extra={}){
 return {id:row.id,status:row.status,page:row.page,imported:row.imported,updated:row.updated_count,skipped:row.skipped,lastError:row.last_error||'',...extra};
}
export async function importProgress(){
 const row=(await rows('sp_import_jobs?order=updated_at.desc&limit=1'))[0];
 return row?progress(row):{status:'idle',page:0,imported:0,updated:0,skipped:0,lastError:''};
}
export async function defaultCrmPage(page,watermark){
 const key=process.env.RECRUIT_CRM_API_KEY;
 if(!key)return {configured:false,records:[],next:false};
 const params=new URLSearchParams({page:String(page),limit:'25'});
 if(watermark)params.set('updated_from',watermark);
 const response=await fetch(`https://api.recruitcrm.io/v1/candidates?${params}`,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(12000)});
 if(response.status===429)return {configured:true,rateLimited:true,records:[],next:true};
 if(!response.ok)throw Error(response.status===401?'crm_auth_rejected':`crm_http_${response.status}`);
 const parsed=candidatePage(await response.json());
 return {configured:true,records:parsed.records||[],next:Boolean(parsed.next)};
}
async function upsert(records){
 const existing=await rows('sp_candidates?select=id,crm_slug,publication,level,years_bucket,firm_type,region,sector,pay_band&limit=500');
 const prepared=prepareImport(records,existing.filter(row=>row.publication!=='unpublished'),5);
 let imported=0,updated=0,skipped=prepared.suppressed;
 for(const [index,projection] of prepared.rows.entries()){
  const slug=String(projection.crm_slug||'');
  const prior=slug?existing.find(row=>row.crm_slug===slug):null;
  let id=prior?.id;
  if(prior){
   if(prior.publication==='published'){skipped++;continue;}
   await db(`sp_candidates?id=eq.${prior.id}`,{method:'PATCH',body:{...projection,publication:'unpublished',fictional:false}});
   updated++;
  }else{
   id=randomUUID();
   await db('sp_candidates',{method:'POST',body:{...projection,id,publication:'unpublished',fictional:false,created_at:now()}});
   imported++;
  }
  const identity=prepared.identities[index];
  if(identity&&process.env.CANDIDATE_IDENTITY_KEY){
   const stored=encryptIdentity(identity);
   const have=await rows(`sp_candidate_identity?candidate_id=eq.${id}&limit=1`);
   if(!have.length)await db('sp_candidate_identity',{method:'POST',body:{id:randomUUID(),candidate_id:id,ciphertext:stored.ciphertext,key_version:stored.key_version,created_at:now()}}).catch(()=>{});
  }
 }
 return {imported,updated,skipped};
}
async function stepOnce({fetcher,paceMs}){
 const current=await job();
 if(paceMs&&Date.now()-Date.parse(current.updated_at||0)<paceMs&&current.page>1)return {...progress(current),waiting:true};
 const watermark=(await rows('sp_settings?key=eq.crm_sync_watermark&limit=1'))[0]?.value?.at||'';
 let page;
 try{page=await fetcher(current.page,watermark);}catch(error){
  await db(`sp_import_jobs?id=eq.${current.id}`,{method:'PATCH',body:{status:'error',last_error:String(error.message||'error').slice(0,160),updated_at:now()}});
  return progress({...current,status:'error',last_error:error.message});
 }
 if(!page.configured){await db(`sp_import_jobs?id=eq.${current.id}`,{method:'PATCH',body:{status:'not_configured',last_error:'missing_key',updated_at:now()}});return {...progress(current),status:'not_configured',reason:'missing_key'};}
 if(page.rateLimited)return {...progress(current),waiting:true,reason:'rate_limited'};
 const counts=await upsert(page.records||[]);
 const done=!page.next||!(page.records||[]).length;
 const next={status:done?'complete':'running',page:done?current.page:current.page+1,imported:current.imported+counts.imported,updated_count:current.updated_count+counts.updated,skipped:current.skipped+counts.skipped,last_error:'',updated_at:now()};
 await db(`sp_import_jobs?id=eq.${current.id}`,{method:'PATCH',body:next});
 if(done){
  const stamp={at:now()};
  const mark=await rows('sp_settings?key=eq.crm_sync_watermark&limit=1');
  if(mark.length)await db('sp_settings?key=eq.crm_sync_watermark',{method:'PATCH',body:{value:stamp,updated_at:now()}});
  else await db('sp_settings',{method:'POST',body:{key:'crm_sync_watermark',value:stamp,updated_at:now()}});
 }
 return progress({...current,...next,updated_count:next.updated_count});
}
export async function stepImport({fetcher=defaultCrmPage,paceMs=1200,maxPages=1}={}){
 if(process.env.RECRUIT_CRM_WRITE==='true')return {status:'blocked',reason:'write_flag_on',imported:0};
 const pages=Math.min(Math.max(Number(maxPages)||1,1),40);
 let last;
 for(let index=0;index<pages;index++){
  if(index>0&&paceMs)await new Promise(resolve=>setTimeout(resolve,paceMs));
  last=await stepOnce({fetcher,paceMs:index===0?paceMs:0});
  if(last.waiting||last.status==='complete'||last.status==='blocked'||last.status==='not_configured'||last.status==='error')break;
 }
 return last;
}
