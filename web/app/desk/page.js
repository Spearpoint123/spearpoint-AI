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
  {data.requests.map(row=><article className="card" key={row.id}><h3>{row.title}</h3><p>{row.type.replaceAll('_',' ')}. {row.status.replaceAll('_',' ')}. {row.overdue?'Overdue.':''}</p><p>{row.body}</p></article>)}
  {!data.requests.length&&<p className="muted">No open requests.</p>}
  <p role="status">{status}</p></PartnerShell>;
}
