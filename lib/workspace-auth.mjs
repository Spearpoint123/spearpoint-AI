import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {PROJECT_URL} from './services.mjs';
const cookieName='__Host-sp_workspace';
function key(){const secret=process.env.RATE_LIMIT_HMAC_KEY;if(!secret||secret.length<32)throw Error('storage_unavailable');return createHash('sha256').update('workspace-v1:'+secret).digest();}
export function sealSession(session){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token,until:Date.now()+7*86400000})),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');}
export function openSession(cookie=''){try{const raw=cookie.split(';').find(c=>c.trim().startsWith(cookieName+'='))?.trim().slice(cookieName.length+1);const b=Buffer.from(raw||'','base64url');const decipher=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));decipher.setAuthTag(b.subarray(12,28));const data=JSON.parse(Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]));return data.until>Date.now()?data:null;}catch{return null;}}
export function workspaceCookie(session){return `${cookieName}=${session?sealSession(session):''}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${session?604800:0}`;}
export async function authRequest(path,body,token){
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(process.env.SUPABASE_URL!==PROJECT_URL||!secret)throw Error('storage_unavailable');
 const r=await fetch(PROJECT_URL+'/auth/v1/'+path,{method:body?'POST':'GET',headers:{apikey:secret,Authorization:'Bearer '+(token||secret),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});
 const payload=await r.text();const data=payload?JSON.parse(payload):{};return {ok:r.ok,data};
}
export async function workspaceUser(req,res,required=true){
 let session=openSession(req.headers.cookie);if(!session){if(required)throw Error('unauthorized');return null;}
 let result=await authRequest('user',null,session.access_token);
 if(!result.ok){const refresh=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});if(!refresh.ok){res.setHeader('Set-Cookie',workspaceCookie(null));if(required)throw Error('unauthorized');return null;}session=refresh.data;result=await authRequest('user',null,session.access_token);if(result.ok)res.setHeader('Set-Cookie',workspaceCookie(session));}
 if(!result.ok||!result.data.id||!result.data.email_confirmed_at||Date.parse(result.data.banned_until||'')>Date.now()){if(required)throw Error('unauthorized');return null;}
 return {id:result.data.id,email:result.data.email};
}
