'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {api,Shell} from '../../lib/api';
export default function Start(){
 const router=useRouter();
 const [mode,setMode]=useState('signup');
 const [status,setStatus]=useState('');
 async function submit(event){
  event.preventDefault();
  const form=new FormData(event.target);
  setStatus(mode==='signup'?'Creating your account…':'Signing in…');
  try{
   await api('/api/workspace/auth',{action:mode,email:form.get('email'),password:form.get('password'),consent:true,directEmployer:true});
   await api('/api/client/bootstrap',{});
   router.push('/brief');
  }catch(error){setStatus(error.message);}
 }
 return <Shell><h1>{mode==='signup'?'Start a search.':'Sign in.'}</h1><p>Use your work email. Free email domains are not accepted.</p><form onSubmit={submit}><label>Work email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength={12} autoComplete={mode==='signup'?'new-password':'current-password'}/></label><button type="submit">{mode==='signup'?'Create account':'Sign in'}</button> <button type="button" className="ghost" onClick={()=>setMode(mode==='signup'?'signin':'signup')}>{mode==='signup'?'I already have an account':'Create an account'}</button></form><p className="muted" role="status">{status}</p><p className="muted">Demonstration: client@demo.spearpoint.test / demo-client-pass</p></Shell>;
}
