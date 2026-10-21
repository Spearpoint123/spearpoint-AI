import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {savedArchetypes,findArchetype,catalogueVersion} from '../lib/archetype-store.mjs';
import handler from '../api/index.mjs';
test('every selectable role has a saved backend CV archetype and career progression',async()=>{
 const app=await readFile(new URL('../views/app.js',import.meta.url),'utf8');
 const roles=[...app.matchAll(/roles:\[([^\]]+)\]/g)].flatMap(match=>[...match[1].matchAll(/'([^']+)'/g)].map(value=>value[1]));
 assert.equal(roles.length,33);assert.deepEqual(new Set(roles),new Set(savedArchetypes.map(p=>p.role)));assert.equal(new Set(savedArchetypes.map(p=>p.id)).size,33);
 assert.ok(!app.includes("from './role-archetypes.js'"));assert.ok(app.includes('blueprint(input,currentArchetype)'));assert.equal(catalogueVersion,'2026-10-21.2');
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
test('all 33 CVs contain substantial role-specific histories, technology and contextual fictional metrics',()=>{
 assert.equal(new Set(savedArchetypes.map(p=>p.professionalSummary)).size,33);
 for(const p of savedArchetypes){
  assert.ok(p.professionalSummary.length>180,p.role);assert.ok(p.experienceYears>=10);assert.ok(p.leadershipScope.length>40);assert.ok(p.technologies.length>=5);assert.ok(p.markets.length>=3);
  assert.ok(p.careerHistory.every(s=>s.period&&s.environment!=='Capital markets or a relevant adjacent business'&&s.responsibilities.length>=3));
  assert.ok(p.metrics.length>=3);assert.ok(p.metrics.every(m=>m.label&&m.value&&m.context.length>20&&/example|hypothetical|scenario/i.test(m.context)&&m.hypothetical===true));assert.match(p.metricsDisclosure,/fictional/);
  assert.equal(p.kind,'synthetic');assert.equal(new Set(p.achievementExamples.map(a=>a.example)).size,3);
 }
 const trading=findArchetype({role:'Head of Trading',location:'London'});assert.ok(trading.technologies.includes('FIX connectivity'));assert.ok(trading.technologies.includes('Python'));
 const sales=findArchetype({role:'VP Sales',location:'New York'});assert.ok(sales.technologies.includes('Salesforce'));assert.ok(sales.metrics.some(m=>m.label==='Qualified win rate'));
});
test('PM performance scenario uses a unitless consistent Sharpe and explicit hypothetical context',()=>{
 const p=findArchetype({role:'Portfolio Manager',location:'Chicago'}),s=p.performanceScenario;
 assert.equal(s.hypothetical,true);assert.equal(s.periodMonths,36);assert.equal(s.netOfCostsAndFees,true);
 assert.ok(Math.abs((s.annualisedReturn-s.riskFreeRate)/s.annualisedVolatility-s.sharpeRatio)<1e-12);
 assert.equal(s.sharpeRatio,2);assert.equal(p.metrics.find(m=>m.label==='Sharpe ratio').value,'2.0');assert.ok(s.maximumDrawdown>0&&s.maximumDrawdown<1);
 assert.match(p.metrics.find(m=>m.label==='Sharpe ratio').context,/Unitless/);
});
