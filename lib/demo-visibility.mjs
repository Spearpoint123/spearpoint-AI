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
 return (rows||[]).filter(row=>row.publication!=='unpublished'&&row.source!=='rocketreach'&&(showDemo||row.fictional!==true));
}
export function forStaff(rows,showDemo){
 return (rows||[]).filter(row=>showDemo||row.fictional!==true);
}
