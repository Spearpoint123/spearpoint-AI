'use client';
import {useState} from 'react';
import {api,Shell} from '../lib/api';
const booking='https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone';
export default function Home(){
 const [query,setQuery]=useState('senior quant researcher, crypto market making, Dubai or London, $250-350K');
 const [result,setResult]=useState(null);
 const [status,setStatus]=useState('');
 async function search(event){
  event.preventDefault();
  setStatus('Reading Spearpoint’s database…');
  try{setResult(await api('/api/public/teaser',{query}));setStatus('');}catch(error){setStatus(error.message);}
 }
 return <Shell banner="Anonymised profiles only. Names are not part of this view."><div className="hero"><p className="kicker">Executive search</p><h1>See the market before you see a name.</h1><p>Spearpoint maps senior talent from its own database. A partner runs the search. You decide from anonymised profiles.</p><form className="searchbar" onSubmit={search}><input aria-label="Try a search" value={query} onChange={event=>setQuery(event.target.value)}/><button type="submit">Try a search</button></form><p role="status">{status}</p>{result&&<><p>{result.total} anonymised profiles in the database. {result.message}</p><div className="grid"><div className="card"><h3>Region</h3>{(result.map.region||[]).slice(0,4).map(row=><p key={row.name}>{row.name} · {row.total}</p>)}</div><div className="card"><h3>Pay bands</h3><p>{(result.map.pay||[]).slice(0,4).join(', ')||'none'}</p></div></div><div className="grid">{result.cards.map((card,index)=><article className="card tease" key={index}><p className="score">Match {card.score}</p><h2>{card.level}</h2><p>{card.region} · {card.pay_band}</p><p>{card.firm_type}</p></article>)}</div><p>Sign up to open the full cards and the reason each one matched.</p></>}<p><a className="button" href="/begin/start">Start a search</a> <a className="button ghost" href={booking}>Book a call</a> <a href="/signup">Existing employer workspace</a></p></div></Shell>;
}
