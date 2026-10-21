let currentSearch;
let currentReport;
let guideStep=0;
const selection={};
const $=s=>document.querySelector(s);
async function post(url,data){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.error||'Service unavailable');return result;}
function el(tag,text,cls){const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;}
function section(card,title,items){
 if(!Array.isArray(items)||!items.length)return;
 card.append(el('h4',title,'profile-section-title'));
 const list=el('ul','','profile-highlights');items.forEach(item=>list.append(el('li',item)));card.append(list);
}
function profileCard(profile,index,bookingUrl){
 const card=el('article','','card');
 card.append(el('div',`${String(index+1).padStart(2,'0')} / ${profile.kind==='synthetic'?'ILLUSTRATIVE':'REAL · REDACTED'}`,'card-top'),el('span',profile.label,'badge'));
 if(profile.kind==='real'&&Number.isFinite(profile.matchScore))card.append(el('p',`${profile.matchScore}% of scored criteria matched`,'match-score'));
 card.append(el('h3',profile.title),el('p',profile.summary));
 const chips=el('div','','chips');profile.focus.forEach(s=>chips.append(el('span',s)));card.append(chips);
 section(card,'Experience',profile.experience);
 section(card,'Why it could fit',profile.fitReasons);
 section(card,'Gaps to discuss',profile.gaps);
 if(profile.matchBasis){const detail=el('details','','match-method');detail.append(el('summary','How this is assessed'),el('p',profile.matchBasis));card.append(detail);}
 const booking=el('a','Discuss this profile ↗','card-booking');booking.href=bookingUrl;booking.target='_blank';booking.rel='noopener noreferrer';
 card.append(booking,el('p',profile.availability,'availability'));return card;
}
const niches={
 'Exchanges':{hint:'Trading venues, liquidity and market infrastructure',skills:['Trading systems','Market structure','Operational resilience']},
 'Digital assets':{hint:'Custody, tokenisation and institutional adoption',skills:['Digital asset infrastructure','Institutional adoption','Risk management']},
 'Payments':{hint:'Money movement, acquiring and payment infrastructure',skills:['Payment infrastructure','Commercial partnerships','Operational resilience']},
 'Fintech':{hint:'Financial technology built for the next stage of growth',skills:['Financial technology','Platform scale','Regulated environments']},
 'Banking & investment':{hint:'Financial institutions, investment and wealth',skills:['Financial services','Risk management','Business transformation']},
 'Technology & SaaS':{hint:'Platforms, enterprise software and product businesses',skills:['Enterprise software','Platform scale','Product strategy']}
};
const functions={
 'Technology & engineering':{roles:['Chief Technology Officer','VP Engineering','Head of Engineering','Chief Information Security Officer'],mandate:'Build the technical foundations for the next stage of growth.',pillars:[['Architecture that scales','Set a platform direction that supports the commercial roadmap.'],['Teams that deliver','Develop engineering leadership and a clear delivery rhythm.'],['Resilience by design','Balance speed, security and operational reliability.']]},
 'Commercial & growth':{roles:['Chief Revenue Officer','Chief Commercial Officer','VP Sales','Head of Business Development'],mandate:'Turn market opportunity into a repeatable commercial engine.',pillars:[['Market focus','Identify the segments and partnerships that deserve investment.'],['Commercial execution','Bring structure to pipeline, sales leadership and accountability.'],['Durable growth','Connect revenue ambitions with customer value and retention.']]},
 'Product & strategy':{roles:['Chief Product Officer','VP Product','Head of Product','Head of Strategy'],mandate:'Connect customer needs, product choices and commercial ambition.',pillars:[['Product direction','Translate market insight into a focused roadmap.'],['Prioritisation','Make deliberate choices about what to build and why.'],['Cross-functional leadership','Align product, engineering and commercial teams.']]},
 'Risk & compliance':{roles:['Chief Risk Officer','Chief Compliance Officer','Head of Compliance','Head of Financial Crime'],mandate:'Enable growth with clear risk ownership and credible controls.',pillars:[['Regulatory judgement','Navigate the requirements relevant to your business and markets.'],['Practical controls','Build a proportionate operating framework.'],['Leadership confidence','Make risk decisions clear to the board and the business.']]},
 'Operations & finance':{roles:['Chief Operating Officer','Chief Financial Officer','Head of Operations','Finance Director'],mandate:'Create the operating discipline to support your next stage.',pillars:[['Operating clarity','Establish ownership, cadence and decision-making.'],['Financial discipline','Connect resources and investment to business priorities.'],['Execution at scale','Strengthen processes as the organisation grows.']]},
 'Executive leadership':{roles:['Chief Executive Officer','Managing Director','General Manager','Chief People Officer'],mandate:'Set the direction and build the leadership capacity to deliver it.',pillars:[['Strategic direction','Turn an ambitious vision into clear priorities.'],['Leadership depth','Build an accountable and aligned senior team.'],['Business impact','Connect culture, execution and commercial outcomes.']]}
};
const markets=['London','United Kingdom','Europe','New York','United States','Dubai','Abu Dhabi','Singapore','Hong Kong','Global / location flexible'];
function optionButton(title,hint,handler){const button=el('button','','choice');button.type='button';button.append(el('strong',title));if(hint)button.append(el('small',hint));button.addEventListener('click',handler);return button;}
function advance(key,value){selection[key]=value;guideStep++;drawGuide();}
function drawGuide(){
 const titles=['Where are you building?','Which team needs to move forward?','Which role is closest to your brief?','Where will this leader make an impact?'];
 const intros=['Choose your niche. We’ll help you pinpoint the leadership your business needs.','Choose the function at the heart of your next hire.','Choose a starting point. We’ll refine the exact title and scope with you.','Choose the closest market. Location and working arrangements can be refined on a call.'];
 $('#search-title').textContent=titles[guideStep];$('#guide-intro').textContent=intros[guideStep];
 document.querySelectorAll('.journey li').forEach((item,i)=>{item.className=i===guideStep?'active':i<guideStep?'complete':'';if(i===guideStep)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
 const panel=$('#choice-panel');panel.replaceChildren();const choices=el('div','','choice-grid');
 if(guideStep===0)Object.entries(niches).forEach(([key,value])=>choices.append(optionButton(key,value.hint,()=>advance('niche',key))));
 if(guideStep===1)Object.entries(functions).forEach(([key,value])=>choices.append(optionButton(key,value.roles.slice(0,2).join(' · '),()=>advance('function',key))));
 if(guideStep===2){
  const label=el('label','Find a role in the suggested list');const filter=el('input');filter.type='search';filter.placeholder='Search titles, e.g. CTO or Head of Product';label.append(filter);panel.append(label);
  const populate=()=>{choices.replaceChildren();const query=filter.value.toLowerCase().trim();const roles=query?Object.values(functions).flatMap(value=>value.roles).filter(role=>(role.split(' ').map(w=>w[0]).join('').toLowerCase()===query||role.toLowerCase().split(/\s+/).some((_,i,words)=>words.slice(i).join(' ').startsWith(query)))):functions[selection.function].roles;
   roles.forEach(role=>choices.append(optionButton(role,'Explore this target profile ↗',()=>{selection.function=Object.keys(functions).find(key=>functions[key].roles.includes(role));advance('role',role);})));if(!roles.length)choices.append(el('p','No listed title matches. Clear your search to choose the closest role; we can refine it on a briefing call.'));};
  filter.addEventListener('input',populate);populate();
 }
 if(guideStep===3)markets.forEach(market=>{const button=optionButton(market,'',()=>{selection.location=market;drawGuide();});button.setAttribute('aria-pressed',String(selection.location===market));choices.append(button);});
 panel.append(choices);$('#guide-back').hidden=guideStep===0;$('#guide-context').textContent=[selection.niche,guideStep>1?selection.function:null,guideStep>2?selection.role:null].filter(Boolean).join(' / ');$('#search-submit').hidden=guideStep!==3||!selection.location;
}
$('#guide-back').addEventListener('click',()=>{guideStep=Math.max(0,guideStep-1);$('#results').hidden=true;drawGuide();});
function blueprint(input){
 const spec=functions[selection.function];const article=el('article','','blueprint');
 const top=el('div','','blueprint-top');top.append(el('span',selection.niche.toUpperCase()+' / '+input.location.toUpperCase(),'step'),el('span','Illustrative target profile','blueprint-label'));article.append(top);
 const core=el('div','','blueprint-core');const story=el('div','','blueprint-story');story.append(el('span','THE MANDATE','step'),el('h3',input.role),el('p',spec.mandate,'mandate'));
 const chips=el('div','','chips');niches[selection.niche].skills.forEach(skill=>chips.append(el('span',skill)));const call=el('a','Discuss this search ↗','button');call.href='https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone';call.target='_blank';call.rel='noopener noreferrer';story.append(chips,call,el('p','A target to shape your search—not a real person or a statement of candidate availability.','blueprint-disclosure'));core.append(story);
 const pillars=el('div','','capabilities');spec.pillars.forEach(([title,description],index)=>{const row=el('div','','capability');row.append(el('span','0'+(index+1),'capability-number'));const text=el('div');text.append(el('h4',title),el('p',description));row.append(text);pillars.append(row);});core.append(pillars);article.append(core);
 const question=el('div','','brief-question');question.append(el('span','THE QUESTION WORTH A CONVERSATION','step'),el('p','What would this leader need to change in their first 12 months?'));article.append(question);return article;
}
$('#search-form').addEventListener('submit',async event=>{
 event.preventDefault();if(guideStep!==3||!selection.location)return;
 const button=$('#search-submit');button.disabled=true;$('#search-status').textContent='Building your target profile and checking relevant, shareable CRM profiles…';$('#results').hidden=true;$('#market-brief').hidden=true;currentSearch=null;currentReport=null;
 try{
  const input={role:selection.role,location:selection.location,skills:niches[selection.niche].skills.join(', ')};
  const data=await post('/api/search',input);currentSearch=input;const grid=$('#profile-grid');grid.replaceChildren();
  $('#result-tag').textContent=data.synthetic?'Your search blueprint':'Permission-based profile preview';
  $('#result-message').textContent=data.synthetic?data.crmStatus==='unavailable'?"The live profile check couldn’t complete. Explore this target brief, then discuss a tailored search with us.":'Here is a focused starting point for your hire. A briefing turns this target into a search tailored to your business.':data.message;
  if(data.synthetic)grid.append(blueprint(input));else data.profiles.forEach((profile,index)=>grid.append(profileCard(profile,index,data.bookingUrl)));
  buildMarketBrief(input,data.crmStatus);grid.classList.toggle('blueprint-grid',data.synthetic);$('#results').hidden=false;$('#search-status').textContent='Your target profile is ready.';$('#results').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(error){$('#search-status').textContent=error.message;}finally{button.disabled=false;}
});
drawGuide();
const salaryGuide='https://www.spearpointsearch.com/resources/salary-guide';
const sectorPages={
 'Exchanges':'https://www.spearpointsearch.com/exchanges-venues-executive-search',
 'Digital assets':'https://www.spearpointsearch.com/digital-assets-crypto-executive-search',
 'Payments':'https://www.spearpointsearch.com/fintech-payments-executive-search',
 'Fintech':'https://www.spearpointsearch.com/fintech-payments-executive-search'
};
const pools={
 'Exchanges':['Trading venues and exchange infrastructure','Market makers and liquidity providers','Institutional brokerage and trading technology'],
 'Digital assets':['Custody and digital asset infrastructure','Institutional financial services with digital asset teams','Exchanges and prime brokerage'],
 'Payments':['Payment processors and acquiring platforms','Banks with payments infrastructure teams','Financial technology and embedded finance businesses'],
 'Fintech':['Financial technology platforms','Banks and financial infrastructure businesses','Adjacent software businesses with relevant operating complexity'],
 'Banking & investment':['Banks and investment businesses','Financial market infrastructure','Financial technology businesses with relevant regulatory exposure'],
 'Technology & SaaS':['Enterprise software and platform businesses','Adjacent product companies at a comparable growth stage','Financial technology businesses where the mandate overlaps']
};
function buildMarketBrief(input,crmStatus){
 const spec=functions[selection.function];const niche=selection.niche;
 currentReport={role:input.role,location:input.location,niche,function:selection.function,prepared:new Date().toISOString().slice(0,10),crmStatus,
 sections:[
  {title:'Salary guide',eyebrow:'01 / COMPENSATION',intro:`Benchmark ${input.role} in ${input.location} against the scope of your mandate.`,items:['Use the Spearpoint Compensation Guide as a starting point, then confirm that sector, function, seniority and city match your brief.','Compare base salary, target bonus and long-term incentives separately. Equity or token arrangements need their own valuation and terms.','An exact salary band is not reproduced here. Where the selected role or market is absent, request a tailored benchmark rather than substitute an unrelated figure.'],source:{label:'Spearpoint Compensation Guide · 2026 / 2027 edition, September 2026',url:salaryGuide},action:'Open the salary guide ↗',note:'Source checked 21 October 2026. The guide uses researched ranges and location indices; its percentiles are not a large-sample survey statistic.'},
  {title:'Candidate landscape',eyebrow:'02 / SEARCH DIRECTION',intro:`Where we would start exploring a ${niche.toLowerCase()} leadership search.`,items:pools[niche].map(pool=>`Potential talent pool: ${pool}.`),source:sectorPages[niche]?{label:'Spearpoint sector search overview',url:sectorPages[niche]}:null,action:'Explore the sector ↗',note:'These are proposed sourcing directions, not measured talent supply, candidate counts or evidence of availability. Validate transferable experience against the mandate.'},
  {title:'Talent insight',eyebrow:'03 / SHAPE THE MANDATE',intro:spec.mandate,items:[...spec.pillars.map(([title,description])=>`${title}: ${description}`),'Before launching: agree the first-year outcomes, essential experience, reporting line and the flexibility of the package.'],source:null,note:'Planning guidance based on your selected function and niche. A consultant should validate it against your business stage and exact role.'}
 ]};
 $('#market-context').textContent=`${input.role} / ${niche} / ${input.location}`;
 const container=$('#market-sections');container.replaceChildren();
 currentReport.sections.forEach(part=>{
  const card=el('article','','insight-card');card.append(el('span',part.eyebrow,'step'),el('h3',part.title),el('p',part.intro,'insight-intro'));section(card,'What to consider',part.items);
  if(part.source){const link=el('a',part.action,'insight-source');link.href=part.source.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link,el('p',part.source.label,'source-caption'));}
  card.append(el('p',part.note,'insight-note'));container.append(card);
 });
 $('#market-brief').hidden=false;$('#download-status').textContent='';
}
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
$('#download-brief').addEventListener('click',()=>{
 if(!currentReport)return;const r=currentReport,e=escapeHtml;
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spearpoint hiring market brief — ${e(r.role)}</title><style>body{font:15px/1.7 Arial,sans-serif;color:#183d32;max-width:850px;padding:40px 24px;margin:auto}h1,h2{font-family:Georgia,serif;font-weight:400}h1{font-size:40px;line-height:1.2}header{border-bottom:3px solid #183d32;padding-bottom:25px}.brand{font-weight:bold;letter-spacing:2px}section{padding:24px 0;border-bottom:1px solid #d9dfd4}a{color:#285844}.note,footer{font-size:12px;color:#63706a}li{margin:10px 0}.call{padding:22px;background:#edf2e5} @media print{body{padding:0}a{color:inherit}section{break-inside:avoid}}</style></head><body><header><p class="brand">↗ SPEARPOINT AI</p><p>HIRING MARKET BRIEF / PRIVATE STAGING</p><h1>${e(r.role)}</h1><p>${e(r.niche)} · ${e(r.location)} · Prepared ${e(r.prepared)}</p><p class="note">Search-planning guidance. No candidate identities, availability claims or unsourced compensation figures are included.</p></header>${r.sections.map(part=>`<section><p class="note">${e(part.eyebrow)}</p><h2>${e(part.title)}</h2><p>${e(part.intro)}</p><ul>${part.items.map(item=>`<li>${e(item)}</li>`).join('')}</ul>${part.source?`<p><a href="${e(part.source.url)}">${e(part.source.label)}</a></p>`:''}<p class="note">${e(part.note)}</p></section>`).join('')}<section class="call"><h2>Turn the brief into a focused search.</h2><p>Discuss the mandate, validate the market and agree your next move.</p><a href="https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone">Book your hiring briefing ↗</a></section><footer><p>This brief is generated from your selected niche, function, role and market. Candidate landscape and talent insight are planning recommendations, not a live market survey. Salary guidance links to the published Spearpoint source; no specific role/market band has been independently verified here.</p><p>Open this file in a browser to read it, or use Print → Save as PDF to keep a PDF copy.</p></footer></body></html>`;
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const link=el('a');link.href=url;link.download=`spearpoint-hiring-brief-${r.role.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.html`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#download-status').textContent='Your brief download has started. Open it in a browser to read it or print it as a PDF.';
});
$('#request-report').addEventListener('click',()=>{
 if(!currentReport)return;$('#brief-details').open=true;$('#brief-form [name=notes]').value=`Please follow up with a tailored hiring market brief for ${currentReport.role} in ${currentReport.location}, within ${currentReport.niche}. I would like to discuss salary benchmarking, candidate landscape and talent insight.`;$('#brief-details').scrollIntoView({behavior:'smooth',block:'start'});$('#brief-form [name=name]').focus({preventScroll:true});
});
$('#brief-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!currentSearch)return;const button=event.target.querySelector('button');button.disabled=true;$('#brief-status').textContent='Saving your briefing request…';
 try{const data=Object.fromEntries(new FormData(event.target));const result=await post('/api/brief',{...currentSearch,...data,notes:`${data.notes||'Hiring briefing request'}\nSearch context: ${currentReport?.niche||selection.niche}; ${currentReport?.function||selection.function}. Report version: 2026-10-21.`,consent:data.consent==='on'});$('#brief-status').textContent=`${result.message} Reference: ${result.reference}`;event.target.reset();}catch(error){$('#brief-status').textContent=error.message;}finally{button.disabled=false;}
});
