import {node} from '/talent.js';
export function candidateTable(candidates,{onStage,onIntro,onRequest}={}){
 const wrap=node('div','','candidate-table-wrap');const table=node('table','','candidate-table');table.setAttribute('aria-label','Confidential candidate comparison');const head=node('thead'),hr=node('tr');['Candidate profile','Must-have coverage','Gaps and next checks','Source / review','Pipeline','Introduction'].forEach(label=>hr.append(node('th',label)));head.append(hr);table.append(head);const body=node('tbody');
 if(!candidates.length){const row=node('tr'),cell=node('td','No records in this view. Clear the table filters or use Search internal & market above to source candidates.');cell.colSpan=6;row.append(cell);body.append(row);}
 for(const p of candidates){const row=node('tr');row.dataset.candidateId=p.id||p.reference;
  const identity=node('td');identity.append(node('span',p.reference,'reference'),node('strong',p.title));
  const checks=p.mustHaveChecks||[];
  if(checks.length===3){
   const list=node('ol','','must-have-evidence');
   for(const check of checks){const item=node('li');item.append(node('strong',check.requirement),node('small',check.status==='reviewed_evidence'?'Reviewed evidence':check.status==='source_supported'?'Source-backed experience':check.status==='source_mention'?'Source evidence · unverified':check.status==='source_conflict'?'Source needs clarification':'Research pending'),node('p',check.evidence.replace(/(?:\s*\[redacted\]\s*)+/g,' … ').trim()));list.append(item);}
   identity.append(list);
  }else identity.append(node('p','Set three must-haves to see an evidence check for each requirement.','table-summary'));
  const consult=node('a','Discuss this profile','button small-button profile-cta');consult.href='/consult?profile='+encodeURIComponent(p.reference);consult.setAttribute('aria-label','Discuss this profile '+p.reference);if(onRequest){const request=node('button',p.introduction?'Request '+p.introduction.status.replaceAll('_',' '):'Request details','small-button profile-cta');request.type='button';request.disabled=!!p.introduction;request.addEventListener('click',()=>onRequest(p,request));identity.append(request);}else identity.append(consult);
  const evidence=node('td');
  if(checks.length===3){evidence.append(node('strong',`${p.mustHaveSupported??p.mustHaveReviewed??0}/3 source-backed requirements`,p.researchStatus==='matched'||p.mustHaveReviewed===3?'status-good':'status-pending'),node('small',p.researchMethod==='source_grounded_ai'?'AI assessed source passages':p.mustHaveReviewed===3?'Specialist-reviewed evidence':'Further source research'),node('small',p.researchReadStatus==='detail_read_cv_read'?'CRM CV read':p.researchReadStatus?.includes('cv_')?'Professional record read; CV access needs a further check.':p.researchReadStatus==='page_read'?'Public biography read':p.researchReadStatus==='detail_read'?'Detailed CRM profile read':''));}
  else evidence.append(node('p','Three must-haves not yet set.'));
  const gaps=node('td');const list=node('ul');(p.gaps||[]).forEach(t=>list.append(node('li',t)));gaps.append(list);
  const source=node('td');source.append(node('span',p.sourceLabel||'Spearpoint CRM · reviewed'),node('small',p.reviewedAt?'Reviewed '+p.reviewedAt:p.checkedAt?'Discovered '+new Date(p.checkedAt).toLocaleDateString():'Review pending'));
  const pipeline=node('td');const select=node('select');select.setAttribute('aria-label','Pipeline for '+p.reference);[['new','New'],['saved','Saved'],['passed','Passed']].forEach(([value,label])=>{const o=node('option',label);o.value=value;select.append(o);});select.disabled=!onStage;select.value=p.pipeline_stage||'new';select.addEventListener('change',()=>onStage?.(p,select.value));pipeline.append(select);const notes=node('details');notes.append(node('summary','Private note'));const note=node('textarea');note.maxLength=1000;note.value=p.feedback||'';note.setAttribute('aria-label','Private feedback for '+p.reference);notes.append(note);const save=node('button','Save note','small-button');save.type='button';save.addEventListener('click',()=>onStage?.(p,select.value,note.value));notes.append(save);if(onStage)pipeline.append(notes);
  const intro=node('td');if(p.introduction)intro.append(node('span',p.introduction.status.replaceAll('_',' '),'status-pill'));else if(p.canRequestIntro){const b=node('button','Request specialist review','small-button');b.type='button';b.addEventListener('click',()=>onIntro?.(p));intro.append(b);}else intro.append(node('span',p.introUnavailableReason||'Available after review','guide-note'));
  row.append(identity,evidence,gaps,source,pipeline,intro);body.append(row);
 }
 table.append(body);wrap.append(table);return wrap;
}

export function researchComparison(candidates,options={}){
 const wrap=node('div');
 const matched=candidates.filter(p=>p.researchStatus==='matched'||p.mustHaveReviewed===3);
 const remaining=candidates.filter(p=>!matched.includes(p));
 wrap.append(node('h3',matched.length+' source-backed '+(matched.length===1?'match':'matches')));
 if(matched.length)wrap.append(candidateTable(matched,options));
 else wrap.append(node('p','The search has not yet substantiated all three requirements in one profile. Other sourced people remain below for further research.','notice-box'));
 if(remaining.length){const queue=node('details','','research-queue');queue.append(node('summary',remaining.length+' other sourced profiles · research incomplete'),node('p','These are real sourced records. Some requirements, source access or current credential details still need to be resolved.','guide-note'),candidateTable(remaining,options));wrap.append(queue);}
 return wrap;
}
