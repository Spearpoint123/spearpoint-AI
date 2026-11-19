import {Worker} from 'node:worker_threads';
export const MAX_DOCUMENT_BYTES=2*1024*1024;
export async function extractDocument(body){
 if(body.confirmed!==true||typeof body.name!=='string'||body.name.length>180||typeof body.data!=='string'||body.data.length>Math.ceil(MAX_DOCUMENT_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.data))throw Error('document_invalid');
 const bytes=Buffer.from(body.data,'base64');if(!bytes.length||bytes.length>MAX_DOCUMENT_BYTES)throw Error('document_large');
 const ext=body.name.split('.').at(-1).toLowerCase();if(!['pdf','docx','txt'].includes(ext))throw Error('document_invalid');
 if(ext==='txt'){let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/\u0000/g,'').trim();}catch{throw Error('document_invalid');}if(text.length<12)throw Error('document_empty');if(text.length>20000)throw Error('document_long');return {text,characters:text.length};}
 if(ext==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-'||ext==='docx'&&(bytes.length<4||bytes.readUInt32LE(0)!==0x04034b50))throw Error('document_invalid');
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./document-worker.mjs',import.meta.url),{workerData:{kind:ext,bytes},resourceLimits:{maxOldGenerationSizeMb:128}});const timer=setTimeout(()=>{worker.terminate();reject(Error('document_timeout'));},10000);let done=false;worker.once('message',result=>{done=true;clearTimeout(timer);worker.terminate();if(result.error)reject(Error(result.error));else resolve({...result,characters:result.text.length});});worker.once('error',()=>{clearTimeout(timer);reject(Error('document_invalid'));});worker.once('exit',()=>{clearTimeout(timer);if(!done)reject(Error('document_invalid'));});});
}
