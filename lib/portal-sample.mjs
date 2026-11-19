import {randomUUID} from 'node:crypto';
import {db,demoMode} from './services.mjs';
import {sampleCandidates} from './sample-candidates.mjs';
import {encryptIdentity} from './candidate-crypto.mjs';
import {nextCallDate,weeklyBooking} from './weekly-call.mjs';
import {BOOKING_URL} from './domain.mjs';

export const PORTAL_EMAIL='portal@harbour-lane.example';
export const PORTAL_ORG_ID='a1000001-0000-4000-8000-000000000001';
export const PORTAL_SEARCH_ID='a1000001-0000-4000-8000-000000000002';
export const PORTAL_ENGAGEMENT_ID='a1000001-0000-4000-8000-000000000003';
export const PORTAL_REQUEST_ID='a1000001-0000-4000-8000-000000000004';
export const PORTAL_ANCHOR='2026-11-11T09:00:00.000Z';
const revealed='c1000001-0000-4000-8000-000000000002';
const unaudited='c1000001-0000-4000-8000-000000000003';
const withdrawn='c1000001-0000-4000-8000-000000000004';
export const SAMPLE_IDENTITY={name:'Rowan Pell',employer:'Northglass Markets (fictional)',fictional:true};
export function revealEntity(candidateId,organisationId,searchId){return `reveal:${candidateId}:${organisationId}:${searchId}`;}

