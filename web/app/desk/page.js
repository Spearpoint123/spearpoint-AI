'use client';
import {useEffect,useState} from 'react';
import {api,PartnerShell} from '../../lib/api';
export default function Desk(){
 const [data,setData]=useState(null);
 const [status,setStatus]=useState('Opening your searches…');
 useEffect(()=>{api('/api/partner/home',{}).then(setData).then(()=>setStatus('')).catch(error=>setStatus(error.message));},[]);
 if(!data)return <PartnerShell><p role="status">{status}</p></PartnerShell>;
 return <PartnerShell><h1>My searches.</h1><p>{data.sources}</p>
  {data.searches.map(row=><article className="card" key={row.id}><p className="score">{row.overdue?'Overdue':'On track'}</p><h2>{row.title}</h2><p>{row.organisation}</p><p>Next: {row.next}</p><p>{row.openRequests} request{row.openRequests===1?'':'s'} to answer.</p><a className="button" href={'/begin/desk/search/?id='+row.id}>Open the search</a></article>)}
  <h2>Request queue</h2>
  {data.requests.map(row=><article className="card" key={row.id}><h3>{row.title}</h3><p>{row.type.replaceAll('_',' ')}. {row.status.replaceAll('_',' ')}. {row.overdue?'Overdue.':''}</p><p>{row.body}</p><a href={'/begin/desk/search/?id='+row.searchId}>Open the search</a></article>)}
  {!data.requests.length&&<p className="muted">No open requests.</p>}
  <p><a className="button" href="/begin/desk/candidates">Find candidates</a></p>
  <h2>Open a search</h2>
  <form onSubmit={async event=>{event.preventDefault();const form=new FormData(event.target);setStatus('Opening the search…');try{const next=await api('/api/partner/open-search',{organisationId:form.get('organisationId'),title:form.get('title')});location.href='/begin/desk/search/?id='+next.id;}catch(error){setStatus(error.message);}}}><label>Verified employer<select name="organisationId">{(data.organisations||[]).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Role title<input name="title" required minLength={3} defaultValue="Head of quantitative research"/></label><button type="submit">Open the search</button></form><p>These adapters are off. No call is made.</p>{(data.providers||[]).map(row=><p key={row.id}>{row.label}. {row.reason}</p>)}
  <p role="status">{status}</p></PartnerShell>;
}
