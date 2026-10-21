import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {searchInput,briefInput,archetypes,BOOKING_URL} from '../lib/domain.mjs';
import {rateLimit,realSearch,saveBrief} from '../lib/services.mjs';
import {sessionCookie,sessionValid} from '../lib/session.mjs';
import {originAllowed} from '../lib/origin.mjs';
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript'],'/role-archetypes.js':['role-archetypes.js','text/javascript'],'/GT-Canon-VF.ttf':['GT-Canon-VF.ttf','font/ttf'],'/GT-Standard-VF.ttf':['GT-Standard-VF.ttf','font/ttf'],'/style.css':['style.css','text/css'],'/hero-knight.png':['hero-knight.png','image/png'],'/privacy':['privacy.html','text/html; charset=utf-8'],'/logomark.svg':['logomark.svg','image/svg+xml']};
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
 const asset=async(file,type)=>{res.setHeader('Content-Type',type);res.end(await readFile(new URL(`../views/${file}`,import.meta.url)));};
 if(req.method==='GET'&&path==='/login.js')return asset('login.js','text/javascript');
 if(req.method==='GET'&&path==='/style.css')return asset('style.css','text/css');
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
 if(!authorized(req)){
  if(req.method==='GET'&&(path==='/'||path==='/login'))return asset('login.html','text/html; charset=utf-8');
  return json(401,{error:'Please sign in to the private staging site.'});
 }
 if(req.method==='GET'&&files[path]){const [file,type]=files[path];res.setHeader('Content-Type',type);return res.end(await readFile(new URL(`../views/${file}`,import.meta.url)));}
 if(path==='/robots.txt'){res.setHeader('Content-Type','text/plain');return res.end('User-agent: *\nDisallow: /\n');}
 if(!['/api/search','/api/brief'].includes(path))return json(404,{error:'Not found'});
 if(req.method!=='POST'){res.setHeader('Allow','POST');return json(405,{error:'Method not allowed'});}
 if(!originAllowed(req.headers.origin))return json(403,{error:'Request origin rejected. Please use the main staging address.'});
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json(415,{error:'JSON required'});
 let body;
 try{if(req.body){if(Buffer.byteLength(JSON.stringify(req.body))>12000)return json(413,{error:'Request too large'});body=typeof req.body==='string'?JSON.parse(req.body):req.body;}else{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>12000)return json(413,{error:'Request too large'});}body=JSON.parse(raw);}if(!body||Array.isArray(body)||typeof body!=='object')throw Error();}catch{return json(400,{error:'Invalid request'});}
 try{
  const input=path==='/api/search'?searchInput(body):briefInput(body);
  if(!await rateLimit(req,path==='/api/search'?'search':'brief')){res.setHeader('Retry-After','3600');return json(429,{error:'Hourly limit reached. Please try later or book a briefing.'});}
  if(path==='/api/search'){
   let result;try{result=await realSearch(input);}catch(error){const code=/^(crm_http_[0-9]{3}|crm_contract|crm_rate_limited|storage_unavailable)$/.test(error.message)?error.message:['TimeoutError','AbortError'].includes(error.name)?'crm_timeout':'crm_internal';result={profiles:[],status:'unavailable',diagnostic:code};console.warn('Recruit CRM connection:',code);}
   const synthetic=result.profiles.length===0;
   const message=!synthetic?'These consented, redacted profiles meet at least 80% of the scored search criteria. Review their experience, supporting evidence and gaps with a consultant.':result.status==='not_connected'?'Live candidate search is not available in this preview. These are synthetic planning profiles, not CRM results or available candidates.':result.status==='unavailable'?"We couldn't complete the live candidate check. These synthetic examples can help shape your briefing; they are not real or available candidates.":'No externally shareable profile met the 80% criteria threshold in this search. These synthetic examples show the profile a real search could target; they are not available candidates.';
   return json(200,{profiles:synthetic?archetypes(input):result.profiles,synthetic,crmStatus:result.status,...(result.diagnostic?{crmDiagnostic:result.diagnostic}:{}),message,bookingUrl:BOOKING_URL});
  }
  if(process.env.RETENTION_JOB_CONFIRMED!=='true')throw Error('storage_unavailable');
  const saved=await saveBrief(input);return json(201,{reference:saved.id,bookingUrl:BOOKING_URL,message:'Your briefing request has been saved securely. Book a time to discuss your search.'});
 }catch(e){if(e.message==='validation')return json(400,{error:'Please check your details and privacy consent.'});return json(503,{error:'This staging service is not ready. No successful submission is being claimed. Please use the booking link.'});}
}