const stages=[
 ['c1000001-0000-4000-8000-000000000001','approached'],
 [revealed,'interested'],
 [unaudited,'shortlisted'],
 [withdrawn,'interviewing'],
 ['c1000001-0000-4000-8000-000000000005','offer'],
 ['c1000001-0000-4000-8000-000000000006','hired']
];
const activity=[
 'A senior researcher in Dubai was approached.',
 'A London researcher moved to interested. Identity is still hidden from other searches.',
 'The market map was refreshed for this search.',
 'A request was opened to add someone from a crypto market maker.'
];
async function rows(path){const result=await db(path);return Array.isArray(result)?result:[];}
async function has(path){return (await rows(path+'&limit=1')).length>0;}
export async function ensurePortalFixture(user){
 if(!user?.id)return;
 const now=new Date().toISOString();
 if(!await has('sp_candidates?select=id'))await db('sp_candidates',{method:'POST',body:sampleCandidates.map(row=>({...row,created_at:now}))});
 let org=(await rows('sp_organisations?domain=eq.harbour-lane.example&limit=5')).find(row=>row.verification_status==='verified')||(await rows('sp_organisations?domain=eq.harbour-lane.example&limit=5'))[0];
 if(!org){
  org={id:PORTAL_ORG_ID,domain:'harbour-lane.example',legal_name:'Harbour Lane Capital (fictional)',website:'',verification_status:'verified',verified_at:PORTAL_ANCHOR,verification_note:'Fictional sample. Not a real company.',created_at:PORTAL_ANCHOR};
  await db('sp_organisations',{method:'POST',body:org});
 }else if(org.verification_status!=='verified'){
  await db(`sp_organisations?id=eq.${org.id}`,{method:'PATCH',body:{legal_name:'Harbour Lane Capital (fictional)',verification_status:'verified',verified_at:PORTAL_ANCHOR,verification_note:'Fictional sample. Not a real company.'}});
  org={...org,legal_name:'Harbour Lane Capital (fictional)',verification_status:'verified'};
 }
 const orgId=org.id;
 if(!await has(`sp_searches?id=eq.${PORTAL_SEARCH_ID}`)){
  await db('sp_searches',{method:'POST',body:{id:PORTAL_SEARCH_ID,organisation_id:orgId,created_by:user.id,partner_id:null,title:'Head of quantitative research',status:'live',profile:{title:'Head of quantitative research',function:'Quantitative research',seniority:'Senior',location:'Dubai or London',remote_policy:'Hybrid',base_pay:'250–350',total_pay:'400–600',must_haves:'crypto market making',nice_to_haves:'Python',target_firms:'crypto market makers',excluded_firms:'retail brokers',start_date:'Next quarter'},created_at:PORTAL_ANCHOR,updated_at:now}});
 }
 if(!await has(`sp_engagements?id=eq.${PORTAL_ENGAGEMENT_ID}`)){
  await db('sp_engagements',{method:'POST',body:{id:PORTAL_ENGAGEMENT_ID,organisation_id:orgId,search_id:PORTAL_SEARCH_ID,type:'single',label:'Single search',fee_percent:17.5,engagement_fee:5000,monthly_amount:0,note:'Fictional sample engagement.',status:'active',invoicing:'manual',created_at:PORTAL_ANCHOR}});
 }
 if(!await has(`sp_pipeline?search_id=eq.${PORTAL_SEARCH_ID}`)){
  await db('sp_pipeline',{method:'POST',body:stages.map(([candidate_id,stage],index)=>({id:`a1000001-0000-4000-8000-00000000001${index}`,search_id:PORTAL_SEARCH_ID,candidate_id,stage,updated_at:PORTAL_ANCHOR,updated_by:user.id}))});
 }
 if(!await has(`sp_search_activity?search_id=eq.${PORTAL_SEARCH_ID}`)){
  await db('sp_search_activity',{method:'POST',body:activity.map((summary,index)=>({id:`a1000001-0000-4000-8000-00000000002${index}`,search_id:PORTAL_SEARCH_ID,actor_id:user.id,summary,created_at:new Date(Date.parse(PORTAL_ANCHOR)+index*3600000).toISOString()}))});
 }
 if(!await has(`sp_requests?id=eq.${PORTAL_REQUEST_ID}`)){
  await db('sp_requests',{method:'POST',body:{id:PORTAL_REQUEST_ID,search_id:PORTAL_SEARCH_ID,type:'add_candidate',status:'in_progress',body:'Add a candidate from a crypto market maker.',opened_by:user.id,created_at:PORTAL_ANCHOR}});
  await db('sp_request_events',{method:'POST',body:[
   {id:'a1000001-0000-4000-8000-000000000031',request_id:PORTAL_REQUEST_ID,status:'open',note:'Opened.',actor_id:user.id,at:PORTAL_ANCHOR},
   {id:'a1000001-0000-4000-8000-000000000032',request_id:PORTAL_REQUEST_ID,status:'in_progress',note:'A partner is looking at firm types.',actor_id:user.id,at:new Date(Date.parse(PORTAL_ANCHOR)+86400000).toISOString()}
  ]});
 }
 if(!await has(`sp_calls?search_id=eq.${PORTAL_SEARCH_ID}&kind=eq.weekly`)){
  const booking=weeklyBooking();
  await db('sp_calls',{method:'POST',body:{id:'a1000001-0000-4000-8000-000000000040',search_id:PORTAL_SEARCH_ID,kind:'weekly',status:booking.status,meeting_url:BOOKING_URL,starts_at:nextCallDate(PORTAL_ANCHOR),created_at:now}});
 }
 if(!await has(`sp_reveal_approvals?candidate_id=eq.${revealed}&search_id=eq.${PORTAL_SEARCH_ID}`)){
  await db('sp_reveal_approvals',{method:'POST',body:[
   {id:'a1000001-0000-4000-8000-000000000051',candidate_id:revealed,organisation_id:orgId,search_id:PORTAL_SEARCH_ID,approved_at:PORTAL_ANCHOR,withdrawn_at:null},
   {id:'a1000001-0000-4000-8000-000000000052',candidate_id:unaudited,organisation_id:orgId,search_id:PORTAL_SEARCH_ID,approved_at:PORTAL_ANCHOR,withdrawn_at:null},
   {id:'a1000001-0000-4000-8000-000000000053',candidate_id:withdrawn,organisation_id:orgId,search_id:PORTAL_SEARCH_ID,approved_at:PORTAL_ANCHOR,withdrawn_at:now}
  ]});
 }
 if(!await has(`sp_audit_log?entity=eq.${encodeURIComponent(revealEntity(revealed,orgId,PORTAL_SEARCH_ID))}`)){
  await db('sp_audit_log',{method:'POST',body:{id:'a1000001-0000-4000-8000-000000000061',actor_id:user.id,action:'reveal',entity:revealEntity(revealed,orgId,PORTAL_SEARCH_ID),at:PORTAL_ANCHOR,meta:{candidate_id:revealed,organisation_id:orgId,search_id:PORTAL_SEARCH_ID,fictional:true}}});
 }
 if(!await has(`sp_memberships?user_id=eq.${user.id}&organisation_id=eq.${orgId}`)){
  await db('sp_memberships',{method:'POST',body:{id:randomUUID(),user_id:user.id,organisation_id:orgId,role:'hiring_manager',created_at:now}});
 }
 if(process.env.CANDIDATE_IDENTITY_KEY && !await has(`sp_candidate_identity?candidate_id=eq.${revealed}`)){
  const stored=encryptIdentity(SAMPLE_IDENTITY);
  await db('sp_candidate_identity',{method:'POST',body:{id:randomUUID(),candidate_id:revealed,ciphertext:stored.ciphertext,key_version:stored.key_version,created_at:now}}).catch(()=>{});
 }
}
export function portalDemoUser(user){return demoMode()&&user?.email===PORTAL_EMAIL;}
