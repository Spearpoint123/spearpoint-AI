'use client';
import {useEffect,useState} from 'react';
import {api,Shell,Steps} from '../../lib/api';
function Bars({title,rows}){return <div className="card"><h3>{title}</h3>{(rows||[]).map(row=><p key={row.name}>{row.name} · {row.total}</p>)}</div>;}
export default function Market(){
 const [data,setData]=useState(null);
 const [status,setStatus]=useState('Reading the database…');
 useEffect(()=>{api('/api/client/market').then(setData).then(()=>setStatus('')).catch(error=>setStatus(error.message));},[]);
 return <Shell><Steps current={2}/><h1>Market view.</h1><p>Spearpoint’s own database. No external profiles.</p><p role="status">{status}</p>{data&&<><p>{data.message}</p><div className="grid"><Bars title="Firm type" rows={data.map.firm_type}/><Bars title="Region" rows={data.map.region}/><Bars title="Level" rows={data.map.seniority}/></div><p className="muted">Pay bands in view: {(data.map.pay||[]).join(', ')||'none'}.</p>{data.matches.map(row=><article className="card" key={row.id}><p className="score">Fit {row.score}</p><h2>{row.level} · {row.years_bucket}</h2><p>{row.firm_type} · {row.region} · {row.pay_band}</p><p>{row.why}</p><a href={'/begin/candidate?id='+row.id}>Open the anonymised profile</a></article>)}<p><a className="button" href="/begin/book">Book a call</a></p></>}</Shell>;
}
