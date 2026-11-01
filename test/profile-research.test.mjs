import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {anonymiseExperience,researchPassages,validateAssessment,quotationSupportsRequirement,researchDiscoveries,researchProjection} from '../lib/profile-research.mjs';
import {publicAddress,sourceUrl,pageText,readSource,readPublicProfile} from '../lib/source-reader.mjs';
import {candidateDetail,hydrateCandidates,professionalDiscoveryPriority} from '../lib/services.mjs';
import {instantSearch} from '../lib/instant-search.mjs';
import {completeResearch} from '../lib/research-flow.mjs';
import {publicResearch} from '../lib/public-research.mjs';
import {gatewayFixture} from './provider-fixture.mjs';
const criteria={role:'Chief Technology Officer',family:'technology',location:'Any location',niches:[],requirements:[],customRequirements:[],otherRequirements:'None',mustHaves:['Rust systems experience','FIX protocol delivery','Led a team of 18 engineers']};
const response=x=>new Response(JSON.stringify(x));
async function fixture(fn){const old=globalThis.fetch,env={...process.env};Object.assign(process.env,{SUPABASE_URL:'https://pcezdsdhmjxpjakxtdhz.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',AI_GATEWAY_API_KEY:'fixture',RECRUIT_CRM_API_KEY:'fixture',RECRUIT_CRM_ENABLED:'true',RATE_LIMIT_HMAC_KEY:'fixture-research-reference-key-over-thirty-two-characters'});try{await fn();}finally{globalThis.fetch=old;process.env=env;}}
const record={slug:'private-slug',position:'CTO',first_name:'Jane',last_name:'Smith',current_organization:'Private Capital',candidate_summary:'Jane Smith built Rust systems at Private Capital. Delivered a FIX protocol gateway. Led a team of 18 engineers.',skill:'Rust, FIX',private_notes:'CONFIDENTIAL_NOTE',candidate_dob:'PRIVATE_DOB'};
function modelFixture({prompt}){const parsed=JSON.parse(prompt);assert.ok(!/Jane|Smith|Private Capital|CONFIDENTIAL_NOTE|PRIVATE_DOB|private-slug/.test(prompt));return {text:JSON.stringify({profiles:parsed.profiles.map(p=>({id:p.id,checks:criteria.mustHaves.map((r,i)=>{const term=['Rust systems','FIX protocol','18 engineers'][i],passage=p.passages.find(p=>p.text.includes(term));return {index:i,verdict:passage?'supported':'unresolved',passageId:passage?.id||null,quote:passage?.text||''};})}))})};}
test('CRM candidate_summary and work descriptions are read and private identity never enters the assessment',()=>{
 const text=anonymiseExperience(record.candidate_summary+' Email jane@private.com. Born in 1980. Salary 200000. at Goldman Sachs.',record,criteria);
 assert.ok(!/Jane|Smith|Private Capital|jane@|1980|200000|Goldman|Sachs/.test(text));assert.match(text,/Rust systems/);
 const passages=researchPassages({...record,candidate_summary:'Built Rust systems.',work_history:[{work_company_name:'Private Bank',work_description:'Delivered a FIX protocol gateway. Led a team of 18 engineers.'}]},criteria);
 assert.ok(passages.some(p=>p.kind==='work_history'&&p.text.includes('FIX protocol')));assert.ok(!/PRIVATE_DOB|CONFIDENTIAL_NOTE/.test(JSON.stringify(passages)));
});
test('fabricated quotes, wrong passage ids, numeric inflation and stale credentials cannot support a match',()=>{
 const passages=[{id:'p0',kind:'summary',text:'Led a team of 8 engineers.'},{id:'p1',kind:'summary',text:'Previously held an expired Series 3 qualification.'},{id:'p2',kind:'summary',text:'No Rust systems delivery experience.'}];
 assert.equal(validateAssessment({index:0,verdict:'supported',passageId:'p0',quote:'Led a team of 18 engineers.'},passages,criteria.mustHaves[2],0).verdict,'unresolved');
 assert.equal(validateAssessment({index:0,verdict:'supported',passageId:'p0',quote:passages[0].text},passages,criteria.mustHaves[2],0).verdict,'partial');
 assert.equal(validateAssessment({index:0,verdict:'supported',passageId:'p1',quote:passages[1].text},passages,'Active Series 3',0).verdict,'partial');
 assert.notEqual(validateAssessment({index:0,verdict:'supported',passageId:'p2',quote:passages[2].text},passages,'Rust systems experience',0).verdict,'supported');
 assert.equal(validateAssessment({index:1,verdict:'supported',passageId:'missing',quote:'Built Rust systems.'},passages,'Rust systems',1).verdict,'unresolved');
});
test('requirements outside the old keyword list receive three source-grounded semantic checks',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(true);
 const rows=await researchDiscoveries(criteria,[{source:'internal',person_name:'Jane Smith',reported_company:'Private Capital',_profileReadStatus:'detail_read',_professionalRecord:record,sources:[]}],{generate:async args=>modelFixture(args)});
 assert.equal(rows[0]._professionalRecord,undefined);const safe=researchProjection(rows[0],criteria);
 assert.equal(safe.mustHaveSupported,3);assert.equal(safe.researchStatus,'matched');assert.ok(safe.mustHaveChecks.every(c=>c.status==='source_supported'));assert.ok(!/Jane|Smith|Private Capital|CONFIDENTIAL_NOTE|PRIVATE_DOB/.test(JSON.stringify(safe)));
 assert.equal(researchProjection(rows[0],{...criteria,mustHaves:['Payments','Risk management','Cloud']}),null);
}));
test('a public search summary is not proof when its actual page cannot be read',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(true);let generated=false;
 const rows=await researchDiscoveries(criteria,[{source:'public',person_name:'Real Person',canonical_url:'https://firm.com/team/person',source_excerpt:'Built Rust systems. Delivered a FIX protocol gateway. Led a team of 18 engineers.',sources:[]}],{publicReader:async()=>({status:'page_unavailable',text:''}),generate:async()=>{generated=true;throw Error();}});
 assert.equal(generated,false);const safe=researchProjection(rows[0],criteria);assert.equal(safe.mustHaveSupported,0);assert.equal(safe.researchStatus,'research_queue');assert.equal(safe.researchReadStatus,'page_unavailable');assert.ok(safe.mustHaveChecks.every(c=>!c.evidence.includes('No supporting evidence')));
}));
test('full CRM hydration rechecks off-limits and preserves other records when a detail fails',()=>fixture(async()=>{
 globalThis.fetch=async(url)=>{url=String(url);if(url.includes('sp_candidate_submissions'))return response([]);if(url.includes('sp_search_runs'))return response(null);if(url.includes('sp_take_rate_limit'))return response(true);if(url.endsWith('/blocked'))return response({...record,slug:'blocked',off_limit:{off_limit:true}});if(url.endsWith('/unread'))return new Response('{}',{status:503});if(url.endsWith('/work-history'))return response([{candidate_slug:record.slug,work_description:'Delivered a FIX protocol gateway.'}]);return response(record);};
 const hydrated=await hydrateCandidates([{slug:record.slug,position:'CTO'},{slug:'blocked',position:'CTO'},{slug:'unread',position:'CTO'}],'CTO');
 assert.equal(hydrated.length,2);assert.equal(hydrated[0].summary,record.candidate_summary);assert.equal(hydrated[0].work_history.length,1);assert.equal(hydrated[1]._profileReadStatus,'detail_unavailable');assert.throws(()=>candidateDetail({...record,slug:'other'},record.slug),/crm_detail_contract/);
}));
test('public source reading blocks private addresses and pins a verified public DNS address',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.1.1','172.16.0.1','192.168.1.1','::1'])assert.equal(publicAddress(ip),false);assert.equal(publicAddress('93.184.216.34'),true);
 for(const url of ['http://firm.com','https://127.0.0.1','https://169.254.169.254','https://user:pass@firm.com','https://firm.com:8080','https://evil.internal'])assert.equal(sourceUrl(url),null);
 let contacted=false;await assert.rejects(readSource('https://firm.com',{resolve:async()=>[{address:'127.0.0.1'}],transport:()=>{contacted=true;}}),/source_blocked/);assert.equal(contacted,false);
 const transport=(_u,options,callback)=>{const req=new EventEmitter();req.setTimeout=()=>req;req.destroy=()=>{};options.lookup('firm.com',{},(_err,address)=>assert.equal(address,'93.184.216.34'));const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'text/html'};process.nextTick(()=>{callback(res);res.emit('data',Buffer.from('<article>Real Person built Rust systems.</article>'));res.emit('end');});return req;};
 const actual=await readSource('https://firm.com/team/person',{resolve:async()=>[{address:'93.184.216.34'}],transport});assert.match(pageText(actual.bytes.toString()),/Rust systems/);
});
test('a public biography requires the actual named person in readable page content',async()=>{
 const lead={person_name:'Real Person',canonical_url:'https://firm.com/team/person'};
 const yes=await readPublicProfile(lead,{reader:async()=>({contentType:'text/html',bytes:Buffer.from('<article><h1>Real Person</h1><p>Built Rust systems.</p></article>'),url:lead.canonical_url})});assert.equal(yes.status,'page_read');
 const no=await readPublicProfile(lead,{reader:async()=>({contentType:'text/html',bytes:Buffer.from('<article>Other Person</article>'),url:lead.canonical_url})});assert.equal(no.status,'page_unavailable');
});
test('deeper research cannot send a public search after the shared allowance is exhausted',()=>fixture(async()=>{
 let remainingAllowance=1,providerCalls=0,denied=0;const keys=[];
 globalThis.fetch=async(url,opts)=>{if(String(url).includes('sp_take_rate_limit')){const body=JSON.parse(opts.body);keys.push(body.p_key);assert.equal(body.p_limit,10);if(body.p_key==='spearpoint-public-web-daily'){if(remainingAllowance===0){denied++;return response(false);}remainingAllowance--;return response(true);}return response(true);}providerCalls++;return response(gatewayFixture({citations:[],choices:[{message:{content:'{"leads":[]}'}}]}));};
 await publicResearch(criteria,'owner');await completeResearch(criteria,[],'owner',{allowPublicFollowup:true});assert.equal(providerCalls,1);assert.equal(remainingAllowance,0);assert.equal(denied,1);assert.ok(keys.every(k=>k==='spearpoint-public-web-daily'||k==='spearpoint-public-owner:owner'));
}));
test('natural-language search hydrates actual records, reads work history and returns private three-reason profiles',()=>fixture(async()=>{
 let rows=[],detailRead=false,historyRead=false;
 globalThis.fetch=async(url,opts)=>{url=String(url);if(url.includes('sp_candidate_submissions'))return response([]);if(url.includes('sp_search_runs'))return response(null);if(url.includes('sp_take_rate_limit'))return response(true);if(url.includes('/candidates/search'))return response({data:[{slug:record.slug,position:'CTO',first_name:record.first_name,last_name:record.last_name,current_organization:record.current_organization}]});if(url.endsWith('/work-history')){historyRead=true;return response([{candidate_slug:record.slug,work_description:'Delivered a FIX protocol gateway. Led a team of 18 engineers.'}]);}if(url.endsWith('/candidates/'+record.slug)){detailRead=true;return response({...record,candidate_summary:'Jane Smith built Rust systems at Private Capital.'});}if(url.includes('sp_profile_approvals'))return response([]);if(url.includes('sp_public_discoveries')){if(opts.method==='POST'){rows=JSON.parse(opts.body);return response(null);}return response(rows);}if(url.includes('ai-gateway')){const b=JSON.parse(opts.body);if(b.model)return response({choices:[{message:{content:JSON.stringify(criteria)}}]});return response(gatewayFixture({citations:[],choices:[{message:{content:'{"leads":[]}'}}]}));}assert.fail(url);};
 const result=await instantSearch({id:'12345678-1234-4123-8123-123456789abc'},{query:'CTO',mustHaves:criteria.mustHaves,confirmed:true},()=>null,{generate:async args=>modelFixture(args)});
 assert.ok(detailRead&&historyRead);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].researchStatus,'matched');assert.equal(result.candidates[0].mustHaveSupported,3);assert.ok(!/Jane|Smith|Private Capital|CONFIDENTIAL_NOTE|PRIVATE_DOB|private-slug/.test(JSON.stringify(result)));
}));

