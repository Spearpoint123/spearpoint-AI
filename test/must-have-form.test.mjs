import test from 'node:test';import assert from 'node:assert/strict';
import {mustHaveProblems} from '../views/requirement-types.js';
import {professionalMustHaveInput} from '../lib/search-intake.mjs';
const complete=['Production Rust software','Low-latency optimisation','Electronic trading systems'];
test('zero, one and two priorities remain blocked in both form validation and server validation',()=>{for(let count=0;count<3;count++){const values=complete.slice(0,count);assert.ok(mustHaveProblems(values).some(Boolean));assert.throws(()=>professionalMustHaveInput(values),/must_haves_required/);}});
test('whitespace and short entries cannot substitute for a third must-have',()=>{for(const third of ['','   ','x','ab']){const v=[...complete.slice(0,2),third];assert.ok(mustHaveProblems(v)[2]);assert.throws(()=>professionalMustHaveInput(v),/must_haves_required/);}});
test('duplicate entries and location cannot unlock the search',()=>{assert.ok(mustHaveProblems([complete[0],complete[0],complete[2]]).some(Boolean));assert.ok(mustHaveProblems([complete[0],complete[1],'New York'],'New York, USA')[2]);});
test('three distinct professional priorities clear the must-have gate',()=>{assert.deepEqual(mustHaveProblems(complete,'New York'),['','','']);assert.deepEqual(professionalMustHaveInput(complete,'New York'),complete);});
