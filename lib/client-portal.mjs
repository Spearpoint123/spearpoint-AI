import {randomUUID} from 'node:crypto';
import {db} from './services.mjs';
import {employerDomain,agencyDomain} from './employer-access.mjs';
import {sampleCandidates} from './sample-candidates.mjs';
import {assertClientSources,databaseSource,marketMap,clientCandidate} from './client-sources.mjs';
import {sanitiseFilters,bookingLink} from './client-search.mjs';
import {decryptIdentity} from './candidate-crypto.mjs';
import {track} from './analytics.mjs';
import {nextCallDate,weeklyBooking} from './weekly-call.mjs';
import {ensurePortalFixture,portalDemoUser,revealEntity,PORTAL_ANCHOR} from './portal-sample.mjs';

const stages=['approached','interested','shortlisted','interviewing','offer','hired'];
const requestTypes=['change_brief','add_target','pause','question','add_candidate','move_interview'];
const now=()=>new Date().toISOString();
const gates={
 verification_pending:'Verification pending. A partner checks the company, the hiring manager and that the role is live. The pipeline stays closed until then.',
 verification_rejected:'This company was not verified. The pipeline stays closed.',
 engagement_required:'The pipeline opens when the engagement is active. Recording terms does not start the search.'
};
async function rows(path){const result=await db(path);return Array.isArray(result)?result:[];}
function cleanText(value,max){
 const text=String(value||'').replace(/[\u0000-\u001f]/g,'').trim();
 if(text.length<8||text.length>max||/@|https?:|www\.|linkedin/i.test(text))throw Error('validation');
 return text;
}
async function catalogue(){
 if(!(await rows('sp_candidates?select=id&limit=1')).length)await db('sp_candidates',{method:'POST',body:sampleCandidates.map(row=>({...row,created_at:now()}))});
 return rows('sp_candidates?select=id,source,level,seniority,years_bucket,region,firm_type,sector,pay_band,scope,sector_history,skills,summary,fictional&limit=100');
}
function filtersFromProfile(profile){
 return sanitiseFilters({level:profile.seniority,region:profile.location,sector:profile.function,keywords:[profile.title,profile.must_haves,profile.target_firms].filter(Boolean).join(' '),pay_band:profile.base_pay});
}
export function revealState({approval,audits,candidateId,organisationId,searchId}){
 if(!approval||approval.withdrawn_at)return 'pending';
 if(approval.candidate_id!==candidateId||approval.organisation_id!==organisationId||approval.search_id!==searchId)return 'pending';
 const logged=(audits||[]).some(row=>row.action==='reveal'&&row.entity===revealEntity(candidateId,organisationId,searchId));
 return logged?'shown':'pending';
}
async function orgFor(user){
 const domain=employerDomain(user.email);
 if(agencyDomain(domain))throw Error('agency_not_allowed');
 const found=await rows(`sp_organisations?domain=eq.${encodeURIComponent(domain)}&limit=5`);
 let org=found.find(row=>row.verification_status==='verified')||found[0];
 if(!org){
  org={id:randomUUID(),domain,legal_name:domain,website:'',verification_status:'pending',created_at:now()};
  await db('sp_organisations',{method:'POST',body:org});
 }
 const member=(await rows(`sp_memberships?user_id=eq.${user.id}&organisation_id=eq.${org.id}&limit=1`))[0];
 if(!member)await db('sp_memberships',{method:'POST',body:{id:randomUUID(),user_id:user.id,organisation_id:org.id,role:'hiring_manager',created_at:now()}});
 return org;
}
async function accessFor(user){
 if(portalDemoUser(user))await ensurePortalFixture(user);
 const org=await orgFor(user);
 if(org.verification_status==='rejected')return {gate:'verification_rejected',org};
 if(org.verification_status!=='verified')return {gate:'verification_pending',org};
 const engagement=(await rows(`sp_engagements?organisation_id=eq.${org.id}&status=eq.active&order=created_at.desc&limit=1`))[0];
 const search=engagement?.search_id?(await rows(`sp_searches?id=eq.${engagement.search_id}&organisation_id=eq.${org.id}&limit=1`))[0]:null;
 if(!engagement||!search)return {gate:'engagement_required',org,engagement:engagement||null};
 return {org,engagement,search};
}
function gatePayload(access){
 return {gate:access.gate,message:gates[access.gate],organisation:{name:access.org.legal_name,verification_status:access.org.verification_status},engagement:access.engagement?{type:access.engagement.type,status:access.engagement.status}:null,pipeline:null};
}
async function cards(search,org){
 const people=await catalogue();
 const pipeline=await rows(`sp_pipeline?search_id=eq.${search.id}&limit=50`);
 const approvals=await rows(`sp_reveal_approvals?organisation_id=eq.${org.id}&search_id=eq.${search.id}&limit=50`);
 const audits=await rows('sp_audit_log?action=eq.reveal&limit=200');
 const out=[];
 for(const row of pipeline){
  if(!stages.includes(row.stage))continue;
  const person=people.find(item=>item.id===row.candidate_id);
  if(!person)continue;
  const approval=approvals.find(item=>item.candidate_id===row.candidate_id);
  const state=revealState({approval,audits,candidateId:row.candidate_id,organisationId:org.id,searchId:search.id});
  let identity=null,identity_state=state==='shown'?'unavailable':'pending';
  if(state==='shown'){
   const stored=(await rows(`sp_candidate_identity?candidate_id=eq.${row.candidate_id}&limit=1`))[0];
   try{
    const secret=stored?decryptIdentity(stored):null;
    const name=String(secret?.name||'').trim(),employer=String(secret?.employer||'').trim();
    if(name&&employer){identity={name:name.slice(0,80),employer:employer.slice(0,120),fictional:secret.fictional===true};identity_state='shown';}
   }catch{identity_state='unavailable';}
  }
  out.push({...clientCandidate(person),stage:row.stage,updated_at:row.updated_at,identity,identity_state});
 }
 return out.sort((a,b)=>stages.indexOf(a.stage)-stages.indexOf(b.stage)||String(a.updated_at).localeCompare(String(b.updated_at)));
}
async function ensureWeekly(search,engagement){
 const latest=(await rows(`sp_calls?search_id=eq.${search.id}&kind=eq.weekly&order=starts_at.desc&limit=1`))[0];
 if(latest&&Date.parse(latest.starts_at)>Date.now())return latest;
 const booking=weeklyBooking();
 const row={id:randomUUID(),search_id:search.id,kind:'weekly',status:booking.status,meeting_url:booking.meeting_url,starts_at:nextCallDate(engagement.created_at||PORTAL_ANCHOR),previous_id:latest?.id||null,created_at:now()};
 await db('sp_calls',{method:'POST',body:row});
 await db('sp_search_activity',{method:'POST',body:{id:randomUUID(),search_id:search.id,actor_id:null,summary:'The next weekly call was set. It repeats every seven days.',created_at:now()}});
 return row;
}
async function market(search){
 const profile=search.profile||{};
 const all=await catalogue();
 const source=databaseSource(all);
 assertClientSources([source]);
 const matches=source.search(filtersFromProfile(profile));
 const strong=matches.filter(row=>row.strong);
 const map=marketMap(all.map(clientCandidate));
 await db('sp_market_snapshots',{method:'POST',body:{id:randomUUID(),search_id:search.id,captured_at:now(),counts:map,pay_band:profile.base_pay||'',strong_match_count:strong.length,beyond_database:strong.length<3}});
 return {map,matches,message:strong.length<3?'Fewer than three strong matches are in the database. The map is still here. Spearpoint will search beyond the database once the search starts.':'These are anonymised profiles from Spearpoint’s database.'};
}
async function requestList(searchId){
 const requests=await rows(`sp_requests?search_id=eq.${searchId}&order=created_at.desc&limit=20`);
 const out=[];
 for(const request of requests){
  const history=await rows(`sp_request_events?request_id=eq.${request.id}&order=at.asc&limit=20`);
  out.push({id:request.id,type:request.type,status:request.status,body:request.body||'',created_at:request.created_at,history:history.map(row=>({status:row.status,note:row.note,at:row.at}))});
 }
 return out;
}
function callView(row,user,org){
 const booking=weeklyBooking();
 return {starts_at:row.starts_at,meeting_url:bookingLink({email:user.email,company:org.legal_name}),status:row.status,mode:booking.mode,notice:booking.notice,previous_id:row.previous_id||null};
}
async function openPortal(user,access){
 const {org,engagement,search}=access;
 const call=await ensureWeekly(search,engagement);
 const view=await market(search);
 const pipeline=await cards(search,org);
 const activity=(await rows(`sp_search_activity?search_id=eq.${search.id}&order=created_at.desc&limit=30`)).map(row=>({summary:row.summary,created_at:row.created_at}));
 await track(user.id,'portal_opened',{});
 return {gate:null,organisation:{name:org.legal_name,verification_status:org.verification_status},engagement:{type:engagement.type,label:engagement.label,status:engagement.status,fee_percent:engagement.fee_percent},search:{id:search.id,title:search.title,status:search.status},stages,pipeline,counts:Object.fromEntries(stages.map(stage=>[stage,pipeline.filter(row=>row.stage===stage).length])),map:view.map,matches:view.matches,marketMessage:view.message,activity,call:callView(call,user,org),requests:await requestList(search.id)};
}
export async function portalApi(path,body,user){
 if(!user?.id||!user?.email)throw Error('unauthorized');
 const access=await accessFor(user);
 const reading=path.endsWith('/portal')||path.endsWith('/portal/home');
 if(access.gate){if(reading)return gatePayload(access);throw Error(access.gate);}
 if(body?.searchId&&body.searchId!==access.search.id)throw Error('not_found');
 if(reading)return openPortal(user,access);
 if(path.endsWith('/portal/request')){
  const type=String(body?.type||'');
  if(!requestTypes.includes(type))throw Error('validation');
  const text=cleanText(body?.body,400);
  const id=randomUUID();
  await db('sp_requests',{method:'POST',body:{id,search_id:access.search.id,type,status:'open',body:text,opened_by:user.id,created_at:now()}});
  await db('sp_request_events',{method:'POST',body:{id:randomUUID(),request_id:id,status:'open',note:'Opened.',actor_id:user.id,at:now()}});
  await db('sp_search_activity',{method:'POST',body:{id:randomUUID(),search_id:access.search.id,actor_id:user.id,summary:`A request was opened: ${type.replaceAll('_',' ')}.`,created_at:now()}});
  await track(user.id,'request_opened',{type});
  return {request:{id,type,status:'open',body:text},requests:await requestList(access.search.id)};
 }
 if(path.endsWith('/portal/call')){
  const when=new Date(body?.starts_at||'');
  const delta=when.getTime()-Date.now();
  if(Number.isNaN(when.getTime())||delta<24*60*60*1000||delta>45*24*60*60*1000)throw Error('validation');
  const current=await ensureWeekly(access.search,access.engagement);
  const booking=weeklyBooking();
  const row={id:randomUUID(),search_id:access.search.id,kind:'weekly',status:booking.status,meeting_url:booking.meeting_url,starts_at:when.toISOString(),previous_id:current.id,created_at:now()};
  await db('sp_calls',{method:'POST',body:row});
  await db('sp_search_activity',{method:'POST',body:{id:randomUUID(),search_id:access.search.id,actor_id:user.id,summary:'The weekly call was moved.',created_at:now()}});
  return {call:callView(row,user,access.org)};
 }
 if(path.endsWith('/portal/export')){
  const pipeline=await cards(access.search,access.org);
  const audit={id:randomUUID(),actor_id:user.id,action:'export',entity:`export:${access.search.id}`,at:now(),meta:{search_id:access.search.id,rows:pipeline.length,revealed:pipeline.filter(row=>row.identity_state==='shown').length}};
  await db('sp_audit_log',{method:'POST',body:audit});
  await db('sp_search_activity',{method:'POST',body:{id:randomUUID(),search_id:access.search.id,actor_id:user.id,summary:'This search was exported. The file keeps the same identity rules as the portal.',created_at:now()}});
  await track(user.id,'portal_exported',{rows:pipeline.length});
  return {exported_at:audit.at,rows:pipeline.map(row=>({stage:row.stage,level:row.level,years_bucket:row.years_bucket,firm_type:row.firm_type,region:row.region,pay_band:row.pay_band,summary:row.summary,identity:row.identity,identity_state:row.identity_state})),audit:{id:audit.id,action:'export'}};
 }
 throw Error('not_found');
}
