import {createHmac} from 'node:crypto';
import {publicProfile} from './domain.mjs';
import {assessProfile,roleMatches,roleQueries} from './matching.mjs';
export const PROJECT_URL='https://pcezdsdhmjxpjakxtdhz.supabase.co';
export async function db(path,{method='GET',body,upsert=false,returnRows=false}={}){
 if(process.env.SUPABASE_URL!==PROJECT_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('storage_unavailable');
 const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:(returnRows?'return=representation':'return=minimal')+(upsert?',resolution=merge-duplicates':'')},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error('storage_unavailable');const payload=await r.text();return payload?JSON.parse(payload):null;
}
export async function rateLimit(req,action){
 if(!process.env.RATE_LIMIT_HMAC_KEY||process.env.RATE_LIMIT_HMAC_KEY.length<32)throw Error('storage_unavailable');
 // Vercel overwrites x-vercel-forwarded-for. Never trust client x-forwarded-for.
 const ip=process.env.VERCEL?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
 if(typeof ip!=='string'||!ip)throw Error('storage_unavailable');
 const key=createHmac('sha256',process.env.RATE_LIMIT_HMAC_KEY).update(`${action}:${ip}`).digest('hex');
 const allowed=await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:key,p_limit:action==='candidate-read'?8:action==='candidate-join'?3:action==='updates'?100:action==='brief'?5:action==='login'?10:20,p_window_seconds:3600}});
 return allowed===true;
}
export function candidatePage(payload){
 const message=[payload?.message,payload?.error,payload?.data?.message].filter(value=>typeof value==='string').join(' ');
 if(/INSUFFICIENT_ACCESS|upgrade.*(?:business|enterprise)|api.*not.*enabled/i.test(message))throw Error('crm_access_denied');
 if(/unauthenticated|unauthori[sz]ed|invalid.*token|token.*invalid/i.test(message))throw Error('crm_auth_rejected');
 if(Array.isArray(payload))return {records:payload,next:null};
 const page=payload?.data&&Array.isArray(payload.data.data)?payload.data:payload;
 if(Array.isArray(page?.data))return {records:page.data,next:page.next_page_url};
 if(page?.data===null&&page?.total===0)return {records:[],next:null};
 const keys=['data','message','status','error','errors','results','candidates','items','current_page','total','success'].filter(key=>payload&&Object.hasOwn(payload,key)).join('_')||'none';
 const dataType=Array.isArray(payload?.data)?'array':payload?.data===null?'null':typeof payload?.data;
 throw Error(`crm_contract_${keys}_${dataType}`);
}
export function profileReference(slug){
 const key=process.env.RATE_LIMIT_HMAC_KEY;
 if(!key||key.length<32)throw Error('storage_unavailable');
 return 'SP-'+createHmac('sha256',key).update('candidate-reference:'+slug).digest('hex').slice(0,16).toUpperCase();
}
const flagged=value=>value!==undefined&&value!==null&&value!==false&&value!==0&&value!=='false';
export function candidateEligible(candidate,role){
 if(!candidate||typeof candidate.slug!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(candidate.slug)||!roleMatches(role,candidate.position))return false;
 const offLimit=typeof candidate.off_limit==='object'&&candidate.off_limit!==null?candidate.off_limit.off_limit:candidate.off_limit;
 return !flagged(candidate.deleted)&&!flagged(candidate.unavailable)&&!flagged(offLimit)&&!flagged(candidate.marked_as_off_limit)&&(!candidate.status_label||/^available$/i.test(candidate.status_label));
}
export function candidateDetail(payload,slug){
 const data=payload?.data&&typeof payload.data==='object'&&!Array.isArray(payload.data)?payload.data:payload;
 if(!data||typeof data!=='object'||Array.isArray(data)||data.slug!==slug)throw Error('crm_detail_contract');
 return data;
}
export function professionalDiscoveryPriority(candidate,criteria){
 const copy=String(candidate.candidate_summary||candidate.summary||'')+' '+String(candidate.skill||candidate.skills||'');
 const tokens=s=>String(s).toLowerCase().replace(/[^a-z0-9+#]+/g,' ').split(' ').filter(t=>t.length>=3&&!['experience','with','and','the','have','must','years'].includes(t));
 const recorded=new Set(tokens(copy));return (criteria.mustHaves||[]).reduce((total,requirement)=>{const wanted=tokens(requirement);return total+(wanted.length?wanted.filter(t=>recorded.has(t)).length/wanted.length:0);},0);
}
export function candidateResumeUrl(payload,record){
 const rows=Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:payload?.file_link?[payload]:[];
 const original=String(record.resume||'').split('/').at(-1).split('?')[0];
 const matches=rows.filter(f=>f.related_to===record.slug&&f.related_to_type==='candidate'&&typeof f.file_link==='string'&&/^https:\/\//.test(f.file_link)&&typeof f.file_name==='string'&&/\.(?:pdf|docx|txt)$/i.test(f.file_name)&&(original.length>=5&&(f.file_link.includes(original)||f.file_name===original)));
 return matches.sort((a,b)=>Date.parse(b.created_on||0)-Date.parse(a.created_on||0))[0]?.file_link||null;
}
export async function hydrateCandidates(records,role,{limit=10}={}){
 const selected=records.slice(0,limit),hydrated=[];
 for(let start=0;start<selected.length;start+=5){
  const batch=await Promise.all(selected.slice(start,start+5).map(async c=>{
   try{
    if(await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:'spearpoint-crm-provider-budget',p_limit:45,p_window_seconds:60}})!==true)throw Error('crm_rate_limited');
    const r=await fetch('https://api.recruitcrm.io/v1/candidates/'+encodeURIComponent(c.slug),{headers:{Accept:'application/json',Authorization:`Bearer ${process.env.RECRUIT_CRM_API_KEY}`},signal:AbortSignal.timeout(6000)});
    if(!r.ok)throw Error('crm_detail_unavailable');const full=candidateDetail(await r.json(),c.slug),merged={...c,...full,summary:full.candidate_summary||full.summary||c.candidate_summary||c.summary};
    if(!candidateEligible(merged,role))return null;
    try{if(await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:'spearpoint-crm-provider-budget',p_limit:45,p_window_seconds:60}})===true){const h=await fetch('https://api.recruitcrm.io/v1/candidates/'+encodeURIComponent(c.slug)+'/work-history',{headers:{Accept:'application/json',Authorization:`Bearer ${process.env.RECRUIT_CRM_API_KEY}`},signal:AbortSignal.timeout(5000)});if(h.ok){const data=await h.json(),rows=Array.isArray(data)?data:Array.isArray(data?.data)?data.data:data?.work_description?[data]:[];merged.work_history=rows.filter(w=>!w.candidate_slug||w.candidate_slug===c.slug).slice(0,20);}}}catch{}
    if(merged.resume&&typeof merged.resume==='string'&&!/^https:\/\//.test(merged.resume))try{if(await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:'spearpoint-crm-provider-budget',p_limit:45,p_window_seconds:60}})===true){const files=await fetch('https://api.recruitcrm.io/v1/files/candidate/'+encodeURIComponent(c.slug),{headers:{Accept:'application/json',Authorization:`Bearer ${process.env.RECRUIT_CRM_API_KEY}`},signal:AbortSignal.timeout(5000)});if(files.ok){const url=candidateResumeUrl(await files.json(),merged);if(url)merged.resume=url;}}}catch{}
    return {...merged,_profileReadStatus:'detail_read'};
   }catch{return {...c,_profileReadStatus:'detail_unavailable'};}
  }));hydrated.push(...batch.filter(Boolean));
 }
 return [...hydrated,...records.slice(limit).map(c=>({...c,_profileReadStatus:'not_read_budget'}))];
}
export async function discoverInternal(input){
 if(process.env.RECRUIT_CRM_ENABLED!=='true'||!process.env.RECRUIT_CRM_API_KEY)return {records:[],status:'not_connected'};
 const batches=await Promise.all(roleQueries(input.role).map(async title=>{
  const records=[];
  for(let page=1;page<=2;page++){
   const allowed=await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:'spearpoint-crm-provider-budget',p_limit:45,p_window_seconds:60}});
   if(allowed!==true)throw Error('crm_rate_limited');
   const url=new URL('https://api.recruitcrm.io/v1/candidates/search');
   url.searchParams.set('position',title);url.searchParams.set('marked_as_off_limit','false');url.searchParams.set('page',String(page));
   const r=await fetch(url,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${process.env.RECRUIT_CRM_API_KEY}`},signal:AbortSignal.timeout(6000)});
   if(!r.ok)throw Error(`crm_http_${r.status}`);const data=await r.json();
   const parsed=candidatePage(data);records.push(...parsed.records.slice(0,25));if(!parsed.next||parsed.next==='null')break;
  }
  return records;
 }));
 const candidates=new Map(batches.flat().filter(c=>candidateEligible(c,input.role)).map(c=>[c.slug,c]));
 const records=[...candidates.values()].sort((a,b)=>professionalDiscoveryPriority(b,input)-professionalDiscoveryPriority(a,input)).slice(0,40);
 return {records:input.mustHaves?.length===3?await hydrateCandidates(records,input.role):records,status:'searched'};
}
export async function realSearch(input){
 const result=await discoverInternal(input);if(result.status!=='searched')return {profiles:[],status:result.status};
 const candidates=new Map(result.records.map(c=>[c.slug,c]));
 const slugs=new Set(candidates.keys());
 if(!slugs.size)return {profiles:[],status:'searched'};
 const fields='crm_slug,approval_basis,approved_by,external_sharing_consent,consent_evidence,consent_expires_at,revoked_at,reviewed_at,public_title,public_summary,public_skills';
 const rows=await db(`sp_profile_approvals?select=${fields}&external_sharing_consent=eq.true&revoked_at=is.null&crm_slug=in.(${[...slugs].join(',')})&limit=100`);
 if(!Array.isArray(rows))throw Error('storage_unavailable');
 const profiles=rows.map(row=>{
  const safe=publicProfile(row,slugs);if(!safe)return null;
  const match=assessProfile(input,row);if(!match.eligible)return null;
  return {...safe,reference:profileReference(row.crm_slug),experience:match.experience,fitReasons:match.fitReasons,gaps:match.gaps,checks:match.checks,matchBasis:match.matchBasis};
 }).filter(Boolean).sort((a,b)=>b.reviewedAt.localeCompare(a.reviewedAt)).slice(0,6);
 return {profiles,status:'searched'};
}
export async function saveBrief(brief){
 const id=crypto.randomUUID();
 await db('sp_briefs',{method:'POST',body:{id,...brief,consented_at:new Date().toISOString()}});
 // Capture succeeds independently of optional CRM delivery. No employer data is sent by default.
 let sync='disabled';
 if(process.env.HUBSPOT_SYNC_AUTHORIZED==='true'&&process.env.HUBSPOT_PRIVATE_APP_TOKEN){
  try{const r=await fetch('https://api.hubapi.com/crm/v3/objects/contacts',{method:'POST',headers:{Authorization:`Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({properties:{email:brief.email,firstname:brief.name,company:brief.company}}),signal:AbortSignal.timeout(6000)});sync=r.ok?'synced':'needs_review';}catch{sync='needs_review';}
  await db(`sp_briefs?id=eq.${id}`,{method:'PATCH',body:{hubspot_status:sync}}).catch(()=>{});
 }
 return {id,sync};
}
