import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const lifetime=8*60*60;
const password=()=>process.env.STAGING_PASSWORD||process.env.STAGINGPASSWORD||'';
const signature=payload=>createHmac('sha256',password()).update(`spearpoint-staging-session:${payload}`).digest('base64url');
export function sessionCookie(now=Date.now()){
 if(password().length<20)throw Error('configuration');
 const payload=`${Math.floor(now/1000)+lifetime}.${randomBytes(24).toString('base64url')}`;
 return `sp_session=${payload}.${signature(payload)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${lifetime}`;
}
export function sessionValid(cookie,now=Date.now()){
 if(password().length<20||typeof cookie!=='string'||cookie.length>5000)return false;
 const value=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('sp_session='))?.slice(11);
 if(!value)return false;
 const parts=value.split('.');if(parts.length!==3)return false;
 const expiry=Number(parts[0]),current=Math.floor(now/1000);
 if(!Number.isSafeInteger(expiry)||expiry<=current||expiry>current+lifetime)return false;
 const expected=Buffer.from(signature(`${parts[0]}.${parts[1]}`)),received=Buffer.from(parts[2]);
 return expected.length===received.length&&timingSafeEqual(expected,received);
}
