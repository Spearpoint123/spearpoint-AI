import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.mjs';
test('model-CV search never sends individual CRM data or requires a sharing-approval query',async()=>{
 Object.assign(process.env,{STAGING_USER:'tester',STAGING_PASSWORD:'a'.repeat(24),APP_ORIGIN:'https://staging.example.com',SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',RATE_LIMIT_HMAC_KEY:'fixture-only-hmac-key-over-32-characters',RECRUIT_CRM_ENABLED:'true',RECRUIT_CRM_API_KEY:'fixture'});
 delete process.env.VERCEL;const original=globalThis.fetch;let candidateReads=0;
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('sp_take_rate_limit'))return new Response('true');
  if(String(url).startsWith('https://api.recruitcrm.io/v1/candidates/search')){assert.equal(options.method,'GET');candidateReads++;return new Response(JSON.stringify([{slug:'private-record',position:'Head of Market Making',first_name:'PRIVATE_PERSON',email:'private@example.com',company:'PRIVATE_EMPLOYER',candidate_summary:'PRIVATE_HISTORY'}]));}
  assert.fail('Model-CV mode must not query sharing approvals or other data');
 };
 try{const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};
 await handler({url:'/api/search',method:'POST',headers:{authorization:'Basic '+Buffer.from('tester:'+process.env.STAGING_PASSWORD).toString('base64'),origin:process.env.APP_ORIGIN,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},body:{role:'Head of Market Making',location:'London',skills:'Electronic market making'}},res);
 assert.equal(res.statusCode,200);const result=JSON.parse(res.body);assert.equal(result.crmStatus,'searched');assert.equal(result.synthetic,true);assert.ok(candidateReads>0);assert.ok(result.profiles.every(profile=>profile.label==='search preview'&&profile.kind==='synthetic'));
 for(const secret of ['PRIVATE_PERSON','private@example.com','PRIVATE_EMPLOYER','PRIVATE_HISTORY','private-record'])assert.ok(!res.body.includes(secret));
 }finally{globalThis.fetch=original;}
});
