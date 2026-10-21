import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {roleArchetypes,targetArchetype} from '../views/role-archetypes.js';
import handler from '../api/index.mjs';
test('every selectable role has a complete, distinct illustrative target',async()=>{
 const app=await readFile(new URL('../views/app.js',import.meta.url),'utf8');
 const roles=[...app.matchAll(/roles:\[([^\]]+)\]/g)].flatMap(match=>[...match[1].matchAll(/'([^']+)'/g)].map(value=>value[1]));
 assert.equal(roles.length,33);assert.deepEqual(new Set(roles),new Set(Object.keys(roleArchetypes)));
 assert.equal(new Set(Object.values(roleArchetypes).map(value=>value.mandate)).size,roles.length);
 for(const role of roles){const p=targetArchetype(role,'Market makers & prop trading','Chicago');assert.equal(p.kind,'synthetic');assert.equal(p.location,'Chicago');assert.equal(p.experience.length,3);assert.equal(p.focus.length,3);assert.equal(p.pillars.length,3);assert.match(p.baseFocus,/150,000/);assert.ok(p.question.length>30);}
});
test('market-making archetype addresses liquidity, inventory and venue risk rather than a generic trading mandate',()=>{
 const p=targetArchetype('Head of Market Making','Market makers & prop trading','London');assert.match(p.mandate,/liquidity/);assert.match(p.experience.join(' '),/inventory/);assert.match(p.experience.join(' '),/venue/);assert.notEqual(p.mandate,roleArchetypes['Head of Trading'].mandate);assert.throws(()=>targetArchetype('Invented role','Exchanges','London'));
});
test('trial font files remain unavailable before staging sign-in',async()=>{
 for(const url of ['/GT-Canon-VF.ttf','/GT-Standard-VF.ttf']){const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};await handler({url,method:'GET',headers:{}},res);assert.equal(res.statusCode,401);}
});
