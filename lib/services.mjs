import {createHmac} from 'node:crypto';
import {publicProfile} from './domain.mjs';
export const PROJECT_URL='https://pcezdsdhmjxpjakxtdhz.supabase.co';
export async function db(path,{method='GET',body}={}){
 if(process.env.SUPABASE_URL!==PROJECT_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('storage_unavailable');
 const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error('storage_unavailable');return r.status===204?null:r.json();
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
 // Fixed upstream and GET-only: the browser cannot choose paths, fields or methods.
 const url=new URL('https://api.recruitcrm.io/v1/candidates/search');
 url.searchParams.set('job_title',input.role);url.searchParams.set('city',input.location);url.searchParams.set('limit','25');
 const r=await fetch(url,{method:'GET',headers:{Authorization:`Bearer ${process.env.RECRUIT_CRM_API_KEY}`},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('crm_unavailable');const data=await r.json();
 if(!Array.isArray(data.data))throw Error('crm_contract');
 // Recheck relevance locally because CRM versions may interpret filters differently.
 const terms=input.role.toLowerCase().split(/\s+/).filter(t=>t.length>2);
 const slugs=new Set(data.data.filter(c=>terms.some(t=>String(c.current_job_title||'').toLowerCase().includes(t))&&String(c.city||'').toLowerCase().includes(input.location.toLowerCase())).map(c=>c.slug));
 if(!slugs.size)return {profiles:[],status:'searched'};
 const rows=await db('sp_profile_approvals?select=crm_slug,external_sharing_consent,consent_expires_at,revoked_at,reviewed_at,public_title,public_summary,public_skills&external_sharing_consent=eq.true&revoked_at=is.null&limit=100');
 return {profiles:rows.map(row=>publicProfile(row,slugs)).filter(Boolean).slice(0,6),status:'searched'};
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
