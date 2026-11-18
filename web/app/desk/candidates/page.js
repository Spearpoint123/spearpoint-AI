'use client';
import {useEffect,useState} from 'react';
import {api,PartnerShell} from '../../../lib/api';
const chips=['level','years_bucket','firm_type','region','sector','pay_band','keywords'];
export default function StaffSearch(){
 const [tab,setTab]=useState('database');
 const [query,setQuery]=useState('senior quant researcher, crypto market making, Dubai or London');
 const [externalQuery,setExternalQuery]=useState('senior quantitative researcher London');
 const [filters,setFilters]=useState(null);
 const [matches,setMatches]=useState(null);
 const [external,setExternal]=useState(null);
 const [searches,setSearches]=useState([]);
 const [status,setStatus]=useState('');
 useEffect(()=>{api('/api/partner/home',{}).then(data=>setSearches(data.searches||[])).catch(()=>{});},[]);
 async function run(event){
  event?.preventDefault();
  setStatus('Searching imported and demo profiles…');
  try{const data=await api('/api/partner/staff-search',filters?{query,filters}:{query});setFilters(data.filters);setMatches(data.matches);setStatus(data.matches.length?`${data.matches.length} profiles.`:'No profiles matched. Edit a chip or broaden the query.');}catch(error){setMatches([]);setStatus(error.message);}
 }
 async function runExternal(event){
  event?.preventDefault();
  setStatus('Searching RocketReach…');
  try{
   const data=await api('/api/partner/external-search',{query:externalQuery});
   setExternal(data);
   setStatus(data.connected?data.notice||`${data.count} external profiles.`:'RocketReach not connected');
  }catch(error){setExternal(null);setStatus(error.message);}
 }
 async function saveExternal(row){
  setStatus('Saving an unpublished record…');
  try{
   const saved=await api('/api/partner/external-import',row);
   setExternal({...external,savedId:saved.id,savedFor:row.externalId});
   setStatus('Saved as an unpublished record. It is not visible to clients.');
  }catch(error){setStatus(error.message);}
 }
 async function addSaved(event){
  event.preventDefault();
  const searchId=new FormData(event.target).get('searchId');
  setStatus('Adding to the pipeline…');
  try{await api('/api/partner/add-to-pipeline',{searchId,candidateId:external.savedId,stage:'approached'});setStatus('Added to the pipeline. The client still sees an anonymised card only after you publish, which this record is not.');}catch(error){setStatus(error.message);}
 }
 const credits=external?.credits;
 return <PartnerShell><p><a href="/begin/desk">My searches</a></p><h1>Find candidates.</h1><p>Names are visible to staff. Every name you open is written to the audit log. Clients still see published, anonymised profiles only.</p>
  <p><button type="button" onClick={()=>setTab('database')}>Our database</button> <button type="button" className="ghost" onClick={()=>setTab('external')}>Search outside our database</button></p>
  {tab==='database'&&<><form className="searchbar" onSubmit={run}><input aria-label="Staff search" value={query} onChange={event=>{setQuery(event.target.value);setFilters(null);}}/><button type="submit">Search</button></form>{filters&&<form className="chips" onSubmit={run}>{chips.map(key=><label key={key}>{key.replaceAll('_',' ')}<input value={filters[key]||''} onChange={event=>setFilters({...filters,[key]:event.target.value})}/></label>)}<button type="submit">Run again</button></form>}<p role="status">{status}</p>{matches&&matches.map(row=><article className="card" key={row.id}><p className="score">Match {row.score}</p><h2>{row.level} · {row.firm_type}</h2><p>{row.region} · {row.pay_band}</p><p>{row.why}</p>{row.demo&&<p>Demo profile. Not a real person.</p>}{row.source==='rocketreach'&&<p>External: RocketReach</p>}{row.identity&&<p>{row.identity.name}. {row.identity.employer}.</p>}<a href={'/begin/desk/candidate/?id='+row.id}>Open the record</a></article>)}{matches&&!matches.length&&<p className="card">Nothing to show. Broaden the query.</p>}</>}
  {tab==='external'&&<><p>External results are labelled RocketReach. They are not published and do not appear in client search.</p><form className="searchbar" onSubmit={runExternal}><input aria-label="RocketReach search" value={externalQuery} onChange={event=>setExternalQuery(event.target.value)}/><button type="submit">Search RocketReach</button></form><p role="status">{status}</p>{external&&!external.connected&&<p className="card">RocketReach not connected</p>}{credits&&<p>Credits{credits.remaining!=null?` remaining ${credits.remaining}`:''}{credits.used!=null?`. Used ${credits.used}`:''}.</p>}{external?.records?.map(row=><article className="card" key={row.externalId}><p>External: RocketReach</p><h2>{row.name}</h2><p>{row.title}. {row.employer}. {row.location}.</p><button type="button" onClick={()=>saveExternal(row)}>Add to RecruitCRM-style candidate record</button></article>)}{external?.savedId&&searches.length>0&&<form onSubmit={addSaved}><label>Add the saved record to a search<select name="searchId">{searches.map(row=><option key={row.id} value={row.id}>{row.title}</option>)}</select></label><button type="submit">Add to the pipeline</button></form>}</>}
 </PartnerShell>;
}
