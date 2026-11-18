import {createHash} from 'node:crypto';
import {db} from './services.mjs';
import {agencyDomain,employerDomain} from './employer-access.mjs';

export function londonStamp(date=new Date()){
 const formatted=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
 return `${formatted} Europe/London`;
}
export function ownerReviewUrl(){
 try{return new URL('/owner', process.env.APP_ORIGIN||'https://ai.spearpointsearch.com').href;}
 catch{return 'https://ai.spearpointsearch.com/owner';}
}
export function alertConfig(){
 const to=String(process.env.OWNER_ALERT_EMAIL||'').trim().toLowerCase();
 const from=String(process.env.ALERT_FROM_EMAIL||'').trim();
 const key=String(process.env.RESEND_API_KEY||'').trim();
 const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 const fromOk=email.test(from)||/^.+ <[^\s@]+@[^\s@]+\.[^\s@]+>$/.test(from);
 if(!to||!from||!key||!email.test(to)||!fromOk)return null;
 return {to,from,key};
}
export function describeBlockedSignup(email,directEmployer){
 const declared=directEmployer===true;
 let domain='';
 try{domain=employerDomain(email);}catch(error){
  domain=String(email||'').split('@')[1]?.toLowerCase()||'';
  return {email:String(email||'').toLowerCase(),domain,personal:error.message==='work_email_required',agency:false,directEmployer:declared,reason:error.message==='work_email_required'?'personal_email':'invalid_email',outcome:'blocked'};
 }
 const agency=agencyDomain(domain);
 const reason=!declared?(agency?'agency_domain':'not_direct_employer'):agency?'agency_domain':'blocked_domain';
 return {email:String(email).toLowerCase(),domain,personal:false,agency,directEmployer:declared,reason,outcome:'blocked'};
}
function letter(facts){
 const lines=[
  facts.outcome==='created'?'A new employer account was created.':'A signup attempt was blocked. No account was created.',
  '',
  `Email: ${facts.email||'unknown'}`,
  `Domain: ${facts.domain||'unknown'}`,
  `Domain record: ${facts.domainState||'not recorded'}`,
  `Personal email domain: ${facts.personal?'yes':'no'}`,
  `Agency domain: ${facts.agency?'yes':'no'}`,
  `Direct employer declaration: ${facts.directEmployer?'yes':'no'}`,
  `Reason: ${String(facts.reason||'signup').replaceAll('_',' ')}`,
  `Time: ${londonStamp(facts.at?new Date(facts.at):new Date())}`,
  '',
  `Review and approve domains: ${ownerReviewUrl()}`,
  '',
  'This alert is sent only to the Spearpoint owner. The person who tried to sign up is not emailed by this feature.'
 ];
 return lines.join('\n');
}
async function postResend(config,subject,text){
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({from:config.from,to:[config.to],subject,text}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('resend_'+response.status);
}
async function firstThisHour(email){
 const key=createHash('sha256').update('owner-signup-alert:'+String(email||'').toLowerCase()).digest('hex');
 return await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:key,p_limit:1,p_window_seconds:3600}})===true;
}
export async function sendOwnerAlert(facts){
 const config=alertConfig();
 if(!config){console.warn('owner_alert_skipped','not_configured');return {sent:false,reason:'not_configured'};}
 try{if(!await firstThisHour(facts.email))return {sent:false,reason:'deduped'};}
 catch(error){console.warn('owner_alert_dedupe_unavailable',error.message);}
 try{await postResend(config,(facts.outcome==='created'?'Spearpoint AI signup: ':'Spearpoint AI blocked signup: ')+(facts.email||'unknown').slice(0,180),letter(facts));return {sent:true};}
 catch(error){console.warn('owner_alert_failed',error.message);return {sent:false,reason:'send_failed'};}
}
export function queueOwnerAlert(facts){
 setImmediate(()=>{sendOwnerAlert(facts).catch(error=>console.warn('owner_alert_failed',error?.message||'error'));});
}
export async function sendSignupDigest(){
 const config=alertConfig();
 if(!config){console.warn('owner_alert_skipped','not_configured');return {sent:false,reason:'not_configured'};}
 let rows=[];
 try{rows=await db('sp_signup_attempts?alerted_at=is.null&order=created_at.asc&limit=50')||[];}
 catch(error){console.warn('owner_alert_digest_unavailable',error.message);return {sent:false,reason:'unavailable'};}
 if(!rows.length)return {sent:false,reason:'empty'};
 const text=['Signup attempts recorded by the auth hook and not yet sent.','',
  ...rows.map(row=>`${londonStamp(new Date(row.created_at||Date.now()))} — ${row.outcome||'blocked'} — ${row.email} — ${row.domain||'no domain'}`),
  '',`Review and approve domains: ${ownerReviewUrl()}`,'','These people were not emailed.'].join('\n');
 try{await postResend(config,`Spearpoint AI signup attempts (${rows.length})`,text);}
 catch(error){console.warn('owner_alert_failed',error.message);return {sent:false,reason:'send_failed'};}
 const ids=rows.map(row=>row.id).filter(Boolean);
 if(ids.length)await db(`sp_signup_attempts?id=in.(${ids.join(',')})`,{method:'PATCH',body:{alerted_at:new Date().toISOString()}}).catch(error=>console.warn('owner_alert_mark_failed',error.message));
 return {sent:true,count:rows.length};
}
