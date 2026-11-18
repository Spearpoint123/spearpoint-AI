'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {api} from '../lib/api';
import {BookingModal} from './booking';
import {ResultCard} from './result-card';
const examples=['Head of Quant Research, Dubai','Staff security engineer, London'];
function Chart({title,rows}){
 if(!rows?.length)return null;
 const max=Math.max(...rows.map(row=>row.total));
 return <div><h3>{title}</h3>{rows.map(row=><div className="meter" key={row.name}><span>{row.name}</span><i style={{width:`${Math.round(row.total/max*100)}%`}}/></div>)}</div>;
}
export default function Home(){
 const router=useRouter();
 const [query,setQuery]=useState('');
 const [result,setResult]=useState(null);
 const [musts,setMusts]=useState(null);
 const [status,setStatus]=useState('');
 const [capture,setCapture]=useState('');
 const [booking,setBooking]=useState(false);
 async function search(event,nextQuery){
  event?.preventDefault();
  const text=(nextQuery??query).trim();
  if(nextQuery)setQuery(nextQuery);
  if(text.length<3){setStatus('Name the role, then the city.');return;}
  setResult(null);
  setStatus('Reading the role…');
  try{const data=await api('/api/public/teaser',{query:text,preview:true});setMusts(data.suggestions);setStatus('');}catch(error){setMusts(null);setStatus(error.message);}
 }
 async function confirm(event){
  event.preventDefault();
  setStatus('Scoring the shortlist…');
  try{setResult(await api('/api/public/teaser',{query,must_haves:musts}));setStatus('');}catch(error){setResult(null);setStatus(error.message);}
 }
 async function submit(event){
  event.preventDefault();
  const form=new FormData(event.target);
  setCapture('Opening the shortlist…');
  try{
   await api('/api/workspace/auth',{action:'signup',email:form.get('email'),password:form.get('password'),consent:true,directEmployer:true});
   await api('/api/client/bootstrap',{});
   await api('/api/client/brief',{title:form.get('role'),company:form.get('company'),capture:true,must_haves:musts||[]});
   router.push('/market');
  }catch(error){setCapture(error.message);}
 }
 const chart=result?.chart;
 const showChart=chart&&(chart.seniority?.length||chart.pay?.length);
 const booked=()=>{setBooking(false);router.push('/engagement');};
 return <div className="landing">
  <section className="hero">
   <header className="bar"><a className="brand" href="/begin">SPEARPOINT</a><nav><a href="/begin/start">Sign in</a><button type="button" className="link" onClick={()=>setBooking(true)}>Book a call</button></nav></header>
   <div className="frame">
    <h1>Senior hiring, without the search-firm price.</h1>
    <p className="sub">Hire leaders and senior talent above $150K for a fraction of the cost of an executive search firm. Software maps the market. A partner runs the approach and the close.</p>
    <p className="aside">See the shortlist before you see a name.</p>
    <form id="search" className="searchbar" onSubmit={search}><input aria-label="Role and city" value={query} placeholder="Head of quantitative research, London" onChange={event=>{setQuery(event.target.value);setMusts(null);setResult(null);}}/><button type="submit">Search</button></form>
    <div className="examples">{examples.map(example=><button type="button" key={example} onClick={event=>search(event,example)}>{example}</button>)}</div>
    {musts&&<form className="musts" onSubmit={confirm}><p>What are the three things this person must have?</p>{musts.map((item,index)=><label key={index}>Must-have {index+1}<input aria-label={`Must-have ${index+1}`} value={item} onChange={event=>setMusts(musts.map((value,place)=>place===index?event.target.value:value))}/></label>)}<button type="submit">Score the shortlist</button></form>}
    <p className="status" role="status">{status}</p>
   </div>
  </section>
  {result&&<section className="reveal"><div className="frame">
   <p className="count">{result.matched} confidential {result.matched===1?'profile matches':'profiles match'}.</p>
   <div className="teasers">{result.cards.map(card=><ResultCard key={(card.origin||'')+(card.id||card.snapshot)} row={card}/>)}</div>
   {showChart&&<div className="chart"><Chart title="Seniority" rows={chart.seniority}/><Chart title="Pay band" rows={chart.pay}/></div>}
   <form className="capture" onSubmit={submit}><h2>See the full shortlist.</h2><p>Work email. Free email domains are not accepted.</p><label>Work email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength={12} autoComplete="new-password"/></label><label>Company<input name="company" required minLength={2} autoComplete="organization"/></label><label>Role being hired<input name="role" required minLength={3} defaultValue={query}/></label><button type="submit">See the full shortlist</button><p className="status" role="status">{capture}</p></form>
  </div></section>}
  <section className="steps"><div className="frame"><h2>How it works.</h2><ol>
   <li><span>1</span><div><h3>Map.</h3><p>The software reads Spearpoint’s database and shows the market for the role.</p></div></li>
   <li><span>2</span><div><h3>Judge.</h3><p>A partner approaches people and decides who is worth a conversation.</p></div></li>
   <li><span>3</span><div><h3>Meet.</h3><p>You meet people who have approved you.</p></div></li>
  </ol></div></section>
  <section className="quiet"><div className="frame"><h2>Confidential by design.</h2><p>Employer and candidate data is handled under UK GDPR. The same rule applies to UAE searches.</p><p>A name is shared only after the candidate approves the employer.</p></div></section>
  <p className="census">Mapping senior talent across capital markets, crypto, AI, payments and trading.</p>
  <section className="close"><div className="frame"><h2>Start with the role.</h2><p>Search the database, or speak with a partner.</p><p className="actions"><a className="button" href="#search">Search</a><button type="button" className="button light" onClick={()=>setBooking(true)}>Book a call</button></p><p className="fine"><a href="/begin/start">Sign in</a> · <a href="/signup">Existing employer workspace</a></p></div></section>
  <BookingModal open={booking} onClose={()=>setBooking(false)} onBooked={booked}/>
 </div>;
}
