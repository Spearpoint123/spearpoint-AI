import {randomUUID} from 'node:crypto';
import {db,demoMode} from './services.mjs';
import {staffSearch,confirmedCrmNote} from './recruitcrm.mjs';
import {parseRecruiterCsv} from './sourcing/csv-import.mjs';
import {linkedinRecruiterSearch} from './sourcing/linkedin-recruiter.mjs';
import {outreachDraft} from './sourcing/outreach.mjs';
import {providerCatalogue} from './sourcing/providers.mjs';
import {track,productMetrics} from './analytics.mjs';
import {scoreDemo} from './demo-data.mjs';

export const isStaff=user=>user?.owner===true||user?.operator===true||user?.recruiter===true;
const stages=['new','shortlisted','outreach_drafted','intro_requested','interviewing','placed','archived'];
const live=()=>`expires_at=gt.${encodeURIComponent(new Date().toISOString())}`;

async function briefs(){
 const roles=await db(`sp_roles?select=id,title,state,owner_id,criteria,internal_status,public_status,created_at&${live()}&order=created_at.desc&limit=40`)||[];
 const intros=await db(`sp_introductions?select=id,role_id,reference,status,request_note,created_at&${live()}&order=created_at.desc&limit=40`)||[];
 return {roles,introductions:intros};
}
export async function recruiterApi(action,body,user){
 if(!isStaff(user))throw Error('staff_required');
 if(action==='home'){
  const queue=await briefs();
  const metrics=await productMetrics();
  return {...queue,metrics,providers:providerCatalogue(),demo:demoMode(),fictional:demoMode(),message:demoMode()?'Demonstration workspace. Every candidate shown without a RecruitCRM key is fictional.':'Spearpoint team workspace. Client accounts still see anonymised profiles only.'};
 }
 if(action==='search'){
  const result=await staffSearch({text:String(body.text||body.query||''),skills:String(body.skills||''),location:String(body.location||'')});
  await track(user.id,'search_run',{fictional:result.fictional===true,source:result.status});
  await track(user.id,'candidates_surfaced',{surfaced:result.records.length,fictional:result.fictional===true});
  return result;
 }
 if(action==='pipeline'){
  if(!stages.includes(body.stage))throw Error('validation');
  const key=String(body.candidate_key||'').slice(0,160);
  if(key.length<2)throw Error('validation');
  await db('sp_recruiter_pipeline',{method:'POST',body:{id:randomUUID(),owner_id:user.id,candidate_key:key,stage:body.stage,note:String(body.note||'').slice(0,1000)}});
  return {ok:true,stage:body.stage,message:'Pipeline updated inside Spearpoint. RecruitCRM was not changed.'};
 }
 if(action==='linkedin')return linkedinRecruiterSearch({title:body.title||body.text,location:body.location,skills:body.skills,seniority:body.seniority});
 if(action==='import'){
  const parsed=parseRecruiterCsv(body.csv||body.text||'');
  const rows=parsed.leads.map(lead=>({id:randomUUID(),owner_id:user.id,source:'linkedin_recruiter_export',fictional:false,...lead,pipeline_stage:'imported'}));
  await db('sp_import_leads',{method:'POST',body:rows});
  await track(user.id,'csv_imported',{surfaced:rows.length});
  return {imported:rows.length,leads:rows.map(r=>({id:r.id,full_name:r.full_name,title:r.title,company:r.company,location:r.location,profile_url:r.profile_url,fictional:false})),note:parsed.note};
 }
 if(action==='outreach'){
  const draft=outreachDraft({candidate:body.candidate||{},role:body.role||{},channel:body.channel});
  await track(user.id,'outreach_drafted',{channel:draft.channel});
  return draft;
 }
 if(action==='note')return confirmedCrmNote({slug:body.slug,note:body.note,confirm:body.confirm===true});
 if(action==='metrics')return productMetrics();
 if(action==='queue'){
  const queue=await briefs();
  const imported=await db(`sp_import_leads?${live()}&order=created_at.desc&limit=50`)||[];
  const pipeline=await db(`sp_recruiter_pipeline?order=created_at.desc&limit=50`)||[];
  const illustration=demoMode()?scoreDemo(''):[];
  return {...queue,imported,pipeline,illustration};
 }
 throw Error('not_found');
}
