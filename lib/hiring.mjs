import {searchFeedback,requestProfile,acceptShortlist} from './pilot-operations.mjs';
import {visibleNetworkRows} from './talent-network.mjs';
import {compareMustHaveEvidence} from './discovery-evidence.mjs';
import {mustHaveInput} from './search-intake.mjs';
import {pendingDiscovery} from './instant-search.mjs';
import {instantSearch,instantResults} from './instant-search.mjs';
import {sourceRole} from './combined-search.mjs';
import {briefSettings,compareEvidence} from './brief-settings.mjs';
import {EXPERIENCE_LEVELS,WORK_MODES} from '../views/brief-settings.js';
import {randomUUID} from 'node:crypto';
import {db,profileReference} from './services.mjs';
import {text,publicProfile} from './domain.mjs';
import {mandateCriteria,interpretMandate,searchMandate,reviewedProfiles,assessMandate,CAPABILITIES} from './talent-search.mjs';
import {publicResearch,researchCompany} from './public-research.mjs';
export const isId=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const now=()=>new Date().toISOString();
const live=()=>`expires_at=gt.${encodeURIComponent(now())}`;
export const owned=(table,user)=>`${table}?owner_id=eq.${user.id}&${live()}`;
const optional=(value,max)=>value?text(value,1,max):'';
export function employerInput(body){let website=optional(body.website,250);if(website){try{const u=new URL(website.startsWith('https://')?website:'https://'+website);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^[\d.]+$|localhost|\.local$/.test(u.hostname))throw Error();website=u.origin;}catch{throw Error('validation');}}return {company_name:text(body.company_name,2,160),website,company_context:optional(body.company_context,2000)};}
export async function getRole(user,id){if(!isId(id))throw Error('validation');const rows=await db(owned('sp_roles',user)+`&id=eq.${id}&limit=1`);if(!rows?.length)throw Error('not_found');return rows[0];}
export function approvedExternal(row){
 if(row.review_status!=='approved'||!row.reviewed_by||!row.approval_evidence||!row.approved_copy||!Number.isFinite(Date.parse(row.approval_expires_at))||!Number.isFinite(Date.parse(row.expires_at))||Date.parse(row.approval_expires_at)<=Date.now()||Date.parse(row.expires_at)<=Date.now())return null;
 const copy=row.approved_copy;const safe=publicProfile({crm_slug:row.id,approval_basis:'owner_approved_anonymised_summary',approved_by:row.reviewed_by,external_sharing_consent:true,consent_evidence:row.approval_evidence,consent_expires_at:row.approval_expires_at,reviewed_at:row.reviewed_at,public_title:copy.title,public_summary:copy.summary,public_skills:copy.focus},new Set([row.id]));if(!safe)return null;
 const evidence=Array.isArray(copy.evidence)?copy.evidence.filter(e=>Object.hasOwn(CAPABILITIES,e.criterion)&&typeof e.text==='string'&&e.text.length<500&&!/@|https?:|[\u0000-\u001f]/.test(e.text)):[];
 return {...safe,reference:row.reference,family:copy.family,niches:copy.niches||[],locations:copy.locations||[],evidence,source:row.source||'public',sourceLabel:row.source==='internal'?'Spearpoint CRM · specialist reviewed':'Public profile · specialist reviewed'};
}
export async function externalProfiles(ownerId){const rows=await db(`sp_public_discoveries?owner_id=eq.${ownerId}&${live()}&review_status=eq.approved&limit=100`);return rows.map(approvedExternal).filter(Boolean);}
async function roleView(user,role){
 const [candidates,profiles,discoveries,introductions]=await Promise.all([db(owned('sp_role_candidates',user)+`&role_id=eq.${role.id}&brief_version=eq.${role.brief_version}&order=created_at.asc&limit=100`),reviewedProfiles(),db(owned('sp_public_discoveries',user)+`&role_id=eq.${role.id}&brief_version=eq.${role.brief_version}&limit=50`),db(owned('sp_introductions',user)+`&role_id=eq.${role.id}&select=id,candidate_id,reference,status,created_at,updated_at&limit=100`)]);
 const visibleDiscoveries=await visibleNetworkRows(discoveries);
 const approved=new Map(profiles.map(p=>[p.reference,p])),external=new Map(visibleDiscoveries.map(d=>[d.reference,d]));
 const rows=candidates.map(c=>{
  const intro=introductions.find(i=>i.candidate_id===c.id);let profile;
  const discovery=external.get(c.reference);
  if(c.source==='internal'&&approved.has(c.reference)){profile=assessMandate(role.criteria,approved.get(c.reference));if(!profile)return null;profile={...profile,sourceLabel:'Spearpoint CRM · reviewed'};}
  else{
   if(!discovery||discovery.review_status==='rejected')return null;
   const safe=approvedExternal(discovery);if(discovery.review_status==='approved'&&!safe)return null;
   profile=safe?assessMandate(role.criteria,safe):null;
   if(!profile){if(safe)return null;return {...pendingDiscovery(role.criteria,{...discovery,id:c.id,source:c.source}),pipeline_stage:c.pipeline_stage,feedback:c.feedback,introduction:intro||null};}
  }
  return {...profile,id:c.id,source:c.source,reviewStatus:'approved',pipeline_stage:c.pipeline_stage,feedback:c.feedback,checkedAt:c.source==='public'?external.get(c.reference).discovered_at:role.last_searched_at,introduction:intro||null,canRequestIntro:role.state==='active',introUnavailableReason:role.state==='active'?'':'Activate this role to request a review.'};
 }).filter(Boolean).sort((a,b)=>compareMustHaveEvidence(a,b)||(a.reviewStatus==='pending'?(b.reviewStatus==='pending'?0:1):b.reviewStatus==='pending'?-1:compareEvidence(a,b)));
 return {role,candidates:rows,introductions,publicNotice:'Public research finds indexed professional pages; it is not direct access to LinkedIn’s member database. Names, source URLs and unreviewed text stay in the specialist review queue.'};
}
export async function hiringApi(path,body,user){
 const action=path.split('/').at(-1);
 if(action==='accept-shortlist'){if(!isId(body.search_id))throw Error('validation');const result=await instantResults(user,body.search_id,approvedExternal,true);return acceptShortlist(body,user,result.candidates);}
 if(action==='search-feedback')return searchFeedback(body,user);
 if(action==='request-profile')return requestProfile(body,user,{catalogue:await reviewedProfiles()});
 if(action==='instant-search')return instantSearch(user,body,approvedExternal);
 if(action==='instant-results'){if(!isId(body.search_id))throw Error('validation');return instantResults(user,body.search_id,approvedExternal,true);}
 if(action==='home'){const [employers,roles]=await Promise.all([db(owned('sp_employers',user)+'&limit=1'),db(owned('sp_roles',user)+'&order=created_at.desc&limit=20')]);return {employer:employers[0]||null,roles,operator:user.operator===true,owner:user.owner===true};}
 if(action==='research-company'){if(body.confirmed!==true)throw Error('validation');return researchCompany(employerInput(body),user.id);}
 if(action==='company'){const input=employerInput(body);await db('sp_employers',{method:'POST',upsert:true,body:{owner_id:user.id,...input,updated_at:now()}});return {ok:true};}
 if(action==='interpret'){
  const title=text(body.title,3,120),description=text(body.job_description,12,20000);const compensation=optional(body.compensation,180);const settings=briefSettings(body,[]),location=body.location?text(body.location,2,80):'';
  const response=await interpretMandate(`Role: ${title}\n${description}\nLocation: ${location||'Not specified'}\nExperience level: ${EXPERIENCE_LEVELS[settings.experienceLevel]||'Not specified'}\nWork arrangement: ${WORK_MODES[settings.workMode]||'Not specified'}\nAdditional requirements for specialist review: ${compensation||'None'}`,{maxLength:22000});
  return {...response,criteria:{...response.criteria,...settings,...(location?{location}:{})},title,calibration:['Which experience is essential rather than preferred?','Is the location flexible?','What evidence would make you confident enough to request an introduction?'],note:'Review and edit the criteria before activating the role. Company information, job description and compensation entered here are processed by the AI interpretation provider.'};
 }
 if(action==='create'){
  const company=await db(owned('sp_employers',user)+'&select=owner_id&limit=1');if(!company.length)throw Error('company_required');
  const existing=await db(owned('sp_roles',user)+'&select=id&limit=21');if(existing.length>=20)throw Error('workspace_limit');if(body.approved!==true)throw Error('validation');
  const id=randomUUID(),criteria=mandateCriteria({...body.criteria,mustHaves:mustHaveInput(body.criteria?.mustHaves,true)});await db('sp_roles',{method:'POST',body:{id,owner_id:user.id,title:text(body.title,3,120),job_description:text(body.job_description,12,5000),compensation:optional(body.compensation,180),pitch:optional(body.pitch,2000),criteria,state:'active'}});return {id};
 }
 if(action==='operator-queue'||action==='operator-review'||action==='operator-introduction')return operatorApi(action,body,user);
 const role=await getRole(user,body.role_id);
 if(action==='view')return roleView(user,role);
 if(action==='update'){
  if(body.version!==role.brief_version||body.approved!==true)throw Error('role_conflict');const criteria=mandateCriteria({...body.criteria,mustHaves:mustHaveInput(body.criteria?.mustHaves,true)});const updated=await db(owned('sp_roles',user)+`&id=eq.${role.id}&brief_version=eq.${body.version}`,{method:'PATCH',returnRows:true,body:{criteria,title:text(body.title,3,120),job_description:text(body.job_description,12,5000),compensation:optional(body.compensation,180),pitch:optional(body.pitch,2000),brief_version:role.brief_version+1,internal_status:'not_searched',public_status:'not_searched',updated_at:now()}});if(!updated?.length)throw Error('role_conflict');return {ok:true};
 }
 if(action==='delete'){if(body.confirmed!==true)throw Error('validation');await db(owned('sp_roles',user)+`&id=eq.${role.id}`,{method:'DELETE'});return {ok:true};}
 if(action==='state'){if(!['active','paused','closed'].includes(body.state))throw Error('validation');await db(owned('sp_roles',user)+`&id=eq.${role.id}`,{method:'PATCH',body:{state:body.state,updated_at:now()}});return {ok:true};}
 if(['search','public-search','search-all'].includes(action)){
  if(role.state!=='active')throw Error('role_inactive');
  mustHaveInput(role.criteria.mustHaves,true);const market=action!=='search';if(market&&body.confirmed!==true)throw Error('validation');
  await sourceRole(user,role,{market});return roleView(user,await getRole(user,role.id));
 }
 if(action==='feedback'||action==='intro'){
  if(action==='intro'&&role.state!=='active')throw Error('role_inactive');
  if(!isId(body.candidate_id))throw Error('validation');const rows=await db(owned('sp_role_candidates',user)+`&id=eq.${body.candidate_id}&role_id=eq.${role.id}&brief_version=eq.${role.brief_version}&limit=1`);if(!rows.length)throw Error('not_found');const candidate=rows[0];
  if(action==='feedback'){if(!['saved','passed','new'].includes(body.stage))throw Error('validation');await db(owned('sp_role_candidates',user)+`&id=eq.${candidate.id}`,{method:'PATCH',body:{pipeline_stage:body.stage,feedback:optional(body.feedback,1000),updated_at:now()}});return {ok:true};}
  if(role.state!=='active'||body.confirmed!==true)throw Error('validation');const view=await roleView(user,role);if(!view.candidates.find(c=>c.id===candidate.id)?.canRequestIntro)throw Error('profile_unavailable');
  const existing=await db(owned('sp_introductions',user)+`&candidate_id=eq.${candidate.id}&limit=1`);if(existing.length)return {ok:true,status:existing[0].status};
  await db('sp_introductions',{method:'POST',body:{id:randomUUID(),owner_id:user.id,role_id:role.id,candidate_id:candidate.id,reference:candidate.reference,request_note:optional(body.note,1500)}});return {ok:true,status:'requested',message:'Specialist review requested. No candidate has been contacted and no identity has been released.'};
 }
 throw Error('not_found');
}
async function operatorApi(action,body,user){
 if(user.operator!==true)throw Error('unauthorized');
 if(action==='operator-queue'){const [leads,intros]=await Promise.all([db(`sp_public_discoveries?${live()}&review_status=eq.pending&order=discovered_at.desc&limit=50`),db(`sp_introductions?${live()}&status=in.(requested,reviewing,candidate_agreed)&order=created_at.desc&limit=50`)]);return {leads,introductions:intros};}
 if(action==='operator-review'){
  if(!isId(body.id)||body.confirmed!==true||!['approved','rejected'].includes(body.decision))throw Error('validation');const row=(await db(`sp_public_discoveries?id=eq.${body.id}&${live()}&limit=1`))[0];if(!row)throw Error('not_found');
  let patch={review_status:body.decision,reviewed_by:user.id,reviewed_at:now()};
  if(body.decision==='approved'){
   const criteria=mandateCriteria(body.criteria);const focus=text(body.skills,2,240).split(',').map(s=>s.trim()).filter(Boolean);if(focus.length>10)throw Error('validation');
   const evidence=Array.isArray(body.evidence)?body.evidence:[];if(evidence.length>12||evidence.some(e=>!Object.hasOwn(CAPABILITIES,e.criterion)||typeof e.text!=='string'||e.text.length<5||e.text.length>450||/@|https?:|[\u0000-\u001f]/.test(e.text)))throw Error('validation');
   const copy={title:text(body.title,3,120),summary:text(body.summary,20,600),focus,family:criteria.family,niches:criteria.niches,locations:body.locations?text(body.locations,2,240).split(',').map(x=>x.trim()):[],evidence};
   patch={...patch,approved_copy:copy,approval_basis:'owner_approved_anonymised_summary',approval_evidence:text(body.approval_evidence,20,1000),approval_expires_at:new Date(Date.now()+30*86400000).toISOString()};if(!approvedExternal({...row,...patch}))throw Error('validation');
  }
  await db(`sp_public_discoveries?id=eq.${row.id}&${live()}`,{method:'PATCH',body:patch});return {ok:true};
 }
 if(action==='operator-introduction'){
  if(!isId(body.id)||body.confirmed!==true||!['reviewing','candidate_agreed','introduced','declined'].includes(body.status))throw Error('validation');const row=(await db(`sp_introductions?id=eq.${body.id}&${live()}&limit=1`))[0];if(!row)throw Error('not_found');const transitions={requested:['reviewing','candidate_agreed','declined'],reviewing:['candidate_agreed','declined'],candidate_agreed:['introduced','declined']};if(!transitions[row.status]?.includes(body.status))throw Error('permission_required');
  const patch={status:body.status,operator_note:optional(body.note,1500),updated_by:user.id,updated_at:now()};if(body.status==='candidate_agreed')patch.permission_evidence=text(body.permission_evidence,20,1500);
  const changed=await db(`sp_introductions?id=eq.${row.id}&status=eq.${row.status}&${live()}`,{method:'PATCH',body:patch,returnRows:true});if(!changed?.length)throw Error('role_conflict');return {ok:true,message:'Status recorded. This action does not send email or disclose identity.'};
 }
 throw Error('not_found');
}
