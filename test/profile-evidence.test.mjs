import test from 'node:test';
import assert from 'node:assert/strict';
import {profileEvidence} from '../lib/profile-evidence.mjs';
import {anonymiseExperience,requirementsKey,RESEARCH_VERSION} from '../lib/profile-research.mjs';
const criteria={mustHaves:['Series 3 qualification','NFA membership','Build compliance programs']};
const row=(passages)=>({person_name:'Alice Private',reported_company:'Secret Employer',reported_title:'Chief Compliance Officer at Secret Employer',source:'internal',sources:[{kind:'profile_research',version:RESEARCH_VERSION,requirementsKey:requirementsKey(criteria),checkedAt:'2026-11-01',checks:[],passages:passages.map((text,i)=>({id:'p'+i,text,kind:'work_history'}))}]});
test('substantive source facts retain provenance without identities or source URLs',()=>{
 const p=profileEvidence(row(['Alice Private led the compliance program at Secret Employer and implemented monitoring controls across derivatives trading operations.','Managed regulatory relationships and risk reporting while developing policies and procedures for a new swap execution facility.']),criteria);
 assert.equal(p.title,'Chief Compliance Officer');assert.equal(p.evidenceReady,true);assert.equal(p.professionalFacts.length,2);assert.equal(p.professionalFacts[0].source,'CRM career history');assert.doesNotMatch(JSON.stringify(p),/Alice|Private|Secret Employer|https:|@/);
});
test('titles and fragmented passages do not qualify as usable profile evidence',()=>{
 const p=profileEvidence(row(['Chief Compliance Officer','[redacted] [redacted] built [redacted] procedures']),criteria);assert.equal(p.evidenceReady,false);assert.equal(p.professionalFacts.length,0);
});
test('public regulatory terminology is preserved while known employer names are still removed',()=>{
 const p=anonymiseExperience('Alice Private managed National Futures Association and Commodity Futures Trading Commission examinations for Secret Employer.',row([]),criteria);assert.match(p,/National Futures Association/);assert.match(p,/Commodity Futures Trading Commission/);assert.doesNotMatch(p,/Alice|Secret Employer/);
});
test('missing or stale source assessment cannot become professional facts',()=>{
 const r=row(['Managed regulatory relationships and risk reporting while developing policies and procedures for a new swap execution facility.']);r.sources[0].requirementsKey='stale';assert.deepEqual(profileEvidence(r,criteria).professionalFacts,[]);
});

test('subjective assessments, skills dumps and employer descriptions do not appear as experience facts',()=>{
 const p=profileEvidence(row(['The candidate appears to be a low-to-mid level candidate with strong management experience in financial services.','The company is a recruitment agency specialising in placing compliance professionals with financial services clients.']),criteria);assert.equal(p.professionalFacts.length,0);
});
