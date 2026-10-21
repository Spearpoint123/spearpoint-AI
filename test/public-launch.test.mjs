import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.mjs';
import {originAllowed} from '../lib/origin.mjs';
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=body}});
test('public access requires the exact custom hostname on Vercel',async()=>{
 process.env.VERCEL='1';
 try{for(const host of ['ai.spearpointsearch.com','ai.spearpointsearch.com.attacker.example','spearpoint-ai-staging-psi.vercel.app']){
  const r=response();await handler({url:'/',method:'GET',headers:{host}},r);
  assert.equal(r.body.toString().includes('search-form'),host==='ai.spearpointsearch.com');
  if(host==='ai.spearpointsearch.com')assert.doesNotMatch(r.body.toString(),/Private staging|Please use test data/);
 }}finally{delete process.env.VERCEL;}
 const r=response();await handler({url:'/',method:'GET',headers:{host:'ai.spearpointsearch.com'}},r);assert.match(r.body.toString(),/login-form/);
});
test('public routes block trial fonts and login, use fallback typography and reject foreign origins',async()=>{
 process.env.VERCEL='1';
 try{for(const url of ['/GT-Canon-VF.ttf','/GT-Standard-VF.ttf','/api/login','/login.js']){const r=response();await handler({url,method:'GET',headers:{host:'ai.spearpointsearch.com'}},r);assert.equal(r.statusCode,404);}
 const css=response();await handler({url:'/style.css',method:'GET',headers:{host:'ai.spearpointsearch.com'}},css);assert.doesNotMatch(css.body,/@font-face|GT Canon Trial VF|GT Standard Trial VF/);
 const privacy=response();await handler({url:'/privacy',method:'GET',headers:{host:'ai.spearpointsearch.com'}},privacy);assert.match(privacy.body.toString(),/sam@spearpointsearch.com/);assert.doesNotMatch(privacy.body.toString(),/must be updated|private trial/);
 assert.equal(originAllowed('https://ai.spearpointsearch.com'),true);assert.equal(originAllowed('https://ai.spearpointsearch.com.attacker.example'),false);
 const blocked=response();await handler({url:'/api/search',method:'POST',headers:{host:'ai.spearpointsearch.com',origin:'https://evil.example','content-type':'application/json'}},blocked);assert.equal(blocked.statusCode,403);
 }finally{delete process.env.VERCEL;}
});
