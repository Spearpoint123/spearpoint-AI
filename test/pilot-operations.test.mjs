import test from 'node:test';import assert from 'node:assert/strict';
import {workspaceApi} from '../lib/workspace.mjs';
import {ownerApi,requestProfile,searchFeedback,recordSearchRun,acceptShortlist,downloadCandidateCv} from '../lib/pilot-operations.mjs';
import {candidateResumeUrl} from '../lib/services.mjs';
import {networkDiscoveries,visibleNetworkRows} from '../lib/talent-network.mjs';
import {researchDiscoveries,researchProjection} from '../lib/profile-research.mjs';
import {workspaceUser,workspaceCookie} from '../lib/workspace-auth.mjs';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',other='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const user={id:userId,owner:true},reference='SP-1234567890ABCDEF';
const criteria={role:'Chief Technology Officer',mustHaves:['Rust systems experience','FIX protocol delivery','Led a team of 18 engineers']};
const response=x=>new Response(JSON.stringify(x));
async function fixture(fn){const old=globalThis.fetch,env={...process.env};Object.assign(process.env,{SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',AI_GATEWAY_API_KEY:'fixture',RATE_LIMIT_HMAC_KEY:'fixture-reference-key-more-than-thirty-two-characters'});try{await fn();}finally{globalThis.fetch=old;process.env=env;}}
test('every owner action rejects employers and specialist-only accounts before reading data',()=>fixture(async()=>{globalThis.fetch=async()=>assert.fail('Reached storage');for(const action of ['overview','candidate','candidate-review','request-update','pilot','cv','request-profile','search-cost'])for(const account of [{id:userId},{id:userId,operator:true}])await assert.rejects(ownerApi(action,{id},account),/owner_required/);}));
test('user-editable metadata cannot grant owner privileges',()=>fixture(async()=>{
 globalThis.fetch=async()=>response({id:userId,email:'fixture@example.com',email_confirmed_at:new Date().toISOString(),user_metadata:{spearpoint_owner:true},app_metadata:{}});const headers={cookie:workspaceCookie({access_token:'fixture',refresh_token:'fixture'})};const resolved=await workspaceUser({headers},{setHeader(){}});assert.equal(resolved.owner,false);assert.equal(resolved.operator,false);
}));
test('owner overview only returns allowlisted auth fields, never credentials or metadata',()=>fixture(async()=>{
 globalThis.fetch=async url=>String(url).includes('/auth/v1/')?response({users:[{id:userId,email:'person@example.com',created_at:'date',email_confirmed_at:'date',last_sign_in_at:'date',encrypted_password:'SECRET_PASSWORD',app_metadata:{secret:'PRIVATE'}}]}):response([]);
 const d=await ownerApi('overview',{},user);assert.equal(d.accounts[0].email,'person@example.com');assert.ok(!/SECRET|PRIVATE|encrypted_password|app_metadata/.test(JSON.stringify(d)));
}));
test('talent-network discovery reads only current reviewed copies, not CVs or identities',()=>fixture(async()=>{
 globalThis.fetch=async url=>{const u=String(url);assert.ok(u.includes('status=eq.verified')&&u.includes('matching_approved=eq.true')&&u.includes('email_verified=eq.true'));assert.ok(!u.includes('cv_text'));return response([{id,approved_copy:{title:'CTO',summary:'Built Rust systems. Delivered a FIX protocol gateway. Led a team of 18 engineers.',focus:['Rust','FIX']},ai_matching_consent:false}]);};
 const rows=await networkDiscoveries(criteria);assert.equal(rows.length,1);assert.equal(rows[0]._assessmentAllowed,false);assert.equal(rows[0].person_name,'');assert.equal(rows[0].provider,'talent_network');
}));
test('withheld candidate AI permission prevents all model calls and cannot manufacture a match',()=>fixture(async()=>{
 globalThis.fetch=async()=>assert.fail('No provider or budget call expected');const records=await researchDiscoveries(criteria,[{source:'internal',provider:'talent_network',_assessmentAllowed:false,_professionalRecord:{summary:'Built Rust systems. Delivered a FIX protocol gateway. Led a team of 18 engineers.'}}],{generate:async()=>assert.fail('Sent candidate material without permission')});const safe=researchProjection(records[0],criteria);assert.equal(safe.researchMethod,'candidate_ai_not_permitted');assert.equal(safe.mustHaveSupported,0);assert.equal(safe.researchStatus,'research_queue');assert.ok(!('_assessmentAllowed' in records[0]));
}));
test('withdrawn network approvals disappear from saved discoveries',()=>fixture(async()=>{
 globalThis.fetch=async()=>response([]);const ordinary={id:'ordinary',sources:[]},network={id:'network',sources:[{kind:'talent_network',submission_id:id}]};assert.deepEqual(await visibleNetworkRows([ordinary,network]),[ordinary]);
}));
test('candidate approval requires verified identity and removes identifying names from reviewed copy',()=>fixture(async()=>{
 const row={id,full_name:'Jane Example'};let writes=0;globalThis.fetch=async(url,opts)=>{if(opts.method==='POST'||opts.method==='PATCH')writes++;return response([row]);};
 const valid={id,status:'verified',confirmed:true,title:'Chief Technology Officer',family:'technology',summary:'Built Rust systems and delivered a FIX gateway.',skills:'Rust, FIX',locations:'London',verificationEvidence:'Identity and email ownership verified directly with candidate.',identityVerified:true,anonymisationReviewed:true};
 await assert.rejects(ownerApi('candidate-review',{...valid,identityVerified:false},user),/permission_required/);await assert.rejects(ownerApi('candidate-review',{...valid,summary:'Jane Example built Rust systems.'},user),/anonymisation_required/);assert.equal(writes,0);await ownerApi('candidate-review',valid,user);assert.equal(writes,2);
}));
test('profile requests require an owned search and never count as agreement or send messages',()=>fixture(async()=>{
 let seen=[];globalThis.fetch=async(url,opts)=>{const u=String(url);seen.push(u);if(u.includes('sp_search_runs')){assert.ok(u.includes('owner_id=eq.'+userId));return response([]);}return response([]);};await assert.rejects(requestProfile({search_id:id,reference,confirmed:true},user),/not_found/);assert.equal(seen.length,1);
 seen=[];let saved;globalThis.fetch=async(url,opts)=>{const u=String(url);seen.push(u);if(u.includes('sp_search_runs'))return response([{id}]);if(u.includes('sp_public_discoveries'))return response([{reference,sources:[]}]);if(opts.method==='POST'){saved=JSON.parse(opts.body);return response(null);}return response([]);};const result=await requestProfile({search_id:id,reference,confirmed:true},user);assert.equal(result.status,'requested');assert.equal(saved.owner_id,userId);assert.ok(!saved.permission_evidence);assert.ok(seen.every(u=>u.startsWith(process.env.SUPABASE_URL+'/rest/v1/')));
}));
test('introduction status cannot skip candidate permission and completion uses a checked transition',()=>fixture(async()=>{
 let row={id,status:'requested'},writes=0;globalThis.fetch=async(url,opts)=>{if(opts.method==='PATCH'){writes++;assert.ok(String(url).includes('status=eq.candidate_agreed'));return response([row]);}if(opts.method==='POST')return response(null);return response([row]);};await assert.rejects(ownerApi('request-update',{id,status:'introduced',confirmed:true},user),/permission_required/);row={id,status:'reviewing'};await assert.rejects(ownerApi('request-update',{id,status:'candidate_agreed',confirmed:true,permissionEvidence:''},user),/validation/);assert.equal(writes,0);row={id,status:'candidate_agreed',permission_evidence:'Candidate expressly agreed to this introduction.'};await ownerApi('request-update',{id,status:'introduced',confirmed:true},user);assert.equal(writes,1);
}));
test('feedback is owner-scoped and missing delivery costs cannot silently become zero',()=>fixture(async()=>{
 globalThis.fetch=async(url,opts)=>{assert.ok(String(url).includes('owner_id=eq.'+userId));assert.equal(JSON.parse(opts.body).employer_feedback,'useful');return response([]);};await assert.rejects(searchFeedback({search_id:id,feedback:'useful'},user),/not_found/);await assert.rejects(ownerApi('search-cost',{id,staffMinutes:'',providerCost:''},user),/validation/);
}));
test('a positive pilot payment needs recorded evidence and is not an automated transaction',()=>fixture(async()=>{
 globalThis.fetch=async url=>{assert.ok(String(url).includes('/auth/v1/admin/users/'));return response({id:userId});};await assert.rejects(ownerApi('pilot',{employer_id:userId,name:'Pilot',status:'active',pricingModel:'per_search',currency:'USD',amountPaid:1000,paymentEvidence:''},user),/validation/);
}));
test('search diagnostics record actual source access and useful-match counts with unknown costs left unset',()=>fixture(async()=>{
 let saved;globalThis.fetch=async(url,opts)=>{saved=JSON.parse(opts.body);return response(null);};await recordSearchRun({id,ownerId:userId,criteria,candidates:[{researchStatus:'matched'},{researchStatus:'research_queue'}],internalStatus:'searched',publicStatus:'daily_limit',durationMs:2000,records:[{provider:'recruitcrm',sources:[{kind:'profile_research',readStatus:'detail_read_cv_reference_only'}]}]});assert.equal(saved.matched_count,1);assert.equal(saved.profile_count,2);assert.equal(saved.source_diagnostics['recruitcrm:detail_read_cv_reference_only'],1);assert.equal(saved.reported_provider_cost_usd,undefined);
}));

test('CRM file resolution binds the file to the correct candidate and selects only a resume document',()=>{
 const record={slug:'my-candidate',resume:'stored-resume-key.pdf'};const file={file_name:'CV.pdf',file_link:'https://files.crm.com/stored-resume-key.pdf',related_to:'my-candidate',related_to_type:'candidate'};assert.equal(candidateResumeUrl([file],record),file.file_link);assert.equal(candidateResumeUrl([{...file,related_to:'someone-else'}],record),null);assert.equal(candidateResumeUrl([{...file,file_name:'private-notes.txt',file_link:'https://files.crm.com/notes.txt'}],record),null);assert.equal(candidateResumeUrl([{...file,file_link:'http://files.crm.com/CV.pdf'}],record),null);
});

test('shortlist acceptance contains only current source-backed matches and requires the owned search',()=>fixture(async()=>{
 const candidates=[{reference,researchStatus:'matched'},{reference:'SP-AAAAAAAAAAAAAAAA',researchStatus:'research_queue'}];let saved;globalThis.fetch=async(url,opts)=>{assert.ok(String(url).includes('owner_id=eq.'+userId));saved=JSON.parse(opts.body);return response([{id}]);};await assert.rejects(acceptShortlist({search_id:id,references:['SP-AAAAAAAAAAAAAAAA']},user,candidates),/profile_unavailable/);assert.equal(saved,undefined);await acceptShortlist({search_id:id,references:[reference]},user,candidates);assert.deepEqual(saved.accepted_refs,[reference]);assert.ok(saved.shortlist_accepted_at);
}));

test('lightweight session check returns verified access flags without loading search history',()=>fixture(async()=>{
 let calls=0;globalThis.fetch=async url=>{calls++;assert.ok(String(url).includes('/auth/v1/user'));return response({id:userId,email:'owner@example.test',email_confirmed_at:new Date().toISOString(),app_metadata:{spearpoint_owner:true}});};const cookie=workspaceCookie({access_token:'fixture',refresh_token:'fixture'});const result=await workspaceApi('/api/workspace/session',{}, {headers:{cookie}}, {setHeader(){}});assert.equal(result.owner,true);assert.equal(result.email,'owner@example.test');assert.equal(calls,1);
}));

test('private CV downloads require owner access on each request and never mint a share link',()=>fixture(async()=>{
 globalThis.fetch=async()=>assert.fail('Unexpected access');await assert.rejects(downloadCandidateCv(id,{id:userId}),/owner_required/);let urls=[];globalThis.fetch=async(url,opts)=>{const u=String(url);urls.push(u);if(u.includes('sp_candidate_submissions'))return response([{id,cv_path:id+'/CV.txt'}]);if(u.includes('/object/authenticated/'))return new Response('SYNTHETIC CV');return response(null);};const file=await downloadCandidateCv(id,user);assert.equal(file.bytes.toString(),'SYNTHETIC CV');assert.equal(file.name,'CV.txt');assert.ok(urls.every(u=>!u.includes('/sign/')));
}));
