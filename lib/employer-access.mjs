import {domainToASCII} from 'node:url';
import {db} from './services.mjs';
const personal=/^(?:gmail\.com|googlemail\.com|yahoo\.[a-z.]+|hotmail\.[a-z.]+|outlook\.[a-z.]+|live\.[a-z.]+|msn\.[a-z.]+|icloud\.com|me\.com|mac\.com|aol\.com|proton\.me|protonmail\.com|gmx\.[a-z.]+|mail\.com|yandex\.[a-z.]+|mailinator\.com|guerrillamail\.[a-z.]+|yopmail\.com|tempmail\.[a-z.]+)$/i;
const agencyDomains=['hays.com','hays.co.uk','randstad.com','roberthalf.com','michaelpage.com','pagegroup.com','adecco.com','manpower.com','manpowergroup.com','kornferry.com','spencerstuart.com','heidrick.com','russellreynolds.com'];
export function employerDomain(email){
 if(typeof email!=='string'||email.length>254||!/^([^\s@]+)@([^\s@]+)$/.test(email))throw Error('validation');
 const domain=domainToASCII(email.split('@')[1]).toLowerCase();
 if(!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)||domain.length>253)throw Error('validation');
 if(personal.test(domain))throw Error('work_email_required');
 return domain;
}
export const agencyDomain=domain=>agencyDomains.some(d=>domain===d||domain.endsWith('.'+d));
async function domainRows(domain){const parents=domain.split('.').map((_,i)=>domain.split('.').slice(i).join('.')).filter(d=>d.includes('.'));return await db('sp_employer_domains?domain=in.('+parents.map(encodeURIComponent).join(',')+')&limit=10')||[];}
export async function employerRegistration(email,directEmployer){
 const domain=employerDomain(email);if(directEmployer!==true||agencyDomain(domain))throw Error('agency_not_allowed');
 const rows=await domainRows(domain);if(rows.some(r=>r.status==='blocked'||r.company_type==='recruitment_agency'))throw Error('agency_not_allowed');
 return domain;
}
export async function registerEmployerDomain(domain){await db('rpc/sp_register_employer_domain',{method:'POST',body:{p_domain:domain}});}
export async function employerAccess(user){
 if(user.owner===true||user.operator===true)return {status:'approved',internal:true};
 let domain;try{domain=employerDomain(user.email);}catch{return {status:'blocked'};}
 if(agencyDomain(domain))return {status:'blocked',domain};
 const rows=await domainRows(domain);if(rows.some(r=>r.status==='blocked'||r.company_type==='recruitment_agency'))return {status:'blocked',domain};
 const current=rows.find(r=>r.domain===domain);
 if(current?.status==='approved'&&current.company_type==='direct_employer'&&current.reviewed_by&&current.reviewed_at&&current.review_evidence?.length>=12)return {status:'approved',domain};
 if(!current)await registerEmployerDomain(domain);
 return {status:'pending',domain};
}
export async function requireEmployerAccess(user){const access=await employerAccess(user);if(access.status!=='approved')throw Error(access.status==='blocked'?'agency_not_allowed':'employer_review_required');return access;}
export async function reviewEmployerDomain(body,user){
 if(user.owner!==true)throw Error('owner_required');
 const domain=employerDomain('review@'+body.domain),status=body.status;
 if(!['approved','blocked','pending'].includes(status)||!['unknown','direct_employer','recruitment_agency'].includes(body.companyType))throw Error('validation');
 if(status==='approved'&&(agencyDomain(domain)||body.companyType!=='direct_employer'))throw Error('agency_not_allowed');
 const name=String(body.companyName||'').trim(),evidence=String(body.evidence||'').trim();
 if(name.length>160||evidence.length>1500||(status==='approved'&&(name.length<2||evidence.length<12)))throw Error('employer_verification_required');
 const rows=await db('sp_employer_domains?domain=eq.'+encodeURIComponent(domain),{method:'PATCH',returnRows:true,body:{status,company_type:body.companyType,company_name:name,review_evidence:evidence,reviewed_by:user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}});
 if(!rows?.length)throw Error('not_found');
 return {ok:true};
}
