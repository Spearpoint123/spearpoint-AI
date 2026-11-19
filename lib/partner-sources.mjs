// Partner-desk adapters. RocketReach runs only when its key is set. The others stay off.
import {randomUUID} from 'node:crypto';
import {db} from './services.mjs';
import {encryptIdentity} from './candidate-crypto.mjs';
import {mapCrmRecord} from './crm-import.mjs';

const adapters=[
 {id:'rocketreach',label:'RocketReach',kind:'licensed'},
 {id:'people_data_labs',label:'People Data Labs',kind:'licensed'},
 {id:'coresignal',label:'Coresignal',kind:'licensed'}
];
export const ROCKETREACH_LABEL='External: RocketReach';
const now=()=>new Date().toISOString();
const clip=(value,max)=>String(value||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,max);
export function rocketReachConfigured(){return typeof process.env.ROCKETREACH_API_KEY==='string'&&process.env.ROCKETREACH_API_KEY.length>0;}
export function partnerProviders(){
 return adapters.map(adapter=>{
  if(adapter.id!=='rocketreach')return {...adapter,enabled:false,configured:false,reason:'No key is configured. This adapter is not called.'};
  const configured=rocketReachConfigured();
  return {...adapter,enabled:configured,configured,reason:configured?'Partner desk only. Results stay unpublished.':'RocketReach not connected.'};
 });
}
export async function searchPartnerProvider(id){
 const adapter=partnerProviders().find(item=>item.id===id);
 if(!adapter)return {called:false,records:[],reason:'unknown'};
 return {called:false,records:[],reason:adapter.reason,id:adapter.id};
}
function creditsFrom(payload,response){
 const headers=response?.headers;
 const headerRemaining=headers?.get?.('x-credits-remaining')||headers?.get?.('x-credit-remaining')||'';
 const headerUsed=headers?.get?.('x-credits-used')||'';
 const usage=payload&&typeof payload==='object'?(payload.credit_usage||payload.credits||null):null;
 let remaining=headerRemaining||null,used=headerUsed||null;
 const row=Array.isArray(usage)?usage[0]:usage;
 if(row&&typeof row==='object'){
  if(remaining==null)remaining=row.remaining??row.credits_remaining??null;
  if(used==null)used=row.used??row.credits_used??null;
 }
 const out={};
 if(remaining!=null&&remaining!==''&&Number.isFinite(Number(remaining)))out.remaining=Number(remaining);
 if(used!=null&&used!==''&&Number.isFinite(Number(used)))out.used=Number(used);
 return Object.keys(out).length?out:null;
}
function externalCard(profile){
 const id=Number(profile?.id||profile?.profile_id);
 if(!Number.isSafeInteger(id)||id<=0||profile?.suppressed===true)return null;
 const name=clip(profile.name,80);
 if(name.length<2)return null;
 return {externalId:String(id),name,title:clip(profile.current_title||profile.title,120),employer:clip(profile.current_employer,120),location:clip(profile.location||profile.city,80),label:ROCKETREACH_LABEL};
}
async function audit(user,action,meta){
 await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:user.id,action,entity:'provider:rocketreach',at:now(),meta}});
}
export async function searchRocketReach(user,query,{fetcher=fetch}={}){
 if(!rocketReachConfigured())return {connected:false,called:false,records:[],count:0,credits:null,label:ROCKETREACH_LABEL,notice:'RocketReach not connected'};
 const text=clip(query,200);
 if(text.length<3)throw Error('validation');
 const allowed=await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:'spearpoint-rocketreach-search-minute',p_limit:20,p_window_seconds:60}});
 if(allowed!==true)return {connected:true,called:false,records:[],count:0,credits:null,label:ROCKETREACH_LABEL,status:'provider_rate_limit',notice:'RocketReach is rate limited. Try again shortly.'};
 let response,status='provider_unavailable',payload=null;
 try{
  response=await fetcher('https://api.rocketreach.co/api/v2/search',{method:'POST',headers:{'Api-Key':process.env.ROCKETREACH_API_KEY,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({query:{keyword:[text]},start:1,page_size:10}),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(response.ok){payload=await response.json();status=Array.isArray(payload?.profiles)?'searched':'provider_unavailable';}
  else status=response.status===429?'provider_rate_limit':response.status===401?'authentication_failed':response.status===402?'credits_exhausted':'provider_unavailable';
 }catch{status='provider_unavailable';}
 const records=status==='searched'?payload.profiles.map(externalCard).filter(Boolean).slice(0,10):[];
 const credits=creditsFrom(payload,response);
 await audit(user,'provider_lookup',{results:records.length,status,credits});
 return {connected:true,called:true,label:ROCKETREACH_LABEL,count:records.length,credits,records,status,notice:status==='searched'?'':'RocketReach did not return results.'};
}
export async function importRocketReach(user,body){
 const externalId=String(body?.externalId||'').replace(/\D/g,'');
 const name=clip(body?.name,80);
 const employer=clip(body?.employer,120);
 const title=clip(body?.title,120)||'Specialist';
 const location=clip(body?.location,80);
 if(!externalId||name.length<2)throw Error('validation');
 const mapped=mapCrmRecord({name,position:title,current_organization:employer||'Undisclosed',city:location,slug:`rr-${externalId}`});
 const projection={...mapped.projection,source:'rocketreach',publication:'unpublished',fictional:false};
 const existing=(await db(`sp_candidates?crm_slug=eq.rr-${externalId}&select=id,publication&limit=1`));
 const prior=Array.isArray(existing)?existing[0]:null;
 let id=prior?.id;
 if(prior){
  if(prior.publication==='published')throw Error('validation');
  await db(`sp_candidates?id=eq.${prior.id}`,{method:'PATCH',body:{...projection,publication:'unpublished',fictional:false}});
 }else{
  id=randomUUID();
  await db('sp_candidates',{method:'POST',body:{...projection,id,created_at:now()}});
 }
 if(mapped.identity&&process.env.CANDIDATE_IDENTITY_KEY){
  const stored=encryptIdentity({...mapped.identity,fictional:false});
  const have=await db(`sp_candidate_identity?candidate_id=eq.${id}&select=id&limit=1`);
  if(!Array.isArray(have)||!have.length)await db('sp_candidate_identity',{method:'POST',body:{id:randomUUID(),candidate_id:id,ciphertext:stored.ciphertext,key_version:stored.key_version,created_at:now()}}).catch(()=>{});
 }
 await audit(user,'provider_import',{external_id:externalId,candidate_id:id,publication:'unpublished'});
 return {id,publication:'unpublished',source:'rocketreach',label:ROCKETREACH_LABEL};
}
