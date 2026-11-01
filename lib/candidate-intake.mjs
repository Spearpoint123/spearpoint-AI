import {randomUUID} from 'node:crypto';
import {db,rateLimit,PROJECT_URL} from './services.mjs';
import {extractDocument} from './documents.mjs';
export const CANDIDATE_PRIVACY_VERSION='2026-11-01';
const field=(value,max,required=true)=>{if(typeof value!=='string'||value.trim().length>max||required&&!value.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('candidate_validation');return value.trim();};
export function candidateInput(body){
 if(body.website||body.consent!==true)throw Error('candidate_validation');
 const full_name=field(body.fullName,120),email=field(body.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('candidate_validation');
 let linkedin_url=field(body.linkedinUrl||'',250,false);if(linkedin_url){try{const u=new URL(linkedin_url);if(u.protocol!=='https:'||!['linkedin.com','www.linkedin.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/in\/[a-zA-Z0-9%_-]{3,150}\/?$/.test(u.pathname))throw Error();u.hostname='www.linkedin.com';u.search='';u.hash='';linkedin_url=u.href;}catch{throw Error('candidate_linkedin');}}
 if(!body.document&&!linkedin_url)throw Error('candidate_profile_required');
 return {full_name,email,linkedin_url,preferred_roles:field(body.preferredRoles,240),preferred_location:field(body.location,160),professional_summary:field(body.professionalSummary||'',6000,false),ai_matching_consent:body.aiConsent===true};
}
async function storage(path,{method,bytes,contentType}={}){
 if(process.env.SUPABASE_URL!==PROJECT_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('storage_unavailable');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(PROJECT_URL+'/storage/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,...(contentType?{'Content-Type':contentType}:{}),'x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('storage_unavailable');return r;
}
export async function candidateIntake(path,body,req){
 if(!['/api/candidates/read-cv','/api/candidates/join'].includes(path))throw Error('not_found');
 if(body.website||body.consent!==true)throw Error('candidate_validation');
 if(!await rateLimit(req,path.endsWith('read-cv')?'candidate-read':'candidate-join'))throw Error('rate_limited');
 if(path.endsWith('read-cv')){const doc=await extractDocument({...body.document,confirmed:true});return {text:doc.text,note:'Review your experience below. Your file has not been saved yet.'};}
 const input=candidateInput(body),id=randomUUID(),reference='TN-'+id.toUpperCase();let cv_path=null,cv_text='',cv_name='',cv_type='';
 // Parse every submitted file on the server; neither file names nor browser MIME types are trusted.
 if(body.document){const extracted=await extractDocument({...body.document,confirmed:true});cv_text=extracted.text;const ext=body.document.name.split('.').at(-1).toLowerCase();cv_type={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'}[ext];cv_name='CV.'+ext;cv_path=id+'/'+cv_name;
  await storage('object/candidate-cvs/'+cv_path,{method:'POST',bytes:Buffer.from(body.document.data,'base64'),contentType:cv_type});
 }
 try{await db('sp_candidate_submissions',{method:'POST',body:{id,reference,...input,cv_path,cv_name,cv_text,privacy_version:CANDIDATE_PRIVACY_VERSION,consented_at:new Date().toISOString(),ai_consented_at:input.ai_matching_consent?new Date().toISOString():null,status:'submitted',email_verified:false}});}catch(error){if(cv_path)try{await storage('object/candidate-cvs',{method:'DELETE',contentType:'application/json',bytes:JSON.stringify({prefixes:[cv_path]})});}catch{console.warn('Candidate intake: private file cleanup required');}throw error;}
 return {reference,message:'You’re in. Your details have been saved privately with Spearpoint. We’ll review your experience and contact you when there is a relevant opportunity. Nothing has been shared with an employer.'};
}
