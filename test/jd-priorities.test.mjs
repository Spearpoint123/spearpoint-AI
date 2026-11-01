import test from 'node:test';import assert from 'node:assert/strict';
import {suggestJdPriorities,validateJdPriorities} from '../lib/jd-priorities.mjs';
const source='Chief Compliance Officer. Based in the United States. An active Series 3 qualification is mandatory. Lead NFA registration for an introducing broker. Build written supervisory procedures and an AML compliance programme.';
const result={role:'Chief Compliance Officer',location:'United States',priorities:[{requirement:'Active Series 3 qualification',quote:'An active Series 3 qualification is mandatory.'},{requirement:'NFA registration for an introducing broker',quote:'Lead NFA registration for an introducing broker.'},{requirement:'Build supervisory procedures and AML compliance',quote:'Build written supervisory procedures and an AML compliance programme.'}]};
const reply=x=>new Response(JSON.stringify(x));
async function fixture(fn){const env={...process.env},fetch=globalThis.fetch;Object.assign(process.env,{AI_GATEWAY_API_KEY:'fixture',SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture'});try{await fn();}finally{process.env=env;globalThis.fetch=fetch;}}
test('JD priorities preserve three specific, sourced professional requirements without a sector taxonomy',()=>{const parsed=validateJdPriorities(result,source);assert.equal(parsed.priorities.length,3);assert.match(parsed.priorities[0].requirement,/Series 3/);assert.match(parsed.priorities[1].requirement,/NFA registration/);});
test('unsupported or fabricated quotes, changed credentials, personal criteria and duplicate suggestions are rejected',()=>{
 for(const first of [{...result.priorities[0],quote:'An active Series 7 qualification is mandatory.'},{...result.priorities[0],requirement:'Active Series 7 qualification'},{...result.priorities[0],requirement:'Required nationality'}])assert.throws(()=>validateJdPriorities({...result,priorities:[first]},source),/priorities_unavailable/);
 assert.throws(()=>validateJdPriorities({...result,priorities:[result.priorities[0],result.priorities[0]]},source));assert.throws(()=>validateJdPriorities({...result,priorities:[...result.priorities,result.priorities[0]]},source));
});
test('a sparse job description may supply fewer than three requirements without inventing the remainder',()=>{assert.equal(validateJdPriorities({...result,priorities:[result.priorities[0]]},source).priorities.length,1);assert.throws(()=>validateJdPriorities({priorities:[]},source),/priorities_empty/);});
test('suggestions use the existing AI budget, a compact response contract and make no writes or candidate searches',()=>fixture(async()=>{
 const calls=[];globalThis.fetch=async(url,opts)=>{calls.push(String(url));const body=JSON.parse(opts.body);if(String(url).includes('sp_take_rate_limit')){assert.equal(body.p_key,'spearpoint-mandate-ai-daily');assert.equal(body.p_limit,100);return reply(true);}assert.equal(String(url),'https://ai-gateway.vercel.sh/v1/chat/completions');assert.equal(body.response_format.json_schema.schema.properties.priorities.maxItems,3);assert.equal(body.messages[1].content,source);return reply({choices:[{message:{content:JSON.stringify(result)}}]});};const d=await suggestJdPriorities({job_description:source});assert.equal(d.priorities.length,3);assert.equal(calls.length,2);
}));
test('budget exhaustion, failed responses and malformed output fail visibly instead of inventing priorities',()=>fixture(async()=>{
 globalThis.fetch=async()=>reply(false);await assert.rejects(suggestJdPriorities({job_description:source}),/priorities_unavailable/);
 globalThis.fetch=async url=>String(url).includes('sp_take_rate_limit')?reply(true):reply({choices:[{message:{content:'broken JSON'}}]});await assert.rejects(suggestJdPriorities({job_description:source}),/priorities_unavailable/);
 await assert.rejects(suggestJdPriorities({job_description:'x'.repeat(20001)}),/validation/);
}));
