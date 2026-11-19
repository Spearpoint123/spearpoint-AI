'use client';
import {useEffect,useState} from 'react';
import {api,PartnerShell} from '../../../lib/api';
export default function StaffCandidate(){
 const [row,setRow]=useState(null);
 const [searches,setSearches]=useState([]);
 const [status,setStatus]=useState('Opening the record…');
 const id=typeof location==='undefined'?'':new URLSearchParams(location.search).get('id')||'';
 useEffect(()=>{
  if(!id)return;
  api('/api/partner/staff-candidate',{id}).then(data=>setRow(data.candidate)).catch(error=>setStatus(error.message));
  api('/api/partner/home',{}).then(data=>{setSearches(data.searches||[]);setStatus('');}).catch(()=>{});
 },[id]);
 async function add(event){
  event.preventDefault();
  const searchId=new FormData(event.target).get('searchId');
  setStatus('Adding to the pipeline…');
  try{await api('/api/partner/add-to-pipeline',{searchId,candidateId:id,stage:'approached'});setStatus('Added. The client still sees an anonymised card.');}catch(error){setStatus(error.message);}
 }
 if(!row)return <PartnerShell><p role="status">{status}</p></PartnerShell>;
 const identity=row.identity;
 return <PartnerShell><p><a href="/begin/desk/candidates">Find candidates</a></p><h1>{row.level}. {row.firm_type}.</h1><p>{row.demo?'Demo profile. Not a real person.':row.label}</p><p>{row.summary}</p>{identity?<div className="card"><h2>{identity.name}</h2><p>{identity.employer}</p>{row.crm&&<p><a href={row.crm}>Open in RecruitCRM</a></p>}</div>:<p>No identity is stored for this profile.</p>}<form onSubmit={add}><label>Add to a search<select name="searchId">{searches.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button type="submit">Add to the pipeline</button></form><p role="status">{status}</p></PartnerShell>;
}
