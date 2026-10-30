import {NICHES,FAMILIES,CAPABILITIES} from '/talent-taxonomy.js';
export const $=s=>document.querySelector(s);
export function node(tag,text='',className=''){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;}
export async function api(path,body={}){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){const e=Error(d.error||'Service unavailable');e.status=r.status;throw e;}return d;}
export const chosen=new Set();
try{const stored=JSON.parse(sessionStorage.getItem('sp-shortlist-draft')||'[]');stored.filter(x=>/^SP-[A-F0-9]{16}$/.test(x)).slice(0,25).forEach(x=>chosen.add(x));}catch{}
function remember(){try{sessionStorage.setItem('sp-shortlist-draft',JSON.stringify([...chosen]));}catch{}document.querySelectorAll('[data-profile-reference]').forEach(e=>{const selected=chosen.has(e.dataset.profileReference);e.textContent=selected?'Remove from shortlist':'Add to shortlist';e.setAttribute('aria-pressed',selected);});document.querySelectorAll('[data-draft-count]').forEach(e=>e.textContent=String(chosen.size));}
export function addButton(reference){const b=node('button',chosen.has(reference)?'Remove from shortlist':'Add to shortlist','outline-button');b.type='button';b.dataset.profileReference=reference;b.setAttribute('aria-pressed',chosen.has(reference));b.addEventListener('click',()=>{if(chosen.has(reference))chosen.delete(reference);else if(chosen.size<25)chosen.add(reference);b.textContent=chosen.has(reference)?'Remove from shortlist':'Add to shortlist';b.setAttribute('aria-pressed',chosen.has(reference));remember();});return b;}
export function card(p,{select=true}={}){
 const c=node('article','','confidential-profile');c.append(node('p',p.reference,'step'),node('h3',p.title),node('p',p.summary));
 if(p.matchLabel)c.append(node('p',p.matchLabel,p.requirementsMet?'evidence-match':'evidence-gap'));
 const chips=node('div','','chips');p.focus.forEach(x=>chips.append(node('span',x)));c.append(chips);
 const evidence=p.fitReasons||p.evidence?.map(e=>e.text)||[];
 if(evidence.length){c.append(node('h4','Reviewed evidence'));const list=node('ul');evidence.forEach(x=>list.append(node('li',x)));c.append(list);}
 if(p.gaps?.length){c.append(node('h4','Evidence gaps and next checks'));const list=node('ul');p.gaps.forEach(x=>list.append(node('li',x)));c.append(list);}
 c.append(node('p',`Reviewed ${p.reviewedAt}. Current interest and availability are unconfirmed.`,'guide-note'));
 if(select)c.append(addButton(p.reference));return c;
}
export function showCriteria(target,c){target.replaceChildren(node('p',`${c.role} · ${FAMILIES[c.family]||'Risk & compliance'} · ${c.location}`));target.append(node('p',c.niches?.length?`Sectors (${c.nicheMode==='any'?'any':'all'}): ${c.niches.join(', ')}`:'Sector: all supported niches'));target.append(node('p',c.requirements.length?'Required evidence: '+c.requirements.map(k=>CAPABILITIES[k]||k).join(', '):'No additional experience requirement interpreted.'));if(c.otherRequirements!=='None')target.append(node('p','Needs specialist review: '+c.otherRequirements));}

let interpretation,mandate,lastResult,mandateRevision=0;
const form=$('#mandate-form');
if(form){
 const status=$('#mandate-status'),results=$('#mandate-results');
 form.addEventListener('input',()=>{mandateRevision++;interpretation=null;lastResult=null;$('#mandate-review').hidden=true;results.hidden=true;$('#mandate-save').hidden=true;});
 const picker=$('#mandate-niche');if(picker)for(const niche of NICHES){const option=node('option',niche);option.value=niche;picker.append(option);}
 const examples={'Market makers & prop trading':'Operations leaders with quantitative trading firm experience.','Hedge funds':'Heads of Trading with hedge fund and quantitative research experience.','Exchanges':'CTOs who have built exchange infrastructure.','Digital assets':'Chief Product Officers with digital asset licensing experience.','Payments':'CTOs with payments and cloud infrastructure experience.','Fintech':'CEOs with fintech transformation experience.','Financial institutions':'Chief Revenue Officers with financial institutions experience.','AI infrastructure for finance':'AI leaders with LLM deployment experience in financial technology.'};
 picker?.addEventListener('change',()=>{if(examples[picker.value]&&!form.elements.mandate.value.trim()){form.elements.mandate.value=examples[picker.value];}});
 form.addEventListener('submit',async e=>{e.preventDefault();const revision=++mandateRevision;const button=form.querySelector('button');button.disabled=true;status.textContent='Interpreting your mandate…';results.hidden=true;
  try{mandate=form.elements.mandate.value;if($('#mandate-niche')?.value)mandate+='\nRequired sector: '+$('#mandate-niche').value+'.';const d=await api('/api/mandate/interpret',{mandate});if(revision!==mandateRevision)return;interpretation=d.criteria;showCriteria($('#mandate-criteria'),interpretation);$('#mandate-review').hidden=false;status.textContent=d.interpretation;}catch(e){if(revision===mandateRevision)status.textContent=e.message;}finally{button.disabled=false;}
 });
 $('#mandate-confirm').addEventListener('click',async()=>{if(!interpretation)return;const revision=mandateRevision;const button=$('#mandate-confirm');button.disabled=true;status.textContent='Checking reviewed evidence…';try{const d=await api('/api/mandate/search',{criteria:interpretation});if(revision!==mandateRevision)return;lastResult=d;$('#mandate-grid').replaceChildren(...d.profiles.map(p=>card(p)));const full=d.profiles.filter(p=>p.requirementsMet).length;$('#mandate-result-title').textContent=d.profiles.length?`${full} with evidence for all criteria · ${d.profiles.length-full} with gaps`:'No reviewed matches for these requirements';$('#mandate-coverage').textContent=d.coverage+' '+d.message;results.hidden=false;$('#mandate-save').hidden=false;status.textContent='Search complete. Review evidence and gaps before making a shortlist.';}catch(e){status.textContent=e.message;}finally{button.disabled=false;}});
 $('#save-mandate').addEventListener('click',async()=>{if(!lastResult)return;try{await api('/api/workspace/save-search',{title:$('#saved-search-title').value,mandate,criteria:interpretation});$('#save-status').textContent='Saved to your private workspace.';}catch(e){$('#save-status').textContent=e.message;if(e.status===401)$('#workspace-signin').hidden=false;}});
}
export function setupDraft(){const button=$('#save-draft');if(!button)return;remember();button.addEventListener('click',async()=>{try{if(!chosen.size)throw Error('Add at least one reviewed profile first.');await api('/api/workspace/save-shortlist',{title:$('#shortlist-title').value,references:[...chosen]});chosen.clear();remember();$('#draft-status').textContent='Shortlist saved. Open your workspace to share it and record outcomes.';}catch(e){$('#draft-status').textContent=e.message;if(e.status===401)$('#draft-signin').hidden=false;}});}
setupDraft();
