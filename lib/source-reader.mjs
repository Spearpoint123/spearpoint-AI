import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';
export function publicAddress(ip){
 if(isIP(ip)!==4)return false;const [a,b,c]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
export function sourceUrl(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(u.hostname)||!u.hostname.includes('.')||/\.(local|internal|test|invalid|example)$|\.$/.test(u.hostname))return null;return u;}catch{return null;}}
// Pin the validated public address into TLS lookup, including after every redirect.
export async function readSource(value,{maxBytes=650000,timeoutMs=5000,resolve=lookup,transport=https.get,redirects=0}={}){
 const u=sourceUrl(value);if(!u||redirects>2)throw Error('source_blocked');
 let timer;const addresses=await Promise.race([resolve(u.hostname,{all:true,family:4}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('source_timeout')),timeoutMs);})]).finally(()=>clearTimeout(timer));if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('source_blocked');const address=addresses[0].address;
 return new Promise((resolveRead,reject)=>{
  const req=transport(u,{headers:{'User-Agent':'SpearpointResearch/1.0','Accept':'text/html,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'},lookup:(_host,opts,callback)=>opts?.all?callback(null,[{address,family:4}]):callback(null,address,4)},res=>{
   if([301,302,303,307,308].includes(res.statusCode)){res.resume();let target;try{target=new URL(res.headers.location,u);}catch{return reject(Error('source_unavailable'));}readSource(target.href,{maxBytes,timeoutMs,resolve,transport,redirects:redirects+1}).then(resolveRead,reject);return;}
   if(res.statusCode!==200){res.resume();return reject(Error('source_unavailable'));}
   if(Number(res.headers['content-length'])>maxBytes){res.destroy();return reject(Error('source_too_large'));}
   const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){res.destroy();reject(Error('source_too_large'));}else chunks.push(chunk);});res.on('error',()=>reject(Error('source_unavailable')));res.on('end',()=>{try{let bytes=Buffer.concat(chunks);const encoding=res.headers['content-encoding'];if(encoding==='gzip')bytes=gunzipSync(bytes,{maxOutputLength:maxBytes});else if(encoding==='deflate')bytes=inflateSync(bytes,{maxOutputLength:maxBytes});else if(encoding==='br')bytes=brotliDecompressSync(bytes,{maxOutputLength:maxBytes});resolveRead({bytes,contentType:res.headers['content-type']||'',url:u.href});}catch{reject(Error('source_unavailable'));}});
  });req.setTimeout(timeoutMs,()=>req.destroy(Error('source_timeout')));req.on('error',()=>reject(Error('source_unavailable')));
 });
}
const decode=s=>s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>{const c=Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';});
export function pageText(html){
 return decode(String(html).replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|nav|footer|header|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<\/(?:p|div|section|article|h[1-6]|li)>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,' ')).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim().slice(0,50000);
}
export async function readPublicProfile(lead,{reader=readSource}={}){
 const urls=[...new Set([lead.canonical_url,...(lead.sources||[]).filter(s=>!s.kind&&typeof s.url==='string').map(s=>s.url)])].filter(Boolean).slice(0,3);
 for(const url of urls)try{const r=await reader(url);if(!/text\/html|text\/plain/i.test(r.contentType))throw Error();const text=pageText(r.bytes.toString('utf8'));if(/verify (?:you are|you're) human|checking your browser|enable javascript and cookies/i.test(text))throw Error();const identity=String(lead.person_name||'').trim();const at=text.toLowerCase().indexOf(identity.toLowerCase());if(identity.length<3||at<0)throw Error();return {text:text.slice(Math.max(0,at-200),at+6500),status:'page_read',url:r.url};}catch{}
 return {text:'',status:'page_unavailable',url:lead.canonical_url};
}
