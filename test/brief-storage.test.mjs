import test from 'node:test';
import assert from 'node:assert/strict';
import {saveBrief} from '../lib/services.mjs';
import {briefInput} from '../lib/domain.mjs';
test('a successful minimal 201 insert is acknowledged once without assuming a JSON response',async()=>{
 process.env.SUPABASE_URL='https://pcezdsdhmjxpjakxtdhz.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';delete process.env.HUBSPOT_SYNC_AUTHORIZED;
 const original=globalThis.fetch;let inserts=0;
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),process.env.SUPABASE_URL+'/rest/v1/sp_briefs');assert.equal(options.method,'POST');assert.equal(options.headers.Prefer,'return=minimal');const row=JSON.parse(options.body);assert.equal(row.role,'Chief Technology Officer');assert.match(row.notes,/Exchanges/);assert.ok(row.consented_at);assert.equal(row.consent,undefined);inserts++;return new Response(null,{status:201});};
 try{const result=await saveBrief(briefInput({role:'Chief Technology Officer',location:'London',skills:'Trading systems',name:'Staging QA',email:'qa@example.invalid',company:'Test Company',notes:'Exchanges hiring market brief',consent:true}));assert.match(result.id,/^[0-9a-f-]{36}$/);assert.equal(result.sync,'disabled');assert.equal(inserts,1);}finally{globalThis.fetch=original;delete process.env.SUPABASE_SERVICE_ROLE_KEY;}
});
