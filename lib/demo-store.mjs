import {randomUUID} from 'node:crypto';
import {seedDemoRows} from './demo-data.mjs';

const tables=new Map();
let seeded=false;
function bucket(name){
 if(!seeded){seeded=true;const seed=seedDemoRows();for(const [table,rows] of Object.entries(seed))tables.set(table,rows.map(row=>({...row})));}
 if(!tables.has(name))tables.set(name,[]);
 return tables.get(name);
}
function parse(path){
 const [resource,query='']=String(path).split('?');
 return {resource:resource.replace(/^\/+/,''),params:new URLSearchParams(query)};
}
function matches(row,params){
 for(const [key,value] of params){
  if(['select','order','limit','offset','on_conflict'].includes(key))continue;
  const cut=value.indexOf('.');if(cut<0)continue;
  const op=value.slice(0,cut),raw=value.slice(cut+1),cur=row[key];
  if(op==='eq'&&String(cur)!==raw)return false;
  if(op==='neq'&&String(cur)===raw)return false;
  if(op==='gt'&&!(cur!=null&&String(cur)>raw))return false;
  if(op==='gte'&&!(cur!=null&&String(cur)>=raw))return false;
  if(op==='lt'&&!(cur!=null&&String(cur)<raw))return false;
  if(op==='is'&&raw==='null'&&cur!=null)return false;
  if(op==='in'){const list=raw.replace(/^\(/,'').replace(/\)$/,'').split(',').filter(Boolean);if(!list.includes(String(cur)))return false;}
 }
 return true;
}
function ordered(rows,params){
 let out=rows.filter(row=>matches(row,params));
 const order=params.get('order');
 if(order){const [col,dir]=order.split('.');out=[...out].sort((a,b)=>String(a[col]??'').localeCompare(String(b[col]??'')));if(dir==='desc')out.reverse();}
 const limit=params.get('limit');
 const count=limit==null||limit===''?NaN:Number(limit);
 return Number.isFinite(count)?out.slice(0,count):out;
}
function takeLimit(body){
 const key=String(body?.p_key||'');const limit=Number(body?.p_limit)||20;const windowMs=(Number(body?.p_window_seconds)||3600)*1000;
 const rows=bucket('sp_rate_limits');const now=Date.now();
 let row=rows.find(r=>r.key===key);
 if(!row){row={key,count:0,reset_at:new Date(now+windowMs).toISOString()};rows.push(row);}
 if(Date.parse(row.reset_at)<=now){row.count=0;row.reset_at=new Date(now+windowMs).toISOString();}
 row.count+=1;return row.count<=limit;
}
function purge(){
 const now=new Date().toISOString();
 for(const name of ['sp_briefs','sp_public_discoveries','sp_import_leads','sp_saved_searches','sp_shortlists','sp_activity','sp_introductions','sp_roles']){
  const rows=bucket(name);for(let i=rows.length-1;i>=0;i--)if(rows[i].expires_at&&rows[i].expires_at<now)rows.splice(i,1);
 }
 const events=bucket('sp_product_events');const cutoff=new Date(Date.now()-180*86400000).toISOString();
 for(let i=events.length-1;i>=0;i--)if((events[i].created_at||'')<cutoff)events.splice(i,1);
 const limits=bucket('sp_rate_limits');
 for(let i=limits.length-1;i>=0;i--)if(limits[i].reset_at<now)limits.splice(i,1);
}
export async function demoDb(path,{method='GET',body,returnRows=false,upsert=false}={}){
 const {resource,params}=parse(path);
 if(resource==='rpc/sp_take_rate_limit')return takeLimit(body);
 if(resource==='rpc/sp_purge_staging'){purge();return null;}
 if(resource==='rpc/sp_register_employer_domain'){
  const domain=String(body?.p_domain||'');const rows=bucket('sp_employer_domains');
  if(domain&&!rows.some(r=>r.domain===domain))rows.push({domain,status:'pending',company_type:'unknown',company_name:'',review_evidence:''});
  return null;
 }
 const name=resource.split('/')[0];
 const rows=bucket(name);
 if(method==='GET')return ordered(rows,params);
 if(method==='DELETE'){const drop=new Set(ordered(rows,params));for(let i=rows.length-1;i>=0;i--)if(drop.has(rows[i]))rows.splice(i,1);return null;}
 if(method==='PATCH'){
  const found=ordered(rows,params);
  for(const row of found)Object.assign(row,body||{});
  return returnRows?found:null;
 }
 if(method==='POST'){
  const incoming=Array.isArray(body)?body:[body||{}];
  const saved=[];
  for(const item of incoming){
   const row={id:item.id||randomUUID(),created_at:item.created_at||new Date().toISOString(),expires_at:item.expires_at||new Date(Date.now()+30*86400000).toISOString(),...item};
   if(upsert&&row.owner_id){const existing=rows.find(r=>r.owner_id===row.owner_id&&(!row.id||r.id===row.id||name==='sp_employers'));if(existing){Object.assign(existing,row);saved.push(existing);continue;}}
   rows.push(row);saved.push(row);
  }
  return returnRows?saved:null;
 }
 throw Error('storage_unavailable');
}
export function resetDemoStore(){tables.clear();seeded=false;}
