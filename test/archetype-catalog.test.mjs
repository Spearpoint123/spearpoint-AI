import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {savedArchetypes,findArchetype,catalogueVersion} from '../lib/archetype-store.mjs';
import handler from '../api/index.mjs';
test('every selectable role has a saved backend CV archetype and career progression',async()=>{
 const app=await readFile(new URL('../views/app.js',import.meta.url),'utf8');
 const roles=[...app.matchAll(/roles:\[([^\]]+)\]/g)].flatMap(match=>[...match[1].matchAll(/'([^']+)'/g)].map(value=>value[1]));
 assert.equal(roles.length,33);assert.deepEqual(new Set(roles),new Set(savedArchetypes.map(p=>p.role)));assert.equal(new Set(savedArchetypes.map(p=>p.id)).size,33);
 assert.ok(!app.includes("from './role-archetypes.js'"));assert.ok(app.includes('blueprint(input,currentArchetype)'));assert.equal(catalogueVersion,'2026-10-21.1');
 for(const role of roles){const p=findArchetype({role,niche:'Market makers & prop trading',location:'Chicago'});assert.equal(p.kind,'synthetic');assert.equal(p.location,'Chicago');assert.equal(p.careerHistory.length,3);assert.equal(p.achievementExamples.length,3);assert.equal(p.careerHistory[0].title,role);assert.match(p.disclosure,/hypothetical/);assert.ok(p.careerHistory.every(s=>s.title&&s.responsibilities.length));assert.equal(p.matchScore,null);}
});
test('backend retrieves the exact role, canonical aliases and niche without claiming a real candidate match',()=>{
 const p=findArchetype({role:'Head of Market Making',niche:'Market makers & prop trading',location:'London'});assert.match(p.mandate,/liquidity/);assert.match(p.careerHistory.map(s=>s.responsibilities.join(' ')).join(' '),/inventory/);assert.match(p.sectorContext,/inventory/);assert.equal(p.careerHistory[1].title,'Market Making Desk Lead');
 assert.equal(findArchetype({role:'CTO',location:'London'}).role,'Chief Technology Officer');
 assert.throws(()=>findArchetype({role:'Invented role',location:'London'}));assert.throws(()=>findArchetype({role:'Head of Trading',niche:'Invented sector',location:'London'}));
 p.careerHistory[0].title='changed';assert.equal(findArchetype({role:'Head of Market Making',location:'London'}).careerHistory[0].title,'Head of Market Making');
});
test('backend catalogue is not exposed as an unguarded static asset',async()=>{
 process.env.VERCEL='1';try{for(const url of ['/role-archetypes.js','/data/candidate-archetypes.json']){const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},end(body){this.body=body}};await handler({url,method:'GET',headers:{host:'ai.spearpointsearch.com'}},res);assert.equal(res.statusCode,404);}}finally{delete process.env.VERCEL;}
});
test('trial font files remain unavailable before staging sign-in',async()=>{
 for(const url of ['/GT-Canon-VF.ttf','/GT-Standard-VF.ttf']){const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};await handler({url,method:'GET',headers:{}},res);assert.equal(res.statusCode,401);}
});
