import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGenerated,generatedArchetype} from '../lib/generated-archetypes.mjs';
import {savedArchetypes} from '../lib/archetype-store.mjs';
import {searchInput,briefInput} from '../lib/domain.mjs';
import {canVisitStep,selectSearchOption} from '../views/search-journey.js';
test('custom roles preserve exact title and enforce specialism prerequisites',()=>{
 const groups={Commercial:{roles:['VP Sales']},Trading:{roles:['Head of Trading']}};
 assert.throws(()=>selectSearchOption({},'customRole','Derivatives Sales',groups));
 const s=selectSearchOption({niche:'Exchanges',function:'Commercial'},'customRole','Derivatives Sales',groups);
 assert.equal(s.role,'Derivatives Sales');assert.equal(canVisitStep(s,3,groups),true);
 assert.equal(selectSearchOption(s,'function','Trading',groups).role,undefined);
 assert.throws(()=>selectSearchOption(s,'customRole','x'.repeat(101),groups));
});
test('requirements are bounded and cannot become arbitrary brief database columns',()=>{
 const input={role:'Derivatives Sales',location:'London',jobDescription:'Equity options for institutional clients'};
 assert.equal(searchInput(input).jobDescription,input.jobDescription);
 assert.throws(()=>searchInput({...input,jobDescription:'x'.repeat(4001)}));
 assert.equal(briefInput({...input,name:'Test User',company:'Example',email:'test@example.com',consent:true}).jobDescription,undefined);
});
test('generated CV validation rejects contact details, malformed structure and misleading metadata',()=>{
 const v=structuredClone(savedArchetypes[0]);v.kind='real';v.source='crm';
 const safe=validateGenerated(v,{role:'Derivatives Sales'});
 assert.equal(safe.role,'Derivatives Sales');assert.equal(safe.kind,'synthetic');assert.equal(safe.source,'ai_generated');assert.equal(safe.metrics[0].hypothetical,true);
 assert.throws(()=>validateGenerated({...v,professionalSummary:'Email person@example.com'},{role:'X'}));
 assert.throws(()=>validateGenerated({...v,careerHistory:[]},{role:'X'}));
});
test('budget denial stops inference without transmitting requirements',async()=>{
 const old=global.fetch,env={...process.env};process.env.SUPABASE_URL='https://pcezdsdhmjxpjakxtdhz.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.RATE_LIMIT_HMAC_KEY='x'.repeat(32);process.env.AI_GATEWAY_API_KEY='test';
 const calls=[];global.fetch=async(url)=>{calls.push(String(url));return new Response(JSON.stringify(String(url).includes('/rpc/')?false:[]),{status:200});};
 try{await assert.rejects(generatedArchetype({role:'Derivatives Sales',location:'London'}),/generation_budget/);assert.equal(calls.length,2);assert.ok(calls.every(x=>x.startsWith(process.env.SUPABASE_URL)));}finally{global.fetch=old;process.env=env;}
});
test('validated cached CV is reused without an AI call and cache key separates requirements',async()=>{
 const old=global.fetch,env={...process.env};process.env.SUPABASE_URL='https://pcezdsdhmjxpjakxtdhz.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.RATE_LIMIT_HMAC_KEY='x'.repeat(32);
 const paths=[];global.fetch=async(url)=>{paths.push(String(url));return new Response(JSON.stringify([{profile:savedArchetypes[0]}]),{status:200});};
 try{const result=await generatedArchetype({role:'Derivatives Sales',location:'London',jobDescription:'Equity options'});assert.equal(result.role,'Derivatives Sales');assert.equal(result.kind,'synthetic');assert.equal(paths.length,1);await generatedArchetype({role:'Derivatives Sales',location:'London',jobDescription:'Credit derivatives'});assert.notEqual(paths[0],paths[1]);assert.ok(paths.every(x=>x.startsWith(process.env.SUPABASE_URL)));assert.ok(paths.every(x=>!x.includes('derivatives')&&!x.includes('Equity')));}finally{global.fetch=old;process.env=env;}
});
