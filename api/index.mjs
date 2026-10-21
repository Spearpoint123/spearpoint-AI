import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {searchInput,briefInput,BOOKING_URL} from '../lib/domain.mjs';
import {rateLimit,realSearch,saveBrief} from '../lib/services.mjs';
import {sessionCookie,sessionValid} from '../lib/session.mjs';
import {originAllowed} from '../lib/origin.mjs';
import {findArchetype,catalogueVersion} from '../lib/archetype-store.mjs';
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript'],'/search-journey.js':['search-journey.js','text/javascript'],'/GT-Canon-VF.ttf':['GT-Canon-VF.ttf','font/ttf'],'/GT-Standard-VF.ttf':['GT-Standard-VF.ttf','font/ttf'],'/style.css':['style.css','text/css'],'/hero-knight.png':['hero-knight.png','image/png'],'/privacy':['privacy.html','text/html; charset=utf-8'],'/logomark.svg':['logomark.svg','image/svg+xml']};
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
 if(req.method==='GET'&&files[path]){const [file,type]=files[path];res.setHeader('Content-Type',type);
  if(publicSite&&path==='/privacy')return asset('privacy-public.html',type);
  if(publicSite&&path==='/'){let html=await readFile(new URL('../views/index.html',import.meta.url),'utf8');html=html.replace(/<div class=\"staging\">.*?<\/div>/,'').replace(' Please use test data in staging.','');return res.end(html);}
  return res.end(await readFile(new URL(`../views/${file}`,import.meta.url)));}
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
   const archetype=findArchetype(input);
   let result;try{result=await realSearch({...input,skills:archetype.focus.join(', ')},{modelOnly:true});}catch(error){const code=/^(crm_http_[0-9]{3}|crm_contract(?:_[a-z_]{1,140})?|crm_access_denied|crm_auth_rejected|crm_rate_limited|storage_unavailable)$/.test(error.message)?error.message:['TimeoutError','AbortError'].includes(error.name)?'crm_timeout':'crm_internal';result={profiles:[],status:'unavailable',diagnostic:code};console.warn('Recruit CRM connection:',code);}
   const synthetic=true;
   const message=result.status==='searched'?'The confidential CRM search completed privately. This search preview is a role-based target, not an individual candidate.':result.status==='unavailable'?'The search preview is ready. The private CRM check could not complete.':'This search preview is a role-based target. A briefing can begin a confidential candidate search.';
   return json(200,{profiles:[archetype],synthetic,archetypeVersion:catalogueVersion,archetypeStatus:'matched',crmStatus:result.status,...(result.diagnostic?{crmDiagnostic:result.diagnostic}:{}),message,bookingUrl:BOOKING_URL});
  }
  if(process.env.RETENTION_JOB_CONFIRMED!=='true')throw Error('storage_unavailable');
  const saved=await saveBrief(input);return json(201,{reference:saved.id,bookingUrl:BOOKING_URL,message:'Your briefing request has been saved securely. Book a time to discuss your search.'});
 }catch(e){if(e.message==='validation')return json(400,{error:'Please check your details and privacy consent.'});return json(503,{error:'This service is temporarily unavailable. Please use the booking link.'});}
}
