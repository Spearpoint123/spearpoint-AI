import test from 'node:test';
import assert from 'node:assert/strict';
import {mustHaveInput,searchIntake,applyIntakeCriteria} from '../lib/search-intake.mjs';
import {crmSignals,mustHaveEvidence,compareMustHaveEvidence} from '../lib/discovery-evidence.mjs';
import {instantSearch,pendingDiscovery} from '../lib/instant-search.mjs';
import {assessMandate,mandateCriteria} from '../lib/talent-search.mjs';
const mustHaves=['DeFi experience','Solidity experience','Engineering leadership'];
const criteria={role:'Chief Technology Officer',family:'technology',location:'Any location',niches:[],requirements:[],otherRequirements:'None',mustHaves};
test('search requires three distinct professional must-haves before any provider call',async()=>{
 for(const invalid of [undefined,[],['DeFi'],['DeFi','Solidity'],['DeFi','defi experience','Solidity'],['CTO','Solidity','DeFi'],['  ','Solidity','DeFi']]){
  assert.throws(()=>mustHaveInput(invalid,true),/must_haves_required/);
  await assert.rejects(instantSearch({id:'fixture'},{query:'CTO',mustHaves:invalid,confirmed:true},()=>null),/must_haves_required/);
 }
 assert.deepEqual(mustHaveInput(mustHaves,true),mustHaves);
 const intake=searchIntake({mustHaves},{requireMustHaves:true});
 assert.deepEqual(mandateCriteria(applyIntakeCriteria(criteria,intake)).mustHaves,mustHaves);
});
test('three checks require substantive source evidence and never use the job title as proof',()=>{
 const source={source:'internal',reported_title:'CTO in DeFi, Solidity and Engineering leadership',sources:crmSignals({position:'CTO in DeFi, Solidity and Engineering leadership'})};
 const p=pendingDiscovery(criteria,source);assert.equal(p.mustHaveChecks.length,3);assert.equal(p.mustHaveMentions,0);assert.equal(p.mustHaveReviewed,0);
 assert.ok(p.mustHaveChecks.every(c=>c.status==='not_evidenced'));
 const evidenced=pendingDiscovery(criteria,{...source,sources:crmSignals({summary:'Led DeFi protocol development. Built production Solidity contracts. Led engineering teams.'})});
 assert.equal(evidenced.mustHaveMentions,3);assert.equal(evidenced.mustHaveReviewed,0);assert.ok(evidenced.mustHaveChecks.every(c=>c.status==='source_mention'));
 assert.ok(compareMustHaveEvidence(evidenced,p)<0);
});
test('public evidence keeps each missing must-have visible and cannot turn a partial lead into a complete match',()=>{
 const p=pendingDiscovery(criteria,{source:'public',reported_title:'Chief Technology Officer',source_excerpt:'Built DeFi protocols. No Solidity experience. Interested in engineering leadership.'});
 assert.equal(p.mustHaveMentions,1);assert.equal(p.mustHaveChecks.filter(c=>c.status==='not_evidenced').length,2);assert.equal(p.mustHaveReviewed,0);assert.notEqual(p.requirementsMet,true);
 assert.ok(!p.mustHaveChecks.some(c=>/title/.test(c.evidence)));
});
test('active credentials and quantified requirements are not verified from a related keyword mention',()=>{
 const c={...criteria,mustHaves:['Active Series 3','10 years of risk management','NFA registration experience']};
 const p=pendingDiscovery(c,{source:'public',source_excerpt:'Passed Series 3. Worked in risk management. Supported NFA registration.'});
 assert.equal(p.mustHaveReviewed,0);assert.equal(p.mustHaveChecks[0].status,'source_mention');assert.equal(p.mustHaveChecks[0].evidence,'Source profile mentions Series 3.');
});
test('reviewed evidence can cover three explicit requirements without asserting overall hiring fit',()=>{
 const c={...criteria,mustHaves:['Regulatory licensing','Risk management','Payments']};
 const profile={title:'Chief Technology Officer',family:'technology',niches:[],locations:[],focus:[],evidence:[{criterion:'licensing',text:'Led regulatory licensing applications.'},{criterion:'risk_management',text:'Implemented risk management systems.'},{criterion:'payments',text:'Delivered payment platforms and payments infrastructure.'}]};
 const assessed=assessMandate(c,profile);assert.equal(assessed.mustHaveReviewed,3);assert.equal(assessed.mustHaveChecks.length,3);assert.ok(assessed.mustHaveChecks.every(c=>c.status==='reviewed_evidence'));assert.ok(!assessed.fitReasons.some(s=>s.startsWith('Reviewed role')));
 const partial=assessMandate(c,{...profile,evidence:profile.evidence.slice(0,2)});assert.equal(partial.mustHaveReviewed,2);assert.equal(partial.requirementsMet,false);assert.ok(partial.gaps.some(s=>s==='Must-have evidence needed: Payments.'));
 assert.equal(mustHaveEvidence(c,{reviewed:true,evidence:[{criterion:'payments',text:'No payments experience has been verified.'}]}).mustHaveReviewed,0);
});
test('three-check output never includes raw CRM identities, contact data or legacy title-only signals',()=>{
 const p=pendingDiscovery(criteria,{source:'internal',person_name:'PRIVATE_NAME',reported_company:'PRIVATE_COMPANY',reported_title:'CTO',sources:[{kind:'professional_signal',criterion:'defi'}],source_excerpt:'PRIVATE_NAME private@example.com'});
 assert.equal(p.mustHaveMentions,0);assert.ok(!/PRIVATE_|private@example|https:/.test(JSON.stringify(p)));
});

test('NFA is clarified in the product and membership is never inferred from general NFA experience',()=>{
 assert.throws(()=>mustHaveInput(['Series 3','NFA','Compliance program delivery'],true),/nfa_clarification_required/);
 const c={...criteria,mustHaves:['Series 3','NFA membership','Compliance program delivery']};
 const ambiguous=pendingDiscovery(c,{source:'public',source_excerpt:'Series 3. Worked with NFA regulations. Built a compliance program.'});
 assert.equal(ambiguous.mustHaveChecks[1].status,'not_evidenced');
 const member=pendingDiscovery(c,{source:'public',source_excerpt:'Series 3. NFA membership. Built a compliance program.'});
 assert.equal(member.mustHaveChecks[1].status,'source_mention');assert.equal(member.mustHaveReviewed,0);
});
