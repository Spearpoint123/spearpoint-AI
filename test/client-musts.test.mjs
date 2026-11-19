import test from 'node:test';
import assert from 'node:assert/strict';
import {assertClientSources} from '../lib/client-sources.mjs';
import {suggestMustHaves,scoreMustHaves} from '../lib/must-haves.mjs';
import {templateSnapshot} from '../lib/snapshot.mjs';
import {snapshotFromRocketReach,widerForClient,scrubClient} from '../lib/client-external.mjs';
import {clientApi} from '../lib/client-journey.mjs';
import {db} from '../lib/services.mjs';
import {resetDemoStore} from '../lib/demo-store.mjs';
import {sampleCandidates} from '../lib/sample-candidates.mjs';

const user={id:'11111111-1111-4111-8111-111111111111',email:'client@demo.spearpoint.test'};
const leak=/@[a-z0-9.-]+\.[a-z]{2,}|linkedin\.com|https?:\/\/|rocketreach|Secret Desk|Ada Example|\+447/i;

async function demo(fn){
 const previous={...process.env};
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.VERCEL_ENV;
 delete process.env.AI_GATEWAY_API_KEY;
 delete process.env.ROCKETREACH_API_KEY;
 Object.assign(process.env,{SPEARPOINT_DEMO:'true',RATE_LIMIT_HMAC_KEY:'demo-test-hmac-key-with-32-characters',CANDIDATE_IDENTITY_KEY:Buffer.alloc(32,7).toString('base64')});
 resetDemoStore();
 try{await fn();}finally{process.env=previous;resetDemoStore();}
}

test('must-haves are suggested from the role and rank ahead of score',()=>{
 const suggestions=suggestMustHaves('Head of Quant Research, Dubai',{level:'Director',region:'Dubai'});
 assert.equal(suggestions.length,3);
 assert.match(suggestions[0],/Quant Research/);
 assert.match(suggestions.join(' '),/Dubai/);
 const strong={level:'Senior',region:'Dubai',firm_type:'crypto market maker',summary:'Quantitative research lead. Dubai.',skills:['research'],score:10};
 const weak={level:'Staff',region:'London',firm_type:'payments firm',summary:'Payments platform.',skills:['platform'],score:90};
 const high=scoreMustHaves(strong,suggestions);
 const low=scoreMustHaves(weak,suggestions);
 assert.equal(high.count>low.count,true);
 const ranked=[
  {...weak,met:low.count},
  {...strong,met:high.count}
 ].sort((a,b)=>b.met-a.met||b.score-a.score);
 assert.equal(ranked[0].region,'Dubai');
});

test('a snapshot stays on structured fields',()=>{
 const text=templateSnapshot(sampleCandidates[0]);
 assert.match(text,/Senior/);
 assert.match(text,/Crypto market maker in Dubai/);
 assert.doesNotMatch(text,/\. crypto/);
 assert.match(text,/Pay band/);
 assert.equal(leak.test(text),false);
});

test('client search can take a RocketReach snapshot and nothing identifying',()=>{
 assert.throws(()=>assertClientSources([{id:'rocketreach',kind:'licensed'}]),/client_source_forbidden/);
 assert.throws(()=>assertClientSources([{id:'rocketreach',kind:'snapshot',label:'Wider market'}]),/client_source_forbidden/);
 assert.throws(()=>assertClientSources([{id:'people_data_labs',kind:'snapshot'}],{clientSearch:true}),/client_source_forbidden/);
 assert.throws(()=>assertClientSources([{id:'coresignal',kind:'internal'}],{clientSearch:true}),/client_source_forbidden/);
 assertClientSources([{id:'rocketreach',kind:'snapshot',label:'Wider market'}],{clientSearch:true});
 const card=snapshotFromRocketReach({id:4242,name:'Ada Example',current_title:'Staff engineer',current_employer:'Secret Desk Ltd',location:'London',industry:'Payments',job_history:[{start_date:'2016-01-01',title:'Engineer',company_name:'Secret Desk Ltd'}],emails:['ada@secret.example'],phones:['+447700900123'],linkedin_url:'https://www.linkedin.com/in/ada-example'});
 assert.match(card.years_bucket,/yrs/);
 assert.equal(card.region,'London');
 const packed=JSON.stringify(scrubClient(card));
 assert.equal(leak.test(packed),false);
 assert.equal(packed.includes('Ada'),false);
 assert.equal(packed.includes('Secret'),false);
});

test('an anonymous visitor gets one live wider-market lookup, then a verified email is required',()=>demo(async()=>{
 process.env.ROCKETREACH_API_KEY='fixture-key';
 let calls=0;
 const fetcher=async()=>{
  calls+=1;
  return {ok:true,status:200,headers:{get:name=>name==='x-credits-remaining'?'12':null},json:async()=>({profiles:[{id:9,name:'Ada Example',current_title:'Senior researcher',current_employer:'Secret Desk Ltd',location:'Dubai',emails:['ada@secret.example'],phones:['+447700900123'],linkedin_url:'https://www.linkedin.com/in/ada'}],credit_usage:{remaining:12}})};
 };
 const cohort=sampleCandidates.filter(row=>row.region==='Dubai'&&row.firm_type==='crypto market maker');
 const first=await widerForClient({query:'senior researcher dubai',cohort,anonymous:true,ip:'203.0.113.8',fetcher});
 const second=await widerForClient({query:'staff engineer london',cohort,anonymous:true,ip:'203.0.113.8',fetcher});
 const repeat=await widerForClient({query:'senior researcher dubai',cohort,anonymous:true,ip:'203.0.113.8',fetcher});
 assert.equal(calls,1);
 assert.equal(second.rows.length,0);
 assert.equal(second.status,'verification_required');
 assert.equal(repeat.status,'cached');
 assert.equal(leak.test(JSON.stringify(first.rows)),false);
 assert.equal(leak.test(JSON.stringify(repeat.rows)),false);
 const audits=await db('sp_audit_log?action=eq.provider_lookup&limit=5');
 assert.equal(audits.length,1);
 assert.equal(audits[0].meta.credits.remaining,12);
 assert.equal(JSON.stringify(audits[0].meta).includes('Ada'),false);
 const cached=await db('sp_external_cache?limit=5');
 assert.equal(JSON.stringify(cached).includes('Ada'),false);
 assert.equal(JSON.stringify(cached).includes('Secret'),false);
 const signedIn=await clientApi('/api/client/search',{query:'Head of Quant Research, Dubai',must_haves:['Quantitative research','Dubai','Crypto']},user);
 assert.equal(signedIn.must_haves.length,3);
 assert.equal(signedIn.matches.every(row=>row.snapshot&&Array.isArray(row.musts)),true);
 assert.equal(JSON.stringify(signedIn).includes('rocketreach'),false);
 const home=await clientApi('/api/client/home',{},user);
 assert.deepEqual(home.search.profile.must_have_items,signedIn.must_haves);
}));
