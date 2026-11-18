import test from 'node:test';
import assert from 'node:assert/strict';
import {describeBlockedSignup,londonStamp,ownerReviewUrl,queueOwnerAlert,sendOwnerAlert,sendSignupDigest} from '../lib/owner-alert.mjs';
import {workspaceApi} from '../lib/workspace.mjs';

const env={SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',RATE_LIMIT_HMAC_KEY:'fixture-reference-key-more-than-thirty-two-characters',OWNER_ALERT_EMAIL:'sam@spearpointsearch.com',ALERT_FROM_EMAIL:'alerts@spearpointsearch.com',RESEND_API_KEY:'re_test_key',APP_ORIGIN:'https://ai.spearpointsearch.com',VERCEL:'1'};
async function withEnv(fn){const previous={...process.env},fetch=globalThis.fetch;Object.assign(process.env,env);try{await fn();}finally{globalThis.fetch=fetch;process.env=previous;for(const key of Object.keys(env))if(!(key in previous))delete process.env[key];}}
function logsOf(fn){const lines=[];const warn=console.warn;console.warn=(...args)=>{lines.push(args.map(String).join(' '));warn(...args);};return Promise.resolve().then(fn).finally(()=>{console.warn=warn;}).then(()=>lines);}

test('London timestamps name the zone and the owner link is /owner',()=>{
 assert.match(londonStamp(new Date('2026-01-15T12:00:00Z')),/Europe\/London/);
 assert.equal(ownerReviewUrl(),'https://ai.spearpointsearch.com/owner');
 assert.equal(describeBlockedSignup('person@gmail.com',true).personal,true);
 assert.equal(describeBlockedSignup('person@hays.com',true).agency,true);
 assert.equal(describeBlockedSignup('person@firm.example',false).reason,'not_direct_employer');
});

test('alerts are skipped without Resend and never call the network',()=>withEnv(async()=>{
 delete process.env.RESEND_API_KEY;let called=false;globalThis.fetch=async()=>{called=true;return Response.json({});};
 const lines=await logsOf(async()=>{const result=await sendOwnerAlert({outcome:'created',email:'person@firm.example',domain:'firm.example',domainState:'new',personal:false,agency:false,directEmployer:true,reason:'account_created'});assert.deepEqual(result,{sent:false,reason:'not_configured'});});
 assert.equal(called,false);assert.ok(lines.some(line=>line.startsWith('owner_alert_skipped')));
}));

test('a configured alert goes only to the owner, is deduped, and survives a provider failure',()=>withEnv(async()=>{
 let sends=0,allowed=true;globalThis.fetch=async(url,opts)=>{url=String(url);if(url.includes('sp_take_rate_limit'))return Response.json(allowed);if(url.includes('api.resend.com')){sends++;const body=JSON.parse(opts.body);assert.deepEqual(body.to,['sam@spearpointsearch.com']);assert.equal(body.to.includes('person@firm.example'),false);assert.match(body.text,/person@firm\.example/);assert.match(body.text,/\/owner/);assert.match(body.text,/Europe\/London/);assert.match(body.text,/Domain record: new/);return new Response('nope',{status:500});}assert.fail(url);};
 const lines=[];const warn=console.warn;console.warn=(...args)=>{lines.push(args.map(String).join(' '));};
 try{
 const failed=await sendOwnerAlert({outcome:'created',email:'person@firm.example',domain:'firm.example',domainState:'new',personal:false,agency:false,directEmployer:true,reason:'account_created'});
 assert.equal(failed.sent,false);assert.equal(failed.reason,'send_failed');assert.equal(sends,1);assert.ok(lines.some(line=>line.startsWith('owner_alert_failed')));
 allowed=false;globalThis.fetch=async url=>String(url).includes('sp_take_rate_limit')?Response.json(false):assert.fail(String(url));
 const again=await sendOwnerAlert({outcome:'blocked',email:'person@firm.example',domain:'firm.example',personal:true,agency:false,directEmployer:true,reason:'personal_email'});
 assert.equal(again.reason,'deduped');assert.equal(sends,1);assert.ok(lines.some(line=>line.includes('owner_alert_skipped deduped')));
 }finally{console.warn=warn;}
}));

test('the auth-hook digest sends one owner email and does not mail the applicants',()=>withEnv(async()=>{
 const rows=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@gmail.com',domain:'gmail.com',outcome:'blocked_personal',created_at:'2026-11-18T15:00:00Z'}];
 let marked=false;globalThis.fetch=async(url,opts)=>{url=String(url);if(url.includes('sp_signup_attempts')&&(!opts||opts.method==='GET'||!opts.method))return Response.json(rows);if(url.includes('api.resend.com')){const body=JSON.parse(opts.body);assert.deepEqual(body.to,['sam@spearpointsearch.com']);assert.match(body.text,/a@gmail.com/);assert.match(body.text,/\/owner/);assert.equal(body.to.includes('a@gmail.com'),false);return Response.json({id:'email'});}if(opts?.method==='PATCH'){marked=true;assert.match(url,/id=in\./);return new Response(null,{status:204});}assert.fail(url);};
 const result=await sendSignupDigest();assert.equal(result.sent,true);assert.equal(result.count,1);assert.equal(marked,true);
}));

test('signup still succeeds when the owner alert cannot be sent',()=>withEnv(async()=>{
 globalThis.fetch=async(url,opts)=>{url=String(url);if(url.includes('sp_take_rate_limit'))return Response.json(true);if(url.includes('sp_employer_domains'))return Response.json([]);if(url.includes('/auth/v1/signup'))return Response.json({id:'user',email:'person@firm.example'});if(url.includes('sp_register_employer_domain'))return Response.json(null);if(url.includes('api.resend.com'))return new Response('down',{status:503});assert.fail(url+' '+opts?.method);};
 let result;const lines=await logsOf(async()=>{result=await workspaceApi('/api/workspace/auth',{action:'signup',email:'person@firm.example',password:'Fixture-password-123',consent:true,directEmployer:true},{headers:{'x-vercel-forwarded-for':'127.0.0.1'}},{setHeader(){}});});
 assert.equal(result.confirmationRequired,true);assert.ok(lines.some(line=>line.startsWith('owner_alert_failed')));
}));

test('a blocked personal signup alerts the owner and still rejects the account',()=>withEnv(async()=>{
 let sent=false;globalThis.fetch=async(url,opts)=>{url=String(url);if(url.includes('sp_take_rate_limit'))return Response.json(true);if(url.includes('api.resend.com')){sent=true;const body=JSON.parse(opts.body);assert.deepEqual(body.to,['sam@spearpointsearch.com']);assert.match(body.text,/Personal email domain: yes/);assert.match(body.subject,/blocked signup/i);return Response.json({id:'email'});}assert.fail(url);};
 const lines=await logsOf(()=>assert.rejects(workspaceApi('/api/workspace/auth',{action:'signup',email:'person@gmail.com',password:'Fixture-password-123',consent:true,directEmployer:true},{headers:{'x-vercel-forwarded-for':'127.0.0.1'}},{setHeader(){}}),/work_email_required/));
 assert.equal(sent,true);assert.ok(lines.some(line=>line.startsWith('owner_alert_sent')));
}));

test('a stalled provider cannot hold signup open, and waitUntil receives the same send',()=>withEnv(async()=>{
 const symbol=Symbol.for('@vercel/request-context');const previous=globalThis[symbol];const kept=[];
 globalThis[symbol]={get:()=>({waitUntil(promise){kept.push(promise);}})};
 globalThis.fetch=async url=>{if(String(url).includes('sp_take_rate_limit'))return Response.json(true);return new Promise(()=>{});};
 const started=Date.now();
 try{await queueOwnerAlert({outcome:'blocked',email:'person@gmail.com',domain:'gmail.com',personal:true,agency:false,directEmployer:true,reason:'personal_email'},{timeoutMs:200});}
 finally{globalThis[symbol]=previous;}
 assert.ok(Date.now()-started<1000);assert.equal(kept.length,1);assert.equal(typeof kept[0].then,'function');
}));
