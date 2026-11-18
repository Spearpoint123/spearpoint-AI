import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptIdentity,decryptIdentity} from '../lib/candidate-crypto.mjs';
import {assertClientSources,databaseSource,rank} from '../lib/client-sources.mjs';
import {parseQueryFallback} from '../lib/client-search.mjs';
import {sampleCandidates} from '../lib/sample-candidates.mjs';
import {clientApi} from '../lib/client-journey.mjs';
import {resetDemoStore} from '../lib/demo-store.mjs';

const user={id:'11111111-1111-4111-8111-111111111111',email:'client@demo.spearpoint.test'};
const forbidden=/linkedin|university|@[a-z]|employer_name|first_name|photograph/i;

async function demo(fn){
 const previous={...process.env};
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.VERCEL_ENV;
 delete process.env.AI_GATEWAY_API_KEY;
 Object.assign(process.env,{SPEARPOINT_DEMO:'true',RATE_LIMIT_HMAC_KEY:'demo-test-hmac-key-with-32-characters',CANDIDATE_IDENTITY_KEY:Buffer.alloc(32,7).toString('base64')});
 resetDemoStore();
 try{await fn();}finally{process.env=previous;resetDemoStore();}
}

test('identity encryption round-trips and is not the plaintext',()=>{
 process.env.CANDIDATE_IDENTITY_KEY=Buffer.alloc(32,3).toString('base64');
 const secret={note:'fictional',city:'nowhere'};
 const stored=encryptIdentity(secret);
 assert.equal(stored.ciphertext.includes('nowhere'),false);
 assert.deepEqual(decryptIdentity(stored),secret);
 delete process.env.CANDIDATE_IDENTITY_KEY;
 assert.throws(()=>encryptIdentity(secret),/identity_key_missing/);
});

test('client search refuses licensed providers and hides identity fields',()=>{
 assert.throws(()=>assertClientSources([{id:'rocketreach',kind:'licensed'}]),/client_source_forbidden/);
 assert.throws(()=>assertClientSources([{id:'people_data_labs',kind:'internal'}]),/client_source_forbidden/);
 assert.throws(()=>assertClientSources([{id:'coresignal',kind:'internal'}]),/client_source_forbidden/);
 const source=databaseSource(sampleCandidates);
 assertClientSources([source]);
 const matches=source.search({level:'Senior',region:'Dubai or London',sector:'digital assets',firm_type:'crypto market maker',pay_band:'250–350',keywords:'quant market making'});
 assert.ok(matches.length<=10);
 assert.ok(matches.length>=3);
 for(const row of matches){
  assert.equal(forbidden.test(JSON.stringify(row)),false);
  assert.ok(row.why);
  assert.equal(typeof row.score,'number');
  assert.equal(row.name,undefined);
 }
 const thin=rank(sampleCandidates,{sector:'underwater baskets',keywords:'underwater'});
 assert.equal(thin.filter(row=>row.strong).length<3,true);
 const repeated=rank(sampleCandidates,{keywords:'research research'});
 assert.equal(repeated.some(row=>row.why.includes('research, research')),false);
});

test('a plain-English query becomes editable chips',()=>{
 const filters=parseQueryFallback('senior quant researcher, crypto market making, Dubai or London, $250-350K');
 assert.equal(filters.level,'Senior');
 assert.match(filters.region,/Dubai/);
 assert.match(filters.region,/London/);
 assert.equal(filters.pay_band,'250–350');
 assert.match(filters.firm_type,/market maker/);
 assert.equal(filters.sector,'digital assets');
 assert.equal(filters.years_bucket,'');
});

test('the client journey stays on the Spearpoint database and records the engagement',()=>demo(async()=>{
 const home=await clientApi('/api/client/bootstrap',{},user);
 assert.equal(home.organisation.verification_status,'pending');
 const brief=await clientApi('/api/client/brief',{title:'Head of quantitative research',function:'Quantitative research',seniority:'Senior',location:'Dubai or London',remote_policy:'Hybrid',base_pay:'250–350',total_pay:'400–600',must_haves:'crypto market making',nice_to_haves:'Python',target_firms:'crypto market makers',excluded_firms:'retail brokers',start_date:'Next quarter'},user);
 assert.equal(brief.profile.title,'Head of quantitative research');
 const savedProfile=await clientApi('/api/client/home',{},user);
 assert.equal(savedProfile.search.profile.title,'Head of quantitative research');
 assert.equal(savedProfile.search.status,'market_view');
 const market=await clientApi('/api/client/market',{},user);
 assert.ok(market.strongCount>=3);
 assert.ok(market.map.firm_type.length);
 assert.ok(market.matches.length<=10);
 assert.equal(JSON.stringify(market).includes('rocketreach'),false);
 const search=await clientApi('/api/client/search',{query:'senior quant researcher, crypto market making, Dubai or London, $250-350K'},user);
 assert.equal(search.filters.pay_band,'250–350');
 assert.equal(search.matches.every(row=>row.snapshot&&row.origin==='Spearpoint network'&&row.met>=0),true);
 assert.equal(search.matches.some(row=>row.summary||row.why||row.source),false);
 const saved=await clientApi('/api/client/save-search',{query:search.filters.region,filters:search.filters},user);
 assert.ok(saved.saved.id);
 const card=await clientApi('/api/client/candidate',{id:search.matches[0].id},user);
 assert.equal(card.identity,'hidden');
 assert.equal(card.candidate.snapshot.length>0,true);
 assert.equal(card.candidate.summary,undefined);
 const book=await clientApi('/api/client/book',{},user);
 assert.match(book.url,/meetings-eu1\.hubspot\.com/);
 assert.match(book.url,/email=/);
 const engagement=await clientApi('/api/client/engagement',{type:'single'},user);
 assert.equal(engagement.engagement.fee_percent,17.5);
 assert.equal(engagement.engagement.engagement_fee,5000);
 assert.equal(engagement.engagement.invoicing,'manual');
 const core=await clientApi('/api/client/engagement',{type:'core'},user);
 assert.equal(core.engagement.monthly_amount,3000);
 assert.equal(core.engagement.fee_percent,12.5);
}));
