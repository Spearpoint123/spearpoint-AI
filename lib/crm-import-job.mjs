import {randomUUID} from 'node:crypto';
import {db} from './services.mjs';
import {candidatePage} from './services.mjs';
import {mapCrmRecord} from './crm-import.mjs';
import {encryptIdentity} from './candidate-crypto.mjs';

const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
const now=()=>new Date().toISOString();
async function job(){
 const latest=(await rows('sp_import_jobs?order=updated_at.desc&limit=1'))[0];
 if(latest&&latest.status!=='complete'&&latest.status!=='not_configured'){
  if(latest.status!=='running')await db(`sp_import_jobs?id=eq.${latest.id}`,{method:'PATCH',body:{status:'running',last_error:'',updated_at:now()}});
  return {...latest,status:'running',last_error:''};
 }
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
 if(response.status===429){const retry=Number(response.headers.get('retry-after'));return {configured:true,rateLimited:true,retryAfter:Number.isFinite(retry)?Math.min(Math.max(retry,1),30):2,records:[],next:true};}
 if(!response.ok)throw Error(response.status===401?'crm_auth_rejected':`crm_http_${response.status}`);
 const parsed=candidatePage(await response.json());
 return {configured:true,records:parsed.records||[],next:Boolean(parsed.next)};
}
async function priors(slugs){
 if(!slugs.length)return [];
 const list=slugs.map(slug=>encodeURIComponent(slug)).join(',');
 return rows(`sp_candidates?crm_slug=in.(${list})&select=id,crm_slug,publication&limit=100`);
}
async function upsert(records){
 const {generalise}=await import('./anonymise.mjs');
 const mapped=(Array.isArray(records)?records:[]).map((raw,index)=>{const item=mapCrmRecord(raw);item.projection.import_index=index;return item;});
 const shaped=generalise(mapped.map(row=>row.projection),[],5);
 const kept=new Map(mapped.map(row=>[row.projection.import_index,row]));
 const projections=[...shaped.rows,...shaped.suppressed];
 const slugs=[...new Set(projections.map(row=>String(row.crm_slug||'')).filter(Boolean))];
 const existing=await priors(slugs);
 let imported=0,updated=0,skipped=0;
 for(const row of projections){
  const {import_index,...projection}=row;
  const slug=String(projection.crm_slug||'');
  const prior=slug?existing.find(item=>item.crm_slug===slug):null;
  let id=prior?.id;
  if(prior){
   if(prior.publication==='published'){skipped++;continue;}
   await db(`sp_candidates?id=eq.${prior.id}`,{method:'PATCH',body:{...projection,publication:'unpublished',fictional:false}});
   updated++;
  }else{
   id=randomUUID();
   await db('sp_candidates',{method:'POST',body:{...projection,id,publication:'unpublished',fictional:false,created_at:now()}});
   imported++;
   if(slug)existing.push({id,crm_slug:slug,publication:'unpublished'});
  }
  const identity=kept.get(import_index)?.identity;
  if(identity&&process.env.CANDIDATE_IDENTITY_KEY){
   const stored=encryptIdentity(identity);
   const have=await rows(`sp_candidate_identity?candidate_id=eq.${id}&limit=1`);
   if(!have.length)await db('sp_candidate_identity',{method:'POST',body:{id:randomUUID(),candidate_id:id,ciphertext:stored.ciphertext,key_version:stored.key_version,created_at:now()}}).catch(()=>{});
  }
 }
 return {imported,updated,skipped};
}
async function stepOnce({fetcher}){
 const current=await job();
 const watermark=(await rows('sp_settings?key=eq.crm_sync_watermark&limit=1'))[0]?.value?.at||'';
 let page;
 try{page=await fetcher(current.page,watermark);}catch(error){
  await db(`sp_import_jobs?id=eq.${current.id}`,{method:'PATCH',body:{status:'error',last_error:String(error.message||'error').slice(0,160),updated_at:now()}});
  return progress({...current,status:'error',last_error:error.message});
 }
 if(!page.configured){await db(`sp_import_jobs?id=eq.${current.id}`,{method:'PATCH',body:{status:'not_configured',last_error:'missing_key',updated_at:now()}});return {...progress(current),status:'not_configured',reason:'missing_key'};}
 if(page.rateLimited)return {...progress(current),waiting:true,reason:'rate_limited',retryAfter:page.retryAfter||2};
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
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function stepImport({fetcher=defaultCrmPage,maxPages=30,budgetMs=45000}={}){
 if(process.env.RECRUIT_CRM_WRITE==='true')return {status:'blocked',reason:'write_flag_on',imported:0};
 const started=Date.now();
 const pages=Math.min(Math.max(Number(maxPages)||1,1),80);
 const budget=Math.min(Math.max(Number(budgetMs)||45000,1000),55000);
 let last,index=0;
 while(index<pages){
  if(Date.now()-started>=budget)return {...(last||{status:'running',page:0,imported:0,updated:0,skipped:0}),paused:true,reason:'time_budget'};
  last=await stepOnce({fetcher});
  if(last.reason==='rate_limited'){
   const wait=Math.min((last.retryAfter||2)*1000,8000);
   if(Date.now()-started+wait>=budget)return {...last,waiting:true};
   await sleep(wait);
   continue;
  }
  index++;
  if(last.waiting||last.status==='complete'||last.status==='blocked'||last.status==='not_configured'||last.status==='error')break;
 }
 return last;
}
