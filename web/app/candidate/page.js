'use client';
import {useEffect,useState} from 'react';
import {api,Shell} from '../../lib/api';
export default function Candidate(){
 const [row,setRow]=useState(null);
 const [status,setStatus]=useState('Opening the profile…');
 useEffect(()=>{const id=new URLSearchParams(location.search).get('id');api('/api/client/candidate',{id}).then(data=>{setRow(data.candidate);setStatus('Identity is hidden.');}).catch(error=>setStatus(error.message));},[]);
 if(!row)return <Shell><p role="status">{status}</p></Shell>;
 const scope=row.scope||{};
 return <Shell><h1>{row.level}. {row.years_bucket}.</h1>{row.fictional&&<p>Demo profile. Not a real person.</p>}<p>{row.summary}</p><div className="grid"><div className="card"><h3>Scope</h3><p>Team {scope.team}. {scope.pnl}.</p><p>Asset classes: {(scope.asset_classes||[]).join(', ')}.</p><p>Products: {(scope.products||[]).join(', ')}.</p></div><div className="card"><h3>History by firm type</h3><p>{(row.sector_history||[]).join(' · ')}</p><p>Region {row.region}. Pay band {row.pay_band}.</p><p>Skills: {(row.skills||[]).join(', ')}.</p></div></div><p className="muted">{status} No name, employer, photograph, LinkedIn or university is on this page.</p><p><a className="button" href="/begin/book">Book a call to speak with a partner</a></p></Shell>;
}
