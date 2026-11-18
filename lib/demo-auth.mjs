import {workspaceCookie} from './workspace-auth.mjs';
import {DEMO_CLIENT_ID,DEMO_RECRUITER_ID} from './demo-data.mjs';

const users=[
 {id:DEMO_CLIENT_ID,email:'client@demo.spearpoint.test',password:'demo-client-pass',owner:false,operator:false,recruiter:false},
 {id:DEMO_RECRUITER_ID,email:'recruiter@demo.spearpoint.test',password:'demo-recruiter-pass',owner:true,operator:true,recruiter:true}
];
function shape(user){return {id:user.id,email:user.email,owner:user.owner,operator:user.operator,recruiter:user.recruiter};}
export function demoUserByToken(token){
 const id=String(token||'').slice('demo:'.length);
 const user=users.find(u=>u.id===id);
 return user?shape(user):null;
}
export function demoAuth(body,res){
 if(body?.action==='logout'){res.setHeader('Set-Cookie',workspaceCookie(null));return {ok:true};}
 if(body?.action==='signup')throw Error('demo_accounts_only');
 if(body?.action!=='signin')throw Error('validation');
 const email=String(body.email||'').trim().toLowerCase();
 const user=users.find(u=>u.email===email&&u.password===body.password);
 if(!user)throw Error('signin_failed');
 res.setHeader('Set-Cookie',workspaceCookie({access_token:'demo:'+user.id,refresh_token:'demo-refresh'}));
 return {ok:true,demo:true,message:'Signed in to the fictional demonstration. These records are not real people.'};
}
