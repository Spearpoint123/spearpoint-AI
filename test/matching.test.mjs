import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProfile,roleMatches,roleQueries} from '../lib/matching.mjs';
import {realSearch,candidateEligible,profileReference} from '../lib/services.mjs';
const input={role:'Chief Technology Officer',skills:'crypto, platform scale',location:'London',niche:'Market makers & prop trading'};
const approval={crm_slug:'fixture-slug',external_sharing_consent:true,consent_evidence:'Fixture-only explicit external sharing approval',consent_expires_at:new Date(Date.now()+86400000).toISOString(),reviewed_at:new Date().toISOString(),public_title:'Chief Technology Officer',public_summary:'London technology leader with market making experience.',public_skills:['crypto','platform scale']};
test('all structured essentials must be evidenced; no implicit sector skills or suitability percentages',()=>{
 const full=assessProfile(input,approval);assert.equal(full.eligible,true);assert.ok(full.checks.every(c=>c.met));assert.equal(full.score,undefined);
 for(const patch of [{public_summary:'Market making technology leader.'},{public_summary:'London technology leader at a fintech.'},{public_skills:['crypto']},{public_title:'Chief Financial Officer'}])assert.equal(assessProfile(input,{...approval,...patch}).eligible,false);
 const flexible={...input,skills:'',location:'Global / location flexible'};assert.equal(assessProfile(flexible,{...approval,public_summary:'Market making technology leader.'}).eligible,true);
 assert.equal(assessProfile({...input,skills:'Python'},{...approval,public_summary:approval.public_summary+' No Python experience.'}).eligible,false);
 const notes=assessProfile({...input,jobDescription:'Must have options experience'},approval);assert.equal(notes.eligible,true);assert.match(notes.gaps.join(' '),/not automatically assessed/);
});
test('role aliases, word boundaries and hierarchy do not turn adjacent roles into executive matches',()=>{
 assert.equal(roleMatches('CTO','Chief Technology Officer'),true);assert.equal(roleMatches('CTO','Chief Financial Officer'),false);assert.equal(roleMatches('CTO','Deputy Chief Technology Officer'),false);assert.equal(roleMatches('Head of Trading','Former Head of Trading'),false);assert.equal(roleMatches('VP Engineering','VP of Engineering'),true);assert.equal(roleMatches('VP Engineering','Vice President of Engineering'),true);assert.deepEqual(roleQueries('CTO'),['chief technology officer','CTO']);
});
test('off-limits and unavailable CRM flags are rejected in boolean, string and nested forms',()=>{
 const c={slug:'fixture-slug',position:'CTO'};assert.equal(candidateEligible(c,'CTO'),true);
 for(const patch of [{deleted:true},{unavailable:'true'},{off_limit:true},{off_limit:{off_limit:true}},{off_limit:{off_limit:'true'}},{marked_as_off_limit:true},{status_label:'Unavailable'},{slug:'unsafe,slug'}])assert.equal(candidateEligible({...c,...patch},'CTO'),false);
 assert.equal(candidateEligible({...c,off_limit:{off_limit:false}},'CTO'),true);
});
test('CRM search is read-only and only returns current approved copy with opaque references',async()=>{
 const oldFetch=globalThis.fetch,oldEnv={...process.env};
 Object.assign(process.env,{RECRUIT_CRM_ENABLED:'true',RECRUIT_CRM_API_KEY:'fixture',SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',RATE_LIMIT_HMAC_KEY:'fixture-only-reference-key-over-32-characters'});
 let rows=[approval],records=[{slug:'fixture-slug',position:'CTO',city:'London',first_name:'PRIVATE-NAME',email:'private@example.com',candidate_summary:'PRIVATE-NOTES'}],calls=0;
 globalThis.fetch=async(url,options)=>{
  const parsed=new URL(url);
  if(parsed.host==='api.recruitcrm.io'){
   calls++;assert.equal(options.method,'GET');assert.equal(parsed.pathname,'/v1/candidates/search');assert.equal(parsed.searchParams.get('marked_as_off_limit'),'false');assert.ok(parsed.searchParams.get('position'));return new Response(JSON.stringify({data:records,next_page_url:null}));
  }
  if(parsed.pathname.endsWith('/rpc/sp_take_rate_limit'))return new Response('true');
  assert.equal(options.method,'GET');assert.ok(parsed.pathname.endsWith('/sp_profile_approvals'));return new Response(JSON.stringify(rows));
 };
 try{
  const good=await realSearch(input);assert.equal(good.profiles.length,1);assert.ok(calls>0);assert.equal(good.profiles[0].reference,profileReference('fixture-slug'));assert.match(good.profiles[0].reference,/^SP-[A-F0-9]{16}$/);assert.ok(good.profiles[0].reviewedAt);
  const serialized=JSON.stringify(good);for(const value of ['PRIVATE-NAME','private@example.com','fixture-slug','PRIVATE-NOTES','Fixture-only explicit external sharing approval'])assert.equal(serialized.includes(value),false);
  for(const patch of [{external_sharing_consent:false},{consent_evidence:''},{revoked_at:new Date().toISOString()},{consent_expires_at:'2020-01-01'},{reviewed_at:'2020-01-01'},{public_summary:'Contact private@example.com'},{public_skills:[]}]){rows=[{...approval,...patch}];assert.equal((await realSearch(input)).profiles.length,0);}
  rows=[approval];records=[{slug:'fixture-slug',position:'CTO',off_limit:true}];assert.equal((await realSearch(input)).profiles.length,0);
  process.env.RECRUIT_CRM_ENABLED='false';calls=0;assert.equal((await realSearch(input)).status,'not_connected');assert.equal(calls,0);
 }finally{globalThis.fetch=oldFetch;process.env=oldEnv;}
});
