import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {clientApi} from '../lib/client-journey.mjs';
import {nextCallDate} from '../lib/weekly-call.mjs';
import {resetDemoStore} from '../lib/demo-store.mjs';
import {db} from '../lib/services.mjs';
import {DEMO_CLIENT_ID,DEMO_PORTAL_ID} from '../lib/demo-data.mjs';
import {SAMPLE_IDENTITY} from '../lib/portal-sample.mjs';

const client={id:DEMO_CLIENT_ID,email:'client@demo.spearpoint.test'};
const portalUser={id:DEMO_PORTAL_ID,email:'portal@harbour-lane.example'};
const forbidden=/linkedin|university|@[a-z]|employer_name|first_name|photograph/i;

async function demo(fn){
 const previous={...process.env};
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.VERCEL_ENV;
 delete process.env.AI_GATEWAY_API_KEY;
 delete process.env.HUBSPOT_MEETINGS_AUTOBOOK;
 Object.assign(process.env,{SPEARPOINT_DEMO:'true',RATE_LIMIT_HMAC_KEY:'demo-test-hmac-key-with-32-characters',CANDIDATE_IDENTITY_KEY:Buffer.alloc(32,7).toString('base64')});
 resetDemoStore();
 try{await fn();}finally{process.env=previous;resetDemoStore();}
}

test('the next weekly call stays on a seven-day cadence',()=>{
 const next=nextCallDate('2026-11-11T09:00:00.000Z',new Date('2026-11-18T17:00:00.000Z'));
 assert.equal(next,'2026-11-25T09:00:00.000Z');
});

test('an unverified employer sees the closed portal and cannot raise a request',()=>demo(async()=>{
 const closed=await clientApi('/api/client/portal',{},client);
 assert.equal(closed.gate,'verification_pending');
 assert.equal(closed.pipeline,null);
 await assert.rejects(clientApi('/api/client/portal/request',{type:'pause',body:'Pause this search please.'},client),/verification_pending/);
 const org=(await db('sp_organisations?domain=eq.demo.spearpoint.test&limit=1'))[0];
 await db(`sp_organisations?id=eq.${org.id}`,{method:'PATCH',body:{verification_status:'verified',legal_name:'Demo Capital (fictional)'}});
 await db('sp_engagements',{method:'POST',body:{id:randomUUID(),organisation_id:org.id,search_id:null,type:'single',label:'Single search',fee_percent:17.5,engagement_fee:5000,monthly_amount:0,note:'',status:'recorded',invoicing:'manual',created_at:new Date().toISOString()}});
 const recorded=await clientApi('/api/client/portal',{},client);
 assert.equal(recorded.gate,'engagement_required');
 assert.equal(recorded.pipeline,null);
}));

test('the live portal stays anonymised unless a reveal is approved and audited',()=>demo(async()=>{
 const view=await clientApi('/api/client/portal',{},portalUser);
 assert.equal(view.gate,null);
 assert.equal(view.organisation.verification_status,'verified');
 assert.equal(view.engagement.status,'active');
 assert.deepEqual(view.stages,['approached','interested','shortlisted','interviewing','offer','hired']);
 assert.equal(view.pipeline.length,6);
 assert.equal(view.activity.some(row=>row.summary.includes('approached')),true);
 assert.equal(view.activity.some(row=>row.summary.includes(SAMPLE_IDENTITY.name)),false);
 assert.match(view.call.meeting_url,/hubspot\.com/);
 assert.equal(view.call.mode,'reminder');
 assert.ok(Date.parse(view.call.starts_at)>Date.now());
 const shown=view.pipeline.find(row=>row.identity_state==='shown');
 assert.equal(shown.stage,'interested');
 assert.deepEqual(shown.identity,SAMPLE_IDENTITY);
 const hidden=view.pipeline.filter(row=>row.stage!=='interested');
 assert.equal(hidden.every(row=>row.identity===null&&row.identity_state==='pending'),true);
 assert.equal(forbidden.test(JSON.stringify(hidden)),false);
 const saved=view.requests.find(row=>row.type==='add_candidate');
 assert.equal(saved.status,'in_progress');
 assert.equal(saved.history.length,2);
 await assert.rejects(clientApi('/api/client/portal',{searchId:'b1000001-0000-4000-8000-000000000099'},portalUser),/not_found/);
 const opened=await clientApi('/api/client/portal/request',{type:'move_interview',body:'Move the interview to next week.',searchId:view.search.id},portalUser);
 assert.equal(opened.request.status,'open');
 assert.equal(opened.requests.find(row=>row.id===opened.request.id).history[0].note,'Opened.');
 const moved=await clientApi('/api/client/portal/call',{starts_at:new Date(Date.now()+3*86400000).toISOString(),searchId:view.search.id},portalUser);
 assert.ok(moved.call.previous_id);
 const file=await clientApi('/api/client/portal/export',{searchId:view.search.id},portalUser);
 assert.equal(file.audit.action,'export');
 assert.equal(file.rows.filter(row=>row.identity).length,1);
 assert.equal(file.rows.find(row=>row.identity).identity.name,SAMPLE_IDENTITY.name);
 const audits=await db(`sp_audit_log?action=eq.export&entity=eq.export:${view.search.id}&limit=5`);
 assert.equal(audits.length,1);
 process.env.HUBSPOT_MEETINGS_AUTOBOOK='true';
 const flagged=await clientApi('/api/client/portal',{},portalUser);
 assert.equal(flagged.call.mode,'autobook_unavailable');
 assert.match(flagged.call.notice,/not connected/);
 assert.equal(JSON.stringify(flagged.matches).includes('rocketreach'),false);
}));
