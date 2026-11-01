import {db} from './services.mjs';
import {roleQueries} from './matching.mjs';
const clip=(s,n=6000)=>typeof s==='string'?s.replace(/[\u0000-\u001f]/g,' ').slice(0,n):'';
const date=s=>/^\d{4}-\d{2}-\d{2}/.test(s||'')?s.slice(0,10):'';
const validId=n=>Number.isSafeInteger(Number(n))&&Number(n)>0;
export function externalQuery(c){
 const query={current_title:roleQueries(c.role)};
 if(c.location&&!/^(any location|global|remote|global \/ location flexible)$/i.test(c.location))query.location=[c.location];
 const brief=[c.role,...(c.mustHaves||[])].join(' ');
 if(/\bRIA\b|registered investment advis[oe]r/i.test(brief))query.keyword=['RIA'];
 else if(/\bRust\b/i.test(brief)){query.skills=['Rust'];if(/\bHFT\b|high.frequency|market making/i.test(brief)){query.keyword=['HFT'];query.current_title=[...new Set([...query.current_title,'HFT Developer','Quantitative Developer','Trading Systems Engineer'])];}}
 else if(/\bDeFi\b|decentrali[sz]ed finance/i.test(brief))query.keyword=['DeFi'];
 return query;
}
export function professionalRecord(p){
 const jobs=(Array.isArray(p.job_history)?p.job_history:[]).slice(0,20);
 return {person_name:clip(p.name,180),reported_company:clip(p.current_employer,200),position:clip(p.current_title,200),summary:clip(p.summary||p.description||'',6000),skills:(Array.isArray(p.skills)?p.skills:[]).filter(s=>typeof s==='string').slice(0,60),work_history:jobs.map(j=>({company_name:clip(j.company_name,200),description:clip(j.description||j.responsibilities||'',4000),title:clip(j.title,200),start_date:date(j.start_date),end_date:date(j.end_date),is_current:j.is_current===true})),location:clip(p.location,100)};
}
export function externalDiscovery(p,detailed=false){
 if(!validId(p.id||p.profile_id)||p.suppressed===true||typeof p.name!=='string'||!p.name.trim())return null;
 const id=Number(p.id||p.profile_id),record=professionalRecord(p);
 // Whitelist only professional fields. Contacts, photos, birth dates and raw payloads are discarded.
 return {source:'public',provider:'rocketreach',canonical_url:'https://rocketreach.co/person?pid='+id,person_name:record.person_name,reported_title:record.position,reported_company:record.reported_company,source_excerpt:'Professional data provider discovery; source material is assessed separately.',sources:[],_professionalRecord:detailed?record:null,_profileReadStatus:detailed?'provider_detail_read':'provider_preview_only',_assessmentAllowed:true};
}
export async function discoverExternal(criteria,ownerId,{fetcher=fetch,take=async(key,limit,window)=>await db('rpc/sp_take_rate_limit',{method:'POST',body:{p_key:key,p_limit:limit,p_window_seconds:window}})===true,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const key=process.env.ROCKETREACH_API_KEY;if(!key)return {records:[],status:'not_connected',lookups:0};
 const call=async(path,body)=>{
  const r=await fetcher('https://api.rocketreach.co/api/v2/'+path,{method:body?'POST':'GET',headers:{'Api-Key':key,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error(r.status===401?'authentication_failed':r.status===403?'access_denied':r.status===402?'credits_exhausted':r.status===429?'provider_rate_limit':'provider_unavailable');
  const text=await r.text();if(text.length>3000000)throw Error('provider_unavailable');try{return JSON.parse(text);}catch{throw Error('provider_unavailable');}
 };
 if(!await take('spearpoint-rocketreach-search-minute',20,60))return {records:[],status:'provider_rate_limit',lookups:0};
 let found;try{found=await call('search',{query:externalQuery(criteria),start:1,page_size:10});}catch(e){return {records:[],status:e.message,lookups:0};}
 if(!Array.isArray(found.profiles))return {records:[],status:'provider_unavailable',lookups:0};
 const previews=[...new Map(found.profiles.filter(p=>validId(p.id)&&p.suppressed!==true).map(p=>[p.id,p])).values()].slice(0,10);
 let lookups=0,detailStatus='complete';const details=new Map(),pending=[];
 for(const p of previews.slice(0,3)){
  if(!await take('spearpoint-rocketreach-lookups-daily',100,86400)){detailStatus='lookup_daily_limit';break;}
  try{lookups++;const d=await call('person/lookup?id='+encodeURIComponent(p.id));if(Number(d.id||d.profile_id)!==Number(p.id)){detailStatus='lookup_incomplete';continue;}if(d.status==='complete')details.set(p.id,d);else if(['pending','progress','searching','queued'].includes(d.status))pending.push(p.id);else detailStatus='lookup_incomplete';}catch(e){detailStatus=e.message;if(['credits_exhausted','provider_rate_limit','access_denied','authentication_failed'].includes(e.message))break;}
 }
 for(let attempt=0;pending.some(id=>!details.has(id))&&attempt<3;attempt++){await pause(3000);try{const polled=await call('person/checkStatus?'+pending.map(id=>'ids='+encodeURIComponent(id)).join('&'));const rows=Array.isArray(polled)?polled:polled.profiles||polled.records||[];for(const p of rows)if(p.status==='complete'&&pending.includes(Number(p.id||p.profile_id)))details.set(Number(p.id||p.profile_id),p);if(pending.some(id=>!details.has(id)))detailStatus='lookup_pending';}catch(e){detailStatus=e.message;}}
 if(detailStatus==='lookup_pending'&&pending.every(id=>details.has(id)))detailStatus='complete';
 const records=previews.map(p=>externalDiscovery(details.has(p.id)?{...p,...details.get(p.id),location:details.get(p.id).location||p.location,current_title:details.get(p.id).current_title||p.current_title,current_employer:details.get(p.id).current_employer||p.current_employer,name:details.get(p.id).name||p.name}:p,details.has(p.id))).filter(Boolean);
 return {records,status:detailStatus==='complete'?'searched':detailStatus,lookups,total:Number(found.pagination?.total)||records.length};
}
