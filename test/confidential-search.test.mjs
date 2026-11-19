import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.mjs';
const response=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}});
test('search endpoint returns real approved matches, honest empty results and errors without any generated fallback',async()=>{
 const oldFetch=globalThis.fetch,oldEnv={...process.env};
 Object.assign(process.env,{STAGING_USER:'tester',STAGING_PASSWORD:'a'.repeat(24),APP_ORIGIN:'https://staging.example.com',SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',RATE_LIMIT_HMAC_KEY:'fixture-only-hmac-key-over-32-characters',RECRUIT_CRM_ENABLED:'true',RECRUIT_CRM_API_KEY:'fixture',AI_GATEWAY_API_KEY:'must-not-be-used'});delete process.env.VERCEL;
 const row={crm_slug:'private-record',external_sharing_consent:true,consent_evidence:'PRIVATE_APPROVAL_EVIDENCE',consent_expires_at:new Date(Date.now()+86400000).toISOString(),reviewed_at:new Date().toISOString(),public_title:'Chief Technology Officer',public_summary:'London technology leader with market making experience.',public_skills:['Python']};
 let mode='matched';const reads=[];
 globalThis.fetch=async(url,options)=>{
  reads.push(String(url));
  if(String(url).includes('sp_take_rate_limit'))return new Response('true');
  if(String(url).startsWith('https://api.recruitcrm.io/v1/candidates/search')){assert.equal(options.method,'GET');if(mode==='failure')return new Response('PRIVATE_UPSTREAM_ERROR',{status:503});return new Response(JSON.stringify([{slug:'private-record',position:'CTO',first_name:'PRIVATE_PERSON',email:'private@example.com',company:'PRIVATE_EMPLOYER',candidate_summary:'PRIVATE_HISTORY'}]));}
  if(String(url).includes('/sp_profile_approvals?')){if(mode==='approval_failure')return new Response('PRIVATE_STORAGE_ERROR',{status:500});return new Response(JSON.stringify(mode==='empty'?[]:[row]));}
  assert.fail('Unexpected service call; generation and cache must not run');
 };
 const request=()=>({url:'/api/search',method:'POST',headers:{authorization:'Basic '+Buffer.from('tester:'+process.env.STAGING_PASSWORD).toString('base64'),origin:process.env.APP_ORIGIN,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},body:{role:'Chief Technology Officer',location:'London',skills:'Python',niche:'Market makers & prop trading',jobDescription:'Additional notes for manual review'}});
 try{
  let res=response();await handler(request(),res);assert.equal(res.statusCode,200);let result=JSON.parse(res.body);assert.equal(result.synthetic,false);assert.equal(result.outcome,'matches');assert.equal(result.profiles.length,1);assert.equal(result.profiles[0].kind,'real');assert.match(result.requirementsNote,/not automatically assessed/);
  for(const secret of ['PRIVATE_PERSON','private@example.com','PRIVATE_EMPLOYER','PRIVATE_HISTORY','private-record','PRIVATE_APPROVAL_EVIDENCE'])assert.ok(!res.body.includes(secret));
  mode='empty';res=response();await handler(request(),res);result=JSON.parse(res.body);assert.equal(res.statusCode,200);assert.deepEqual(result.profiles,[]);assert.equal(result.outcome,'no_shareable_matches');assert.equal(result.synthetic,false);assert.match(result.message,/does not mean/);
  for(mode of ['failure','approval_failure']){res=response();await handler(request(),res);assert.equal(res.statusCode,503);assert.deepEqual(JSON.parse(res.body).profiles,[]);assert.ok(!res.body.includes('PRIVATE_'));assert.equal(JSON.parse(res.body).crmDiagnostic,undefined);}
  process.env.RECRUIT_CRM_ENABLED='false';res=response();await handler(request(),res);assert.equal(res.statusCode,503);assert.equal(JSON.parse(res.body).crmStatus,'not_connected');
  assert.ok(reads.every(url=>url.startsWith('https://api.recruitcrm.io/')||url.startsWith(process.env.SUPABASE_URL)));
 }finally{globalThis.fetch=oldFetch;process.env=oldEnv;}
});
