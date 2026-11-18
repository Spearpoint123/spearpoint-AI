'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {api,Shell} from '../../lib/api';
const fields=[['title','Role title','Head of quantitative research'],['function','Function','Quantitative research'],['seniority','Seniority','Senior'],['location','Location','London or Dubai'],['remote_policy','Remote policy','Hybrid'],['base_pay','Base pay range','250–350'],['total_pay','Total pay range','400–600'],['must_haves','Must-haves','Crypto market making, research'],['nice_to_haves','Nice-to-haves','Python'],['target_firms','Target firm types','Crypto market makers'],['excluded_firms','Excluded firm types','Retail brokers'],['start_date','Start date','Next quarter']];
export default function Brief(){
 const router=useRouter();
 const [status,setStatus]=useState('');
 async function submit(event){
  event.preventDefault();setStatus('Structuring the brief…');
  const answers=Object.fromEntries(new FormData(event.target));
  try{await api('/api/client/brief',answers);router.push('/profile');}catch(error){setStatus(error.message);}
 }
 return <Shell><h1>The brief.</h1><p>Five minutes. We turn this into a search profile you can edit.</p><form onSubmit={submit}>{fields.map(([name,label,placeholder])=><label key={name}>{label}{name.includes('must')||name.includes('nice')||name.includes('firm')?<textarea name={name} required={name==='title'} rows={2} placeholder={placeholder}/>:<input name={name} required={name==='title'} placeholder={placeholder}/>}</label>)}<button type="submit">Build the search profile</button></form><p role="status">{status}</p></Shell>;
}
