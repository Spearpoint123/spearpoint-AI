import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';

function keyBytes(){
  const raw=process.env.CANDIDATE_IDENTITY_KEY||'';
  if(!raw)throw Error('identity_key_missing');
  const buf=raw.length===64&&/^[0-9a-f]+$/i.test(raw)?Buffer.from(raw,'hex'):Buffer.from(raw,'base64');
  if(buf.length!==32)throw Error('identity_key_missing');
  return buf;
}
export function encryptIdentity(value){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',keyBytes(),iv);
  const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return {ciphertext:Buffer.concat([iv,tag,body]).toString('base64'),key_version:1};
}
export function decryptIdentity(payload){
  const buf=Buffer.from(payload.ciphertext,'base64');
  const iv=buf.subarray(0,12),tag=buf.subarray(12,28),body=buf.subarray(28);
  const decipher=createDecipheriv('aes-256-gcm',keyBytes(),iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8'));
}
export function fingerprint(value){
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);
}
