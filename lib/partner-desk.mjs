import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {db,demoMode} from './services.mjs';
import {decryptIdentity,encryptIdentity} from './candidate-crypto.mjs';
import {clientCandidate} from './client-sources.mjs';
import {sampleCandidates} from './sample-candidates.mjs';
import {ensurePortalFixture,PORTAL_EMAIL,PORTAL_SEARCH_ID} from './portal-sample.mjs';
import {DEMO_PORTAL_ID} from './demo-data.mjs';
import {planSync,applySync} from './crm-sync.mjs';
import {draftOutreach,summariseCall,benchmarkOffer,interviewPlan,sendPartnerMail} from './partner-tools.mjs';
import {track} from './analytics.mjs';
import {partnerProviders,searchPartnerProvider} from './partner-sources.mjs';
import {staffSearch,staffCandidate,listCandidateRows} from './staff-search.mjs';
import {showDemoProfiles,forStaff} from './demo-visibility.mjs';

const stages=['approached','interested','shortlisted','interviewing','offer','hired','withdrawn'];
const day=86400000;
const now=()=>new Date().toISOString();
const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
export function isPartner(user){return user?.owner===true||user?.operator===true||user?.recruiter===true;}
function requirePartner(user){if(!user?.id)throw Error('unauthorized');if(!isPartner(user))throw Error('staff_required');}
function plain(text){
 const clean=String(text||'').replace(/[\u0000-\u001f]/g,'').trim();
 if(clean.length<8||clean.length>400||/@|https?:|www\.|linkedin/i.test(clean))throw Error('validation');
 return clean;
}
export function deskSignals({requests=[],call,pipeline=[],nowMs=Date.now()}={}){
 const open=requests.filter(row=>row.status!=='done');
 const overdueRequest=open.some(row=>nowMs-Date.parse(row.created_at)>2*day);
 const overdueCall=!!(call&&Date.parse(call.starts_at)<nowMs);
 const stale=pipeline.some(row=>['approached','interested'].includes(row.stage)&&nowMs-Date.parse(row.updated_at)>7*day);
 const next=open.length?'Answer the request.':overdueCall?'The weekly call is due.':stale?'A profile has been waiting.':'Review the pipeline.';
 return {overdue:overdueRequest||overdueCall||stale,next};
}
async function identityFor(candidateId){
 const stored=(await rows(`sp_candidate_identity?candidate_id=eq.${candidateId}&limit=1`))[0];
 if(!stored)return null;
 try{
  const secret=decryptIdentity(stored);
  const name=String(secret.name||'').trim(),employer=String(secret.employer||'').trim();
  if(!name||!employer)return null;
  return {name:name.slice(0,80),employer:employer.slice(0,120),fictional:secret.fictional===true};
 }catch{return null;}
}
async function catalogue(){
 if(!(await rows('sp_candidates?select=id&limit=1')).length)await db('sp_candidates',{method:'POST',body:sampleCandidates.map(row=>({...row,created_at:now()}))});
 return forStaff(await listCandidateRows(),await showDemoProfiles());
}
async function logIdentity(user,candidateId){
 await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:user.id,action:'identity_view',entity:`candidate:${candidateId}`,at:now(),meta:{candidate_id:candidateId}}});
}
export async function ensureDeskSample(user){
 if(!demoMode())return;
 await ensurePortalFixture({id:DEMO_PORTAL_ID,email:PORTAL_EMAIL});
 const search=(await rows(`sp_searches?id=eq.${PORTAL_SEARCH_ID}&limit=1`))[0];
 if(search&&!search.partner_id)await db(`sp_searches?id=eq.${search.id}`,{method:'PATCH',body:{partner_id:user.id,updated_at:now()}});
 if(process.env.CANDIDATE_IDENTITY_KEY&&!(await rows('sp_candidate_identity?candidate_id=eq.c1000001-0000-4000-8000-000000000001&limit=1')).length){
  const stored=encryptIdentity({name:'Casey Moss',employer:'Paper Desk Markets (fictional)',fictional:true});
  await db('sp_candidate_identity',{method:'POST',body:{id:randomUUID(),candidate_id:'c1000001-0000-4000-8000-000000000001',ciphertext:stored.ciphertext,key_version:stored.key_version,created_at:now()}}).catch(()=>{});
 }
}
async function visibleSearches(user){
 await ensureDeskSample(user);
 const query=user.owner||user.operator?'sp_searches?order=updated_at.desc&limit=50':`sp_searches?partner_id=eq.${user.id}&order=updated_at.desc&limit=50`;
 return rows(query).then(list=>list.filter(row=>row.status!=='draft'));
}
async function searchFor(user,id){
 if(!/^[a-f0-9-]{36}$/i.test(id||''))throw Error('validation');
 const search=(await visibleSearches(user)).find(row=>row.id===id);
 if(!search)throw Error('not_found');
 return search;
}
async function pipelineFor(searchId){return rows(`sp_pipeline?search_id=eq.${searchId}&limit=50`);}
async function cards(searchId,user){
 const people=await catalogue();
 const pipeline=await pipelineFor(searchId);
 const out=[];
 for(const row of pipeline){
  const person=people.find(item=>item.id===row.candidate_id);
  if(!person)continue;
  const identity=await identityFor(row.candidate_id);
  if(identity)await logIdentity(user,row.candidate_id);
  out.push({...clientCandidate(person),stage:row.stage,updated_at:row.updated_at,demo:person.fictional===true,identity});
 }
 return out;
}
async function home(user){
 const searches=await visibleSearches(user);
 const listed=[];
 const queue=[];
 for(const search of searches){
  const requests=await rows(`sp_requests?search_id=eq.${search.id}&limit=20`);
  const pipeline=await pipelineFor(search.id);
  const call=(await rows(`sp_calls?search_id=eq.${search.id}&kind=eq.weekly&order=starts_at.desc&limit=1`))[0];
  const signal=deskSignals({requests,call,pipeline});
  const org=(await rows(`sp_organisations?id=eq.${search.organisation_id}&limit=1`))[0];
  listed.push({id:search.id,title:search.title,status:search.status,organisation:org?.legal_name||'',next:signal.next,overdue:signal.overdue,openRequests:requests.filter(row=>row.status!=='done').length});
  for(const request of requests.filter(row=>row.status!=='done'))queue.push({id:request.id,searchId:search.id,title:search.title,type:request.type,status:request.status,body:request.body||'',created_at:request.created_at,overdue:Date.now()-Date.parse(request.created_at)>2*day});
 }
 await track(user.id,'partner_opened',{});
 const organisations=(await rows('sp_organisations?verification_status=eq.verified&limit=20')).map(row=>({id:row.id,name:row.legal_name}));
 return {searches:listed,requests:queue,organisations,providers:partnerProviders(),sources:'Licensed provider search is not connected on this desk. Client search stays on Spearpoint’s database.'};
}
async function workspace(user,id){
 const search=await searchFor(user,id);
 const org=(await rows(`sp_organisations?id=eq.${search.organisation_id}&limit=1`))[0];
 const requests=await rows(`sp_requests?search_id=eq.${search.id}&order=created_at.desc&limit=20`);
 const withHistory=[];
 for(const request of requests){
  const history=await rows(`sp_request_events?request_id=eq.${request.id}&order=at.asc&limit=20`);
  withHistory.push({id:request.id,type:request.type,status:request.status,body:request.body||'',history:history.map(row=>({status:row.status,note:row.note,at:row.at}))});
 }
 const time=await rows(`sp_time_entries?search_id=eq.${search.id}&order=worked_on.desc&limit=30`);
 const notes=await rows(`sp_notes?search_id=eq.${search.id}&order=created_at.desc&limit=20`);
 const drafts=await rows(`sp_outreach_drafts?search_id=eq.${search.id}&order=created_at.desc&limit=10`);
 const interviews=await rows(`sp_calls?search_id=eq.${search.id}&kind=eq.interview&order=created_at.desc&limit=5`);
 return {search:{id:search.id,title:search.title,status:search.status,profile:search.profile||{}},organisation:{id:org?.id,name:org?.legal_name,verification_status:org?.verification_status},pipeline:await cards(search.id,user),requests:withHistory,time:{entries:time.map(row=>({id:row.id,hours:Number(row.hours),worked_on:row.worked_on,note:row.note})),total:time.reduce((sum,row)=>sum+Number(row.hours||0),0)},notes:notes.map(row=>({id:row.id,kind:row.kind,body:row.body,created_at:row.created_at})),drafts:drafts.map(row=>({id:row.id,candidate_id:row.candidate_id,body:row.body,status:row.status,sent_at:row.sent_at})),interviews:interviews.map(row=>({id:row.id,starts_at:row.starts_at,meeting_url:row.meeting_url,slots:row.slots||[],status:row.status}))};
}
async function activity(searchId,userId,summary){
 await db('sp_search_activity',{method:'POST',body:{id:randomUUID(),search_id:searchId,actor_id:userId,summary,created_at:now()}});
}
export async function partnerApi(path,body,user){
 requirePartner(user);
 if(path.endsWith('/home')||path.endsWith('/partner'))return home(user);
 if(path.endsWith('/search'))return workspace(user,body?.searchId);
 if(path.endsWith('/stage')){
  const search=await searchFor(user,body?.searchId);
  const stage=String(body?.stage||'');
  if(!stages.includes(stage))throw Error('validation');
  if(!(await catalogue()).some(row=>row.id===body?.candidateId))throw Error('not_found');
  const plan=planSync({localStage:stage,remoteStage:body?.remoteStage});
  const current=(await pipelineFor(search.id)).find(row=>row.candidate_id===body.candidateId);
  if(current)await db(`sp_pipeline?id=eq.${current.id}`,{method:'PATCH',body:{stage:plan.stage,updated_at:now(),updated_by:user.id}});
  else await db('sp_pipeline',{method:'POST',body:{id:randomUUID(),search_id:search.id,candidate_id:body.candidateId,stage:plan.stage,updated_at:now(),updated_by:user.id}});
  await activity(search.id,user.id,`A profile moved to ${plan.stage}.`);
  if(plan.stage==='hired')await activity(search.id,user.id,'A placement was recorded. The fee follows the engagement. Invoicing is manual.');
  const sync=await applySync(plan);
  await track(user.id,'stage_moved',{stage:plan.stage});
  return {stage:plan.stage,sync};
 }
 if(path.endsWith('/note')){
  const search=await searchFor(user,body?.searchId);
  const kind=String(body?.kind||'');
  if(!['call','interview','offer'].includes(kind))throw Error('validation');
  const text=plain(body?.body);
  const row={id:randomUUID(),search_id:search.id,candidate_id:body?.candidateId||null,kind,body:text,raw_text:'',author_id:user.id,created_at:now()};
  await db('sp_notes',{method:'POST',body:row});
  return {note:{id:row.id,kind,body:text}};
 }
 if(path.endsWith('/activity')){
  const search=await searchFor(user,body?.searchId);
  const summary=plain(body?.summary);
  await activity(search.id,user.id,summary);
  return {summary};
 }
 if(path.endsWith('/request')){
  const search=await searchFor(user,body?.searchId);
  const request=(await rows(`sp_requests?id=eq.${body?.requestId}&search_id=eq.${search.id}&limit=1`))[0];
  if(!request)throw Error('not_found');
  const status=String(body?.status||request.status);
  if(!['open','in_progress','done'].includes(status))throw Error('validation');
  const note=plain(body?.note||'Status updated.');
  await db(`sp_requests?id=eq.${request.id}`,{method:'PATCH',body:{status,completed_at:status==='done'?now():null}});
  await db('sp_request_events',{method:'POST',body:{id:randomUUID(),request_id:request.id,status,note,actor_id:user.id,at:now()}});
  await activity(search.id,user.id,'A request was updated.');
  return {status};
 }
 if(path.endsWith('/time')){
  const search=await searchFor(user,body?.searchId);
  const hours=Number(body?.hours);
  if(!Number.isFinite(hours)||hours<=0||hours>24)throw Error('validation');
  const worked=String(body?.worked_on||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(worked)||worked>now().slice(0,10))throw Error('validation');
  const row={id:randomUUID(),search_id:search.id,partner_id:user.id,hours,worked_on:worked,note:String(body?.note||'').replace(/[\u0000-\u001f]/g,'').slice(0,200)};
  await db('sp_time_entries',{method:'POST',body:row});
  await track(user.id,'time_logged',{hours});
  return {entry:{id:row.id,hours,worked_on:worked,note:row.note}};
 }
 if(path.endsWith('/draft')){
  const search=await searchFor(user,body?.searchId);
  const candidate=(await catalogue()).find(row=>row.id===body?.candidateId);
  if(!candidate)throw Error('not_found');
  const drafted=await draftOutreach({search,candidate});
  const row={id:randomUUID(),search_id:search.id,candidate_id:candidate.id,body:drafted.body,status:'draft',partner_id:user.id,created_at:now()};
  await db('sp_outreach_drafts',{method:'POST',body:row});
  await track(user.id,'outreach_drafted',{model:drafted.model==='deterministic'?0:1});
  return {draft:{id:row.id,body:row.body,status:'draft',model:drafted.model}};
 }
 if(path.endsWith('/send')){
  if(body?.confirm!==true)return {sent:false,reason:'not_confirmed'};
  const search=await searchFor(user,body?.searchId);
  const draft=(await rows(`sp_outreach_drafts?id=eq.${body?.draftId}&search_id=eq.${search.id}&limit=1`))[0];
  if(!draft||draft.status!=='draft')throw Error('not_found');
  const result=await sendPartnerMail({from:user.email,to:String(body?.to||''),subject:`Spearpoint: ${search.title}`.slice(0,120),text:String(body?.body||draft.body).slice(0,4000)});
  if(!result.sent)return {sent:false,reason:result.reason};
  await db(`sp_outreach_drafts?id=eq.${draft.id}`,{method:'PATCH',body:{status:'sent_by_partner',sent_at:now(),body:String(body?.body||draft.body).slice(0,4000)}});
  await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:user.id,action:'outreach',entity:`outreach:${draft.id}`,at:now(),meta:{search_id:search.id,to:String(body.to).slice(0,160)}}});
  await activity(search.id,user.id,'An outreach note was sent by the partner.');
  return {sent:true,id:result.id};
 }
 if(path.endsWith('/interview')){
  const search=await searchFor(user,body?.searchId);
  const org=(await rows(`sp_organisations?id=eq.${search.organisation_id}&limit=1`))[0];
  const slots=(Array.isArray(body?.slots)?body.slots:[]).map(value=>new Date(value)).filter(value=>!Number.isNaN(value.getTime())&&value.getTime()>Date.now()).slice(0,3);
  if(!slots.length)throw Error('validation');
  const plan=interviewPlan(org?.legal_name||'');
  const row={id:randomUUID(),search_id:search.id,kind:'interview',status:'proposed',meeting_url:plan.meeting_url,slots:slots.map(value=>value.toISOString()),starts_at:slots[0].toISOString(),created_at:now()};
  await db('sp_calls',{method:'POST',body:row});
  return {interview:{id:row.id,meeting_url:row.meeting_url,slots:row.slots,notice:plan.notice}};
 }
 if(path.endsWith('/summary')){
  const search=await searchFor(user,body?.searchId);
  const raw=String(body?.text||'').replace(/[\u0000-\u001f]/g,'').trim();
  if(raw.length<12||raw.length>8000)throw Error('validation');
  const shaped=await summariseCall(raw);
  const row={id:randomUUID(),search_id:search.id,candidate_id:null,kind:'call',body:shaped.summary,raw_text:raw.slice(0,8000),author_id:user.id,created_at:now()};
  await db('sp_notes',{method:'POST',body:row});
  return {summary:shaped.summary,next_steps:shaped.next_steps,model:shaped.model};
 }
 if(path.endsWith('/benchmark')){
  await searchFor(user,body?.searchId);
  const people=await catalogue();
  return benchmarkOffer(body?.amount,people,body?.level?String(body.level):'');
 }
 if(path.endsWith('/provider'))return searchPartnerProvider(body?.id);
 if(path.endsWith('/staff-search'))return staffSearch(user,body||{});
 if(path.endsWith('/staff-candidate'))return staffCandidate(user,body?.id);
 if(path.endsWith('/add-to-pipeline')){
  const search=await searchFor(user,body?.searchId);
  if(!(await catalogue()).some(row=>row.id===body?.candidateId))throw Error('not_found');
  const stage=['approached','interested','shortlisted','interviewing','offer','hired'].includes(body?.stage)?body.stage:'approached';
  const current=(await pipelineFor(search.id)).find(row=>row.candidate_id===body.candidateId);
  if(current)await db(`sp_pipeline?id=eq.${current.id}`,{method:'PATCH',body:{stage,updated_at:now(),updated_by:user.id}});
  else await db('sp_pipeline',{method:'POST',body:{id:randomUUID(),search_id:search.id,candidate_id:body.candidateId,stage,updated_at:now(),updated_by:user.id}});
  await activity(search.id,user.id,'A profile was added to the pipeline.');
  return {searchId:search.id,candidateId:body.candidateId,stage};
 }
 if(path.endsWith('/open-search')){
  const org=(await rows(`sp_organisations?id=eq.${body?.organisationId}&limit=1`))[0];
  if(!org)throw Error('not_found');
  if(org.verification_status!=='verified')throw Error('verification_pending');
  const title=String(body?.title||'').trim().slice(0,120);
  if(title.length<3)throw Error('validation');
  const id=randomUUID();
  await db('sp_searches',{method:'POST',body:{id,organisation_id:org.id,created_by:user.id,partner_id:user.id,title,status:'live',profile:{title},created_at:now(),updated_at:now()}});
  return {id,title};
 }
 if(path.endsWith('/reveal-link')){
  const search=await searchFor(user,body?.searchId);
  const org=(await rows(`sp_organisations?id=eq.${search.organisation_id}&limit=1`))[0];
  if(org?.verification_status!=='verified')throw Error('verification_pending');
  if(!(await catalogue()).some(row=>row.id===body?.candidateId))throw Error('not_found');
  const token=randomBytes(32).toString('hex');
  const expires=new Date(Date.now()+14*day).toISOString();
  await db('sp_candidate_links',{method:'POST',body:{id:randomUUID(),token_hash:createHash('sha256').update(token).digest('hex'),candidate_id:body.candidateId,organisation_id:org.id,search_id:search.id,expires_at:expires,created_by:user.id,created_at:now()}});
  const origin=process.env.APP_ORIGIN||'http://127.0.0.1:3000';
  return {url:`${origin}/begin/consent/?token=${token}`,expires_at:expires,emailed:false,notice:'Nothing was emailed. Copy this link and send it yourself.'};
 }
 throw Error('not_found');
}
