import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import handler from '../api/index.mjs';
import {parseRecruiterCsv} from '../lib/sourcing/csv-import.mjs';
import {linkedinRecruiterSearch} from '../lib/sourcing/linkedin-recruiter.mjs';
import {outreachDraft} from '../lib/sourcing/outreach.mjs';
import {resetDemoStore} from '../lib/demo-store.mjs';
const res=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(b){this.body=b;}});
async function withDemo(fn){
 const previous={...process.env};
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.RECRUIT_CRM_API_KEY;
 delete process.env.VERCEL_ENV;
 Object.assign(process.env,{SPEARPOINT_DEMO:'true',RATE_LIMIT_HMAC_KEY:'demo-test-hmac-key-with-32-characters',APP_ORIGIN:'http://127.0.0.1:3000'});
 resetDemoStore();
 try{await fn();}finally{process.env=previous;resetDemoStore();}
}
function post(path,body,cookie){return {url:path,method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json','x-vercel-forwarded-for':'127.0.0.1',...(cookie?{cookie}:{})},body,socket:{remoteAddress:'127.0.0.1'}};}
test('homepage no longer loads the broken guided-search script',async()=>{
 const html=await readFile(new URL('../views/index.html',import.meta.url),'utf8');
 assert.equal(html.includes('/app.js'),false);
 assert.match(html,/hero-knight\.webp/);
 assert.equal(html.includes('hero-knight.png'),false);
 const css=await readFile(new URL('../views/style.css',import.meta.url),'utf8');
 assert.equal(css.includes('GT Canon Trial'),false);
 assert.equal(css.includes('GT Standard Trial'),false);
});
test('linkedin helper and outreach never claim to send anything',()=>{
 const search=linkedinRecruiterSearch({title:'Head of Quantitative Trading',location:'London',skills:['Python','systematic equities']});
 assert.match(search.query,/Head of Quantitative Trading/);
 assert.match(search.query,/London/);
 assert.match(search.note,/does not search LinkedIn/);
 const draft=outreachDraft({candidate:{name:'Avery',matchReasons:['Fictional equities experience']},role:{title:'Head of Trading'},channel:'inmail'});
 assert.equal(draft.sent,false);
 assert.match(draft.notice,/Nothing has been sent/);
});
test('CSV import keeps profile URLs as text and ignores unsafe links',()=>{
 const csv='First Name,Last Name,Title,Company,Location,Profile URL\nAvery,Quinn,Trader,Northwind,London,https://www.linkedin.com/in/fictional-avery\nBad,Link,Trader,Northwind,London,javascript:alert(1)\n';
 const parsed=parseRecruiterCsv(csv);
 assert.equal(parsed.leads.length,2);
 assert.equal(parsed.leads[0].profile_url,'https://www.linkedin.com/in/fictional-avery');
 assert.equal(parsed.leads[1].profile_url,'');
 assert.equal(parsed.leads[0].full_name,'Avery Quinn');
});
test('demo recruiter can search fictional people and a client search stays anonymised',()=>withDemo(async()=>{
 const calls=[];const original=globalThis.fetch;globalThis.fetch=async(url)=>{calls.push(String(url));throw Error('demo must not call the network');};
 try{
  let r=res();await handler(post('/api/workspace/auth',{action:'signin',email:'recruiter@demo.spearpoint.test',password:'demo-recruiter-pass'}),r);
  assert.equal(r.statusCode,200);const cookie=r.headers['Set-Cookie'];assert.match(cookie,/__Host-sp_workspace=/);
  r=res();await handler(post('/api/workspace/recruit/search',{text:'quantitative equities python',location:'London'},cookie),r);
  assert.equal(r.statusCode,200);const body=JSON.parse(r.body);
  assert.equal(body.fictional,true);assert.ok(body.records.some(p=>p.name==='Avery Quinn'));
  assert.match(JSON.stringify(body),/Fictional/);
  r=res();await handler(post('/api/workspace/recruit/import',{csv:'First Name,Last Name,Title,Company\nCasey,Stone,Trader,Example Co\n'},cookie),r);
  assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).imported,1);
  r=res();await handler(post('/api/workspace/auth',{action:'signin',email:'client@demo.spearpoint.test',password:'demo-client-pass'}),r);
  const client=r.headers['Set-Cookie'];
  r=res();await handler(post('/api/workspace/hiring/instant-search',{query:'Head of quantitative trading',location:'London',mustHaves:['Systematic equities','Python research','Portfolio construction'],confirmed:true},client),r);
  assert.equal(r.statusCode,200);const shown=JSON.parse(r.body);
  assert.equal(shown.internalStatus,'demo');
  assert.ok(shown.candidates.every(p=>p.title.startsWith('Fictional')));
  assert.equal(JSON.stringify(shown).includes('avery.quinn'),false);
  assert.equal(calls.length,0);
 }finally{globalThis.fetch=original;}
}));
test('mandate interpretation requires a signed-in user and unknown pages are HTML',async()=>{
 const previous={...process.env};
 Object.assign(process.env,{VERCEL:'1',APP_ORIGIN:'https://ai.spearpointsearch.com',STAGING_USER:'staging',STAGING_PASSWORD:'x'.repeat(24)});
 delete process.env.SPEARPOINT_DEMO;
 const original=globalThis.fetch;globalThis.fetch=async()=>assert.fail('Anonymous interpret must not call a model');
 try{
  const r=res();await handler({url:'/api/mandate/interpret',method:'POST',headers:{host:'ai.spearpointsearch.com',origin:'https://ai.spearpointsearch.com','content-type':'application/json'},body:{mandate:'Hire a CTO in London with exchange experience'}},r);
  assert.equal(r.statusCode,401);
  const missing=res();await handler({url:'/does-not-exist',method:'GET',headers:{host:'ai.spearpointsearch.com'}},missing);
  assert.equal(missing.statusCode,404);assert.match(missing.body.toString(),/Page not found/);
  const css=res();await handler({url:'/style.css',method:'GET',headers:{host:'ai.spearpointsearch.com'}},css);
  assert.equal(css.statusCode,200);assert.match(css.headers['Cache-Control'],/max-age=86400/);
 }finally{globalThis.fetch=original;process.env=previous;}
});
test('a shared shortlist link does not demand a workspace session',async()=>{
 const previous={...process.env};
 Object.assign(process.env,{VERCEL:'1',APP_ORIGIN:'https://ai.spearpointsearch.com',SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',RATE_LIMIT_HMAC_KEY:'fixture-key-with-at-least-32-characters',STAGING_USER:'staging',STAGING_PASSWORD:'x'.repeat(24)});
 delete process.env.SPEARPOINT_DEMO;
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{url=String(url);if(url.includes('sp_take_rate_limit'))return Response.json(true);if(url.includes('sp_shortlists'))return Response.json([]);return Response.json([]);};
 try{
  const r=res();await handler({url:'/api/shortlist/shared',method:'POST',headers:{host:'ai.spearpointsearch.com',origin:'https://ai.spearpointsearch.com','content-type':'application/json','x-vercel-forwarded-for':'203.0.113.9'},body:{token:'a'.repeat(43)}},r);
  assert.notEqual(r.statusCode,401);
  assert.equal(r.statusCode,404);
 }finally{globalThis.fetch=original;process.env=previous;}
});
