import test from 'node:test';
import assert from 'node:assert/strict';
import {canVisitStep,selectSearchOption} from '../views/search-journey.js';
const groups={Trading:{roles:['Head of Trading','Portfolio Manager']},Commercial:{roles:['VP Sales']}};
test('step navigation allows revisiting valid choices and blocks missing prerequisites',()=>{
 assert.equal(canVisitStep({},0,groups),true);for(const n of [1,2,3,-1,4,1.5])assert.equal(canVisitStep({},n,groups),false);
 assert.equal(canVisitStep({niche:'Fintech'},1,groups),true);assert.equal(canVisitStep({niche:'Fintech',function:'Trading'},2,groups),true);
 const selected={niche:'Fintech',function:'Trading',role:'Portfolio Manager',location:'London'};for(let step=0;step<4;step++)assert.equal(canVisitStep(selected,step,groups),true);
 assert.equal(canVisitStep({...selected,function:'Commercial'},3,groups),false);
});
test('changing a niche preserves valid specialism, role and location without mutating the previous brief',()=>{
 const before={niche:'Hedge funds',function:'Trading',role:'Portfolio Manager',location:'Chicago'};
 const after=selectSearchOption(before,'niche','Fintech',groups);
 assert.deepEqual(after,{...before,niche:'Fintech'});assert.equal(before.niche,'Hedge funds');assert.equal(canVisitStep(after,3,groups),true);
});
test('changing specialism clears an incompatible role but retains location for the next choice',()=>{
 const before={niche:'Fintech',function:'Trading',role:'Head of Trading',location:'New York'};
 const after=selectSearchOption(before,'function','Commercial',groups);assert.equal(after.role,undefined);assert.equal(after.location,'New York');assert.equal(canVisitStep(after,3,groups),false);
 const complete=selectSearchOption(after,'role','VP Sales',groups);assert.equal(complete.function,'Commercial');assert.equal(canVisitStep(complete,3,groups),true);assert.equal(complete.location,'New York');
 assert.equal(selectSearchOption(before,'function','Trading',groups).role,'Head of Trading');
});
test('cross-specialism role search updates the specialism and keeps other choices',()=>{
 const result=selectSearchOption({niche:'Exchanges',function:'Trading',role:'Portfolio Manager',location:'London'},'role','VP Sales',groups);
 assert.equal(result.function,'Commercial');assert.equal(result.niche,'Exchanges');assert.equal(result.location,'London');
 assert.throws(()=>selectSearchOption(result,'role','Unknown role',groups));assert.throws(()=>selectSearchOption(result,'function','Unknown',groups));
});
