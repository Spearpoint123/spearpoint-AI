import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {db,rateLimit} from './services.mjs';
import {text} from './domain.mjs';
import {authRequest,workspaceCookie,workspaceUser,openSession} from './workspace-auth.mjs';
import {interpretMandate,mandateCriteria,reviewedProfiles,searchMandate,reviewedCoverage} from './talent-search.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
const ownerPath=(table,user)=>`${table}?owner_id=eq.${user.id}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`;
export async function recordActivity(user,event){if(user)await db('sp_activity',{method:'POST',body:{id:randomUUID(),owner_id:user.id,...event}});}
export function summariseActivity(rows){
 const count=type=>rows.filter(r=>r.event_type===type).length;
 const delivery=rows.filter(r=>r.event_type==='delivery_recorded');
 const days=new Set(rows.filter(r=>r.event_type==='search').map(r=>r.created_at.slice(0,10))).size;
 return {searches:count('search'),activeSearchDays:days,returnedOnAnotherDay:days>1,acceptedShortlists:count('shortlist_accepted'),introductionsRequested:count('introduction_requested'),introductionsAccepted:count('introduction_accepted'),reportedMinutesSaved:delivery.reduce((n,r)=>n+Number(r.minutes_saved||0),0),recordedDeliveryCostGbp:delivery.reduce((n,r)=>n+Number(r.delivery_minutes||0)*Number(r.hourly_cost_gbp||0)/60,0),deliveryRecords:delivery.length,aiCostUsd:null,aiCostNote:'AI costs have not been reconciled with billing. Recorded delivery cost covers reported staff time only.'};
}
export async function workspaceApi(path,body,req,res){
 if(path==='/api/workspace/auth'){
  if(!await rateLimit(req,'login'))throw Error('rate_limited');
  if(body.action==='logout'){const s=openSession(req.headers.cookie);if(s)await authRequest('logout?scope=local',{},s.access_token).catch(()=>null);res.setHeader('Set-Cookie',workspaceCookie(null));return {ok:true};}
  if(!['signup','signin'].includes(body.action))throw Error('validation');
  const email=text(body.email,5,254).toLowerCase(),password=text(body.password,12,128);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('validation');
  if(body.action==='signup'&&body.consent!==true)throw Error('validation');
  const response=await authRequest(body.action==='signup'?'signup':'token?grant_type=password',{email,password});
  if(!response.ok)throw Error(body.action==='signup'?'signup_unavailable':'signin_failed');
  if(response.data.access_token&&response.data.user?.email_confirmed_at){res.setHeader('Set-Cookie',workspaceCookie(response.data));return {ok:true};}
  return {ok:true,confirmationRequired:true,message:'Check your email to confirm your account, then return here to sign in. If no email arrives, contact Spearpoint for workspace access.'};
 }
 if(path==='/api/mandate/coverage')return reviewedCoverage();
 if(path==='/api/mandate/interpret'){
  if(!await rateLimit(req,'interpret'))throw Error('rate_limited');
  return interpretMandate(body.mandate);
 }
 if(path==='/api/mandate/search'){
  if(!await rateLimit(req,'search'))throw Error('rate_limited');
  const result=await searchMandate(body.criteria);const user=await workspaceUser(req,res,false);
  await recordActivity(user,{event_type:'search'});return result;
 }
 if(path==='/api/shortlist/shared'){
  if(typeof body.token!=='string'||! /^[a-zA-Z0-9_-]{43}$/.test(body.token))throw Error('not_found');
  if(!await rateLimit(req,'share'))throw Error('rate_limited');
  const rows=await db(`sp_shortlists?select=title,profile_refs&share_hash=eq.${hash(body.token)}&share_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
  if(!rows?.length)throw Error('not_found');
  const row=rows[0];return {title:row.title,profiles:(await reviewedProfiles()).filter(p=>row.profile_refs.includes(p.reference)),message:'Confidential, read-only shortlist. Removed, expired or unapproved profiles are omitted. Please do not forward this link without the owner’s agreement.'};
 }
 const user=await workspaceUser(req,res);
 if(path==='/api/workspace/load'){
  const [searches,shortlists,activity]=await Promise.all([db(ownerPath('sp_saved_searches',user)+'&order=created_at.desc&limit=50'),db(ownerPath('sp_shortlists',user)+'&select=id,title,profile_refs,share_expires_at,created_at&order=created_at.desc&limit=50'),db(ownerPath('sp_activity',user)+'&order=created_at.desc&limit=5000')]);
  return {email:user.email,searches,shortlists,metrics:summariseActivity(activity),checkedAt:new Date().toISOString(),retention:'Workspace records expire after 180 days. Shared links expire after 7 days unless revoked sooner.'};
 }
 if(path==='/api/workspace/save-search'){
  const count=await db(ownerPath('sp_saved_searches',user)+'&select=id&limit=51');if(count.length>=50)throw Error('workspace_limit');
  const criteria=mandateCriteria(body.criteria),result=await searchMandate(criteria),id=randomUUID();
  await db('sp_saved_searches',{method:'POST',body:{id,owner_id:user.id,title:text(body.title,2,120),mandate:text(body.mandate,12,1500),criteria,seen_refs:result.profiles.filter(p=>p.requirementsMet).map(p=>p.reference)}});return {id};
 }
 if(path==='/api/workspace/check-search'){
  if(!uuid(body.id))throw Error('validation');
  if(!await rateLimit(req,body.markSeen===true?'search':'updates'))throw Error('rate_limited');
  const rows=await db(ownerPath('sp_saved_searches',user)+`&id=eq.${body.id}&limit=1`);if(!rows?.length)throw Error('not_found');
  const row=rows[0],result=await searchMandate(row.criteria);const refs=result.profiles.filter(p=>p.requirementsMet).map(p=>p.reference);
  const newRefs=refs.filter(ref=>!row.seen_refs.includes(ref));
  if(body.markSeen===true){await db(ownerPath('sp_saved_searches',user)+`&id=eq.${body.id}`,{method:'PATCH',body:{seen_refs:refs}});await recordActivity(user,{event_type:'search'});}
  return {...result,newRefs,title:row.title};
 }
 if(path==='/api/workspace/save-shortlist'){
  const title=text(body.title,2,120);if(!Array.isArray(body.references)||!body.references.length||body.references.length>25||body.references.some(r=>typeof r!=='string'||!/^SP-[A-F0-9]{16}$/.test(r)))throw Error('validation');
  const valid=new Set((await reviewedProfiles()).map(p=>p.reference));if(body.references.some(r=>!valid.has(r)))throw Error('profile_unavailable');
  const count=await db(ownerPath('sp_shortlists',user)+'&select=id&limit=51');if(count.length>=50)throw Error('workspace_limit');
  const id=randomUUID();await db('sp_shortlists',{method:'POST',body:{id,owner_id:user.id,title,profile_refs:[...new Set(body.references)]}});return {id};
 }
 if(path==='/api/workspace/share'||path==='/api/workspace/revoke-share'){
  if(!uuid(body.id))throw Error('validation');const selector=ownerPath('sp_shortlists',user)+`&id=eq.${body.id}`;
  const rows=await db(selector+'&select=id&limit=1');if(!rows?.length)throw Error('not_found');
  const token=path.endsWith('/share')?randomBytes(32).toString('base64url'):null,expires=token?new Date(Date.now()+7*86400000).toISOString():null;
  await db(selector,{method:'PATCH',body:{share_hash:token?hash(token):null,share_expires_at:expires}});
  return token?{url:`/shortlist/${token}`,expiresAt:expires}:{ok:true};
 }
 if(path==='/api/workspace/outcome'){
  const types=['shortlist_accepted','introduction_requested','introduction_accepted','delivery_recorded'];if(!types.includes(body.event_type)||body.confirmed!==true||!uuid(body.shortlist_id))throw Error('validation');
  const rows=await db(ownerPath('sp_shortlists',user)+`&id=eq.${body.shortlist_id}&limit=1`);if(!rows?.length)throw Error('not_found');
  const event={event_type:body.event_type,shortlist_id:body.shortlist_id};
  if(body.event_type.startsWith('introduction_')){if(!rows[0].profile_refs.includes(body.profile_ref))throw Error('validation');event.profile_ref=body.profile_ref;}
  if(body.event_type==='delivery_recorded'){for(const field of ['minutes_saved','delivery_minutes','hourly_cost_gbp']){const n=Number(body[field]);if(body[field]===''||!Number.isFinite(n)||n<0||n>10000)throw Error('validation');event[field]=n;}}
  else{const existing=await db(ownerPath('sp_activity',user)+`&event_type=eq.${event.event_type}&shortlist_id=eq.${event.shortlist_id}`+(event.profile_ref?`&profile_ref=eq.${event.profile_ref}`:'')+'&select=id&limit=1');if(existing.length)return {ok:true,alreadyRecorded:true};}
  await recordActivity(user,event);return {ok:true};
 }
 if(path==='/api/workspace/delete'){
  if(!uuid(body.id)||!['search','shortlist'].includes(body.kind))throw Error('validation');await db(ownerPath(body.kind==='search'?'sp_saved_searches':'sp_shortlists',user)+`&id=eq.${body.id}`,{method:'DELETE'});return {ok:true};
 }
 throw Error('not_found');
}
