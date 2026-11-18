'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {api} from '../lib/api';
const booking='https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone';
const examples=['Head of Quant Research, Dubai','Staff security engineer, London'];
export default function Home(){
 const router=useRouter();
 const [query,setQuery]=useState('');
 const [catalogue,setCatalogue]=useState(null);
 const [result,setResult]=useState(null);
 const [status,setStatus]=useState('');
 const [capture,setCapture]=useState('');
 useEffect(()=>{api('/api/public/teaser',{query:'senior',counts:true}).then(data=>setCatalogue({total:data.total,sectors:data.sectors})).catch(()=>{});},[]);
 async function search(event,nextQuery){
  event?.preventDefault();
  const text=(nextQuery??query).trim();
  if(nextQuery)setQuery(nextQuery);
  if(text.length<3){setStatus('Name the role, then the city.');return;}
  setStatus('Reading the database…');
  try{setResult(await api('/api/public/teaser',{query:text}));setStatus('');}catch(error){setStatus(error.message);}
 }
 async function submit(event){
  event.preventDefault();
  const form=new FormData(event.target);
  setCapture('Opening the shortlist…');
  try{
   await api('/api/workspace/auth',{action:'signup',email:form.get('email'),password:form.get('password'),consent:true,directEmployer:true});
   await api('/api/client/bootstrap',{});
   await api('/api/client/brief',{title:form.get('role'),company:form.get('company'),capture:true});
   router.push('/market');
  }catch(error){setCapture(error.message);}
 }
 return <div className="landing"><header className="top"><a className="brand" href="/begin">SPEARPOINT</a><nav><a href="/begin/start">Sign in</a><a href={booking}>Book a call</a></nav></header>
  <section className="hero"><p className="kicker">Executive search</p><h1>See the shortlist before you see a name.</h1><p>For hiring leaders in capital markets, crypto, AI, payments and trading. Roles above $150k.</p>
   <form className="searchbar" onSubmit={search}><input aria-label="Role and city" value={query} placeholder="Head of quantitative research, London" onChange={event=>setQuery(event.target.value)}/><button type="submit">Search</button></form>
   <div className="examples">{examples.map(example=><button type="button" className="ghost" key={example} onClick={event=>search(event,example)}>{example}</button>)}</div>
   <p role="status">{status}</p>
   {result&&<div className="payoff"><p className="count">{result.matched} confidential {result.matched===1?'profile matches':'profiles match'}.</p><div className="grid">{result.cards.map((card,index)=><article className="card" key={index}><div className="veil"><p className="score">Match {card.score}</p><h2>{card.level}</h2><p>{card.region} · {card.pay_band}</p><p>{card.firm_type}</p></div>{card.fictional?<p>Demo profile. Not a real person.</p>:<p>Verified by Spearpoint</p>}<p>Identity pending approval.</p></article>)}</div>
    <form className="capture" onSubmit={submit}><h2>See the full shortlist.</h2><p>Work email. Free email domains are not accepted.</p><label>Work email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength={12} autoComplete="new-password"/></label><label>Company<input name="company" required minLength={2} autoComplete="organization"/></label><label>Role being hired<input name="role" required minLength={3} defaultValue={query}/></label><button type="submit">See the full shortlist</button><p role="status">{capture}</p></form>
   </div>}
  </section>
  <section><h2>How it works.</h2><ol className="how"><li><strong>1. Map.</strong> The software reads Spearpoint’s database and shows the market for the role.</li><li><strong>2. Judge.</strong> A partner approaches people and decides who is worth a conversation.</li><li><strong>3. Meet.</strong> You meet people who have approved you.</li></ol></section>
  <section className="card fee"><h2>Single search.</h2><p>US$5,000, credited against the 17.5% fee on first-year base. Invoicing is manual.</p></section>
  <section><h2>Confidential by design.</h2><p>Employer and candidate data is handled under UK GDPR. The same rule applies to UAE searches.</p><p>A name is shared only after the candidate approves the employer. The reveal is audited.</p></section>
  {catalogue&&<p className="muted">{catalogue.total} confidential profiles mapped. {catalogue.sectors} sectors in the database.</p>}
  <p><a className="button" href={booking}>Book a call</a></p>
  <p className="muted"><a href="/begin/start">Sign in</a> · <a href="/signup">Existing employer workspace</a></p>
 </div>;
}
