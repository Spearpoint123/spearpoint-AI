import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerApi} from '../lib/partner-desk.mjs';
import {adminApi} from '../lib/admin-desk.mjs';
import {clientApi} from '../lib/client-journey.mjs';
import {partnerProviders,searchPartnerProvider,searchRocketReach} from '../lib/partner-sources.mjs';
import {forClients} from '../lib/demo-visibility.mjs';
import {db} from '../lib/services.mjs';
import {resetDemoStore} from '../lib/demo-store.mjs';
import {DEMO_CLIENT_ID,DEMO_RECRUITER_ID} from '../lib/demo-data.mjs';

const client={id:DEMO_CLIENT_ID,email:'client@demo.spearpoint.test'};
const partner={id:DEMO_RECRUITER_ID,email:'recruiter@demo.spearpoint.test',recruiter:true,owner:true};
const person={id:4242,name:'Example External',current_title:'Staff engineer',current_employer:'Example Desk Ltd',location:'London',emails:['hidden@example.invalid'],phones:['+440000000']};

async function demo(fn){
 const previous={...process.env};
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.VERCEL_ENV;
 delete process.env.ROCKETREACH_API_KEY;
 process.env.RECRUIT_CRM_WRITE='false';
 Object.assign(process.env,{SPEARPOINT_DEMO:'true',RATE_LIMIT_HMAC_KEY:'demo-test-hmac-key-with-32-characters',CANDIDATE_IDENTITY_KEY:Buffer.alloc(32,7).toString('base64')});
 resetDemoStore();
 try{await fn();}finally{process.env=previous;resetDemoStore();}
}

test('RocketReach stays disconnected and off the client path until a key exists',()=>demo(async()=>{
 assert.equal(partnerProviders().find(row=>row.id==='rocketreach').enabled,false);
 assert.equal(partnerProviders().filter(row=>row.id!=='rocketreach').every(row=>row.enabled===false),true);
 assert.equal((await searchPartnerProvider('rocketreach')).called,false);
 const closed=await searchRocketReach(partner,'senior researcher london');
 assert.equal(closed.called,false);
 assert.equal(closed.notice,'RocketReach not connected');
 assert.equal(forClients([{id:'x',source:'rocketreach',publication:'published',fictional:false}],true).length,0);
}));

test('a RocketReach lookup is audited, unpublished, and invisible to clients',()=>demo(async()=>{
 process.env.ROCKETREACH_API_KEY='fixture-key';
 const fetcher=async(url,options)=>{
  assert.equal(new URL(url).hostname,'api.rocketreach.co');
  assert.equal(options.headers['Api-Key'],'fixture-key');
  assert.equal(options.redirect,'error');
  return {ok:true,status:200,headers:{get:name=>name==='x-credits-remaining'?'40':name==='x-credits-used'?'2':null},json:async()=>({profiles:[person],credit_usage:{remaining:40,used:2}})};
 };
 const found=await searchRocketReach(partner,'senior researcher london',{fetcher});
 assert.equal(found.called,true);
 assert.equal(found.count,1);
 assert.equal(found.records[0].label,'External: RocketReach');
 assert.equal(found.credits.remaining,40);
 assert.equal(JSON.stringify(found).includes('hidden@example.invalid'),false);
 assert.equal(JSON.stringify(found).includes('+440000000'),false);
 const audits=await db('sp_audit_log?action=eq.provider_lookup&limit=5');
 assert.equal(audits.length,1);
 assert.equal(JSON.stringify(audits[0].meta).includes('Example External'),false);
 const saved=await partnerApi('/api/partner/external-import',found.records[0],partner);
 assert.equal(saved.publication,'unpublished');
 assert.equal(saved.source,'rocketreach');
 const stored=await db(`sp_candidates?id=eq.${saved.id}&limit=1`);
 assert.equal(stored[0].publication,'unpublished');
 assert.equal(stored[0].fictional,false);
 const clientView=await clientApi('/api/client/search',{query:'staff engineer london'},client);
 assert.equal(JSON.stringify(clientView).includes('Example External'),false);
 assert.equal(JSON.stringify(clientView).includes('rocketreach'),false);
 const refused=await adminApi('/api/admin/publish',{ids:[saved.id]},partner);
 assert.equal(refused.published,0);
 assert.equal(refused.suppressed.includes(saved.id),true);
 const still=await db(`sp_candidates?id=eq.${saved.id}&select=publication&limit=1`);
 assert.equal(still[0].publication,'unpublished');
}));
