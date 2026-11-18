'use client';
import {useEffect,useState} from 'react';
import {api,PartnerShell} from '../../../lib/api';
const stages=['approached','interested','shortlisted','interviewing','offer','hired','withdrawn'];
export default function SearchDesk(){
 const [data,setData]=useState(null);
 const [status,setStatus]=useState('Opening the search…');
 const [link,setLink]=useState('');
 const [summary,setSummary]=useState(null);
 const [bench,setBench]=useState(null);
 const [drafts,setDrafts]=useState([]);
 const id=typeof location==='undefined'?'':new URLSearchParams(location.search).get('id')||'';
 function load(){return api('/api/partner/search',{searchId:id}).then(next=>{setData(next);setDrafts(next.drafts||[]);setStatus('');}).catch(error=>setStatus(error.message));}
 useEffect(()=>{if(id)load();},[id]);
 async function move(candidateId,stage){setStatus('Moving the profile…');try{await api('/api/partner/stage',{searchId:id,candidateId,stage});await load();}catch(error){setStatus(error.message);}}
 async function reply(requestId){setStatus('Saving the reply…');try{await api('/api/partner/request',{searchId:id,requestId,status:'in_progress',note:'A partner is looking at this.'});await load();setStatus('Reply saved.');}catch(error){setStatus(error.message);}}
 async function logTime(event){event.preventDefault();const form=new FormData(event.target);setStatus('Saving the time…');try{await api('/api/partner/time',{searchId:id,hours:Number(form.get('hours')),worked_on:form.get('worked_on'),note:form.get('note')});await load();setStatus('Time saved.');}catch(error){setStatus(error.message);}}
 async function draft(candidateId){setStatus('Drafting the note…');try{const next=await api('/api/partner/draft',{searchId:id,candidateId});setDrafts([next.draft,...drafts]);setStatus('Draft ready. It has not been sent.');}catch(error){setStatus(error.message);}}
 async function send(draftId){setStatus('Checking the sender…');try{const next=await api('/api/partner/send',{searchId:id,draftId,confirm:true,to:'hiring.example@example.invalid'});setStatus(next.sent?'Sent and logged.':'Nothing was sent. The partner address is not a verified sender.');}catch(error){setStatus(error.message);}}
 async function propose(){setStatus('Saving the slots…');try{const when=new Date(Date.now()+5*86400000).toISOString();const next=await api('/api/partner/interview',{searchId:id,slots:[when]});setStatus(next.interview.notice);await load();}catch(error){setStatus(error.message);}}
 async function summarise(event){event.preventDefault();setStatus('Summarising…');try{setSummary(await api('/api/partner/summary',{searchId:id,text:new FormData(event.target).get('text')}));setStatus('');}catch(error){setStatus(error.message);}}
 async function offer(){setStatus('Comparing pay bands…');try{setBench(await api('/api/partner/benchmark',{searchId:id,amount:300,level:'Senior'}));setStatus('');}catch(error){setStatus(error.message);}}
 async function reveal(candidateId){setStatus('Creating the link…');try{const next=await api('/api/partner/reveal-link',{searchId:id,candidateId});setLink(next.url);setStatus(next.notice);}catch(error){setStatus(error.message);}}
 if(!data)return <PartnerShell><p role="status">{status}</p></PartnerShell>;
 return <PartnerShell><p><a href="/begin/desk">My searches</a></p><h1>{data.search.title}.</h1><p>{data.organisation.name}.</p>
  <h2>Pipeline</h2>
  {data.pipeline.map(row=><article className="card" key={row.id}><h3>{row.level} · {row.firm_type}</h3><p>{row.region} · {row.years_bucket} · {row.pay_band}</p><p>{row.identity?`${row.identity.name}, ${row.identity.employer}. ${row.identity.fictional?'Fictional sample.':''}`:'No identity on file.'}</p><label>Stage<select value={row.stage} onChange={event=>move(row.id,event.target.value)}>{stages.map(stage=><option key={stage} value={stage}>{stage}</option>)}</select></label><button type="button" onClick={()=>draft(row.id)}>Draft outreach</button> <button type="button" onClick={()=>reveal(row.id)}>Request approval</button></article>)}
  {link&&<p className="card">Copy this link. It was not emailed.<br/><a href={link}>{link}</a></p>}
  <h2>Requests</h2>
  {data.requests.map(row=><article className="card" key={row.id}><h3>{row.type.replaceAll('_',' ')}</h3><p>{row.status}. {row.body}</p><ol className="history">{row.history.map(item=><li key={item.at}>{item.status}. {item.note}</li>)}</ol>{row.status!=='done'&&<button type="button" onClick={()=>reply(row.id)}>Reply and mark in progress</button>}</article>)}
  <h2>Time</h2><p>{data.time.total} hours on this search.</p><form onSubmit={logTime}><label>Hours<input name="hours" type="number" min="0.25" max="24" step="0.25" defaultValue="1.5" required/></label><label>Date<input name="worked_on" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Note<input name="note" defaultValue="Partner preparation"/></label><button type="submit">Log time</button></form>
  <h2>Outreach</h2>
  {drafts.map(row=><article className="card" key={row.id}><p>{row.body}</p><button type="button" onClick={()=>send(row.id)}>Send this draft</button></article>)}
  {!drafts.length&&<p className="muted">No drafts yet.</p>}
  <h2>Interview</h2><button type="button" onClick={propose}>Propose a slot and the HubSpot link</button>
  {data.interviews.map(row=><p key={row.id}>{(row.slots||[]).join(', ')||row.starts_at} · <a href={row.meeting_url}>HubSpot</a></p>)}
  <h2>Call summary</h2><form onSubmit={summarise}><label>Notes or transcript<textarea name="text" required minLength={12} rows={4} defaultValue="The hiring manager wants a senior researcher. Next, book the weekly call and send the anonymised shortlist."/></label><button type="submit">Summarise</button></form>
  {summary&&<div className="card"><p>{summary.summary}</p><ul>{summary.next_steps.map(step=><li key={step}>{step}</li>)}</ul></div>}
  <h2>Offer benchmark</h2><button type="button" onClick={offer}>Compare 300 for a senior profile</button>
  {bench&&<p>{bench.inside} of {bench.compared} senior bands contain 300. {bench.below} are higher. {bench.above} are lower. {bench.note}</p>}
  <p role="status">{status}</p></PartnerShell>;
}
