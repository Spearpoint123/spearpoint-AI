import {randomUUID} from 'node:crypto';
import {db,discoverInternal,profileReference} from './services.mjs';
import {searchMandate} from './talent-search.mjs';
import {publicResearch} from './public-research.mjs';
const timestamp=()=>new Date().toISOString();
const live=()=>`expires_at=gt.${encodeURIComponent(timestamp())}`;
const path=(table,user,role)=>`${table}?owner_id=eq.${user.id}&role_id=eq.${role.id}&brief_version=eq.${role.brief_version}&${live()}`;
export async function sourceRole(user,role,{market=false}={}){
 // Public research sees structured criteria only. CRM records stay in this process.
 const [reviewed,crm,publicResult]=await Promise.allSettled([
  searchMandate(role.criteria),discoverInternal(role.criteria),market?publicResearch(role.criteria,user.id):Promise.resolve([])
 ]);
 if(reviewed.status==='rejected')throw reviewed.reason;
 const approved=reviewed.value.profiles.map(p=>({source:'internal',reference:p.reference}));
 const internalStatus=crm.status==='fulfilled'?crm.value.status:'unavailable';
 const publicStatus=!market?null:publicResult.status==='fulfilled'?'searched':publicResult.reason?.message==='research_limit'?'daily_limit':'unavailable';
 const clip=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').slice(0,max):'';
 const discoveries=[...(crm.status==='fulfilled'?crm.value.records.filter(c=>!approved.some(p=>p.reference===profileReference(c.slug))).map(c=>({source:'internal',reference:profileReference(`internal:${user.id}:${role.id}:${role.brief_version}:${c.slug}`),canonical_url:'https://app.recruitcrm.io/v1/candidate/'+c.slug,person_name:clip([c.first_name,c.last_name].filter(Boolean).join(' '),180),reported_title:clip(c.position,200),reported_company:clip(c.current_organization,200),source_excerpt:'Recorded CRM title; suitability, requirements, location and current interest require specialist verification.',provider:'recruitcrm',sources:[]})):[]),...(publicResult.status==='fulfilled'?publicResult.value.map(l=>({...l,source:'public',provider:'perplexity/sonar',reference:profileReference(`public:${user.id}:${role.id}:${role.brief_version}:${l.canonical_url}`)})):[])];
 const current=await db(`sp_roles?id=eq.${role.id}&owner_id=eq.${user.id}&${live()}&limit=1`);
 if(!current?.length||current[0].brief_version!==role.brief_version||current[0].state!=='active')throw Error('role_conflict');
 const existing=await db(path('sp_public_discoveries',user,role)+'&select=canonical_url&limit=100');const urls=new Set(existing.map(x=>x.canonical_url));
 const fresh=discoveries.filter(l=>!urls.has(l.canonical_url));
 if(fresh.length)await db('sp_public_discoveries',{method:'POST',upsert:true,body:fresh.map(l=>({id:randomUUID(),owner_id:user.id,role_id:role.id,brief_version:role.brief_version,...l}))});
 const prior=await db(path('sp_role_candidates',user,role)+'&select=reference,source&limit=100');const keys=new Set(prior.map(c=>c.source+':'+c.reference));
 const found=new Map([...approved,...discoveries.map(({source,reference})=>({source,reference}))].map(c=>[c.source+':'+c.reference,c]));
 const additions=[...found].filter(([key])=>!keys.has(key)).map(([,c])=>({id:randomUUID(),owner_id:user.id,role_id:role.id,brief_version:role.brief_version,...c}));
 if(additions.length)await db('sp_role_candidates',{method:'POST',upsert:true,body:additions});
 await db(`sp_roles?id=eq.${role.id}&owner_id=eq.${user.id}&brief_version=eq.${role.brief_version}&${live()}`,{method:'PATCH',body:{internal_status:internalStatus,...(market?{public_status:publicStatus}:{}),last_searched_at:timestamp(),updated_at:timestamp()}});
 await db('sp_activity',{method:'POST',body:{id:randomUUID(),owner_id:user.id,event_type:'search'}});
 return {internalStatus,publicStatus};
}
