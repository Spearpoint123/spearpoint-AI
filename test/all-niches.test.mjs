import test from 'node:test';
import assert from 'node:assert/strict';
import {NICHES,FAMILIES,BROAD_ROLES} from '../views/talent-taxonomy.js';
import {assessMandate,mandateCriteria,reviewedProfiles,reviewedCoverage} from '../lib/talent-search.mjs';
const criteria=(patch={})=>mandateCriteria({role:'Chief Technology Officer',family:'technology',niches:['Payments'],nicheMode:'all',location:'Any location',requirements:['cloud'],otherRequirements:'None',...patch});
const profile={kind:'real',title:'Chief Technology Officer',family:'technology',niches:['Payments','Fintech'],focus:['Cloud'],locations:['United Kingdom'],evidence:[{criterion:'cloud',text:'Reviewed cloud migration experience.'}]};
test('all eight niches are searchable with a matching reviewed sector; unrelated sectors cannot become partial matches',()=>{
 for(const niche of NICHES){const c=criteria({niches:[niche]});const p={...profile,niches:[niche]};assert.equal(assessMandate(c,p).requirementsMet,true,niche);assert.equal(assessMandate(c,{...p,niches:NICHES.filter(n=>n!==niche)}),null,niche);}
});
test('all senior role groups use reviewed family and retain the requested role level',()=>{
 const titles={trading:'Head of Trading',ai_data:'Head of AI',technology:'Chief Technology Officer',commercial:'Chief Revenue Officer',product:'Chief Product Officer',risk_compliance:'Head of Compliance',operations:'Chief Operating Officer',executive:'Chief Executive Officer'};
 for(const family of Object.keys(FAMILIES)){
  const p={...profile,family,title:titles[family]};const c=criteria({family,role:titles[family]});assert.ok(assessMandate(c,p));assert.ok(assessMandate({...c,role:BROAD_ROLES[family]},p));assert.equal(assessMandate({...c,family:family==='technology'?'trading':'technology'},p),null);
 }
 assert.equal(assessMandate(criteria({role:'Head of Engineering'}),profile),null);
 assert.equal(assessMandate(criteria({role:'Chief Financial Officer',family:'operations'}),{...profile,title:'Chief Operating Officer',family:'operations'}),null);
});
test('sector alternatives and required combinations differ, and unmapped technology stays a gap',()=>{
 assert.ok(assessMandate(criteria({niches:['Payments','Exchanges'],nicheMode:'any'}),profile));
 assert.equal(assessMandate(criteria({niches:['Payments','Exchanges'],nicheMode:'all'}),profile),null);
 assert.equal(assessMandate(criteria({otherRequirements:'Must have Rust and a completed platform launch'}),profile).requirementsMet,false);
 assert.throws(()=>criteria({niches:['Unreviewed invented niche']}));assert.throws(()=>criteria({family:'invented'}));assert.throws(()=>criteria({nicheMode:'ignore'}));
});
test('existing compliance saved searches retain their family without requiring a data migration',()=>{
 const c=mandateCriteria({role:'Compliance leadership',location:'Any location',requirements:['licensing'],otherRequirements:'None'});assert.equal(c.family,'risk_compliance');assert.deepEqual(c.niches,[]);
 assert.ok(assessMandate(c,{...profile,family:'risk_compliance',title:'Chief Compliance Officer',evidence:[{criterion:'licensing',text:'Reviewed licensing programme experience.'}]}));
});
test('mixed catalogue projects only approved public evidence and returns actual coverage counts',async()=>{
 const env={...process.env},fetch=globalThis.fetch;Object.assign(process.env,{SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',RATE_LIMIT_HMAC_KEY:'fixture-key-with-more-than-32-characters'});
 const row={crm_slug:'PRIVATE_RECORD',external_sharing_consent:true,consent_evidence:'PRIVATE_RELEASE_NOTE',consent_expires_at:new Date(Date.now()+86400000).toISOString(),reviewed_at:new Date().toISOString(),public_title:'Chief Technology Officer',public_summary:'Reviewed financial technology and exchange infrastructure experience.',public_skills:['Cloud'],profile_family:'technology',sector_tags:['Exchanges','Fintech'],public_locations:['United Kingdom'],public_evidence:[{criterion:'exchange_infrastructure',text:'Recorded exchange infrastructure delivery.'}]};
 globalThis.fetch=async url=>{assert.ok(!String(url).includes('profile_family=eq.compliance'));return new Response(JSON.stringify([row,{...row,crm_slug:'REVOKED_PRIVATE_RECORD',revoked_at:new Date().toISOString()}]));};
 try{const profiles=await reviewedProfiles();assert.equal(profiles.length,1);assert.equal(profiles[0].family,'technology');const data=JSON.stringify(profiles);assert.ok(!data.includes('PRIVATE'));assert.ok(!data.includes('crm_slug'));const coverage=await reviewedCoverage();assert.equal(coverage.total,1);assert.equal(coverage.niches.find(n=>n.niche==='Exchanges').count,1);assert.equal(coverage.niches.find(n=>n.niche==='Hedge funds').count,0);assert.equal(coverage.families.find(f=>f.key==='technology').count,1);}finally{globalThis.fetch=fetch;process.env=env;}
});
