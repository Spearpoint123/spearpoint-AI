'use client';
import {useState} from 'react';
import {api,Shell,Steps} from '../../lib/api';
import {ResultCard} from '../result-card';
const chips=['level','years_bucket','firm_type','region','sector','pay_band','keywords'];
export default function Search(){
 const [query,setQuery]=useState('senior quant researcher, crypto market making, Dubai or London, $250-350K');
 const [filters,setFilters]=useState(null);
 const [musts,setMusts]=useState(null);
 const [rows,setRows]=useState(null);
 const [status,setStatus]=useState('');
 async function prepare(event){
  event?.preventDefault();
  setRows(null);
  setStatus('Reading the role…');
  try{const data=await api('/api/client/search',{query,preview:true});setFilters(data.filters);setMusts(data.suggestions);setStatus('');}catch(error){setStatus(error.message);}
 }
 async function run(event){
  event?.preventDefault();
  setStatus('Scoring the shortlist…');
  try{const data=await api('/api/client/search',{query,filters,must_haves:musts});setFilters(data.filters);setRows([...(data.matches||[]),...(data.wider||[])]);setStatus(data.matches?.length||data.wider?.length?data.message:'No profiles matched. Edit a must-have or broaden the query.');}catch(error){setRows([]);setStatus(error.message);}
 }
 async function save(){
  setStatus('Saving to your search profile…');
  try{await api('/api/client/save-search',{query,filters,must_haves:musts});setStatus('Saved to your search profile.');}catch(error){setStatus(error.message);}
 }
 return <Shell>
  <Steps current={3}/>
  <h1>Search.</h1>
  <p>Spearpoint network profiles are verified relationships. Wider market cards are anonymised snapshots. A name is not shown.</p>
  <form className="searchbar" onSubmit={prepare}>
   <input aria-label="Search" value={query} onChange={event=>{setQuery(event.target.value);setFilters(null);setMusts(null);setRows(null);}}/>
   <button type="submit">Search</button>
  </form>
  {musts&&<form className="musts plain" onSubmit={run}>
   <p>What are the three things this person must have?</p>
   {musts.map((item,index)=><label key={index}>Must-have {index+1}<input aria-label={`Must-have ${index+1}`} value={item} onChange={event=>setMusts(musts.map((value,place)=>place===index?event.target.value:value))}/></label>)}
   {filters&&<div className="chips">{chips.map(key=><label key={key}>{key.replaceAll('_',' ')}<input value={filters[key]||''} onChange={event=>setFilters({...filters,[key]:event.target.value})}/></label>)}</div>}
   <button type="submit">Score the shortlist</button>
  </form>}
  {rows&&<p><button type="button" className="ghost" onClick={save}>Save</button></p>}
  <p role="status">{status}</p>
  {rows&&rows.map(row=><div className="card" key={(row.origin||'')+row.id}><ResultCard row={row} linked/></div>)}
  {rows&&!rows.length&&<p className="card">Nothing to show yet. Try a wider region or drop a must-have.</p>}
 </Shell>;
}
