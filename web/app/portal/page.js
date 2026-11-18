'use client';
import {useEffect,useState} from 'react';
import {api,Shell} from '../../lib/api';
const labels={approached:'Approached',interested:'Interested',shortlisted:'Shortlisted',interviewing:'Interviewing',offer:'Offer',hired:'Hired',active:'Active',add_candidate:'Add a candidate',move_interview:'Move an interview',change_brief:'Change the brief',add_target:'Add a target firm',pause:'Pause the search',question:'Ask a question',open:'Open',in_progress:'In progress',done:'Done'};
const requestTypes=['add_candidate','move_interview','change_brief','add_target','pause','question'];
function identityLine(row){
 if(row.identity_state==='shown'&&row.identity)return `${row.identity.name}, ${row.identity.employer}.`;
 if(row.identity_state==='unavailable')return 'Identity is approved for this employer, but the record is not available.';
 return 'Identity pending approval.';
}
function Bars({title,rows}){return <div className="card"><h3>{title}</h3>{(rows||[]).map(row=><p key={row.name}>{row.name} · {row.total}</p>)}</div>;}
export default function Portal(){
 const [data,setData]=useState(null);
 const [status,setStatus]=useState('Opening the portal…');
 const [type,setType]=useState('add_candidate');
 const [body,setBody]=useState('Add a candidate from a crypto market maker.');
 const [when,setWhen]=useState('');
 function load(){return api('/api/client/portal',{}).then(setData).then(()=>setStatus('')).catch(error=>setStatus(error.message));}
 useEffect(()=>{load();},[]);
 async function sendRequest(event){
  event.preventDefault();setStatus('Sending the request…');
  try{const next=await api('/api/client/portal/request',{type,body,searchId:data.search.id});setData({...data,requests:next.requests});setStatus('Request opened.');}catch(error){setStatus(error.message);}
 }
 async function moveCall(event){
  event.preventDefault();setStatus('Moving the call…');
  try{const next=await api('/api/client/portal/call',{starts_at:new Date(when).toISOString(),searchId:data.search.id});setData({...data,call:next.call});setStatus('The weekly call was moved.');}catch(error){setStatus(error.message);}
 }
 async function download(){
  setStatus('Preparing the export…');
  try{
   const file=await api('/api/client/portal/export',{searchId:data.search.id});
   const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(file.rows,null,2)],{type:'application/json'}));link.download='spearpoint-search.json';link.click();
   setStatus('Export recorded in the audit log.');
  }catch(error){setStatus(error.message);}
 }
 const banner='Profiles stay confidential. A name is shown once that candidate approves this employer. The reveal is audited.';
 if(!data)return <Shell banner={banner}><p role="status">{status}</p></Shell>;
 if(data.gate)return <Shell banner={banner}><h1>Portal.</h1><p>{data.message}</p><p><a className="button" href="/begin/book">Book a call</a> <a className="button" href="/begin/engagement">Choose an engagement</a></p><p role="status">{status}</p></Shell>;
 const whenText=new Date(data.call.starts_at).toLocaleString('en-GB',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/London'});
 return <Shell banner={banner}><h1>{data.search.title}.</h1><p>{data.organisation.name}. {labels[data.engagement.status]||data.engagement.status}. {data.engagement.label}.</p>
  <h2>Pipeline</h2>
  <div className="board">{data.stages.map(stage=><section key={stage}><p className="stage">{labels[stage]} · {data.counts[stage]||0}</p>{data.pipeline.filter(row=>row.stage===stage).map(row=><article className="card" key={row.id}><h3>{row.level} · {row.firm_type}</h3><p>{row.region} · {row.years_bucket} · {row.pay_band}</p><p>{row.summary}</p>{row.fictional?<p>Demo profile. Not a real person.</p>:<p>Verified by Spearpoint</p>}<p>{identityLine(row)}</p></article>)}{!data.counts[stage]&&<p className="muted">None yet.</p>}</section>)}</div>
  <h2>Market</h2><p>{data.marketMessage}</p><div className="grid"><Bars title="Firm type" rows={data.map.firm_type}/><Bars title="Region" rows={data.map.region}/><Bars title="Level" rows={data.map.seniority}/></div><p className="muted">Pay bands in view: {(data.map.pay||[]).join(', ')||'none'}.</p>
  <h2>Activity</h2>{data.activity.map(row=><p key={row.created_at+row.summary}>{row.summary}</p>)}
  <h2>Weekly call</h2><div className="card"><p>{whenText}</p><p>{data.call.notice}</p><p><a href={data.call.meeting_url}>Open the HubSpot link</a></p><form onSubmit={moveCall}><label>Move to<input type="date" required value={when} onChange={event=>setWhen(event.target.value)}/></label><button type="submit">Move the call</button></form></div>
  <h2>Requests</h2><form onSubmit={sendRequest}><label>Type<select value={type} onChange={event=>setType(event.target.value)}>{requestTypes.map(key=><option key={key} value={key}>{labels[key]}</option>)}</select></label><label>What should change?<textarea required minLength={8} rows={3} value={body} onChange={event=>setBody(event.target.value)}/></label><button type="submit">Open a request</button></form>
  {data.requests.map(request=><article className="card" key={request.id}><h3>{labels[request.type]||request.type}</h3><p>{labels[request.status]||request.status}. {request.body}</p><ol className="history">{request.history.map(item=><li key={item.at}>{labels[item.status]||item.status}. {item.note}</li>)}</ol></article>)}
  <p><button type="button" onClick={download}>Export this search</button></p><p role="status">{status}</p></Shell>;
}
