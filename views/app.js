let currentSearch;
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
$('#search-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;$('#search-status').textContent='Checking for relevant, shareable profiles…';$('#results').hidden=true;currentSearch=null;
 try{
  const input=Object.fromEntries(new FormData(event.target));const data=await post('/api/search',input);currentSearch=input;
  $('#result-message').textContent=data.message;$('#result-tag').textContent=data.synthetic?'Synthetic planning profiles':'80%+ criteria · permission-based profiles';
  const grid=$('#profile-grid');grid.replaceChildren();data.profiles.forEach((profile,index)=>grid.append(profileCard(profile,index,data.bookingUrl)));
  $('#results').hidden=false;$('#search-status').textContent='Your profiles are ready. Review the experience, fit and gaps below.';$('#results').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(error){$('#search-status').textContent=error.message;}finally{button.disabled=false;}
});
$('#brief-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!currentSearch)return;const button=event.target.querySelector('button');button.disabled=true;$('#brief-status').textContent='Saving your briefing request…';
 try{const data=Object.fromEntries(new FormData(event.target));const result=await post('/api/brief',{...currentSearch,...data,consent:data.consent==='on'});$('#brief-status').textContent=`${result.message} Reference: ${result.reference}`;event.target.reset();}catch(error){$('#brief-status').textContent=error.message;}finally{button.disabled=false;}
});
