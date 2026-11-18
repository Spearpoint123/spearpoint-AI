import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import handler from '../api/index.mjs';
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=body}});
const publicHeaders={host:'ai.spearpointsearch.com'};
test('the public homepage is the new search front and the pilot routes stay put',async()=>{
 process.env.VERCEL='1';
 try{
  const home=response();await handler({url:'/',method:'GET',headers:publicHeaders},home);
  assert.equal(home.statusCode,200);
  assert.match(home.body.toString(),/See the market before you see a name/);
  assert.match(home.body.toString(),/href="\/signup"/);
  const begin=response();await handler({url:'/begin/',method:'GET',headers:publicHeaders},begin);
  assert.equal(begin.statusCode,200);
  assert.match(begin.body.toString(),/See the market before you see a name/);
  const classic=response();await handler({url:'/classic',method:'GET',headers:publicHeaders},classic);
  assert.equal(classic.statusCode,200);
  assert.match(classic.body.toString(),/hero-knight\.webp/);
  assert.doesNotMatch(classic.body.toString(),/See the market before you see a name/);
  for(const path of ['/signin','/recruit','/hiring','/workspace','/owner','/talent-network','/consult','/privacy','/explore','/signup']){
   const page=response();await handler({url:path,method:'GET',headers:publicHeaders},page);
   assert.equal(page.statusCode,200,path);
   assert.doesNotMatch(page.body.toString(),/See the market before you see a name/);
  }
  const missing=response();await handler({url:'/not-a-page',method:'GET',headers:publicHeaders},missing);
  assert.equal(missing.statusCode,404);
  assert.match(missing.body.toString(),/\/classic/);
  const api=response();await handler({url:'/api/public/teaser',method:'GET',headers:publicHeaders},api);
  assert.equal(api.statusCode,405);
 }finally{delete process.env.VERCEL;}
});
test('the demo profile seed is idempotent and stores no identity',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261118230000_demo_profiles.sql',import.meta.url),'utf8');
 assert.equal((sql.match(/'c[12]000001-0000-4000-8000-/g)||[]).length,82);
 assert.match(sql,/on conflict \(id\) do nothing/);
 assert.match(sql,/source='demo'|source in \('recruitcrm','talent_network','consented','demo'\)/);
 assert.equal(sql.includes('sp_candidate_identity'),false);
 assert.match(sql,/publication='unpublished' where source='demo'/);
});
