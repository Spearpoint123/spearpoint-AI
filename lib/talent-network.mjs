import {db,profileReference} from './services.mjs';
import {roleMatches} from './matching.mjs';
const recent=()=>new Date(Date.now()-30*86400000).toISOString();
const live=()=>`status=eq.verified&email_verified=eq.true&matching_approved=eq.true&reviewed_at=gt.${encodeURIComponent(recent())}`;
export async function networkDiscoveries(criteria){
 const rows=await db(`sp_candidate_submissions?${live()}&select=id,reference,approved_copy,reviewed_at,ai_matching_consent&order=reviewed_at.desc&limit=50`);
 return rows.filter(r=>r.approved_copy?.title&&roleMatches(criteria.role,r.approved_copy.title)&&(!criteria.location||/^any location$/i.test(criteria.location)||(r.approved_copy.locations||[]).some(l=>/^any location$/i.test(l)||criteria.location.toLowerCase().includes(l.toLowerCase())))).map(r=>({source:'internal',provider:'talent_network',canonical_url:'https://ai.spearpointsearch.com/talent-network/profile/'+r.id,person_name:'',reported_title:r.approved_copy.title,reported_company:'',source_excerpt:r.approved_copy.summary.slice(0,700),reference:profileReference('network:'+r.id),sources:[{kind:'talent_network',submission_id:r.id}],_professionalRecord:{summary:r.approved_copy.summary,skill:(r.approved_copy.focus||[]).join(', ')},_profileReadStatus:'network_reviewed',_assessmentAllowed:r.ai_matching_consent===true}));
}
export async function visibleNetworkRows(rows){
 const linked=rows.filter(r=>(r.sources||[]).some(s=>s.kind==='talent_network'));
 if(!linked.length)return rows;
 const ids=[...new Set(linked.flatMap(r=>r.sources.filter(s=>s.kind==='talent_network').map(s=>s.submission_id)).filter(s=>/^[a-f0-9-]{36}$/i.test(s)))];if(!ids.length)return rows.filter(r=>!linked.includes(r));
 const active=await db(`sp_candidate_submissions?${live()}&id=in.(${ids.join(',')})&select=id&limit=100`),allowed=new Set(active.map(r=>r.id));
 return rows.filter(r=>!linked.includes(r)||r.sources.some(s=>s.kind==='talent_network'&&allowed.has(s.submission_id)));
}
