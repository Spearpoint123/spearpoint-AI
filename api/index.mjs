import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {searchInput,briefInput,BOOKING_URL} from '../lib/domain.mjs';
import {rateLimit,realSearch,saveBrief} from '../lib/services.mjs';
import {sessionCookie,sessionValid} from '../lib/session.mjs';
import {originAllowed} from '../lib/origin.mjs';
import {workspaceApi,recordActivity} from '../lib/workspace.mjs';
import {candidateIntake} from '../lib/candidate-intake.mjs';
import {workspaceUser} from '../lib/workspace-auth.mjs';
const files={'/owner':['owner.html','text/html; charset=utf-8'],'/owner.js':['owner.js','text/javascript'],'/owner.css':['owner.css','text/css'],'/talent-network':['candidate-join.html','text/html; charset=utf-8'],'/candidate-join.js':['candidate-join.js','text/javascript'],'/candidate-join.css':['candidate-join.css','text/css'],'/consult.js':['consult.js','text/javascript'],'/consult':['consult.html','text/html; charset=utf-8'],'/brief-settings.js':['brief-settings.js','text/javascript'],'/explore':['explore.html','text/html; charset=utf-8'],'/signup':['employer.html','text/html; charset=utf-8'],'/signin':['employer.html','text/html; charset=utf-8'],'/hiring':['employer.html','text/html; charset=utf-8'],'/employer.js':['employer.js','text/javascript'],'/employer.css':['employer.css','text/css'],'/candidate-table.js':['candidate-table.js','text/javascript'],'/talent-taxonomy.js':['talent-taxonomy.js','text/javascript'],'/workspace':['workspace.html','text/html; charset=utf-8'],'/workspace.js':['workspace.js','text/javascript'],'/talent.js':['talent.js','text/javascript'],'/shortlist':['shared.html','text/html; charset=utf-8'],'/shared.js':['shared.js','text/javascript'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript'],'/search-journey.js':['search-journey.js','text/javascript'],'/GT-Canon-VF.ttf':['GT-Canon-VF.ttf','font/ttf'],'/GT-Standard-VF.ttf':['GT-Standard-VF.ttf','font/ttf'],'/style.css':['style.css','text/css'],'/hero-knight.png':['hero-knight.png','image/png'],'/privacy':['privacy.html','text/html; charset=utf-8'],'/logomark.svg':['logomark.svg','image/svg+xml']};
export const PUBLIC_HOST='ai.spearpointsearch.com';
export const isPublicRequest=req=>process.env.VERCEL==='1'&&req.headers.host===PUBLIC_HOST;
const same=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function authorized(req){
 const user=process.env.STAGING_USER;
 const pass=process.env.STAGING_PASSWORD||process.env.STAGINGPASSWORD;
 if(!user||!pass||pass.length<20)return false;
 if(sessionValid(req.headers.cookie))return true;
 const header=req.headers.authorization||'';if(!header.startsWith('Basic '))return false;
 return same(Buffer.from(header.slice(6),'base64').toString(),`${user}:${pass}`);
}
export default async function handler(req,res){
 for(const [k,v] of Object.entries({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Strict-Transport-Security':'max-age=31536000'}))res.setHeader(k,v);
 const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
 const path=new URL(req.url,'http://localhost').pathname;
 const publicSite=isPublicRequest(req);
 // Analytics linker decorations are not part of the shareable product URL.
 // Clean only known tracking keys on the public landing page; keep functional parameters.
 if(publicSite&&req.method==='GET'&&path==='/'){
  const landing=new URL(req.url,'https://'+PUBLIC_HOST);let decorated=false;
  for(const key of [...landing.searchParams.keys()])if(/^(?:_gl|_ga|_gac|gclid|dclid|fbclid|msclkid|utm_.+)$/i.test(key)){landing.searchParams.delete(key);decorated=true;}
  if(decorated){res.statusCode=302;res.setHeader('Location','/'+landing.search);return res.end();}
 }

 if(publicSite&&['/api/login','/login.js','/login'].includes(path))return json(404,{error:'Not found'});
 const asset=async(file,type)=>{res.setHeader('Content-Type',type);res.end(await readFile(new URL(`../views/${file}`,import.meta.url)));};
 if(req.method==='GET'&&path==='/login.js')return asset('login.js','text/javascript');
 if(req.method==='GET'&&path==='/style.css'){
  let css=await readFile(new URL('../views/style.css',import.meta.url),'utf8');
  res.setHeader('Content-Type','text/css');return res.end(css);
 }
 if(req.method==='GET'&&path==='/logomark.svg')return asset('logomark.svg','image/svg+xml');
 if(req.method==='GET'&&path==='/lockup-dark.svg')return asset('lockup-dark.svg','image/svg+xml');
 if(path==='/api/login'){
  if(req.method!=='POST')return json(405,{error:'POST required'});
  if(!originAllowed(req.headers.origin))return json(403,{error:'Request origin rejected. Please use the main staging address.'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json(415,{error:'JSON required'});
  try{
   let body=req.body;
   if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2000)return json(413,{error:'Request too large'});}body=JSON.parse(raw);}
   else {if(Buffer.byteLength(JSON.stringify(body))>2000)return json(413,{error:'Request too large'});if(typeof body==='string')body=JSON.parse(body);}
   if(!body||typeof body.username!=='string'||typeof body.password!=='string'||body.username.length>80||body.password.length>200)return json(400,{error:'Please enter your username and password.'});
   if(!await rateLimit(req,'login')){res.setHeader('Retry-After','3600');return json(429,{error:'Too many sign-in attempts. Please try later.'});}
   const configured=process.env.STAGING_PASSWORD||process.env.STAGINGPASSWORD;
   if(!configured||configured.length<20)return json(503,{error:'The staging password must be saved in Vercel with at least 20 characters.'});
   const header=`Basic ${Buffer.from(`${body.username}:${body.password}`).toString('base64')}`;
   if(!authorized({headers:{authorization:header}}))return json(401,{error:'Username or password did not match.'});
   res.setHeader('Set-Cookie',sessionCookie());return json(200,{ok:true});
  }catch{return json(503,{error:'Sign-in is not ready. The staging operator needs to check its secure configuration.'});}
 }
 if(!publicSite&&!authorized(req)){
  if(req.method==='GET'&&(path==='/'||path==='/login'))return asset('login.html','text/html; charset=utf-8');
  return json(401,{error:'Please sign in to the private staging site.'});
 }
 if(req.method==='GET'&&/^\/shortlist\/[a-zA-Z0-9_-]{43}$/.test(path))return asset('shared.html','text/html; charset=utf-8');
 if(req.method==='GET'&&files[path]){const [file,type]=files[path];res.setHeader('Content-Type',type);
  if(publicSite&&path==='/privacy')return asset('privacy-public.html',type);
  if(publicSite&&path==='/'){let html=await readFile(new URL('../views/index.html',import.meta.url),'utf8');html=html.replace(/<div class=\"staging\">.*?<\/div>/,'').replace(' Please use test data in staging.','');return res.end(html);}
  return res.end(await readFile(new URL(`../views/${file}`,import.meta.url)));}
 if(path==='/robots.txt'){res.setHeader('Content-Type','text/plain');return res.end('User-agent: *\nDisallow: /\n');}
 const candidateRoute=['/api/candidates/read-cv','/api/candidates/join'].includes(path);
 const workspaceRoute=path.startsWith('/api/workspace/')||path.startsWith('/api/mandate/')||path==='/api/shortlist/shared';
 if(!candidateRoute&&!workspaceRoute&&!['/api/search','/api/brief'].includes(path))return json(404,{error:'Not found'});
 if(req.method!=='POST'){res.setHeader('Allow','POST');return json(405,{error:'Method not allowed'});}
 if(!originAllowed(req.headers.origin))return json(403,{error:'Request origin rejected. Please use the main staging address.'});
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json(415,{error:'JSON required'});
 const documentRoute=path==='/api/workspace/hiring/extract-document';
 if(documentRoute){try{await workspaceUser(req,res);}catch{return json(401,{error:'Sign in to upload a job description.'});}}
 const longBriefRoute=['/api/workspace/hiring/instant-search','/api/workspace/hiring/interpret'].includes(path);
 const bodyLimit=(documentRoute||candidateRoute)?2900000:longBriefRoute?96000:12000;
 let body;
 try{if(req.body){if(Buffer.byteLength(JSON.stringify(req.body))>bodyLimit)return json(413,{error:'Request too large'});body=typeof req.body==='string'?JSON.parse(req.body):req.body;}else{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>bodyLimit)return json(413,{error:'Request too large'});}body=JSON.parse(raw);}if(!body||Array.isArray(body)||typeof body!=='object')throw Error();}catch{return json(400,{error:'Invalid request'});}
 try{
  if(candidateRoute)return json(200,await candidateIntake(path,body,req));
  if(workspaceRoute)return json(200,await workspaceApi(path,body,req,res));
  const input=path==='/api/search'?searchInput(body):briefInput(body);
  if(!await rateLimit(req,path==='/api/search'?'search':'brief')){res.setHeader('Retry-After','3600');return json(429,{error:'Hourly limit reached. Please try later or book a briefing.'});}
  if(path==='/api/search'){
   let result;
   try{result=await realSearch(input);}catch(error){
    const code=/^(crm_http_[0-9]{3}|crm_contract(?:_[a-z_]{1,140})?|crm_access_denied|crm_auth_rejected|crm_rate_limited|storage_unavailable)$/.test(error.message)?error.message:['TimeoutError','AbortError'].includes(error.name)?'crm_timeout':'crm_internal';
    console.warn('Confidential search:',code);result={profiles:[],status:'unavailable'};
   }
   if(result.status!=='searched')return json(503,{profiles:[],synthetic:false,crmStatus:result.status,error:'Confidential search is temporarily unavailable. Book a briefing and we can check the mandate directly.',bookingUrl:BOOKING_URL});
   await recordActivity(await workspaceUser(req,res,false),{event_type:'search'});
   const message=result.profiles.length?'These profiles match your structured requirements using approved information. Names and CVs remain private. A specialist must confirm fit, current interest and permission for an introduction.':'No approved, shareable profiles matched your structured requirements in this search. This does not mean the wider database or market has no suitable candidates. Refine the requirements or request a confidential search.';
   return json(200,{profiles:result.profiles,synthetic:false,crmStatus:result.status,outcome:result.profiles.length?'matches':'no_shareable_matches',message,coverage:'Results cover the records checked for this brief and may not include every suitable candidate.',requirementsNote:'Matching uses role, sector, location and the essential skills entered separately. Additional brief notes are for consultant review and are not automatically assessed.',bookingUrl:BOOKING_URL});
  }
  if(process.env.RETENTION_JOB_CONFIRMED!=='true')throw Error('storage_unavailable');
  const saved=await saveBrief(input);return json(201,{reference:saved.id,bookingUrl:BOOKING_URL,message:'Your briefing request has been saved securely. Book a time to discuss your search.'});
 }catch(e){
  if(candidateRoute&&/^document_/.test(e.message)){const message={document_large:'Choose a CV smaller than 2 MB.',document_pages:'Use a CV with no more than 20 pages.',document_long:'This CV is too long. Use a shorter version or a LinkedIn profile link.',document_empty:'No readable text was found. For a scanned CV, use a text-based PDF or a LinkedIn profile link.',document_timeout:'This CV could not be read in time. Try a simpler file or a LinkedIn profile link.'}[e.message]||'Use a readable PDF, Word (.docx) or UTF-8 text CV.';return json(e.message==='document_large'?413:400,{error:message});}
  const errors={owner_required:[403,'This dashboard is restricted to authorised Spearpoint owners.'],anonymisation_required:[400,'Remove the candidate name, contact details and identifying links from the approved copy.'],candidate_validation:[400,'Check your details and confirm permission to store them and contact you.'],candidate_linkedin:[400,'Use a LinkedIn profile link beginning https://www.linkedin.com/in/'],candidate_profile_required:[400,'Add a CV or a LinkedIn profile link.'],nfa_clarification_required:[400,'For NFA, specify membership, registration or examination experience.'],must_haves_required:[400,'Add three different must-haves: specific experience, skills or credentials. A job title alone does not count.'],document_large:[413,'Upload a document smaller than 2 MB.'],document_pages:[400,'Use a job description with no more than 20 pages.'],document_long:[400,'This document is too long. Upload a shorter job description or paste the relevant text.'],document_empty:[400,'No readable text was found. For scanned PDFs, paste the job description text instead.'],document_invalid:[400,'Use a readable PDF, Word .docx or UTF-8 text file.'],document_timeout:[400,'This document could not be read in time. Try a simpler file or paste its text.'],work_email_required:[400,'Please use your company email address to create an employer account.'],company_required:[409,'Complete your company details first.'],role_conflict:[409,'This brief changed. Reopen the role and try again.'],role_inactive:[409,'Activate this role before searching or requesting an introduction.'],public_unavailable:[503,'Public web research is temporarily unavailable. Your internal results are still available.'],public_unverifiable:[503,'Public research did not return source-verifiable profile leads. No unverified claims have been displayed.'],research_limit:[429,'The public research allowance has been reached. Your internal search remains available.'],permission_required:[409,'Record candidate permission before marking an introduction as completed.'],unauthorized:[401,'Sign in to your private workspace first.'],not_found:[404,'This item or link is unavailable.'],rate_limited:[429,'Please wait before trying again.'],signin_failed:[401,'Sign-in failed. Check your details and confirm your email.'],signup_unavailable:[503,'Account registration is unavailable. Please contact Spearpoint for workspace access.'],interpretation_unavailable:[503,'Mandate interpretation is unavailable. Please use the guided search or try again shortly.'],profile_unavailable:[409,'One of these profiles is no longer approved for sharing. Refresh the search.'],workspace_limit:[409,'Your workspace is full. Delete an older item first.']};
  if(errors[e.message])return json(...[errors[e.message][0],{error:errors[e.message][1]}]);
  if(e.message==='validation')return json(400,{error:longBriefRoute?'Check the role description and optional answers. Job descriptions can contain up to 20,000 characters.':'Please check your details and privacy consent.'});return json(503,{error:'This service is temporarily unavailable. Please use the booking link.'});}
}
