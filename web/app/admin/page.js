'use client';
import {useEffect,useState} from 'react';
import {api,Shell} from '../../lib/api';
export default function Admin(){
 const [data,setData]=useState(null);
 const [status,setStatus]=useState('Opening admin…');
 const [domain,setDomain]=useState('harbour-lane.example');
 const [evidence,setEvidence]=useState('Direct employer. Hiring manager named. Role is live.');
 function load(){return api('/api/admin/home',{}).then(setData).then(()=>setStatus('')).catch(error=>setStatus(error.message));}
 useEffect(()=>{load();},[]);
 async function review(next){setStatus('Saving the decision…');try{await api('/api/admin/review',{domain,status:next,evidence,companyName:'Harbour Lane Capital'});await load();setStatus(next==='approved'?'Employer verified.':'Decision saved.');}catch(error){setStatus(error.message);}}
 async function activate(id){setStatus('Activating…');try{await api('/api/admin/activate',{id});await load();setStatus('Engagement is active.');}catch(error){setStatus(error.message);}}
 async function price(id){setStatus('Saving terms…');try{await api('/api/admin/price',{id,fee_percent:17.5,monthly_amount:0,engagement_fee:5000,note:'Manual invoice.'});setStatus('Terms saved.');}catch(error){setStatus(error.message);}}
 async function publish(){setStatus('Publishing…');try{const ids=(data.unpublished||[]).map(row=>row.id);const result=await api('/api/admin/publish',{ids});setStatus(`${result.published} published. ${result.suppressed.length} held back.`);await load();}catch(error){setStatus(error.message);}}
 async function step(){setStatus('Reading the next RecruitCRM page…');try{const result=await api('/api/admin/import-step',{});setStatus(result.status==='not_configured'?'RecruitCRM is not configured. Nothing was read.':`Page ${result.page}. Imported ${result.imported}. Updated ${result.updated}.`);await load();}catch(error){setStatus(error.message);}}
 async function toggleDemo(){setStatus('Saving the demo switch…');try{await api('/api/admin/demo-toggle',{enabled:!data.demo});await load();setStatus('Demo visibility saved.');}catch(error){setStatus(error.message);}}
 if(!data)return <Shell><p role="status">{status}</p></Shell>;
 const report=data.report||{};
 return <Shell banner="Admin. Owner and operator only."><h1>Admin.</h1>
  <h2>Verification</h2><form onSubmit={event=>event.preventDefault()}><label>Domain<input value={domain} onChange={event=>setDomain(event.target.value)}/></label><label>Evidence<textarea value={evidence} onChange={event=>setEvidence(event.target.value)} rows={2}/></label><button type="button" onClick={()=>review('approved')}>Approve</button> <button type="button" className="ghost" onClick={()=>review('blocked')}>Reject</button></form>
  <h2>Engagements</h2>{data.engagements.map(row=><article className="card" key={row.id}><h3>{row.label}</h3><p>{row.status}. Fee {row.fee_percent}%. Monthly {row.monthly_amount}. Engagement fee {row.engagement_fee}.</p>{row.status!=='active'&&<button type="button" onClick={()=>activate(row.id)}>Activate</button>} <button type="button" className="ghost" onClick={()=>price(row.id)}>Save terms</button></article>)}
  <h2>Reporting</h2><div className="grid"><p className="card">Sign-ups {report.signups}</p><p className="card">Briefs {report.briefs}</p><p className="card">Calls {report.callsBooked}</p><p className="card">Conversion {report.conversion}%</p><p className="card">Live searches {report.liveSearches}</p><p className="card">Placements {report.placements}</p><p className="card">Response {report.responseRate}%</p><p className="card">Hours per placement {report.hoursPerPlacement}</p><p className="card">MRR {report.mrr}</p><p className="card">Churn {report.churn}%</p></div>
  <h2>Audit</h2>{(data.audit||[]).map(row=><p key={row.id}>{row.action}. {row.entity}</p>)}{!(data.audit||[]).length&&<p className="muted">No reveals, exports or provider lookups yet.</p>}
  <h2>Unpublished imports</h2><p>Profiles from RecruitCRM stay here until you publish them. RocketReach records stay unpublished. Consent for existing records is still undecided.</p><button type="button" onClick={publish} disabled={!data.unpublished.length}>Publish all</button>
  {data.unpublished.map(row=><p key={row.id}>{row.level} · {row.firm_type} · {row.region} · {row.pay_band}</p>)}
  <h2>RecruitCRM import</h2><p>Read only. Imported profiles stay unpublished for clients. {data.importJob?`Status ${data.importJob.status}. Page ${data.importJob.page}. Imported ${data.importJob.imported}. Updated ${data.importJob.updated}.`:'Not started.'}</p><button type="button" onClick={step}>Import the next page</button>
  <h2>Demo profiles</h2><p>Show fictional profiles on client surfaces and in staff search. They are always labelled demo. Default is on until real profiles are published.</p><button type="button" onClick={toggleDemo}>{data.demo?'Hide demo profiles':'Show demo profiles'}</button>
  <p role="status">{status}</p></Shell>;
}
