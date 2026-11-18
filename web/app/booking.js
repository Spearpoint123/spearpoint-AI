'use client';
import {useEffect,useRef} from 'react';
const meetings='https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone';
export function meetingsSrc({email,name,company}={}){
 const url=new URL(meetings);
 url.searchParams.set('embed','true');
 if(email)url.searchParams.set('email',email);
 if(company)url.searchParams.set('company',company);
 const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
 if(parts[0])url.searchParams.set('firstName',parts[0]);
 if(parts.length>1)url.searchParams.set('lastName',parts.slice(1).join(' '));
 return url.toString();
}
export function MeetingsEmbed({email,name,company,onBooked}){
 const host=useRef(null);
 const booked=useRef(onBooked);
 booked.current=onBooked;
 const src=meetingsSrc({email,name,company});
 useEffect(()=>{
  const node=host.current;
  if(!node)return;
  node.replaceChildren();
  const box=document.createElement('div');
  box.className='meetings-iframe-container';
  box.setAttribute('data-src',src);
  node.appendChild(box);
  const script=document.createElement('script');
  script.type='text/javascript';
  script.src='https://static.hsappstatic.net/MeetingsEmbed/ex/MeetingsEmbedCode.js';
  node.appendChild(script);
  let done=false;
  function onMessage(event){
   if(!String(event.origin||'').endsWith('hubspot.com'))return;
   const data=event.data;
   const text=typeof data==='string'?data:JSON.stringify(data||{});
   if(done||!text.includes('meetingBookSucceeded'))return;
   done=true;
   booked.current?.();
  }
  window.addEventListener('message',onMessage);
  return ()=>{window.removeEventListener('message',onMessage);node.replaceChildren();};
 },[src]);
 return <div ref={host} className="meetings-embed"/>;
}
export function BookingModal({open,onClose,onBooked,email,name,company}){
 useEffect(()=>{
  if(!open)return;
  function onKey(event){if(event.key==='Escape')onClose?.();}
  window.addEventListener('keydown',onKey);
  return ()=>window.removeEventListener('keydown',onKey);
 },[open,onClose]);
 if(!open)return null;
 return <div className="modal-back" role="presentation" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="book-title" onClick={event=>event.stopPropagation()}><button type="button" className="ghost" onClick={onClose}>Close</button><h2 id="book-title">Book a call.</h2><p>Choose a time with a Spearpoint partner. The booking stays on this page.</p><MeetingsEmbed email={email} name={name} company={company} onBooked={onBooked}/></div></div>;
}
