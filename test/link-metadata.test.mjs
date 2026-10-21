import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.mjs';
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=body}});
test('public landing strips tracking decoration without dropping functional parameters or changing staging authentication',async()=>{
 process.env.VERCEL='1';try{
 for(const [url,target] of [['/?_gl=1*example*_gcl_au*abc','/'],['/?_gl=a&role=Derivatives%20Sales&utm_source=test&gclid=b','/?role=Derivatives+Sales']]){const r=response();await handler({url,method:'GET',headers:{host:'ai.spearpointsearch.com'}},r);assert.equal(r.statusCode,302);assert.equal(r.headers.Location,target);}
 const clean=response();await handler({url:'/?role=CTO',method:'GET',headers:{host:'ai.spearpointsearch.com'}},clean);assert.equal(clean.statusCode,200);assert.equal(clean.headers.Location,undefined);
 const privateSite=response();await handler({url:'/?_gl=a',method:'GET',headers:{host:'spearpoint-ai-staging-psi.vercel.app'}},privateSite);assert.equal(privateSite.headers.Location,undefined);assert.match(privateSite.body.toString(),/login-form/);
 }finally{delete process.env.VERCEL;}
});
test('share metadata has one clean canonical URL and accessible branded image',async()=>{
 process.env.VERCEL='1';try{const r=response();await handler({url:'/',method:'GET',headers:{host:'ai.spearpointsearch.com'}},r);const html=r.body.toString();assert.equal((html.match(/rel="canonical"/g)||[]).length,1);assert.match(html,/rel="canonical" href="https:\/\/ai.spearpointsearch.com\/"/);for(const name of ['og:title','og:description','og:url','og:image','og:image:alt','twitter:card','twitter:image'])assert.ok(html.includes('"'+name+'"'));assert.match(html,/<meta name="description"/);const img=response();await handler({url:'/hero-knight.png',method:'GET',headers:{host:'ai.spearpointsearch.com'}},img);assert.equal(img.headers['Content-Type'],'image/png');assert.ok(img.body.length>10000);}finally{delete process.env.VERCEL;}
});
