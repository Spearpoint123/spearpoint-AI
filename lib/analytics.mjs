import {randomUUID} from 'node:crypto';
import {db} from './services.mjs';
const names=new Set(['brief_created','search_run','candidates_surfaced','intro_requested','shortlist_shared','csv_imported','outreach_drafted','role_created','brief_completed','call_booked','engagement_chosen','client_search']);
export async function track(ownerId,name,props={}){
 if(!names.has(name))return;
 const safe={};
 for(const [key,value] of Object.entries(props||{})){
  if(!/^[a-z0-9_]{1,40}$/i.test(key))continue;
  if(typeof value==='number'&&Number.isFinite(value))safe[key]=value;
  else if(typeof value==='boolean')safe[key]=value;
  else if(typeof value==='string')safe[key]=value.slice(0,120);
 }
 try{await db('sp_product_events',{method:'POST',body:{id:randomUUID(),owner_id:ownerId||null,name,props:safe,created_at:new Date().toISOString()}});}catch{/* metrics must not block the product */}
}
export async function productMetrics(){
 let events=[];
 try{events=await db('sp_product_events?select=name,props,created_at&order=created_at.desc&limit=2000')||[];}catch{events=[];}
 const count=name=>events.filter(e=>e.name===name).length;
 const surfaced=events.filter(e=>e.name==='candidates_surfaced').reduce((n,e)=>n+Number(e.props?.surfaced||0),0);
 return {
  briefsCreated:count('brief_created')+count('role_created'),
  searches:count('search_run'),
  candidatesSurfaced:surfaced,
  introsRequested:count('intro_requested'),
  shortlistsShared:count('shortlist_shared'),
  csvImports:count('csv_imported'),
  outreachDrafts:count('outreach_drafted'),
  events:events.length,
  note:'First-party counts for this workspace. No advertising cookies. AI supplier invoices are not reconciled here.'
 };
}
