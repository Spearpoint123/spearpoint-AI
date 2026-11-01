import {visibleNetworkRows} from './talent-network.mjs';
import {randomUUID} from 'node:crypto';
import {db,PROJECT_URL,profileReference} from './services.mjs';
import {authRequest} from './workspace-auth.mjs';
import {FAMILIES} from '../views/talent-taxonomy.js';
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const text=(s,min,max)=>{if(typeof s!=='string'||s.trim().length<min||s.trim().length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))throw Error('validation');return s.trim();};
const now=()=>new Date().toISOString(),live=()=>`expires_at=gt.${encodeURIComponent(now())}`;
async function audit(user,action,id){await db('sp_operations_log',{method:'POST',body:{id:randomUUID(),actor_id:user.id,action,entity_id:id}});}
const optional=s=>s?text(s,1,1500):'';
export async function recordSearchRun({id,ownerId,criteria,candidates,internalStatus,publicStatus,records,durationMs}){
 const diagnostics={};for(const row of records){const research=(row.sources||[]).find(s=>s.kind==='profile_research');const key=(row.provider||row.source)+':'+(research?.readStatus||'not_read');diagnostics[key]=(diagnostics[key]||0)+1;}
 await db('sp_search_runs',{method:'POST',body:{id,owner_id:ownerId,criteria,profile_count:candidates.length,matched_count:candidates.filter(p=>p.researchStatus==='matched'||p.mustHaveReviewed===3).length,internal_status:internalStatus,public_status:publicStatus,source_diagnostics:diagnostics,duration_ms:Math.max(0,Math.round(durationMs))}});
}
export async function searchFeedback(body,user){
 if(!uuid(body.search_id)||!['useful','not_useful'].includes(body.feedback))throw Error('validation');
 const rows=await db(`sp_search_runs?id=eq.${body.search_id}&owner_id=eq.${user.id}&${live()}`,{method:'PATCH',returnRows:true,body:{employer_feedback:body.feedback,feedback_at:now()}});if(!rows?.length)throw Error('not_found');return {ok:true};
}
export async function acceptShortlist(body,user,candidates){
 if(!uuid(body.search_id)||!Array.isArray(body.references)||body.references.length<1||body.references.length>25)throw Error('validation');
 const allowed=new Set(candidates.filter(c=>c.researchStatus==='matched'||c.mustHaveReviewed===3).map(c=>c.reference)),refs=[...new Set(body.references)];
 if(refs.some(r=>!allowed.has(r)))throw Error('profile_unavailable');
 const rows=await db(`sp_search_runs?id=eq.${body.search_id}&owner_id=eq.${user.id}&${live()}`,{method:'PATCH',returnRows:true,body:{accepted_refs:refs,shortlist_accepted_at:now()}});if(!rows?.length)throw Error('not_found');return {ok:true};
}
export async function requestProfile(body,user,{catalogue=[]}={}){
 if(!uuid(body.search_id)||!/^SP-[A-F0-9]{16}$/.test(body.reference)||body.confirmed!==true)throw Error('validation');
 const run=(await db(`sp_search_runs?id=eq.${body.search_id}&owner_id=eq.${user.id}&${live()}&limit=1`))[0];if(!run)throw Error('not_found');
 const discoveries=await visibleNetworkRows(await db(`sp_public_discoveries?owner_id=eq.${user.id}&search_id=eq.${body.search_id}&reference=eq.${body.reference}&review_status=neq.rejected&${live()}&limit=1`));
 if(!discoveries.length&&!catalogue.some(p=>p.reference===body.reference))throw Error('profile_unavailable');
 const previous=await db(`sp_profile_requests?owner_id=eq.${user.id}&search_id=eq.${body.search_id}&reference=eq.${body.reference}&${live()}&limit=1`);if(previous.length)return {ok:true,status:previous[0].status};
 await db('sp_profile_requests',{method:'POST',upsert:true,body:{id:randomUUID(),owner_id:user.id,search_id:body.search_id,reference:body.reference,request_note:optional(body.note)}});return {ok:true,status:'requested',message:'Your request is with Spearpoint. You can track its progress here.'};
}
export async function profileRequests(searchId,user){return db(`sp_profile_requests?owner_id=eq.${user.id}&search_id=eq.${searchId}&${live()}&select=reference,status,created_at,updated_at&limit=100`);}
export async function ownerApi(action,body,user){
 if(user.owner!==true)throw Error('owner_required');
 if(action==='overview'){
  const [auth,candidates,requests,runs,pilots,companies,briefs,introductions]=await Promise.all([authRequest('admin/users?page=1&per_page=100'),db('sp_candidate_submissions?select=id,reference,full_name,email,preferred_roles,status,email_verified,matching_approved,reviewed_at,created_at&order=created_at.desc&limit=100'),db(`sp_profile_requests?${live()}&order=created_at.desc&limit=100`),db(`sp_search_runs?${live()}&order=created_at.desc&limit=100`),db('sp_pilots?order=created_at.desc&limit=100'),db('sp_employers?select=owner_id,company_name,created_at&limit=100'),db('sp_briefs?select=id,name,email,company,role,created_at&order=created_at.desc&limit=100'),db(`sp_introductions?${live()}&order=created_at.desc&limit=100`)]);
  if(!auth.ok)throw Error('storage_unavailable');
  return {accounts:(auth.data.users||[]).map(u=>({id:u.id,email:u.email,created_at:u.created_at,confirmed:!!u.email_confirmed_at,last_sign_in_at:u.last_sign_in_at})),candidates,requests,runs,pilots,companies,briefs,introductions,checkedAt:now(),limit:100,note:'Latest 100 records per list. Costs and payments are manually recorded; AI billing has not been reconciled. No messages are sent by this dashboard.'};
 }
 if(action==='request-profile'){
  if(!uuid(body.id))throw Error('validation');const request=(await db(`sp_profile_requests?id=eq.${body.id}&${live()}&limit=1`))[0];if(!request)throw Error('not_found');
  let profile=(await db(`sp_public_discoveries?owner_id=eq.${request.owner_id}&search_id=eq.${request.search_id}&reference=eq.${request.reference}&${live()}&limit=1`))[0]||null;
  const submission=profile?.sources?.find(s=>s.kind==='talent_network')?.submission_id;
  if(submission){const c=(await db(`sp_candidate_submissions?id=eq.${submission}&select=id,full_name,email,status,professional_summary&limit=1`))[0];if(c)profile={...profile,person_name:c.full_name,contact_email:c.email,network_status:c.status,submission_id:c.id};}
  if(!profile){const approvals=await db('sp_profile_approvals?revoked_at=is.null&limit=100');const row=approvals.find(p=>profileReference(p.crm_slug)===request.reference);if(row)profile={person_name:'Reviewed CRM profile',reported_title:row.public_title,canonical_url:'https://app.recruitcrm.io/v1/candidate/'+row.crm_slug,source_excerpt:row.public_summary};}
  return {request,profile};
 }
 if(action==='candidate'){
  if(!uuid(body.id))throw Error('validation');const row=(await db(`sp_candidate_submissions?id=eq.${body.id}&limit=1`))[0];if(!row)throw Error('not_found');return row;
 }
 if(action==='cv'){
  if(!uuid(body.id))throw Error('validation');const row=(await db(`sp_candidate_submissions?id=eq.${body.id}&select=id,cv_path&limit=1`))[0];if(!row?.cv_path||!new RegExp('^'+row.id+'/CV\\.(pdf|docx|txt)$').test(row.cv_path))throw Error('not_found');
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;const r=await fetch(PROJECT_URL+'/storage/v1/object/sign/candidate-cvs/'+row.cv_path,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300}),signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error('storage_unavailable');const result=await r.json();if(typeof result.signedURL!=='string'||!result.signedURL.startsWith('/object/sign/candidate-cvs/'))throw Error('storage_unavailable');await audit(user,'cv_access',row.id);return {url:PROJECT_URL+'/storage/v1'+result.signedURL};
 }
 if(action==='candidate-review'){
  if(!uuid(body.id)||body.confirmed!==true||!['verified','reviewing','withdrawn'].includes(body.status))throw Error('validation');const row=(await db(`sp_candidate_submissions?id=eq.${body.id}&limit=1`))[0];if(!row)throw Error('not_found');
  const patch={status:body.status,matching_approved:false,reviewed_by:user.id,reviewed_at:now()};
  if(body.status==='verified'){
   if(body.identityVerified!==true||body.anonymisationReviewed!==true)throw Error('permission_required');
   const title=text(body.title,3,120),summary=text(body.summary,20,2000),focus=text(body.skills,2,240).split(',').map(s=>s.trim()).filter(Boolean);if(focus.length>10||!Object.hasOwn(FAMILIES,body.family))throw Error('validation');
   const copy=JSON.stringify({title,summary,focus}),parts=row.full_name.split(/\s+/).filter(p=>p.length>=3);
   if(/@|https?:|\b\+?\d[\d ().-]{7,}\b/.test(copy)||parts.some(p=>copy.toLowerCase().includes(p.toLowerCase())))throw Error('anonymisation_required');
   Object.assign(patch,{email_verified:true,matching_approved:true,verification_evidence:text(body.verificationEvidence,20,1500),approved_copy:{title,summary,focus,family:body.family,locations:text(body.locations||'Any location',2,240).split(',').map(s=>s.trim())}});
  }
  await db(`sp_candidate_submissions?id=eq.${row.id}`,{method:'PATCH',body:patch});await audit(user,'candidate_'+body.status,row.id);return {ok:true};
 }
 if(action==='request-update'){
  if(!uuid(body.id)||body.confirmed!==true)throw Error('validation');const row=(await db(`sp_profile_requests?id=eq.${body.id}&${live()}&limit=1`))[0];if(!row)throw Error('not_found');
  const transitions={requested:['reviewing','declined'],reviewing:['permission_requested','candidate_agreed','declined'],permission_requested:['candidate_agreed','declined'],candidate_agreed:['introduced','declined']};if(!transitions[row.status]?.includes(body.status))throw Error('permission_required');
  const patch={status:body.status,operator_note:optional(body.note),updated_at:now(),updated_by:user.id};if(body.status==='candidate_agreed')patch.permission_evidence=text(body.permissionEvidence,20,1500);if(body.status==='introduced'&&!row.permission_evidence)throw Error('permission_required');
  const changed=await db(`sp_profile_requests?id=eq.${row.id}&status=eq.${row.status}&${live()}`,{method:'PATCH',returnRows:true,body:patch});if(!changed?.length)throw Error('role_conflict');await audit(user,'request_'+body.status,row.id);return {ok:true};
 }
 if(action==='pilot'){
  if(!uuid(body.employer_id)||!['prospect','active','complete','cancelled'].includes(body.status)||!['undecided','subscription','per_search','success_fee','hybrid'].includes(body.pricingModel)||!['USD','AED','GBP','EUR'].includes(body.currency))throw Error('validation');
  const account=await authRequest('admin/users/'+body.employer_id);if(!account.ok||!account.data?.id)throw Error('not_found');const amount=Number(body.amountPaid);if(!Number.isFinite(amount)||amount<0||amount>100000000)throw Error('validation');
  const id=body.id||randomUUID();if(!uuid(id))throw Error('validation');if(body.id&&!(await db(`sp_pilots?id=eq.${id}&limit=1`)).length)throw Error('not_found');
  await db('sp_pilots',{method:'POST',upsert:true,body:{id,employer_id:body.employer_id,name:text(body.name,2,160),status:body.status,pricing_model:body.pricingModel,amount_paid:amount,currency:body.currency,payment_evidence:amount>0?text(body.paymentEvidence,10,1500):optional(body.paymentEvidence),updated_by:user.id,updated_at:now()}});await audit(user,'pilot_recorded',id);return {ok:true};
 }
 if(action==='search-cost'){
  if(!uuid(body.id))throw Error('validation');if(body.staffMinutes===''||body.providerCost===''||body.staffMinutes==null||body.providerCost==null)throw Error('validation');const minutes=Number(body.staffMinutes),cost=Number(body.providerCost);if(!Number.isFinite(minutes)||minutes<0||minutes>10000||!Number.isFinite(cost)||cost<0||cost>100000)throw Error('validation');
  const rows=await db(`sp_search_runs?id=eq.${body.id}&${live()}`,{method:'PATCH',returnRows:true,body:{staff_minutes:minutes,reported_provider_cost_usd:cost,cost_recorded_by:user.id}});if(!rows?.length)throw Error('not_found');await audit(user,'search_cost_recorded',body.id);return {ok:true};
 }
 throw Error('not_found');
}
