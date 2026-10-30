import {node} from '/talent.js';
export function candidateTable(candidates,{onStage,onIntro}={}){
 const wrap=node('div','','candidate-table-wrap');const table=node('table','','candidate-table');table.setAttribute('aria-label','Confidential candidate comparison');const head=node('thead'),hr=node('tr');['Candidate profile','Must-have coverage','Gaps and next checks','Source / review','Pipeline','Introduction'].forEach(label=>hr.append(node('th',label)));head.append(hr);table.append(head);const body=node('tbody');
 if(!candidates.length){const row=node('tr'),cell=node('td','No records in this view. Clear the table filters or use Search internal & market above to source candidates.');cell.colSpan=6;row.append(cell);body.append(row);}
 for(const p of candidates){const row=node('tr');row.dataset.candidateId=p.id||p.reference;
  const identity=node('td');identity.append(node('span',p.reference,'reference'),node('strong',p.title));
  const checks=p.mustHaveChecks||[];
  if(checks.length===3){
   const list=node('ol','','must-have-evidence');
   for(const check of checks){const item=node('li');item.append(node('strong',check.requirement),node('small',check.status==='reviewed_evidence'?'Reviewed evidence':check.status==='source_mention'?'Source evidence · unverified':'Evidence needed'),node('p',check.evidence));list.append(item);}
   identity.append(list);
  }else identity.append(node('p','Set three must-haves to see an evidence check for each requirement.','table-summary'));
  const consult=node('a','Discuss this profile','button small-button profile-cta');consult.href='/consult?profile='+encodeURIComponent(p.reference);consult.setAttribute('aria-label','Discuss this profile '+p.reference);identity.append(consult);
  const evidence=node('td');
  if(checks.length===3){evidence.append(node('strong',`${p.mustHaveReviewed||0}/3 with reviewed evidence`,p.mustHaveReviewed===3?'status-good':'status-pending'),node('p',`${p.mustHaveMentions||0}/3 with related source mentions`),node('small','Each requirement is checked separately.'));}
  else evidence.append(node('p','Three must-haves not yet set.'));
  const gaps=node('td');const list=node('ul');(p.gaps||[]).forEach(t=>list.append(node('li',t)));gaps.append(list);
  const source=node('td');source.append(node('span',p.sourceLabel||'Spearpoint CRM · reviewed'),node('small',p.reviewedAt?'Reviewed '+p.reviewedAt:p.checkedAt?'Discovered '+new Date(p.checkedAt).toLocaleDateString():'Review pending'));
  const pipeline=node('td');const select=node('select');select.setAttribute('aria-label','Pipeline for '+p.reference);[['new','New'],['saved','Saved'],['passed','Passed']].forEach(([value,label])=>{const o=node('option',label);o.value=value;select.append(o);});select.disabled=!onStage;select.value=p.pipeline_stage||'new';select.addEventListener('change',()=>onStage?.(p,select.value));pipeline.append(select);const notes=node('details');notes.append(node('summary','Private note'));const note=node('textarea');note.maxLength=1000;note.value=p.feedback||'';note.setAttribute('aria-label','Private feedback for '+p.reference);notes.append(note);const save=node('button','Save note','small-button');save.type='button';save.addEventListener('click',()=>onStage?.(p,select.value,note.value));notes.append(save);if(onStage)pipeline.append(notes);
  const intro=node('td');if(p.introduction)intro.append(node('span',p.introduction.status.replaceAll('_',' '),'status-pill'));else if(p.canRequestIntro){const b=node('button','Request specialist review','small-button');b.type='button';b.addEventListener('click',()=>onIntro?.(p));intro.append(b);}else intro.append(node('span',p.introUnavailableReason||'Available after review','guide-note'));
  row.append(identity,evidence,gaps,source,pipeline,intro);body.append(row);
 }
 table.append(body);wrap.append(table);return wrap;
}
