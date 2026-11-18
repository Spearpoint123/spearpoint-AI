'use client';
import {useEffect,useState} from 'react';
import {api,Shell} from '../../lib/api';
export default function Engagement(){
 const [options,setOptions]=useState(null);
 const [status,setStatus]=useState('');
 useEffect(()=>{api('/api/client/home').then(data=>setOptions(data.engagements)).catch(error=>setStatus(error.message));},[]);
 async function choose(type){
  setStatus('Recording the engagement…');
  try{const data=await api('/api/client/engagement',{type});setStatus(`${data.engagement.label} recorded. Invoicing is manual. ${data.verification_status==='verified'?'Verified.':'Verification pending.'}`);}catch(error){setStatus(error.message);}
 }
 return <Shell><h1>Choose an engagement.</h1><p>Record the terms you want. A partner confirms them. Nothing is charged in the product.</p><div className="grid">{options&&Object.values(options).map(item=><article className="card" key={item.type}><h2>{item.label}</h2><p>{item.note}</p><button type="button" onClick={()=>choose(item.type)}>Record {item.label}</button></article>)}</div><p role="status">{status}</p></Shell>;
}
