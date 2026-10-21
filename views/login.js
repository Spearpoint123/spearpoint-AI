document.querySelector('#login-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.target.querySelector('button'),status=document.querySelector('#login-status');button.disabled=true;status.textContent='Signing in…';
 try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});const data=await response.json();if(!response.ok)throw Error(data.error||'Sign-in failed.');event.target.reset();location.assign('/');}catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
