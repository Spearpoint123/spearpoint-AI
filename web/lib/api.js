'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {BookingModal} from '../app/booking';
export async function api(path,body){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Something went wrong.');
 return data;
}
export function Shell({children,banner}){
 const router=useRouter();
 const [open,setOpen]=useState(false);
 return <div className="wrap"><header className="top"><a className="brand" href="/begin">SPEARPOINT</a><nav><a href="/begin/brief">Brief</a><a href="/begin/market">Market</a><a href="/begin/search">Search</a><a href="/begin/portal">Portal</a><button type="button" className="link" onClick={()=>setOpen(true)}>Book a call</button><a href="/begin/engagement">Engagement</a></nav></header>{banner?<p className="banner">{banner}</p>:null}{children}<BookingModal open={open} onClose={()=>setOpen(false)} onBooked={()=>{setOpen(false);router.push('/engagement');}}/></div>;
}
export function Steps({current}){
 const items=['Brief','Profile','Market','Search'];
 return <ol className="steps">{items.map((item,index)=><li key={item} className={index===current?'on':''}>{index+1}. {item}</li>)}</ol>;
}
export function PartnerShell({children}){
 return <div className="wrap"><header className="top"><a className="brand" href="/begin/desk">SPEARPOINT</a><nav><a href="/begin/desk">My searches</a></nav></header>{children}</div>;
}
