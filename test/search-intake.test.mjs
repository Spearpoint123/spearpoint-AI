import test from 'node:test';import assert from 'node:assert/strict';
import {searchIntake,professionalMandate,applyIntakeCriteria} from '../lib/search-intake.mjs';
import {professionalSignals,crmSignals,discoveryExplanation} from '../lib/discovery-evidence.mjs';
import {pendingDiscovery,instantSearch} from '../lib/instant-search.mjs';
import {groundMandate} from '../lib/talent-search.mjs';
import {candidateEligible} from '../lib/services.mjs';
const criteria={role:'Chief Technology Officer',family:'technology',location:'Any location',niches:['Digital assets'],requirements:[],customRequirements:['DeFi experience'],otherRequirements:'None'};
test('DeFi survives interpretation as its own requirement and does not become generic crypto experience',()=>{const c=groundMandate({...criteria,customRequirements:[]},'Find a CTO with DeFi experience');assert.equal(c.role,'Chief Technology Officer');assert.ok(c.customRequirements.includes('DeFi experience'));assert.ok(!professionalSignals('Crypto exchange technology experience.').some(s=>s.criterion==='defi'));assert.deepEqual(professionalSignals('No DeFi experience. Interested in DeFi. Has never worked in DeFi.'),[]);});
test('two possible-fit reasons require corresponding professional source evidence and never include identity',()=>{
 const signals=crmSignals({position:'Founder & CTO',summary:'PRIVATE_NAME led DeFi protocol development at PRIVATE_EMPLOYER. Email private@example.com.',skill:'Solidity'});
 const row={source:'internal',reported_title:'Founder & CTO',sources:signals,person_name:'PRIVATE_NAME',reported_company:'PRIVATE_EMPLOYER',canonical_url:'https://private.company.com/person'};
 const p=pendingDiscovery(criteria,row);assert.equal(p.fitReasons.length,2);assert.match(p.fitReasons[0],/DeFi/);assert.equal(p.canRequestIntro,false);assert.equal(p.reviewStatus,'pending');assert.ok(!/PRIVATE_|private@example|https:/.test(JSON.stringify(p)));
 const absent=discoveryExplanation(criteria,{source:'public',reported_title:'CTO',source_excerpt:'Built crypto exchange platforms.'});assert.ok(!absent.fitReasons.some(s=>s.includes('DeFi')));assert.ok(absent.gaps.some(s=>s.startsWith('DeFi: not evidenced')));
 assert.ok(candidateEligible({slug:'fixture',position:'Founder and CTO'},'Chief Technology Officer'));assert.ok(!candidateEligible({slug:'fixture',position:'Assistant CTO'},'Chief Technology Officer'));
});
test('commercial impact, deadline rationale and budget stay out of model and market interpretation input',()=>{
 const intake=searchIntake({mustHaves:['DeFi experience','Solidity','Engineering leadership'],location:'London',impact:'PRIVATE_IMPACT',startDate:'2099-01-31',dateReason:'PRIVATE_REASON',budget:'PRIVATE_BUDGET'});
 const prompt=professionalMandate('CTO with DeFi experience','Build production smart contracts and lead the engineering team.',intake);assert.match(prompt,/DeFi/);assert.match(prompt,/Required location: London/);assert.ok(!prompt.includes('PRIVATE_'));assert.ok(!prompt.includes('2099-01-31'));assert.equal(intake.startDate,'2099-01-31');
 assert.throws(()=>searchIntake({startDate:'ASAP',dateReason:'Launch deadline'}),/validation/);assert.throws(()=>searchIntake({startDate:'2099-02-30',dateReason:'Launch deadline'}),/validation/);assert.throws(()=>searchIntake({startDate:'2099-01-31'}),/validation/);assert.throws(()=>searchIntake({mustHaves:['one','two','three','four']}),/validation/);
});

test('explicit location and the three must-haves cannot be dropped or reprioritised by AI interpretation',()=>{const intake=searchIntake({location:'London, hybrid',mustHaves:['DeFi experience','Led a production launch','Built a team']});const c=applyIntakeCriteria({...criteria,location:'Any location',customRequirements:['Solidity']},intake);assert.equal(c.location,'London, hybrid');assert.deepEqual(c.customRequirements.slice(0,3),intake.mustHaves);assert.deepEqual(c.essential,['custom_0','custom_1','custom_2']);assert.equal(c.weights.custom_0,5);});

test('full uploaded job descriptions preserve the final requirements through interpretation intake',()=>{
 const jd='A'.repeat(19965)+' Required final skill: Series 3.';
 const intake=searchIntake({location:'London',mustHaves:['NFA registration','Series 3','Compliance leadership']});
 const prompt=professionalMandate('CCO',jd,intake);
 assert.ok(prompt.includes(jd));assert.ok(prompt.endsWith('Must-have 3: Compliance leadership'));
 assert.throws(()=>professionalMandate('CCO','A'.repeat(20001),intake),/validation/);
});
