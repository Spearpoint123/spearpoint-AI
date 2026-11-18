import http from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
if(existsSync('.env')){
 for(const line of readFileSync('.env','utf8').split('\n')){
  const match=line.match(/^([A-Z0-9_]+)=(.*)$/);
  if(match&&process.env[match[1]]==null)process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,'');
 }
}
if(process.env.SPEARPOINT_DEMO==null)process.env.SPEARPOINT_DEMO='true';
if(!process.env.RATE_LIMIT_HMAC_KEY)process.env.RATE_LIMIT_HMAC_KEY='demo-only-hmac-key-not-for-production-use';
if(!process.env.APP_ORIGIN)process.env.APP_ORIGIN='http://127.0.0.1:3000';
const {default:handler}=await import('./api/index.mjs');
http.createServer((req,res)=>handler(req,res).catch(()=>{res.statusCode=500;res.end('Service unavailable');})).listen(3000,'127.0.0.1',()=>console.log('Spearpoint AI demo: http://127.0.0.1:3000  (recruiter desk: /recruit)'));
