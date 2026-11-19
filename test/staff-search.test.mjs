import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerApi} from '../lib/partner-desk.mjs';
import {clientApi} from '../lib/client-journey.mjs';
import {stepImport} from '../lib/crm-import-job.mjs';
import {setShowDemoProfiles} from '../lib/demo-visibility.mjs';
import {db} from '../lib/services.mjs';
import {resetDemoStore} from '../lib/demo-store.mjs';
import {DEMO_CLIENT_ID,DEMO_RECRUITER_ID} from '../lib/demo-data.mjs';

const client={id:DEMO_CLIENT_ID,email:'client@demo.spearpoint.test'};
const partner={id:DEMO_RECRUITER_ID,email:'recruiter@demo.spearpoint.test',recruiter:true,owner:true};
function crmPerson(index){return {slug:`crm-${index}`,first_name:'Fictional',last_name:`Import ${index}`,current_organization:'Example Payments Desk',position:'Staff engineer',city:'Singapore',years:8,pay:180,skill:'platform, payments'};}

async function demo(fn){
 const previous={...process.env};
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.VERCEL_ENV;
 delete process.env.AI_GATEWAY_API_KEY;
 delete process.env.RECRUIT_CRM_API_KEY;
 process.env.RECRUIT_CRM_WRITE='false';
 Object.assign(process.env,{SPEARPOINT_DEMO:'true',RATE_LIMIT_HMAC_KEY:'demo-test-hmac-key-with-32-characters',CANDIDATE_IDENTITY_KEY:Buffer.alloc(32,7).toString('base64')});
 resetDemoStore();
 try{await fn();}finally{process.env=previous;resetDemoStore();}
}

test('staff search stays on imported rows, logs identity, and respects the demo switch',()=>demo(async()=>{
 await assert.rejects(partnerApi('/api/partner/staff-search',{query:'senior researcher london'},client),/staff_required/);
 const home=await partnerApi('/api/partner/home',{},partner);
 const shown=await partnerApi('/api/partner/staff-search',{query:'senior quant researcher, crypto market making, Dubai or London'},partner);
 assert.ok(shown.matches.length);
 assert.equal(shown.matches.every(row=>row.demo===true),true);
 const detail=await partnerApi('/api/partner/staff-candidate',{id:'c1000001-0000-4000-8000-000000000001'},partner);
 assert.equal(detail.candidate.identity.name,'Casey Moss');
 assert.match(detail.candidate.label,/Demo profile/);
 const audits=await db('sp_audit_log?action=eq.identity_view&limit=20');
 assert.ok(audits.length>=1);
 await setShowDemoProfiles(false);
 const hidden=await partnerApi('/api/partner/staff-search',{query:'senior quant researcher, crypto market making, Dubai or London'},partner);
 assert.equal(hidden.matches.length,0);
 const clientView=await clientApi('/api/client/search',{query:'senior quant researcher, crypto market making, Dubai or London'},client);
 assert.equal(clientView.matches.length,0);
 await setShowDemoProfiles(true);
 const added=await partnerApi('/api/partner/add-to-pipeline',{searchId:home.searches[0].id,candidateId:'c1000001-0000-4000-8000-000000000001',stage:'approached'},partner);
 assert.equal(added.stage,'approached');
 const portal=await clientApi('/api/client/search',{query:'senior quant researcher'},client);
 assert.equal(portal.matches.some(row=>row.identity),false);
}));

test('the RecruitCRM pull is read-only, paged and resumable',()=>demo(async()=>{
 const pages=[[crmPerson(1),crmPerson(2),crmPerson(3),crmPerson(4),crmPerson(5),crmPerson(6)],[]];
 let calls=0;
 const fetcher=async(page,watermark)=>{calls++;assert.equal(typeof watermark,'string');return {configured:true,records:pages[page-1]||[],next:page===1};};
 const first=await stepImport({fetcher,maxPages:1});
 assert.equal(first.status,'running');
 assert.equal(first.imported,6);
 const second=await stepImport({fetcher,maxPages:1});
 assert.equal(second.status,'complete');
 assert.equal(calls,2);
 const stored=await db('sp_candidates?source=eq.recruitcrm&publication=eq.unpublished&limit=20');
 assert.equal(stored.length,6);
 assert.equal(stored.every(row=>row.fictional===false),true);
 process.env.RECRUIT_CRM_WRITE='true';
 assert.equal((await stepImport({fetcher})).status,'blocked');
}));

test('an errored import resumes its page and a 429 is retried',()=>demo(async()=>{
 await db('sp_import_jobs',{method:'POST',body:{id:'a1000001-0000-4000-8000-0000000000aa',status:'error',page:13,imported:0,updated_count:184,skipped:116,last_error:'timeout',updated_at:new Date().toISOString()}});
 let calls=0;
 const fetcher=async page=>{calls++;if(calls===1)return {configured:true,rateLimited:true,retryAfter:0.01,records:[],next:true};assert.equal(page,13);return {configured:true,records:[],next:false};};
 const result=await stepImport({fetcher,budgetMs:5000});
 assert.equal(result.status,'complete');
 assert.equal(result.page,13);
 assert.equal(calls,2);
}));
