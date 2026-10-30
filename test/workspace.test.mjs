import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.mjs';
import {workspaceCookie,openSession} from '../lib/workspace-auth.mjs';
import {assessMandate,mandateCriteria,interpretMandate} from '../lib/talent-search.mjs';
import {summariseActivity} from '../lib/workspace.mjs';
const owner='12345678-1234-4123-8123-123456789abc',foreign='87654321-4321-4321-8321-cba987654321',item='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env={SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-server-key',RATE_LIMIT_HMAC_KEY:'fixture-key-with-at-least-32-characters',AI_GATEWAY_API_KEY:'fixture-ai-key',VERCEL:'1'};
const res=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(b){this.body=b;}});
const response=data=>new Response(JSON.stringify(data));
const profile={kind:'real',title:'Head of Compliance',reference:'SP-1234567890ABCDEF',focus:['Licensing'],evidence:[{criterion:'licensing',text:'Recorded licensing projects; approval not documented.'}],locations:['United Kingdom']};
const criteria={role:'Compliance leadership',location:'Any location',requirements:['digital_assets','licensing','market_entry'],otherRequirements:'None'};
async function fixture(fn){const original=globalThis.fetch,previous={...process.env};Object.assign(process.env,env);try{await fn();}finally{globalThis.fetch=original;process.env=previous;}}
function req(path,body={},signed=true){return {url:path,method:'POST',headers:{host:'ai.spearpointsearch.com',origin:'https://ai.spearpointsearch.com','content-type':'application/json','x-vercel-forwarded-for':'127.0.0.1',...(signed?{cookie:workspaceCookie({access_token:'ACCESS',refresh_token:'REFRESH'})}:{})},body};}
test('licensing and a digital asset skill never establish market entry without reviewed evidence',()=>{
 const match=assessMandate(criteria,{...profile,evidence:[...profile.evidence,{criterion:'digital_assets',text:'Digital assets is a recorded skill.'}]});assert.equal(match.requirementsMet,false);assert.match(match.gaps.join(' '),/regulated market entry/);assert.equal(match.matchedRequirements,2);
 const complete=assessMandate({...criteria,requirements:['licensing']},profile);assert.equal(complete.requirementsMet,true);
 assert.equal(assessMandate({...criteria,role:'MLRO'},profile),null);
 assert.equal(assessMandate({...criteria,requirements:[],otherRequirements:'Rust'},profile).requirementsMet,false);
 assert.equal(assessMandate({...criteria,requirements:[],location:'London'},profile).requirementsMet,false);
 assert.throws(()=>mandateCriteria({...criteria,requirements:['invented_evidence']}));
});
test('encrypted workspace cookies expire, reject modification and contain no readable tokens',()=>fixture(async()=>{
 const cookie=workspaceCookie({access_token:'PRIVATE_ACCESS',refresh_token:'PRIVATE_REFRESH'});assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);assert.ok(!cookie.includes('PRIVATE'));assert.equal(openSession(cookie).access_token,'PRIVATE_ACCESS');assert.equal(openSession(cookie.replace('__Host-sp_workspace=','__Host-sp_workspace=x')),null);process.env.RATE_LIMIT_HMAC_KEY='rotated-secret-with-more-than-32-characters';assert.equal(openSession(cookie),null);
}));
test('private endpoints reject anonymous requests before any database access',()=>fixture(async()=>{
 globalThis.fetch=async()=>assert.fail('Anonymous request touched storage');
 for(const path of ['/api/workspace/load','/api/workspace/save-shortlist','/api/workspace/share','/api/workspace/outcome']){const r=res();await handler(req(path,{},false),r);assert.equal(r.statusCode,401);}
}));
test('workspace identity comes from verified auth, and every read is filtered to that owner',()=>fixture(async()=>{
 const calls=[];globalThis.fetch=async(url,opts)=>{calls.push(String(url));if(String(url).endsWith('/auth/v1/user')){assert.equal(opts.headers.Authorization,'Bearer ACCESS');return response({id:owner,email:'fixture@example.com',email_confirmed_at:'2026-10-01'});}assert.ok(String(url).includes('owner_id=eq.'+owner));assert.ok(!String(url).includes(foreign));return response([]);};
 const r=res();await handler(req('/api/workspace/load',{owner_id:foreign}),r);assert.equal(r.statusCode,200);assert.equal(calls.length,4);assert.equal(JSON.parse(r.body).metrics.searches,0);
}));
test('a foreign shortlist cannot be shared or used to record an outcome',()=>fixture(async()=>{
 globalThis.fetch=async(url,opts)=>{if(String(url).endsWith('/auth/v1/user'))return response({id:owner,email_confirmed_at:'2026-10-01'});assert.equal(opts.method,'GET');assert.match(String(url),new RegExp('owner_id=eq.'+owner));return response([]);};
 for(const path of ['/api/workspace/share','/api/workspace/outcome']){const r=res();await handler(req(path,{id:item,shortlist_id:item,event_type:'shortlist_accepted',confirmed:true,owner_id:foreign}),r);assert.equal(r.statusCode,404);}
}));
test('shared link resolution checks link expiry and rechecks current profile approval',()=>fixture(async()=>{
 globalThis.fetch=async(url)=>{url=String(url);if(url.includes('sp_take_rate_limit'))return response(true);if(url.includes('sp_shortlists?')){assert.match(url,/share_hash=eq\.[a-f0-9]{64}/);assert.match(url,/share_expires_at=gt/);return response([{title:'Private shortlist',profile_refs:[profile.reference],owner_id:owner}]);}if(url.includes('sp_public_discoveries?'))return response([]);if(url.includes('sp_profile_approvals?'))return response([{crm_slug:'PRIVATE_SLUG',revoked_at:new Date().toISOString()}]);assert.fail('Unexpected read');};
 const r=res();await handler(req('/api/shortlist/shared',{token:'a'.repeat(43)},false),r);assert.equal(r.statusCode,200);assert.deepEqual(JSON.parse(r.body).profiles,[]);assert.ok(!r.body.includes('PRIVATE_SLUG'));
}));
test('share rotation stores only a token hash and revoke removes access',()=>fixture(async()=>{
 let mutation;globalThis.fetch=async(url,opts)=>{if(String(url).endsWith('/auth/v1/user'))return response({id:owner,email_confirmed_at:'2026-10-01'});assert.match(String(url),new RegExp('owner_id=eq.'+owner));if(opts.method==='PATCH'){mutation=JSON.parse(opts.body);return new Response(null,{status:204});}return response([{id:item}]);};
 let r=res();await handler(req('/api/workspace/share',{id:item}),r);assert.equal(r.statusCode,200);const token=JSON.parse(r.body).url.split('/')[2];assert.equal(token.length,43);assert.equal(mutation.share_hash.length,64);assert.notEqual(mutation.share_hash,token);assert.ok(!JSON.stringify(mutation).includes(token));
 r=res();await handler(req('/api/workspace/revoke-share',{id:item}),r);assert.equal(r.statusCode,200);assert.equal(mutation.share_hash,null);assert.equal(mutation.share_expires_at,null);
}));
test('AI extraction sends only mandate text, bounds output and fails closed on invalid criteria or exhausted budget',()=>fixture(async()=>{
 let allowed=true,invalid=false,requests=0;globalThis.fetch=async(url,opts)=>{if(String(url).includes('sp_take_rate_limit'))return response(allowed);requests++;const b=JSON.parse(opts.body);assert.equal(b.max_tokens,650);assert.equal(b.response_format.type,'json_schema');assert.equal(b.response_format.json_schema.strict,true);assert.equal(b.messages.length,2);assert.equal(b.messages[1].content,'Compliance leaders in digital assets');assert.ok(!JSON.stringify(b).includes('PRIVATE_SLUG'));return response({choices:[{message:{content:JSON.stringify(invalid?{...criteria,requirements:['DROP TABLE']}:criteria)}}]});};
 assert.deepEqual((await interpretMandate('Compliance leaders in digital assets')).criteria,mandateCriteria(criteria));invalid=true;await assert.rejects(interpretMandate('Compliance leaders in digital assets'),/interpretation_unavailable/);allowed=false;await assert.rejects(interpretMandate('Compliance leaders in digital assets'),/interpretation_unavailable/);assert.equal(requests,2);
}));
test('requests never count as acceptances; cost and time saved are explicit reports',()=>{
 const rows=[{event_type:'search',created_at:'2026-10-29T10:00:00Z'},{event_type:'search',created_at:'2026-10-30T10:00:00Z'},{event_type:'introduction_requested'},{event_type:'delivery_recorded',minutes_saved:120,delivery_minutes:30,hourly_cost_gbp:100}];const m=summariseActivity(rows);assert.equal(m.introductionsAccepted,0);assert.equal(m.introductionsRequested,1);assert.equal(m.acceptedShortlists,0);assert.equal(m.recordedDeliveryCostGbp,50);assert.equal(m.reportedMinutesSaved,120);assert.equal(m.returnedOnAnotherDay,true);assert.equal(m.aiCostUsd,null);
});
test('confirmed outcomes are deduplicated, and unconfirmed or unrelated profile outcomes cannot be written',()=>fixture(async()=>{
 let writes=0;globalThis.fetch=async(url,opts)=>{if(String(url).endsWith('/auth/v1/user'))return response({id:owner,email_confirmed_at:'2026-10-01'});if(String(url).includes('sp_shortlists?'))return response([{id:item,profile_refs:[profile.reference]}]);if(String(url).includes('sp_activity?'))return response([{id:item}]);writes++;return new Response(null,{status:204});};
 for(const body of [{event_type:'shortlist_accepted',shortlist_id:item,confirmed:false},{event_type:'introduction_accepted',shortlist_id:item,confirmed:true,profile_ref:'SP-FFFFFFFFFFFFFFFF'}]){const r=res();await handler(req('/api/workspace/outcome',body),r);assert.equal(r.statusCode,400);}
 const r=res();await handler(req('/api/workspace/outcome',{event_type:'shortlist_accepted',shortlist_id:item,confirmed:true}),r);assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).alreadyRecorded,true);assert.equal(writes,0);
}));
test('out-of-coverage mandates avoid unrelated catalogue results and missing requirements are rejected',()=>fixture(async()=>{
 const {searchMandate}=await import('../lib/talent-search.mjs');globalThis.fetch=async()=>assert.fail('Out-of-scope mandate should not query candidates');
 const result=await searchMandate({...criteria,inScope:false});assert.deepEqual(result.profiles,[]);assert.match(result.message,/outside/);
 assert.throws(()=>mandateCriteria({...criteria,otherRequirements:{malformed:true}}));
}));
test('sign-out revokes the provider refresh session and clears the encrypted cookie',()=>fixture(async()=>{
 let revoked=false;globalThis.fetch=async(url,opts)=>{if(String(url).includes('sp_take_rate_limit'))return response(true);assert.ok(String(url).endsWith('/auth/v1/logout?scope=local'));assert.equal(opts.method,'POST');assert.equal(opts.headers.Authorization,'Bearer ACCESS');revoked=true;return new Response(null,{status:204});};const r=res();await handler(req('/api/workspace/auth',{action:'logout'}),r);assert.equal(r.statusCode,200);assert.equal(revoked,true);assert.match(r.headers['Set-Cookie'],/Max-Age=0/);
}));
