import {createHmac} from 'node:crypto';
import {publicProfile} from './domain.mjs';
import {assessProfile,roleMatches,roleQueries} from './matching.mjs';
export const PROJECT_URL='https://pcezdsdhmjxpjakxtdhz.supabase.co';
export async function db(path,{method='GET',body}={}){
 if(process.env.SUPABASE_URL!==PROJECT_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('storage_unavailable');
 const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error('storage_unavailable');const payload=await r.text();return payload?JSON.parse(payload):null;
}
export async function rateLimit(req,action){
 if(!process.env.RATE_LIMIT_HMAC_KEY||process.env.RATE_LIMIT_HMAC_KEY.length<32)throw Error('storage_unavailable');
 // Vercel overwrites x-vercel-forwarded-for. Never trust client x-forwarded-for.
 const ip=process.env.VERCEL?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
 if(typeof ip!=='string'||!ip)throw Error('storage_unavailable');
 const key=createHmac('sha256',process.env.RATE_LIMIT_HMAC_KEY).update(`${action}:${ip}`).digest('hex');
 const allowed=await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:key,p_limit:action==='brief'?5:action==='login'?10:20,p_window_seconds:3600}});
 return allowed===true;
}
export async function realSearch(input){
 if(process.env.RECRUIT_CRM_ENABLED!=='true'||!process.env.RECRUIT_CRM_API_KEY)return {profiles:[],status:'not_connected'};
 // Public API fields verified against Recruit CRM's official Search for candidates reference.
 // Fixed upstream, GET only, two title variants and at most two pages each.
 const batches=await Promise.all(roleQueries(input.role).map(async title=>{
  const records=[];
  for(let page=1;page<=2;page++){
   const allowed=await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:'spearpoint-crm-provider-budget',p_limit:45,p_window_seconds:60}});
   if(allowed!==true)throw Error('crm_rate_limited');
   const url=new URL('https://api.recruitcrm.io/v1/candidates/search');
   url.searchParams.set('position',title);url.searchParams.set('marked_as_off_limit','false');url.searchParams.set('page',String(page));
   const r=await fetch(url,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${process.env.RECRUIT_CRM_API_KEY}`},signal:AbortSignal.timeout(6000)});
   if(!r.ok)throw Error(`crm_http_${r.status}`);const data=await r.json();
   if(!Array.isArray(data.data))throw Error('crm_contract');
   records.push(...data.data.slice(0,25));if(!data.next_page_url||data.next_page_url==='null')break;
  }
  return records;
 }));
 const candidates=new Map(batches.flat().filter(c=>typeof c.slug==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(c.slug)&&roleMatches(input.role,c.position)&&!c.deleted&&!c.unavailable&&!c.off_limit?.off_limit&&(!c.status_label||/^available$/i.test(c.status_label))).map(c=>[c.slug,c]));
 const slugs=new Set(candidates.keys());
 if(!slugs.size)return {profiles:[],status:'searched'};
 const fields='crm_slug,external_sharing_consent,consent_expires_at,revoked_at,reviewed_at,public_title,public_summary,public_skills';
 const rows=await db(`sp_profile_approvals?select=${fields}&external_sharing_consent=eq.true&revoked_at=is.null&crm_slug=in.(${[...slugs].join(',')})&limit=100`);
 const profiles=rows.map(row=>{
  const safe=publicProfile(row,slugs);if(!safe)return null;
  const match=assessProfile(input,row);if(!match.eligible)return null;
  return {...safe,experience:match.experience,fitReasons:match.fitReasons,gaps:match.gaps,matchScore:match.score,matchBasis:match.matchBasis};
 }).filter(Boolean).sort((a,b)=>b.matchScore-a.matchScore).slice(0,6);
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
