import test from 'node:test';
import assert from 'node:assert/strict';
import {generalise} from '../lib/anonymise.mjs';
import {mapCrmRecord,prepareImport,recruitCrmPull} from '../lib/crm-import.mjs';
import {adminApi} from '../lib/admin-desk.mjs';
import {publicTeaser} from '../lib/public-teaser.mjs';
import {searchPartnerProvider,partnerProviders} from '../lib/partner-sources.mjs';
import {assertClientSources} from '../lib/client-sources.mjs';
import {clientApi} from '../lib/client-journey.mjs';
import {decryptIdentity} from '../lib/candidate-crypto.mjs';
import {db} from '../lib/services.mjs';
import {resetDemoStore} from '../lib/demo-store.mjs';
import {DEMO_CLIENT_ID,DEMO_RECRUITER_ID} from '../lib/demo-data.mjs';

const client={id:DEMO_CLIENT_ID,email:'client@demo.spearpoint.test'};
const admin={id:DEMO_RECRUITER_ID,email:'recruiter@demo.spearpoint.test',owner:true,operator:true};
const recruiterOnly={id:DEMO_RECRUITER_ID,email:'recruiter@demo.spearpoint.test',recruiter:true};

function person(index){return {name:`Fictional Import ${index}`,first_name:'Fictional',last_name:`Import ${index}`,company:'Example Payments Desk',position:'Staff engineer',city:'Singapore',years:8,pay:180,skill:'platform, payments'};}

async function demo(fn){
 const previous={...process.env};
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.VERCEL_ENV;
 delete process.env.AI_GATEWAY_API_KEY;
 Object.assign(process.env,{SPEARPOINT_DEMO:'true',RATE_LIMIT_HMAC_KEY:'demo-test-hmac-key-with-32-characters',CANDIDATE_IDENTITY_KEY:Buffer.alloc(32,7).toString('base64')});
 resetDemoStore();
 try{await fn();}finally{process.env=previous;resetDemoStore();}
}

test('rare profiles are generalised or held back',()=>{
 const single=generalise([{level:'Senior',years_bucket:'20+ yrs',firm_type:'unique shop',region:'Zurich',sector:'macro',pay_band:'500 and above'}],[],5);
 assert.equal(single.rows.length,0);
 assert.equal(single.suppressed.length,1);
 const cluster=Array.from({length:6},()=>({level:'Staff',years_bucket:'5–10 yrs',firm_type:'payments firm',region:'Singapore',sector:'payments',pay_band:'150–200'}));
 assert.equal(generalise(cluster,[],5).rows.length,6);
});

test('a mapped CRM record keeps the name out of the anonymised profile',()=>{
 const mapped=mapCrmRecord(person(1));
 assert.equal(mapped.projection.publication,'unpublished');
 assert.equal(mapped.projection.summary.includes('Fictional'),false);
 assert.equal(mapped.identity.name.includes('Import'),true);
 assert.equal(recruitCrmPull().ran,false);
});

test('providers stay disabled and off the client path',async()=>{
 assert.equal(partnerProviders().every(row=>row.enabled===false&&row.configured===false),true);
 assert.equal((await searchPartnerProvider('rocketreach')).called,false);
 assert.equal((await searchPartnerProvider('coresignal')).records.length,0);
 assert.throws(()=>assertClientSources([{id:'rocketreach',kind:'licensed'}]),/client_source_forbidden/);
});

test('admin publishes an import and clients never see it before that',()=>demo(async()=>{
 await assert.rejects(adminApi('/api/admin/home',{},client),/owner_required/);
 await assert.rejects(adminApi('/api/admin/home',{},recruiterOnly),/owner_required/);
 const pulled=await adminApi('/api/admin/import',{pull:true},admin);
 assert.equal(pulled.ran,false);
 const home=await adminApi('/api/admin/home',{},admin);
 assert.equal(typeof home.report.mrr,'number');
 assert.equal(typeof home.report.churn,'number');
 await db('sp_organisations',{method:'POST',body:{id:'a2000001-0000-4000-8000-000000000001',domain:'harbour-lane.example',legal_name:'Harbour Lane Capital (fictional)',website:'',verification_status:'pending',created_at:new Date().toISOString()}});
 const reviewed=await adminApi('/api/admin/review',{domain:'harbour-lane.example',status:'approved',evidence:'Direct employer. The hiring manager is named and the role is live.',companyName:'Harbour Lane Capital'},admin);
 assert.equal(reviewed.status,'approved');
 const org=(await db('sp_organisations?domain=eq.harbour-lane.example&limit=1'))[0];
 assert.equal(org.verification_status,'verified');
 await db('sp_engagements',{method:'POST',body:{id:'a2000001-0000-4000-8000-000000000002',organisation_id:org.id,search_id:null,type:'single',label:'Single search',fee_percent:17.5,engagement_fee:5000,monthly_amount:3000,note:'',status:'recorded',invoicing:'manual',created_at:new Date().toISOString()}});
 const active=await adminApi('/api/admin/activate',{id:'a2000001-0000-4000-8000-000000000002'},admin);
 assert.equal(active.status,'active');
 const priced=await adminApi('/api/admin/price',{id:active.id,fee_percent:12.5,monthly_amount:3000,engagement_fee:0,note:'Core terms.'},admin);
 assert.equal(priced.monthly_amount,3000);
 const stored=await adminApi('/api/admin/import',{records:Array.from({length:6},(_,index)=>person(index+1))},admin);
 assert.equal(stored.ranLive,false);
 assert.equal(stored.imported,6);
 const hidden=await db('sp_candidates?publication=eq.unpublished&limit=20');
 assert.equal(hidden.length,6);
 const cipher=(await db(`sp_candidate_identity?candidate_id=eq.${stored.ids[0]}&limit=1`))[0];
 assert.equal(cipher.ciphertext.includes('Fictional'),false);
 assert.equal(decryptIdentity(cipher).name.includes('Import'),true);
 const teaser=await publicTeaser({query:'staff payments firm Singapore'});
 assert.equal(JSON.stringify(teaser).includes('Fictional Import'),false);
 assert.equal(teaser.cards.length<=3,true);
 const before=await clientApi('/api/client/search',{query:'staff payments firm Singapore'},client);
 assert.equal(before.matches.some(row=>stored.ids.includes(row.id)),false);
 const published=await adminApi('/api/admin/publish',{ids:stored.ids},admin);
 assert.equal(published.published,6);
 const after=await clientApi('/api/client/search',{query:'staff payments firm Singapore'},client);
 assert.equal(after.matches.some(row=>stored.ids.includes(row.id)),true);
 const logs=await db('sp_audit_log?action=eq.verification&limit=5');
 assert.equal(logs.length>=1,true);
}));
