import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {searchInput,briefInput,archetypes,BOOKING_URL} from '../lib/domain.mjs';
import {rateLimit,realSearch,saveBrief} from '../lib/services.mjs';
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/privacy':['privacy.html','text/html; charset=utf-8']};
const same=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function authorized(req){
 const user=process.env.STAGING_USER;
 const pass=process.env.STAGING_PASSWORD||process.env.STAGINGPASSWORD;
 if(!user||!pass||pass.length<20)return false;
 const header=req.headers.authorization||'';if(!header.startsWith('Basic '))return false;
 return same(Buffer.from(header.slice(6),'base64').toString(),`${user}:${pass}`);
}
export default async function handler(req,res){
 for(const [k,v] of Object.entries({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Strict-Transport-Security':'max-age=31536000'}))res.setHeader(k,v);
 const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
 if(!authorized(req)){res.setHeader('WWW-Authenticate','Basic realm="Spearpoint staging", charset="UTF-8"');res.statusCode=401;return res.end('Private staging. Credentials are required.');}
 const path=new URL(req.url,'http://localhost').pathname;
 if(req.method==='GET'&&files[path]){const [file,type]=files[path];res.setHeader('Content-Type',type);return res.end(await readFile(new URL(`../views/${file}`,import.meta.url)));}
 if(path==='/robots.txt'){res.setHeader('Content-Type','text/plain');return res.end('User-agent: *\nDisallow: /\n');}
 if(!['/api/search','/api/brief'].includes(path))return json(404,{error:'Not found'});
 if(req.method!=='POST'){res.setHeader('Allow','POST');return json(405,{error:'Method not allowed'});}
 if(!process.env.APP_ORIGIN||req.headers.origin!==process.env.APP_ORIGIN)return json(403,{error:'Request origin rejected'});
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json(415,{error:'JSON required'});
 let body;
 try{if(req.body){if(Buffer.byteLength(JSON.stringify(req.body))>12000)return json(413,{error:'Request too large'});body=typeof req.body==='string'?JSON.parse(req.body):req.body;}else{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>12000)return json(413,{error:'Request too large'});}body=JSON.parse(raw);}if(!body||Array.isArray(body)||typeof body!=='object')throw Error();}catch{return json(400,{error:'Invalid request'});}
 try{
  const input=path==='/api/search'?searchInput(body):briefInput(body);
  if(!await rateLimit(req,path==='/api/search'?'search':'brief')){res.setHeader('Retry-After','3600');return json(429,{error:'Hourly limit reached. Please try later or book a briefing.'});}
  if(path==='/api/search'){
   let result;try{result=await realSearch(input);}catch{result={profiles:[],status:'unavailable'};}
   const synthetic=result.profiles.length===0;
   return json(200,{profiles:synthetic?archetypes(input):result.profiles,synthetic,crmStatus:result.status,message:synthetic?'No shareable real profiles are shown. These synthetic archetypes are planning examples, not available candidates.':'Consented redacted profiles. Interest and availability have not been confirmed.',bookingUrl:BOOKING_URL});
  }
  if(process.env.RETENTION_JOB_CONFIRMED!=='true')throw Error('storage_unavailable');
  const saved=await saveBrief(input);return json(201,{reference:saved.id,bookingUrl:BOOKING_URL,message:'Your briefing request has been saved securely. Book a time to discuss your search.'});
 }catch(e){if(e.message==='validation')return json(400,{error:'Please check your details and privacy consent.'});return json(503,{error:'This staging service is not ready. No successful submission is being claimed. Please use the booking link.'});}
}
