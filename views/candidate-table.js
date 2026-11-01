import {professionalProfile,downloadProfile} from '/profile-document.js';
import {node} from '/talent.js';
function showProfessionalProfile(p){
 const v=professionalProfile(p),dialog=node('dialog','','professional-profile-dialog');dialog.setAttribute('aria-label','Anonymised professional profile '+v.reference);
 const close=node('button','Close','outline-button');close.type='button';close.addEventListener('click',()=>dialog.close());
 dialog.append(close,node('p',v.reference,'reference'),node('h2',v.title),node('p','Anonymised research profile · '+v.source,'guide-note'),node('h3','Why this person may suit your brief'));
 if(v.reasons.length){for(const r of v.reasons)dialog.append(node('h4',r.requirement),node('p',r.evidence));}else dialog.append(node('p','Review the experience below. The three must-have requirements have not yet been established.'));
 dialog.append(node('h3','Professional experience'));for(const fact of v.experience)dialog.append(node('p',fact.text),node('small',fact.source));
 if(v.checks.length){dialog.append(node('h3','Requirements to confirm'));for(const check of v.checks)dialog.append(node('h4',check.requirement),node('p',check.status));}
 const download=node('button','Download anonymised profile','small-button');download.type='button';download.addEventListener('click',()=>downloadProfile(p));dialog.append(download,node('p','Research profile, not a candidate-authored CV. Interest, availability and current credentials are checked before introduction.','guide-note'));
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
export function candidateTable(candidates,{onStage,onIntro,onRequest}={}){
 const wrap=node('div','','candidate-table-wrap');const table=node('table','','candidate-table');table.setAttribute('aria-label','Confidential candidate comparison');const head=node('thead'),hr=node('tr');['Professional experience','Why this person is relevant','Checks before introduction','Source','Pipeline','Introduction'].forEach(label=>hr.append(node('th',label)));head.append(hr);table.append(head);const body=node('tbody');
 if(!candidates.length){const row=node('tr'),cell=node('td','No records in this view. Clear the table filters or use Search internal & market above to source candidates.');cell.colSpan=6;row.append(cell);body.append(row);}
 for(const p of candidates){const row=node('tr');row.dataset.candidateId=p.id||p.reference;
  const identity=node('td');identity.append(node('span',p.reference,'reference'),node('strong',p.title));
  const checks=p.mustHaveChecks||[];
  if(p.professionalFacts?.length){const facts=node('ul');for(const fact of p.professionalFacts.slice(0,3)){const item=node('li',fact.text);item.append(node('small',fact.source));facts.append(item);}identity.append(facts);if(p.professionalFacts.length>3){const more=node('details');more.append(node('summary','More professional experience'));for(const fact of p.professionalFacts.slice(3))more.append(node('p',fact.text),node('small',fact.source));identity.append(more);}}
  else identity.append(node('p',p.summary||'Professional summary awaiting source review.','table-summary'));
  if(p.professionalFacts?.length){const view=node('button','View professional profile','small-button profile-cta');view.type='button';view.addEventListener('click',()=>showProfessionalProfile(p));const download=node('button','Download anonymised profile','outline-button small-button profile-cta');download.type='button';download.addEventListener('click',()=>downloadProfile(p));identity.append(view,download);}
  const consult=node('a','Discuss this profile','button small-button profile-cta');consult.href='/consult?profile='+encodeURIComponent(p.reference);consult.setAttribute('aria-label','Discuss this profile '+p.reference);if(onRequest){const request=node('button',p.introduction?'Details '+p.introduction.status.replaceAll('_',' '):'Request details','small-button profile-cta');request.type='button';request.disabled=!!p.introduction;request.addEventListener('click',()=>onRequest(p,request));identity.append(request);}else identity.append(consult);
  const evidence=node('td');
  const supported=checks.filter(c=>['source_supported','reviewed_evidence'].includes(c.status));
  if(supported.length){const list=node('ul');for(const check of supported){const item=node('li');item.append(node('strong',check.requirement),node('p',check.evidence.replace(/(?:\s*\[redacted\]\s*)+/g,' … ').trim()));list.append(item);}evidence.append(list);}
  else evidence.append(node('p','Relevant professional experience is shown alongside. The three required criteria are not yet established.'));
  const gaps=node('td'),pending=checks.filter(c=>!['source_supported','reviewed_evidence'].includes(c.status));
  if(pending.length){const details=node('details');details.append(node('summary',pending.length+' requirements to confirm'));for(const c of pending){details.append(node('strong',c.requirement));if(c.status==='source_conflict')details.append(node('p','Source information conflicts with this requirement.'));else if(c.status==='partial_source'||c.status==='source_mention')details.append(node('p','Some related experience is recorded; the full requirement needs confirmation.'));else details.append(node('p','This requirement has not been established from the available source.'));}gaps.append(details);}else gaps.append(node('p','All three criteria have supporting evidence. Interest, availability and current credentials are checked before introduction.'));
  const source=node('td');source.append(node('span',p.sourceLabel||'Spearpoint CRM · reviewed'),node('small',p.reviewedAt?'Reviewed '+p.reviewedAt:p.sourceCheckedAt?'Source checked '+new Date(p.sourceCheckedAt).toLocaleDateString():p.checkedAt?'Discovered '+new Date(p.checkedAt).toLocaleDateString():'Review pending'));
  const pipeline=node('td');const select=node('select');select.setAttribute('aria-label','Pipeline for '+p.reference);[['new','New'],['saved','Saved'],['passed','Passed']].forEach(([value,label])=>{const o=node('option',label);o.value=value;select.append(o);});select.disabled=!onStage;select.value=p.pipeline_stage||'new';select.addEventListener('change',()=>onStage?.(p,select.value));pipeline.append(select);const notes=node('details');notes.append(node('summary','Private note'));const note=node('textarea');note.maxLength=1000;note.value=p.feedback||'';note.setAttribute('aria-label','Private feedback for '+p.reference);notes.append(note);const save=node('button','Save note','small-button');save.type='button';save.addEventListener('click',()=>onStage?.(p,select.value,note.value));notes.append(save);if(onStage)pipeline.append(notes);
  const intro=node('td');if(p.introduction)intro.append(node('span',p.introduction.status.replaceAll('_',' '),'status-pill'));else if(p.canRequestIntro){const b=node('button','Request specialist review','small-button');b.type='button';b.addEventListener('click',()=>onIntro?.(p));intro.append(b);}else intro.append(node('span',p.introUnavailableReason||'Available after review','guide-note'));
  row.append(identity,evidence,gaps,source,pipeline,intro);body.append(row);
 }
 table.append(body);wrap.append(table);return wrap;
}

export function researchComparison(candidates,options={}){
 const wrap=node('div');
 const visible=candidates.filter(p=>p.evidenceReady===true||p.mustHaveReviewed===3);
 const matched=visible.filter(p=>p.researchStatus==='matched'||p.mustHaveReviewed===3);
 const remaining=visible.filter(p=>!matched.includes(p));
 if(matched.length){wrap.append(node('h3','Profiles with evidence for all three criteria'),candidateTable(matched,options));}
 if(remaining.length){wrap.append(node('h3','Professionals to explore'),node('p','These sourced profiles have substantive professional experience. Open the checks to see which requirements still need confirmation.','guide-note'),candidateTable(remaining,options));}
 if(!visible.length)wrap.append(node('p','The available records do not yet contain enough professional detail for a useful comparison. Further source research is needed before profiles can be presented.','notice-box'));
 const withheld=candidates.length-visible.length;if(withheld)wrap.append(node('p',withheld+' records held for further source research.','guide-note'));
 return wrap;
}
