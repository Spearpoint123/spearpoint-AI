import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerApi,deskSignals} from '../lib/partner-desk.mjs';
import {consentApi} from '../lib/candidate-consent.mjs';
import {clientApi} from '../lib/client-journey.mjs';
import {planSync,applySync} from '../lib/crm-sync.mjs';
import {sendPartnerMail,summaryFallback,benchmarkOffer} from '../lib/partner-tools.mjs';
import {db} from '../lib/services.mjs';
import {resetDemoStore} from '../lib/demo-store.mjs';
import {DEMO_CLIENT_ID,DEMO_PORTAL_ID,DEMO_RECRUITER_ID} from '../lib/demo-data.mjs';
import {sampleCandidates} from '../lib/sample-candidates.mjs';

const client={id:DEMO_CLIENT_ID,email:'client@demo.spearpoint.test'};
const portalUser={id:DEMO_PORTAL_ID,email:'portal@harbour-lane.example'};
const partner={id:DEMO_RECRUITER_ID,email:'recruiter@demo.spearpoint.test',recruiter:true};
const approached='c1000001-0000-4000-8000-000000000001';

async function demo(fn){
 const previous={...process.env};
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 delete process.env.VERCEL_ENV;
 delete process.env.AI_GATEWAY_API_KEY;
 delete process.env.PARTNER_OUTREACH_FROM;
 delete process.env.RESEND_API_KEY;
 process.env.RECRUIT_CRM_WRITE='false';
 Object.assign(process.env,{SPEARPOINT_DEMO:'true',RATE_LIMIT_HMAC_KEY:'demo-test-hmac-key-with-32-characters',CANDIDATE_IDENTITY_KEY:Buffer.alloc(32,7).toString('base64'),APP_ORIGIN:'http://127.0.0.1:3000'});
 resetDemoStore();
 try{await fn();}finally{process.env=previous;resetDemoStore();}
}

test('desk signals mark an old request overdue and name the next action',()=>{
 const signal=deskSignals({requests:[{status:'open',created_at:new Date(Date.now()-3*86400000).toISOString()}],pipeline:[],nowMs:Date.now()});
 assert.equal(signal.overdue,true);
 assert.equal(signal.next,'Answer the request.');
});

test('RecruitCRM wins a stage conflict and the desk does not write',async()=>{
 const plan=planSync({localStage:'interested',remoteStage:'hired'});
 assert.equal(plan.winner,'recruitcrm');
 assert.equal(plan.stage,'hired');
 let called=0;
 process.env.RECRUIT_CRM_WRITE='false';
 assert.equal((await applySync(plan,{fetcher:()=>{called++;}})).written,false);
 process.env.RECRUIT_CRM_WRITE='true';
 assert.equal((await applySync(plan)).written,false);
 assert.equal((await applySync(plan,{fetcher:()=>{called++;}})).written,true);
 assert.equal(called,1);
 delete process.env.RECRUIT_CRM_WRITE;
});

test('outreach mail is sent only from the verified partner address',async()=>{
 let called=0;
 const fetcher=async()=>{called++;return {ok:true,json:async()=>({id:'mail-1'})};};
 process.env.RESEND_API_KEY='test-key';
 process.env.PARTNER_OUTREACH_FROM='recruiter@demo.spearpoint.test';
 assert.equal((await sendPartnerMail({from:'other@example.invalid',to:'a@example.invalid',subject:'Note',text:'Hello',fetcher})).sent,false);
 assert.equal(called,0);
 assert.equal((await sendPartnerMail({from:'recruiter@demo.spearpoint.test',to:'a@example.invalid',subject:'Note',text:'Hello',fetcher})).sent,true);
 assert.equal(called,1);
 delete process.env.RESEND_API_KEY;
 delete process.env.PARTNER_OUTREACH_FROM;
});

