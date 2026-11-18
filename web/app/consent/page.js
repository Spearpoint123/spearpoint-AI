'use client';
import {useEffect,useState} from 'react';
import {api} from '../../lib/api';
export default function Consent(){
 const [data,setData]=useState(null);
 const [status,setStatus]=useState('Opening the request…');
 const token=typeof location==='undefined'?'':new URLSearchParams(location.search).get('token')||'';
 function load(){return api('/api/candidate/consent',{token}).then(setData).then(()=>setStatus('')).catch(error=>setStatus(error.message));}
 useEffect(()=>{if(token)load();else setStatus('This link is not valid.');},[token]);
 async function choose(decision){setStatus('Saving your decision…');try{setData(await api('/api/candidate/consent',{token,decision}));setStatus('Saved.');}catch(error){setStatus(error.message);}}
 return <div className="wrap"><header className="top"><a className="brand" href="/begin">SPEARPOINT</a></header><h1>Share your name with one employer.</h1><p>This page is only about that employer and that search. You can change your mind later from this same link.</p>{data&&<div className="card"><h2>{data.employer}</h2><p>{data.searchTitle}</p><p>Decision: {data.decision}.</p>{data.decision!=='approved'&&<button type="button" onClick={()=>choose('approve')}>Approve</button>} {data.decision==='approved'?<button type="button" className="ghost" onClick={()=>choose('withdraw')}>Withdraw</button>:<button type="button" className="ghost" onClick={()=>choose('decline')}>Decline</button>}</div>}<p role="status">{status}</p></div>;
}
