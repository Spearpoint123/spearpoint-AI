import {createHash,randomUUID} from 'node:crypto';
import {db,demoMode} from './services.mjs';
import {mapCrmRecord} from './crm-import.mjs';
import {rocketReachConfigured} from './partner-sources.mjs';
import {fitCohort} from './anonymise.mjs';

const now=()=>new Date().toISOString();
const clip=value=>String(value||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,120);
const identity=/^(name|first_name|last_name|full_name|employer|current_employer|company|email|emails|phone|phones|linkedin|linkedin_url|photo|picture|avatar|url|profile_pic)$/i;
const leak=/@[a-z0-9.-]+\.[a-z]{2,}|\blinkedin\.com\b|https?:|www\.|\b\+?\d[\d\s().-]{8,}\b/i;
export function scrubClient(value){
 if(Array.isArray(value))return value.map(scrubClient);
 if(!value||typeof value!=='object')return value;
 const out={};
 for(const [key,item] of Object.entries(value)){
  if(identity.test(key))continue;
  out[key]=typeof item==='string'||typeof item==='object'?scrubClient(item):item;
 }
 return out;
}
export function snapshotFromRocketReach(profile){
 const title=clip(profile?.current_title||profile?.title);
 const location=clip(profile?.location||profile?.city);
 if(title.length<2)return null;
 const mapped=mapCrmRecord({position:title,city:location,skill:title});
 const projection=mapped.projection||{};
 delete projection.crm_slug;
 return scrubClient({...projection,source:undefined,id:randomUUID(),fictional:false,summary:`${projection.level} profile. ${projection.firm_type}. ${projection.region}. Pay band ${projection.pay_band}.`});
}
function assertClean(rows){
 const text=JSON.stringify(rows);
 if(leak.test(text)||/rocketreach/i.test(text))throw Error('anonymisation_required');
 return rows;
}
function hashKey(query,mustHaves){return createHash('sha256').update(`${String(query||'').toLowerCase()}|${(mustHaves||[]).join('|')}`).digest('hex');}
async function readCache(key){
 try{
  const rows=await db(`sp_external_cache?search_key=eq.${key}&limit=1`);
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row||(row.expires_at&&Date.parse(row.expires_at)<=Date.now()))return null;
  const snapshots=Array.isArray(row.snapshots)?row.snapshots:[];
  return assertClean(snapshots.map(scrubClient));
 }catch{return null;}
}
async function writeCache(key,snapshots){
 try{await db('sp_external_cache',{method:'POST',body:{id:randomUUID(),search_key:key,snapshots,created_at:now(),expires_at:new Date(Date.now()+7*86400000).toISOString()}});}catch{}
}
async function audit(userId,meta){
 try{await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:userId||null,action:'provider_lookup',entity:'provider:rocketreach',at:now(),meta}});}catch{}
}
function creditsFrom(payload,response){
 const headers=response?.headers;
 const remaining=headers?.get?.('x-credits-remaining')||headers?.get?.('x-credit-remaining');
 const used=headers?.get?.('x-credits-used');
 const out={};
 if(remaining!=null&&remaining!==''&&Number.isFinite(Number(remaining)))out.remaining=Number(remaining);
 if(used!=null&&used!==''&&Number.isFinite(Number(used)))out.used=Number(used);
 const usage=payload?.credit_usage||payload?.credits;
 const row=Array.isArray(usage)?usage[0]:usage;
 if(row&&typeof row==='object'){
  if(out.remaining==null&&Number.isFinite(Number(row.remaining??row.credits_remaining)))out.remaining=Number(row.remaining??row.credits_remaining);
  if(out.used==null&&Number.isFinite(Number(row.used??row.credits_used)))out.used=Number(row.used??row.credits_used);
 }
 return Object.keys(out).length?out:null;
}
async function allowLive({verified,anonymous,ip}){
 if(!anonymous&&!verified)return false;
 if(anonymous){
  const visitor=await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:`client-external-anon:${ip||'unknown'}`,p_limit:1,p_window_seconds:86400}});
  if(visitor!==true)return false;
 }
 const shared=await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:'spearpoint-rocketreach-search-minute',p_limit:20,p_window_seconds:60}});
 return shared===true;
}
export function fictionalWider(cohort=[]){
 const pool=(cohort||[]).filter(row=>row?.level&&row?.region&&row?.firm_type);
 const first=pool.find(row=>/dubai/i.test(row.region))||pool[0];
 const second=pool.find(row=>row!==first&&row.level==='Staff'&&/london/i.test(row.region))||pool.find(row=>row!==first)||first;
 return [first,second].filter(Boolean).slice(0,2).map((row,index)=>scrubClient({id:`d1000001-0000-4000-8000-${String(index+1).padStart(12,'0')}`,level:row.level,seniority:row.seniority,years_bucket:row.years_bucket,region:row.region,firm_type:row.firm_type,sector:row.sector,pay_band:row.pay_band,scope:row.scope||{},skills:[],summary:'',fictional:true}));
}
export async function widerForClient({query,cohort=[],verified=false,anonymous=false,userId=null,ip='local',fetcher=fetch}={}){
 const text=clip(query);
 if(text.length<3)return {rows:[],status:'skipped',live:false};
 if(!rocketReachConfigured()){
  if(demoMode())return {rows:fictionalWider(cohort),status:'demo',live:false};
  return {rows:[],status:'not_connected',live:false};
 }
 const key=hashKey(text,[]);
 const cached=await readCache(key);
 if(cached)return {rows:cached.map(row=>fitCohort(row,cohort,5)).filter(Boolean),status:'cached',live:false};
 let allowed=false;
 try{allowed=await allowLive({verified,anonymous,ip});}catch{allowed=false;}
 if(!allowed)return {rows:[],status:verified?'provider_rate_limit':'verification_required',live:false};
 let response,payload=null,status='provider_unavailable';
 try{
  response=await fetcher('https://api.rocketreach.co/api/v2/search',{method:'POST',headers:{'Api-Key':process.env.ROCKETREACH_API_KEY,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({query:{keyword:[text]},start:1,page_size:5}),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(response.ok){payload=await response.json();status=Array.isArray(payload?.profiles)?'searched':'provider_unavailable';}
  else status=response.status===429?'provider_rate_limit':response.status===402?'credits_exhausted':response.status===401?'authentication_failed':'provider_unavailable';
 }catch{status='provider_unavailable';}
 let clean=[];
 try{clean=assertClean((status==='searched'?payload.profiles.map(snapshotFromRocketReach).filter(Boolean).slice(0,5):[]).map(scrubClient));}catch{status='anonymisation_required';clean=[];}
 const credits=creditsFrom(payload,response);
 await audit(userId,{audience:'client',results:clean.length,status,credits,cached:false});
 if(clean.length)await writeCache(key,clean);
 return {rows:clean.map(row=>fitCohort(row,cohort,5)).filter(Boolean),status,live:true,credits};
}
