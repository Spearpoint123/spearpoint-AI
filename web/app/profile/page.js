'use client';
import {useEffect,useState} from 'react';
import {api,Shell,Steps} from '../../lib/api';
export default function Profile(){
 const [profile,setProfile]=useState(null);
 const [status,setStatus]=useState('Loading the profile…');
 useEffect(()=>{api('/api/client/home').then(data=>{setProfile(data.search.profile||{});setStatus('');}).catch(error=>setStatus(error.message));},[]);
 async function save(event){
  event.preventDefault();
  const next=Object.fromEntries(new FormData(event.target));
  setStatus('Saving…');
  try{const data=await api('/api/client/profile',{profile:next});setProfile(data.profile);setStatus('Saved.');}catch(error){setStatus(error.message);}
 }
 if(!profile)return <Shell><p role="status">{status}</p></Shell>;
 return <Shell><Steps current={1}/><h1>Search profile.</h1><p>Edit the structured brief. Then open the market view.</p><form onSubmit={save}>{Object.entries(profile).map(([key,value])=><label key={key}>{key.replaceAll('_',' ')}<input name={key} defaultValue={value}/></label>)}<button type="submit">Save profile</button> <a className="button" href="/begin/market">See the market</a></form><p role="status">{status}</p></Shell>;
}
