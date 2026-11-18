'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {api,Shell} from '../../lib/api';
import {MeetingsEmbed} from '../booking';
export default function Book(){
 const router=useRouter();
 const [who,setWho]=useState(null);
 const [status,setStatus]=useState('');
 useEffect(()=>{api('/api/client/home').then(setWho).catch(()=>{});},[]);
 async function booked(){
  setStatus('Saving the booking…');
  try{await api('/api/client/book',{booked:true});}catch{}
  router.push('/engagement');
 }
 return <Shell><h1>Book a call.</h1><p>The onboarding call is with a Spearpoint partner. Your company stays at verification pending until that check is done. The booking stays on this page.</p><MeetingsEmbed email={who?.email} company={who?.organisation?.name} onBooked={booked}/><p>After the call, choose an engagement. The pipeline opens once that engagement is active.</p><p role="status">{status}</p></Shell>;
}
