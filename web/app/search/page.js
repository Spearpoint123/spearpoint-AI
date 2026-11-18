'use client';
import {useState} from 'react';
import {api,Shell,Steps} from '../../lib/api';
const chips=['level','years_bucket','firm_type','region','sector','pay_band','keywords'];
export default function Search(){
 const [query,setQuery]=useState('senior quant researcher, crypto market making, Dubai or London, $250-350K');
 const [filters,setFilters]=useState(null);
 const [matches,setMatches]=useState(null);
 const [status,setStatus]=useState('');
 async function run(event){
  event?.preventDefault();
  setStatus('Searching the database…');
  setMatches(null);
  try{const data=await api('/api/client/search',filters?{query,filters}:{query});setFilters(data.filters);setMatches(data.matches);setStatus(data.matches.length?data.message:'No profiles matched. Edit a chip or broaden the query.');}catch(error){setMatches([]);setStatus(error.message);}
 }
 async function save(){
  setStatus('Saving to your search profile…');
  try{await api('/api/client/save-search',{query,filters});setStatus('Saved to your search profile.');}catch(error){setStatus(error.message);}
 }
 return <Shell><Steps current={3}/><h1>Search.</h1><p>Every profile is a verified Spearpoint relationship. Names are shared once both sides want to talk.</p><form className="searchbar" onSubmit={run}><input aria-label="Search" value={query} onChange={event=>{setQuery(event.target.value);setFilters(null);}}/><button type="submit">Search</button></form>{filters&&<form className="chips" onSubmit={run}>{chips.map(key=><label key={key}>{key.replaceAll('_',' ')}<input value={filters[key]||''} onChange={event=>setFilters({...filters,[key]:event.target.value})}/></label>)}<button type="submit">Run again</button> <button type="button" className="ghost" onClick={save}>Save</button></form>}<p role="status">{status}</p>{matches&&matches.map(row=><article className="card" key={row.id}><p className="score">Match {row.score}</p><h2>{row.level} · {row.firm_type}</h2><p>{row.region} · {row.years_bucket} · {row.pay_band}</p><p>{row.why}</p>{row.fictional?<p>Demo profile. Not a real person.</p>:<p>Verified by Spearpoint</p>}<a href={'/begin/candidate/?id='+row.id}>Confidential profile</a></article>)}{matches&&!matches.length&&<p className="card">Nothing to show yet. Try a wider region or drop a chip.</p>}</Shell>;
}
