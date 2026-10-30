import {randomUUID} from 'node:crypto';
import {db,discoverInternal,profileReference} from './services.mjs';
import {interpretMandate,searchMandate,assessMandate} from './talent-search.mjs';
import {publicResearch} from './public-research.mjs';
import {text} from './domain.mjs';
// Only finite, non-identifying professional descriptors can leave a pending record.
export function pendingDiscovery(criteria,row){
 const vocabulary=[[/\bquant(?:itative)?\b/i,'Quantitative investment'],[/\bequity\b/i,'Equity investment'],[/\btoken\b/i,'Token strategies'],[/\bcredit\b/i,'Credit investment'],[/\bfixed income\b/i,'Fixed income'],[/\bmulti[- ]asset\b/i,'Multi-asset investment'],[/\bcommodit(?:y|ies)\b/i,'Commodities']];
 const focus=vocabulary.filter(([re])=>re.test(row.reported_title||'')).map(([,label])=>label);
 return {id:row.id,reference:row.reference,source:row.source||'public',title:criteria.role,summary:focus.length?'Source-reported professional focus: '+focus.join(', ')+'.':'A professional record was discovered for this request.',focus,fitReasons:[],gaps:['A specialist must verify the brief requirements, location, current role, interest and sharing approval.'],reviewStatus:'pending',sourceLabel:row.source==='internal'?'Spearpoint CRM · unreviewed':'Public market · unreviewed',checkedAt:row.discovered_at,canRequestIntro:false,introUnavailableReason:'Evidence review required before an introduction.'};
}
const live=()=>`expires_at=gt.${encodeURIComponent(new Date().toISOString())}`;
export async function instantResults(user,searchId,approvedExternal){
 const rows=await db(`sp_public_discoveries?owner_id=eq.${user.id}&search_id=eq.${searchId}&${live()}&limit=50`);
 return rows.filter(r=>r.review_status!=='rejected').map(row=>{const safe=approvedExternal(row),assessed=safe?assessMandate(row.search_criteria,safe):null;return safe?(assessed?{...assessed,id:row.id,source:row.source,reviewStatus:'approved',canRequestIntro:false,introUnavailableReason:'Speak to a consultant to arrange an introduction.'}:null):row.review_status==='approved'?null:pendingDiscovery(row.search_criteria,row);}).filter(Boolean);
}
export async function instantSearch(user,body,approvedExternal){
 if(body.confirmed!==true)throw Error('validation');const query=text(body.query,3,1500);
 const {criteria}=await interpretMandate('Find candidates: '+query,{timeoutMs:12000});
 if(criteria.inScope===false)return {criteria,candidates:[],internalStatus:'not_searched',publicStatus:'not_searched',message:'This request is outside the supported senior financial markets roles. A consultant can help refine it.'};
 const searchId=randomUUID();
 const [reviewed,internal,market]=await Promise.allSettled([searchMandate(criteria),discoverInternal(criteria),publicResearch(criteria,user.id)]);
 const clip=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').slice(0,n):'';
 const approved=reviewed.status==='fulfilled'?reviewed.value.profiles:[];
 const records=[...(internal.status==='fulfilled'?internal.value.records.filter(c=>!approved.some(p=>p.reference===profileReference(c.slug))).map(c=>({source:'internal',canonical_url:'https://app.recruitcrm.io/v1/candidate/'+c.slug,person_name:clip([c.first_name,c.last_name].filter(Boolean).join(' '),180),reported_title:clip(c.position,200),reported_company:clip(c.current_organization,200),source_excerpt:'CRM professional title discovery; all brief requirements need specialist verification.',provider:'recruitcrm',sources:[]})):[]),...(market.status==='fulfilled'?market.value.map(l=>({...l,source:'public'})):[])];
 if(records.length)await db('sp_public_discoveries',{method:'POST',body:records.map(l=>({...l,id:randomUUID(),owner_id:user.id,search_id:searchId,search_criteria:criteria,brief_version:1,reference:profileReference(`instant:${user.id}:${searchId}:${l.source}:${l.canonical_url}`)}))});
 const internalStatus=internal.status==='fulfilled'?internal.value.status:'unavailable',publicStatus=market.status==='fulfilled'?'searched':market.reason?.message==='research_limit'?'daily_limit':'unavailable';
 return {searchId,criteria,candidates:[...approved.map(p=>({...p,source:'internal',reviewStatus:'approved',canRequestIntro:false,introUnavailableReason:'Speak to a consultant to arrange an introduction.'})),...(records.length?await instantResults(user,searchId,approvedExternal):[])],internalStatus,publicStatus,message:'Discovery results, not a confirmed shortlist. Identities stay private and a specialist checks the evidence. No role or vacancy has been created.'};
}
