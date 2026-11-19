import {candidatePage} from './services.mjs';
import {scoreDemo} from './demo-data.mjs';

const HOST='https://api.recruitcrm.io/v1';
const clip=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n):'';
async function crmGet(path){
 const key=process.env.RECRUIT_CRM_API_KEY;
 if(process.env.RECRUIT_CRM_ENABLED!=='true'||!key)return null;
 const r=await fetch(HOST+path,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error(r.status===401?'crm_auth_rejected':r.status===429?'crm_rate_limited':`crm_http_${r.status}`);
 return r.json();
}
function localScore(record,query){
 const terms=String(query||'').toLowerCase().split(/[^a-z0-9+#]+/).filter(t=>t.length>2).slice(0,12);
 const fields=[record.position,record.skill,record.candidate_summary,record.summary,record.notes,record.city,Array.isArray(record.work_history)?record.work_history.map(w=>`${w.title||''} ${w.description||''}`).join(' '):''].map(v=>String(v||'').toLowerCase());
 const hits=terms.filter(t=>fields.some(f=>f.includes(t)));
 const reasons=hits.map(t=>{
  const where=[['title',record.position],['skills',record.skill],['summary',record.candidate_summary||record.summary],['notes',record.notes]].find(([,value])=>String(value||'').toLowerCase().includes(t));
  return where?`“${t}” appears in the RecruitCRM ${where[0]}.`:`“${t}” appears on the RecruitCRM record.`;
 });
 return {score:hits.length,matchReasons:reasons.length?reasons:['Title search returned this record. The extra words were not found in skills, summary or notes.']};
}
export function presentStaffRecord(record,query){
 const scored=localScore(record,query);
 const name=clip([record.first_name,record.last_name].filter(Boolean).join(' '),180)||'Unnamed record';
 return {
  slug:record.slug,name,title:clip(record.position,200),company:clip(record.current_organization,200),
  location:clip(record.city||record.locality,120),email:clip(record.email,254),
  summary:clip(record.candidate_summary||record.summary,600),notes:clip(record.notes,600),
  skills:clip(record.skill,400),linkedin:typeof record.linkedin==='string'&&/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(record.linkedin)?record.linkedin:'',
  fictional:record.fictional===true,source:record.fictional?'demonstration':'recruitcrm',
  ...scored,label:record.fictional?'Fictional demonstration profile. Not a real person.':'RecruitCRM record. Confirm interest before any outreach.'
 };
}
export async function staffSearch({text='',skills='',location=''}={}){
 const query=[text,skills,location].filter(Boolean).join(' ').trim().slice(0,240);
 if(query.length<2)throw Error('validation');
 if(process.env.RECRUIT_CRM_ENABLED!=='true'||!process.env.RECRUIT_CRM_API_KEY){
  const records=scoreDemo(query).map(p=>presentStaffRecord({...p,position:p.title,current_organization:p.company,city:p.location,skill:p.skills,candidate_summary:p.summary,first_name:p.name.split(' ')[0],last_name:p.name.split(' ').slice(1).join(' '),fictional:true,slug:p.slug},query));
  return {status:'demo',fictional:true,records,jobs:[],message:'RecruitCRM is not connected. These profiles are fictional demonstration data, not people in your database.'};
 }
 const position=text.slice(0,80)||skills.slice(0,80);
 const urls=[`/candidates/search?position=${encodeURIComponent(position)}&marked_as_off_limit=false&page=1`];
 if(skills.trim())urls.push(`/candidates/search?skill=${encodeURIComponent(skills.slice(0,80))}&marked_as_off_limit=false&page=1`);
 const pages=await Promise.all(urls.map(crmGet));
 const merged=new Map();
 for(const page of pages){const parsed=candidatePage(page);for(const row of parsed.records)if(row?.slug)merged.set(row.slug,row);}
 let records=[...merged.values()].slice(0,25).map(row=>presentStaffRecord(row,query));
 if(location.trim()){
  const city=location.trim().toLowerCase();
  const located=records.filter(r=>r.location.toLowerCase().includes(city)||!r.location);
  if(located.length)records=located;
 }
 records.sort((a,b)=>b.score-a.score);
 let jobs=[];
 try{const payload=await crmGet('/jobs?job_status=1&page=1');const parsed=candidatePage(payload);jobs=parsed.records.slice(0,15).map(j=>({id:j.slug||j.id,title:clip(j.name||j.job_title,160),company:clip(j.company_name||j.company,160),status:clip(j.job_status_label||'',40)})).filter(j=>j.title);}catch{jobs=[];}
 return {status:'searched',fictional:false,records,jobs,message:'Live RecruitCRM search across title, skills, summary and notes returned by the API. CV files are not downloaded. LinkedIn pages are not fetched.'};
}
export async function confirmedCrmNote({slug,note,confirm}){
 if(confirm!==true)return {sent:false,notice:'Nothing was written. Confirm the note before saving it to RecruitCRM.'};
 if(process.env.RECRUIT_CRM_WRITE!=='true'||!process.env.RECRUIT_CRM_API_KEY)return {sent:false,notice:'RecruitCRM write-back is off. Set RECRUIT_CRM_WRITE=true after you have reviewed the API contract. Nothing was sent.'};
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(slug||''))throw Error('validation');
 const body={related_to:slug,related_to_type:'candidate',description:clip(note,2000)};
 if(body.description.length<2)throw Error('validation');
 const r=await fetch(HOST+'/notes',{method:'POST',headers:{Accept:'application/json',Authorization:`Bearer ${process.env.RECRUIT_CRM_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('crm_http_'+r.status);
 return {sent:true,notice:'The note was saved in RecruitCRM. No message was sent to the candidate.'};
}
