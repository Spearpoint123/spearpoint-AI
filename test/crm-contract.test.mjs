import test from 'node:test';
import assert from 'node:assert/strict';
import {candidatePage} from '../lib/services.mjs';
test('CRM candidate pages support direct and wrapped pagination without changing record privacy gates',()=>{
 const rows=[{slug:'test-only',position:'Head of Market Making'}];
 assert.deepEqual(candidatePage({data:rows,next_page_url:'next'}),{records:rows,next:'next'});
 assert.deepEqual(candidatePage({data:{data:rows,next_page_url:'next'}}),{records:rows,next:'next'});
 assert.deepEqual(candidatePage(rows),{records:rows,next:null});
 assert.deepEqual(candidatePage({data:null,total:0}),{records:[],next:null});
});
test('CRM error diagnostics contain only categories and shape, never response values',()=>{
 assert.throws(()=>candidatePage({message:'INSUFFICIENT_ACCESS Please upgrade to Business'}),/crm_access_denied/);
 assert.throws(()=>candidatePage({error:'invalid token private-token-value'}),/crm_auth_rejected/);
 try{candidatePage({message:'private-token-value',data:{email:'private@example.com'}});assert.fail();}catch(error){assert.equal(error.message,'crm_contract_data_message_object');assert.ok(!error.message.includes('private'));}
});
