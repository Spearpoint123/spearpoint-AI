'use client';
import {useState} from 'react';
import {api,Shell} from '../../lib/api';
const chips=['level','years_bucket','firm_type','region','sector','pay_band','keywords'];
export default function Search(){
 const [query,setQuery]=useState('senior quant researcher, crypto market making, Dubai or London, $250-350K');
 const [filters,setFilters]=useState(null);
 const [matches,setMatches]=useState([]);
 const [status,setStatus]=useState('');
 async function run(event){
  event?.preventDefault();
  setStatus('Searching the database…');
  try{const data=await api('/api/client/search',filters?{query,filters}:{query});setFilters(data.filters);setMatches(data.matches);setStatus(data.message);}catch(error){setStatus(error.message);}
 }
 async function save(){
  setStatus('Saving to your search profile…');
  try{await api('/api/client/save-search',{query,filters});setStatus('Saved to your search profile.');}catch(error){setStatus(error.message);}
 }
 return <Shell><h1>Search profiles.</h1><p>Plain English, then chips you can edit. Spearpoint’s database only.</p><form onSubmit={run}><label>Query<textarea value={query} onChange={event=>{setQuery(event.target.value);setFilters(null);}} rows={3}/></label><button type="submit">Search</button></form>{filters&&<form className="chips" onSubmit={run}>{chips.map(key=><label key={key}>{key.replaceAll('_',' ')}<input value={filters[key]||''} onChange={event=>setFilters({...filters,[key]:event.target.value})}/></label>)}<button type="submit">Run again</button> <button type="button" className="ghost" onClick={save}>Save to search profile</button></form>}<p role="status">{status}</p>{matches.map(row=><article className="card" key={row.id}><p className="score">Match {row.score}</p><h2>{row.level} · {row.firm_type}</h2><p>{row.region} · {row.years_bucket} · {row.pay_band}</p><p>{row.why}</p><a href={'/begin/candidate?id='+row.id}>Anonymised profile</a></article>)}</Shell>;
}
