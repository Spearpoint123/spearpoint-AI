import {isFitCheck} from '../views/requirement-types.js';
import {discoverExternal} from './external-profiles.mjs';
import {profileEvidence} from './profile-evidence.mjs';
import {networkDiscoveries,visibleNetworkRows} from './talent-network.mjs';
import {recordSearchRun,profileRequests} from './pilot-operations.mjs';
import {completeResearch} from './research-flow.mjs';
import {researchDiscoveries,researchProjection} from './profile-research.mjs';
import {crmSignals,discoveryExplanation,mustHaveEvidence,professionalSignals,compareMustHaveEvidence} from './discovery-evidence.mjs';
import {professionalMustHaveInput,searchIntake,professionalMandate,applyIntakeCriteria} from './search-intake.mjs';
import {randomUUID} from 'node:crypto';
import {db,discoverInternal,profileReference} from './services.mjs';
import {interpretMandate,searchMandate,assessMandate} from './talent-search.mjs';
import {publicResearch} from './public-research.mjs';
import {text} from './domain.mjs';
// Only finite, non-identifying professional descriptors can leave a pending record.
export function pendingDiscovery(criteria,row){
 const vocabulary=[[/\bquant(?:itative)?\b/i,'Quantitative investment'],[/\bequity\b/i,'Equity investment'],[/\btoken\b/i,'Token strategies'],[/\bcredit\b/i,'Credit investment'],[/\bfixed income\b/i,'Fixed income'],[/\bmulti[- ]asset\b/i,'Multi-asset investment'],[/\bcommodit(?:y|ies)\b/i,'Commodities']];
 const explanation=discoveryExplanation(criteria,row);
 const checks=researchProjection(row,criteria)||mustHaveEvidence(criteria,{signals:row.source==='public'?professionalSignals(row.source_excerpt||'').map(s=>s.criterion):(row.sources||[]).filter(s=>s.kind==='professional_signal'&&s.evidenceSource==='summary_or_skills').map(s=>s.criterion)});
 const focus=vocabulary.filter(([re])=>re.test(row.reported_title||'')).map(([,label])=>label);
 return {...checks,id:row.id,reference:row.reference,source:row.source||'public',...profileEvidence(row,criteria),summary:explanation.fitReasons.length?explanation.fitReasons.join(' '):focus.length?'Source-reported professional focus: '+focus.join(', ')+'.':'Professional background found; the requested experience needs confirmation.',focus,matchedSignalCount:explanation.matchedSignalCount,fitReasons:checks.researchStatus?checks.mustHaveChecks.filter(c=>isFitCheck(c)&&c.status==='source_supported').map(c=>c.evidence):explanation.fitReasons,gaps:checks.researchStatus?checks.mustHaveChecks.filter(c=>c.status!=='source_supported').map(c=>c.requirement+': '+c.evidence):explanation.gaps,matchLabel:checks.researchStatus==='matched'?'Source-backed match':'Further source research',reviewStatus:'pending',sourceLabel:row.provider==='rocketreach'?'RocketReach external profiles':row.provider==='talent_network'?'Spearpoint talent network':row.source==='internal'?'Spearpoint CRM':'Public market',checkedAt:row.discovered_at,canRequestIntro:false,introUnavailableReason:'Discuss fit and next steps.'};
}
const condensedNote='The JD contains more than eight requirements. This search uses the first eight extracted priorities, with your must-haves first. Review the requested experience below.';
const live=()=>`expires_at=gt.${encodeURIComponent(new Date().toISOString())}`;
export async function instantResults(user,searchId,approvedExternal,withContext=false){
 const rows=await visibleNetworkRows(await db(`sp_public_discoveries?owner_id=eq.${user.id}&search_id=eq.${searchId}&${live()}&limit=50`));
 const run=withContext?(await db(`sp_search_runs?owner_id=eq.${user.id}&id=eq.${searchId}&${live()}&limit=1`))[0]:null;
 if(withContext&&!rows.length&&!run)throw Error('not_found');
 const criteria=run?.criteria||rows[0]?.search_criteria;
 const candidates=rows.filter(r=>r.review_status!=='rejected').map(row=>{const safe=approvedExternal(row),assessed=safe?assessMandate(row.search_criteria,safe):null;return safe?(assessed?{...assessed,id:row.id,source:row.source,reviewStatus:'approved',canRequestIntro:false,introUnavailableReason:'Speak to a consultant to arrange an introduction.'}:null):row.review_status==='approved'?null:pendingDiscovery(row.search_criteria,row);}).filter(Boolean).sort((a,b)=>compareMustHaveEvidence(a,b)||(b.matchedSignalCount||b.matchedRequirements||0)-(a.matchedSignalCount||a.matchedRequirements||0));
 if(withContext){const reviewed=await searchMandate(criteria);candidates.push(...reviewed.profiles.map(p=>({...p,source:'internal',reviewStatus:'approved',canRequestIntro:false,introUnavailableReason:'Speak to a consultant to arrange an introduction.'})));candidates.sort((a,b)=>compareMustHaveEvidence(a,b)||(b.matchedSignalCount||b.matchedRequirements||0)-(a.matchedSignalCount||a.matchedRequirements||0));}
 const requests=withContext?await profileRequests(searchId,user):[];for(const c of candidates)c.introduction=requests.find(r=>r.reference===c.reference)||null;
 return withContext?{searchId,criteria,employerFeedback:run?.employer_feedback,interpretationNote:criteria.requirementsCondensed?condensedNote:'',candidates,internalStatus:run?.internal_status||'saved_results',publicStatus:run?.public_status||'saved_results',externalStatus:Object.keys(run?.source_diagnostics||{}).find(k=>k.startsWith('external_status:'))?.slice(16)||'not_searched',message:'Previously sourced records. Search again to refresh discovery. New leads remain confidential pending specialist review.'}:candidates;
}
export async function instantSearch(user,body,approvedExternal,researchOptions={}){
 const started=Date.now();if(body.confirmed!==true)throw Error('validation');const intake=searchIntake(body,{requireMustHaves:true}),mandate=professionalMandate(body.query,body.jobDescription,intake);
 const interpreted=await interpretMandate(mandate,{maxLength:22000,timeoutMs:18000});const criteria={...applyIntakeCriteria(interpreted.criteria,intake),hiringContext:intake,...(interpreted.requirementsCondensed?{requirementsCondensed:true}:{})};
 professionalMustHaveInput(criteria.mustHaves,criteria.location);
 if(criteria.inScope===false)return {criteria,candidates:[],internalStatus:'not_searched',publicStatus:'not_searched',message:'This request is outside the supported senior financial markets roles. A consultant can help refine it.'};
 const searchId=randomUUID();
 const [reviewed,internal,market,network,external]=await Promise.allSettled([searchMandate(criteria),discoverInternal(criteria),publicResearch(criteria,user.id),networkDiscoveries(criteria),discoverExternal(criteria,user.id)]);
 const clip=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').slice(0,n):'';
 const approved=reviewed.status==='fulfilled'?reviewed.value.profiles:[];
 let records=[...(internal.status==='fulfilled'?internal.value.records.filter(c=>!approved.some(p=>p.reference===profileReference(c.slug))).map(c=>({source:'internal',canonical_url:'https://app.recruitcrm.io/v1/candidate/'+c.slug,person_name:clip([c.first_name,c.last_name].filter(Boolean).join(' '),180),reported_title:clip(c.position,200),reported_company:clip(c.current_organization,200),source_excerpt:'CRM professional title discovery; all brief requirements need specialist verification.',provider:'recruitcrm',sources:crmSignals(c),_professionalRecord:c,_profileReadStatus:c._profileReadStatus})):[]),...(market.status==='fulfilled'?market.value.map(l=>({...l,source:'public',provider:'perplexity/sonar'})):[]),...(network.status==='fulfilled'?network.value:[]),...(external.status==='fulfilled'?external.value.records:[])];
 if(criteria.mustHaves?.length===3)records=await completeResearch(criteria,records,user.id,{allowPublicFollowup:market.status==='fulfilled',researchOptions});
 if(records.length)await db('sp_public_discoveries',{method:'POST',body:records.map(l=>({...l,id:randomUUID(),owner_id:user.id,search_id:searchId,search_criteria:criteria,brief_version:1,reference:profileReference(`instant:${user.id}:${searchId}:${l.source}:${l.canonical_url}`)}))});
 const externalStatus=external.status==='fulfilled'?external.value.status:'provider_unavailable';
 const internalStatus=internal.status==='fulfilled'?internal.value.status:'unavailable',publicStatus=market.status==='fulfilled'?'searched':market.reason?.message==='research_limit'?'daily_limit':'unavailable';
 const candidates=[...approved.map(p=>({...p,source:'internal',reviewStatus:'approved',canRequestIntro:false,introUnavailableReason:'Speak to a consultant to arrange an introduction.'})),...(records.length?await instantResults(user,searchId,approvedExternal):[])].sort((a,b)=>compareMustHaveEvidence(a,b)||(b.matchedSignalCount||b.matchedRequirements||0)-(a.matchedSignalCount||a.matchedRequirements||0));
 await recordSearchRun({id:searchId,ownerId:user.id,criteria,candidates,internalStatus,publicStatus,externalStatus,externalLookups:external.status==='fulfilled'?external.value.lookups:0,records,durationMs:Date.now()-started});
 return {searchId,criteria,interpretationNote:interpreted.requirementsCondensed?condensedNote:'',candidates,internalStatus,publicStatus,externalStatus,message:'Discovery results, not a confirmed shortlist. Names stay confidential. Reasons show source evidence; a specialist checks fit before introductions. No role or vacancy has been created.'};
}
