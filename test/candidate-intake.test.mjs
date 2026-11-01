import test from 'node:test';import assert from 'node:assert/strict';
import {candidateInput,candidateIntake} from '../lib/candidate-intake.mjs';import handler from '../api/index.mjs';
const body={fullName:'Test Candidate',email:'test@example.com',preferredRoles:'CTO',location:'London or remote',linkedinUrl:'https://www.linkedin.com/in/test-candidate?tracking=1',consent:true,professionalSummary:'Built trading systems.'};
const req={socket:{remoteAddress:'127.0.0.1'},headers:{}};
async function fixture(fn){const saved={...process.env},original=globalThis.fetch;Object.assign(process.env,{SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-private',RATE_LIMIT_HMAC_KEY:'fixture-key-that-is-longer-than-thirty-two'});delete process.env.VERCEL;try{await fn();}finally{globalThis.fetch=original;process.env=saved;}}
const response=x=>new Response(x===null?null:JSON.stringify(x),{status:x===null?204:200});
test('candidate intake requires consent, professional preferences and a CV or safe LinkedIn URL',()=>{
 const input=candidateInput(body);assert.equal(input.email,'test@example.com');assert.equal(input.linkedin_url,'https://www.linkedin.com/in/test-candidate');assert.equal(input.ai_matching_consent,false);
 for(const patch of [{consent:false},{website:'spam'},{email:'bad'},{linkedinUrl:''},{location:''},{preferredRoles:''},{linkedinUrl:'https://linkedin.com.evil.test/in/name'},{linkedinUrl:'https://user:pass@linkedin.com/in/person'},{professionalSummary:'x'.repeat(6001)}])assert.throws(()=>candidateInput({...body,...patch}));
});
test('candidate CV and details are stored privately; public response has only confirmation',()=>fixture(async()=>{
 const calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url:String(url),opts});if(String(url).includes('sp_take_rate_limit'))return response(true);return response(null);};
 const result=await candidateIntake('/api/candidates/join',{...body,document:{name:'private-original-name.txt',data:Buffer.from('Built trading systems and led engineering teams.').toString('base64')},aiConsent:true},req);
 assert.match(result.reference,/^TN-/);assert.ok(!JSON.stringify(result).includes('cv_path'));assert.equal(calls.length,3);
 const upload=calls[1];assert.match(upload.url,/storage\/v1\/object\/candidate-cvs\/[a-f0-9-]+\/CV.txt$/);assert.equal(upload.opts.headers['x-upsert'],'false');assert.ok(!upload.url.includes('private-original-name'));
 const row=JSON.parse(calls[2].opts.body);assert.equal(row.email_verified,false);assert.equal(row.status,'submitted');assert.equal(row.ai_matching_consent,true);assert.ok(row.ai_consented_at);assert.equal(row.cv_text,'Built trading systems and led engineering teams.');assert.equal(row.privacy_version,'2026-11-01');
}));
test('failed candidate metadata save cleans up the just-uploaded private file',()=>fixture(async()=>{
 const calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url:String(url),opts});if(String(url).includes('sp_take_rate_limit'))return response(true);if(String(url).includes('/rest/v1/sp_candidate_submissions'))return new Response('',{status:503});return response(null);};
 await assert.rejects(candidateIntake('/api/candidates/join',{...body,document:{name:'cv.txt',data:Buffer.from('Built trading systems and led engineering teams.').toString('base64')}},req),/storage_unavailable/);
 assert.equal(calls.at(-1).opts.method,'DELETE');assert.equal(JSON.parse(calls.at(-1).opts.body).prefixes.length,1);
}));
test('candidate parsing is bounded and denied requests never upload or save',()=>fixture(async()=>{
 globalThis.fetch=async url=>{assert.match(String(url),/sp_take_rate_limit/);return response(false);};await assert.rejects(candidateIntake('/api/candidates/join',body,req),/rate_limited/);
 globalThis.fetch=async url=>{assert.match(String(url),/sp_take_rate_limit/);return response(true);};await assert.rejects(candidateIntake('/api/candidates/join',{...body,document:{name:'cv.exe',data:Buffer.from('not a cv').toString('base64')}},req),/document_invalid/);
}));
test('public candidate endpoints enforce origin and do not expose a submissions list',()=>fixture(async()=>{
 process.env.VERCEL='1';const res=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(b){this.body=b;}});let output=res();await handler({url:'/api/candidates/join',method:'POST',headers:{host:'ai.spearpointsearch.com',origin:'https://evil.test','content-type':'application/json'},body},output);assert.equal(output.statusCode,403);
 output=res();await handler({url:'/api/candidates/join',method:'GET',headers:{host:'ai.spearpointsearch.com'}},output);assert.equal(output.statusCode,405);
 output=res();await handler({url:'/talent-network',method:'GET',headers:{host:'ai.spearpointsearch.com'}},output);assert.equal(output.statusCode,200);assert.match(output.body.toString(),/candidate-form/);
}));