test('available substantive experience prioritises deeper CRM reads without using a title as evidence',()=>{
 const good={position:'CTO',candidate_summary:'Built Rust systems and delivered a FIX protocol gateway.'},titleOnly={position:'CTO Rust FIX',candidate_summary:''};
 assert.ok(professionalDiscoveryPriority(good,criteria)>professionalDiscoveryPriority(titleOnly,criteria));
 assert.equal(professionalDiscoveryPriority(titleOnly,criteria),0);
});

test('a real but unrelated quotation cannot substantiate a technology or leadership requirement',()=>{
 assert.equal(quotationSupportsRequirement('Solidity experience','DeFi interoperation','summary'),false);
 assert.equal(quotationSupportsRequirement('Engineering leadership','A leader with 20 years experience in financial services.','summary'),false);
 assert.equal(quotationSupportsRequirement('DeFi experience','DeFi interoperation','skills'),false);
 assert.equal(quotationSupportsRequirement('Solidity experience','Developed production Solidity smart contracts.','summary'),true);
 assert.equal(quotationSupportsRequirement('Engineering leadership','Managed a team exceeding 100 engineers.','work_history'),true);
 assert.equal(quotationSupportsRequirement('NFA membership','Worked with NFA registered firms.','summary'),false);
});

test('blocked public profiles fall back only to cited biographies and verify the person',async()=>{
 const calls=[],lead={person_name:'Real Person',canonical_url:'https://www.linkedin.com/in/real-person',sources:[{url:'https://firm.com/team/real-person'},{url:'https://firm.com/team/other-person'}]};
 const result=await readPublicProfile(lead,{reader:async url=>{calls.push(url);if(url.includes('linkedin'))throw Error('blocked');return {url,contentType:'text/html',bytes:Buffer.from('<article><h1>Real Person</h1><p>Built Rust systems.</p></article>')};}});
 assert.equal(result.status,'page_read');assert.equal(result.url,'https://firm.com/team/real-person');assert.equal(calls.length,2);
});
