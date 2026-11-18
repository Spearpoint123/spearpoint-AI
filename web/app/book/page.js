'use client';
import {useState} from 'react';
import {api,Shell} from '../../lib/api';
export default function Book(){
 const [url,setUrl]=useState('');
 const [status,setStatus]=useState('');
 async function open(){
  setStatus('Preparing the booking link…');
  try{const data=await api('/api/client/book',{});setUrl(data.url);setStatus(data.verification_status==='verified'?'Verified.':'Verification pending. A partner checks the company, the hiring manager and that the role is live.');}catch(error){setStatus(error.message);}
 }
 return <Shell><h1>Book a call.</h1><p>The onboarding call is with a Spearpoint partner. Your company stays at verification pending until that check is done.</p><button type="button" onClick={open}>Open the HubSpot booking page</button>{url&&<p><a className="button" href={url} target="_blank" rel="noreferrer">Continue to HubSpot</a></p>}<p>After the call, <a href="/begin/engagement">choose an engagement</a>. The pipeline opens once that engagement is active.</p><p role="status">{status}</p></Shell>;
}
