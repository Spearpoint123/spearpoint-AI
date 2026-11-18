import {db} from './services.mjs';
const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
export async function showDemoProfiles(){
 const row=(await rows('sp_settings?key=eq.show_demo_profiles&limit=1'))[0];
 if(!row)return true;
 return row.value?.enabled!==false;
}
export async function setShowDemoProfiles(enabled){
 const value={enabled:enabled===true};
 const existing=await rows('sp_settings?key=eq.show_demo_profiles&limit=1');
 if(existing.length)await db('sp_settings?key=eq.show_demo_profiles',{method:'PATCH',body:{value,updated_at:new Date().toISOString()}});
 else await db('sp_settings',{method:'POST',body:{key:'show_demo_profiles',value,updated_at:new Date().toISOString()}});
 return value.enabled;
}
export function forClients(rows,showDemo){
 return (rows||[]).filter(row=>row.source!=='rocketreach'&&(row.publication!=='unpublished'||row.source==='recruitcrm')&&(showDemo||row.fictional!==true));
}
export async function loadClientCandidates(){
 const all=[];
 let last='';
 for(let guard=0;guard<12;guard++){
  const page=await rows(`sp_candidates?select=id,source,level,seniority,years_bucket,region,firm_type,sector,pay_band,scope,sector_history,skills,summary,fictional,publication&order=id.asc&limit=500${last?`&id=gt.${encodeURIComponent(last)}`:''}`);
  if(!page.length)break;
  all.push(...page);
  if(page.length<500)break;
  const next=page.at(-1)?.id;
  if(!next||next===last)break;
  last=next;
 }
 return forClients(all,await showDemoProfiles());
}
export function forStaff(rows,showDemo){
 return (rows||[]).filter(row=>showDemo||row.fictional!==true);
}
