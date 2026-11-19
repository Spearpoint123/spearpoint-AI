import {randomUUID} from 'node:crypto';
import {db} from './services.mjs';
import {generalise} from './anonymise.mjs';
import {prepareImport,storeImport,recruitCrmPull} from './crm-import.mjs';
import {track} from './analytics.mjs';
import {setShowDemoProfiles,showDemoProfiles} from './demo-visibility.mjs';
import {importProgress,stepImport} from './crm-import-job.mjs';

const now=()=>new Date().toISOString();
const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
function requireAdmin(user){if(!user?.id)throw Error('unauthorized');if(user.owner!==true&&user.operator!==true)throw Error('owner_required');}
function text(value,min,max){const clean=String(value||'').trim();if(clean.length<min||clean.length>max)throw Error('validation');return clean;}
async function publishedRows(){
 return (await rows('sp_candidates?select=level,years_bucket,firm_type,region,sector,pay_band,publication&limit=300')).filter(row=>row.publication!=='unpublished');
}
export async function adminApi(path,body,user){
 requireAdmin(user);
 if(path.endsWith('/home')||path.endsWith('/admin')){
  const domains=await rows('sp_employer_domains?order=updated_at.desc&limit=50');
  const engagements=await rows('sp_engagements?order=created_at.desc&limit=50');
  const orgs=await rows('sp_organisations?limit=100');
  const unpublished=await rows('sp_candidates?publication=eq.unpublished&limit=100');
  return {domains,engagements:engagements.map(row=>({id:row.id,organisation_id:row.organisation_id,type:row.type,label:row.label,status:row.status,fee_percent:row.fee_percent,monthly_amount:row.monthly_amount,engagement_fee:row.engagement_fee})),organisations:orgs.map(row=>({id:row.id,name:row.legal_name,domain:row.domain,verification_status:row.verification_status})),unpublished:unpublished.map(row=>({id:row.id,level:row.level,firm_type:row.firm_type,region:row.region,sector:row.sector,pay_band:row.pay_band})),report:await report(),audit:await auditRows(),demo:await showDemoProfiles(),importJob:await importProgress()};
 }
 if(path.endsWith('/review')){
  const domain=text(body?.domain,3,253).toLowerCase();
  const status=String(body?.status||'');
  if(!['approved','blocked','pending'].includes(status))throw Error('validation');
  const evidence=String(body?.evidence||'').trim();
  const companyName=String(body?.companyName||'').trim();
  if(status==='approved'&&(companyName.length<2||evidence.length<12))throw Error('employer_verification_required');
  const found=(await rows(`sp_employer_domains?domain=eq.${encodeURIComponent(domain)}&limit=1`))[0];
  const patch={status,company_type:status==='approved'?'direct_employer':'unknown',company_name:companyName.slice(0,160),review_evidence:evidence.slice(0,1500),reviewed_by:user.id,reviewed_at:now(),updated_at:now()};
  if(found)await db(`sp_employer_domains?domain=eq.${encodeURIComponent(domain)}`,{method:'PATCH',body:patch});
  else await db('sp_employer_domains',{method:'POST',body:{domain,...patch}});
  const org=(await rows(`sp_organisations?domain=eq.${encodeURIComponent(domain)}&limit=1`))[0];
  if(org)await db(`sp_organisations?id=eq.${org.id}`,{method:'PATCH',body:{verification_status:status==='approved'?'verified':status==='blocked'?'rejected':'pending',verified_by:user.id,verified_at:status==='approved'?now():null,verification_note:evidence.slice(0,240)}});
  await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:user.id,action:'verification',entity:`domain:${domain}`,at:now(),meta:{status}}});
  await track(user.id,'verification_decided',{approved:status==='approved'});
  return {domain,status};
 }
 if(path.endsWith('/activate')){
  const engagement=(await rows(`sp_engagements?id=eq.${body?.id}&limit=1`))[0];
  if(!engagement)throw Error('not_found');
  const org=(await rows(`sp_organisations?id=eq.${engagement.organisation_id}&limit=1`))[0];
  if(org?.verification_status!=='verified')throw Error('verification_pending');
  await db(`sp_engagements?id=eq.${engagement.id}`,{method:'PATCH',body:{status:'active'}});
  if(engagement.search_id)await db(`sp_searches?id=eq.${engagement.search_id}`,{method:'PATCH',body:{status:'live',updated_at:now()}});
  await db('sp_audit_log',{method:'POST',body:{id:randomUUID(),actor_id:user.id,action:'engagement',entity:`engagement:${engagement.id}`,at:now(),meta:{status:'active'}}});
  return {id:engagement.id,status:'active'};
 }
 if(path.endsWith('/price')){
  const engagement=(await rows(`sp_engagements?id=eq.${body?.id}&limit=1`))[0];
  if(!engagement)throw Error('not_found');
  const fee=Number(body?.fee_percent),monthly=Number(body?.monthly_amount),once=Number(body?.engagement_fee);
  if(![fee,monthly,once].every(value=>Number.isFinite(value)&&value>=0&&value<=100000))throw Error('validation');
  if(fee>40)throw Error('validation');
  await db(`sp_engagements?id=eq.${engagement.id}`,{method:'PATCH',body:{fee_percent:fee,monthly_amount:monthly,engagement_fee:once,note:String(body?.note||engagement.note||'').slice(0,400)}});
  return {id:engagement.id,fee_percent:fee,monthly_amount:monthly,engagement_fee:once};
 }
 if(path.endsWith('/publish')){
  const ids=(Array.isArray(body?.ids)?body.ids:[]).filter(id=>/^[a-f0-9-]{36}$/i.test(id)).slice(0,100);
  if(!ids.length)throw Error('validation');
  const waiting=await rows('sp_candidates?publication=eq.unpublished&limit=200');
  const blocked=waiting.filter(row=>ids.includes(row.id)&&row.source==='rocketreach').map(row=>row.id);
  const chosen=waiting.filter(row=>ids.includes(row.id)&&row.source!=='rocketreach');
  const shaped=generalise(chosen,await publishedRows(),5);
  const kept=new Set(shaped.rows.map(row=>row.id));
  for(const row of shaped.rows)await db(`sp_candidates?id=eq.${row.id}`,{method:'PATCH',body:{level:row.level,years_bucket:row.years_bucket,firm_type:row.firm_type,region:row.region,sector:row.sector,pay_band:row.pay_band,publication:'published'}});
  await track(user.id,'candidate_published',{count:shaped.rows.length});
  return {published:shaped.rows.length,suppressed:[...chosen.filter(row=>!kept.has(row.id)).map(row=>row.id),...blocked]};
 }
 if(path.endsWith('/import')){
  if(body?.pull===true)return recruitCrmPull();
  const prepared=prepareImport(body?.records||[],await publishedRows(),5);
  const stored=await storeImport(db,prepared);
  await track(user.id,'crm_import',{imported:stored.imported});
  return stored;
 }
 if(path.endsWith('/demo-toggle'))return {enabled:await setShowDemoProfiles(body?.enabled===true)};
 if(path.endsWith('/import-step'))return stepImport();
 if(path.endsWith('/demo')){
  const action=String(body?.action||'');
  const list=await rows('sp_candidates?source=eq.demo&fictional=eq.true&limit=200');
  if(action==='hide'){for(const row of list)await db(`sp_candidates?id=eq.${row.id}`,{method:'PATCH',body:{publication:'unpublished'}});return {hidden:list.length};}
  if(action==='remove'){for(const row of list)await db(`sp_candidates?id=eq.${row.id}`,{method:'DELETE'});return {removed:list.length};}
  throw Error('validation');
 }
 if(path.endsWith('/report'))return report();
 if(path.endsWith('/audit'))return {audit:await auditRows()};
 throw Error('not_found');
}
async function auditRows(){
 const reveal=await rows('sp_audit_log?action=eq.reveal&order=at.desc&limit=30');
 const exported=await rows('sp_audit_log?action=eq.export&order=at.desc&limit=30');
 const lookups=await rows('sp_audit_log?action=eq.provider_lookup&order=at.desc&limit=20');
 const imports=await rows('sp_audit_log?action=eq.provider_import&order=at.desc&limit=20');
 return [...reveal,...exported,...lookups,...imports].map(row=>({id:row.id,action:row.action,entity:row.entity,at:row.at})).sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,40);
}
async function report(){
 const orgs=await rows('sp_organisations?select=id,verification_status&limit=200');
 const searches=await rows('sp_searches?select=id,status&limit=200');
 const engagements=await rows('sp_engagements?select=status,type,monthly_amount&limit=200');
 const calls=await rows('sp_calls?select=kind&limit=200');
 const pipeline=await rows('sp_pipeline?select=stage&limit=300');
 const time=await rows('sp_time_entries?select=hours&limit=300');
 const briefs=searches.filter(row=>row.status&&row.status!=='draft').length;
 const live=searches.filter(row=>row.status==='live').length;
 const active=engagements.filter(row=>row.status==='active');
 const ended=engagements.filter(row=>row.status==='cancelled'||row.status==='closed').length;
 const hired=pipeline.filter(row=>row.stage==='hired').length;
 const responded=pipeline.filter(row=>['interested','shortlisted','interviewing','offer','hired'].includes(row.stage)).length;
 const hours=time.reduce((sum,row)=>sum+Number(row.hours||0),0);
 const mrr=active.reduce((sum,row)=>sum+Number(row.monthly_amount||0),0);
 return {signups:orgs.length,verified:orgs.filter(row=>row.verification_status==='verified').length,briefs,callsBooked:calls.length,conversion:orgs.length?Math.round(active.length/orgs.length*100):0,liveSearches:live,placements:hired,responseRate:pipeline.length?Math.round(responded/pipeline.length*100):0,hoursPerPlacement:hired?Math.round(hours/hired*10)/10:0,mrr,churn:active.length+ended?Math.round(ended/(active.length+ended)*100):0};
}