test('a partner can run the desk and a candidate can approve one employer',()=>demo(async()=>{
 await assert.rejects(partnerApi('/api/partner/home',{},client),/staff_required/);
 const home=await partnerApi('/api/partner/home',{},partner);
 assert.equal(home.searches.length,1);
 assert.equal(home.searches[0].overdue,true);
 assert.match(home.sources,/not connected/);
 assert.equal(JSON.stringify(home).includes('rocketreach'),false);
 const searchId=home.searches[0].id;
 const offer=sampleCandidates.find(row=>row.pay_band==='200–250').id;
 process.env.RECRUIT_CRM_WRITE='true';
 const moved=await partnerApi('/api/partner/stage',{searchId,candidateId:offer,stage:'interested',remoteStage:'offer'},partner);
 assert.equal(moved.stage,'offer');
 assert.equal(moved.sync.written,false);
 assert.equal(moved.sync.reason,'not_wired');
 const lines=await db(`sp_search_activity?search_id=eq.${searchId}&order=created_at.desc&limit=5`);
 assert.equal(lines.some(row=>row.summary==='A profile moved to offer.'),true);
 assert.equal(lines.some(row=>/Casey Moss|Rowan Pell/.test(row.summary)),false);
 const note=await partnerApi('/api/partner/note',{searchId,kind:'interview',body:'Interview preparation for the anonymised profile.'},partner);
 assert.equal(note.note.kind,'interview');
 const request=home.requests[0];
 await partnerApi('/api/partner/request',{searchId,requestId:request.id,status:'in_progress',note:'A partner will reply tomorrow.'},partner);
 const portal=await clientApi('/api/client/portal',{},portalUser);
 const saved=portal.requests.find(row=>row.id===request.id);
 assert.equal(saved.history.some(row=>row.note==='A partner will reply tomorrow.'),true);
 assert.equal(portal.pipeline.find(row=>row.id===approached).identity,null);
 const time=await partnerApi('/api/partner/time',{searchId,hours:1.5,worked_on:new Date(Date.now()-86400000).toISOString().slice(0,10),note:'Preparation'},partner);
 assert.equal(time.entry.hours,1.5);
 const drafted=await partnerApi('/api/partner/draft',{searchId,candidateId:approached},partner);
 assert.equal(drafted.draft.model,'deterministic');
 assert.equal(drafted.draft.body.includes('Casey'),false);
 assert.equal((await partnerApi('/api/partner/send',{searchId,draftId:drafted.draft.id,confirm:false,to:'a@example.invalid'},partner)).sent,false);
 assert.equal((await partnerApi('/api/partner/send',{searchId,draftId:drafted.draft.id,confirm:true,to:'a@example.invalid'},partner)).reason,'not_configured');
 const interview=await partnerApi('/api/partner/interview',{searchId,slots:[new Date(Date.now()+4*86400000).toISOString()]},partner);
 assert.match(interview.interview.meeting_url,/hubspot\.com/);
 assert.match(interview.interview.notice,/not emailed|Nothing is booked/i);
 const summary=await partnerApi('/api/partner/summary',{searchId,text:'The hiring manager wants a senior researcher. Next, book the weekly call.'},partner);
 assert.equal(summary.model,'deterministic');
 assert.ok(summary.next_steps.length);
 const bench=await partnerApi('/api/partner/benchmark',{searchId,amount:300,level:'Senior'},partner);
 assert.ok(bench.inside>=1);
 assert.match(bench.note,/Spearpoint/);
 const link=await partnerApi('/api/partner/reveal-link',{searchId,candidateId:approached},partner);
 assert.equal(link.emailed,false);
 const token=new URL(link.url).searchParams.get('token');
 const pending=await consentApi({token});
 assert.equal(pending.decision,'pending');
 assert.equal(JSON.stringify(pending).includes('250'),false);
 const approved=await consentApi({token,decision:'approve'});
 assert.equal(approved.decision,'approved');
 const shown=await clientApi('/api/client/portal',{},portalUser);
 assert.equal(shown.pipeline.find(row=>row.id===approached).identity.name,'Casey Moss');
 const withdrawn=await consentApi({token,decision:'withdraw'});
 assert.equal(withdrawn.decision,'withdrawn');
 const hidden=await clientApi('/api/client/portal',{},portalUser);
 assert.equal(hidden.pipeline.find(row=>row.id===approached).identity,null);
 await assert.rejects(consentApi({token:'abc'}),/not_found/);
 const shaped=summaryFallback('Next, send the note.');
 assert.equal(shaped.next_steps[0].includes('Next'),true);
 const offerBench=benchmarkOffer(300,[{level:'Senior',pay_band:'250–350'}],'Senior');
 assert.equal(offerBench.inside,1);
}));
