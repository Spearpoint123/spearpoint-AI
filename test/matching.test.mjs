import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProfile,roleMatches,roleQueries} from '../lib/matching.mjs';
import {archetypes} from '../lib/domain.mjs';
import {realSearch} from '../lib/services.mjs';
const input={role:'Chief Technology Officer',skills:'crypto, platform scale',location:'London'};
const approval={crm_slug:'fixture-slug',external_sharing_consent:true,consent_expires_at:new Date(Date.now()+86400000).toISOString(),reviewed_at:new Date().toISOString(),public_title:'Chief Technology Officer',public_summary:'Approved experience in London leading technology teams.',public_skills:['crypto','platform scale']};
test('80% admission uses explicit criteria and keeps unknown location visible as a gap',()=>{
 const full=assessProfile(input,approval);assert.equal(full.score,100);assert.equal(full.eligible,true);
 const noLocation=assessProfile(input,{...approval,public_summary:'Approved engineering leadership experience.'});assert.equal(noLocation.score,80);assert.equal(noLocation.eligible,true);assert.match(noLocation.gaps.join(' '),/Location needs confirmation/);
 const partial=assessProfile(input,{...approval,public_skills:['crypto']});assert.equal(partial.score,80);assert.equal(partial.eligible,true);assert.match(partial.gaps.join(' '),/platform scale/);
 const poor=assessProfile(input,{...approval,public_summary:'Engineering leader.',public_skills:['crypto']});assert.equal(poor.score,60);assert.equal(poor.eligible,false);
 assert.equal(assessProfile(input,{...approval,public_title:'Chief Financial Officer'}).eligible,false);
});
test('role aliases do not confuse different executive positions',()=>{assert.equal(roleMatches('CTO','Chief Technology Officer'),true);assert.equal(roleMatches('CTO','Chief Financial Officer'),false);assert.deepEqual(roleQueries('CTO'),['chief technology officer','CTO']);});
test('synthetic cards share the experience/fit/gaps format and never claim a real match score',()=>{for(const card of archetypes(input)){assert.ok(card.experience.length);assert.ok(card.fitReasons.length);assert.ok(card.gaps.length);assert.equal(card.matchScore,null);assert.equal(card.label,'Suggested target profile');assert.equal(card.kind,'synthetic');assert.match(card.availability,/Not a real person/);}});
test('CRM-first search is GET-only, excludes off-limits, requires consent and returns no raw records',async()=>{
 const priorFetch=globalThis.fetch;const priorEnv={...process.env};
 process.env.RECRUIT_CRM_ENABLED='true';process.env.RECRUIT_CRM_API_KEY='fixture';process.env.SUPABASE_URL='https://pcezdsdhmjxpjakxtdhz.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
 let rows=[approval],records=[{slug:'fixture-slug',position:'CTO',city:'London',first_name:'PRIVATE-NAME',email:'private@example.com'}],calls=0;
 globalThis.fetch=async(url,options)=>{
  const parsed=new URL(url);
  if(parsed.host==='api.recruitcrm.io'){
   calls++;assert.equal(options.method,'GET');assert.equal(parsed.pathname,'/v1/candidates/search');assert.equal(parsed.searchParams.get('marked_as_off_limit'),'false');assert.ok(parsed.searchParams.get('position'));assert.equal(parsed.searchParams.has('job_title'),false);return new Response(JSON.stringify({data:records,next_page_url:null}));
  }
  if(parsed.pathname.endsWith('/rpc/sp_take_rate_limit'))return new Response('true');
  assert.ok(parsed.pathname.endsWith('/sp_profile_approvals'));return new Response(JSON.stringify(rows));
 };
 try{
  const good=await realSearch(input);assert.equal(good.status,'searched');assert.equal(good.profiles.length,1);assert.equal(good.profiles[0].matchScore,100);assert.ok(calls>0);
  const serialized=JSON.stringify(good);for(const privateValue of ['PRIVATE-NAME','private@example.com','fixture-slug'])assert.equal(serialized.includes(privateValue),false);
  rows=[{...approval,external_sharing_consent:false}];assert.equal((await realSearch(input)).profiles.length,0);
  rows=[{...approval,public_summary:'Engineering leadership.',public_skills:['crypto']}];assert.equal((await realSearch(input)).profiles.length,0);
  rows=[approval];records=[{slug:'fixture-slug',position:'CTO',status_label:'Unavailable'}];assert.equal((await realSearch(input)).profiles.length,0);
  process.env.RECRUIT_CRM_ENABLED='false';calls=0;assert.equal((await realSearch(input)).status,'not_connected');assert.equal(calls,0);
 }finally{globalThis.fetch=priorFetch;for(const key of Object.keys(process.env))if(!(key in priorEnv))delete process.env[key];Object.assign(process.env,priorEnv);}
});
