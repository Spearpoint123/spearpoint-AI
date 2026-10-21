// Trust deployment metadata supplied by Vercel, never a client Host header or a wildcard.
export function originAllowed(origin){
 if(typeof origin!=='string'||origin==='null')return false;
 const allowed=new Set();
 if(process.env.VERCEL==='1')allowed.add('https://ai.spearpointsearch.com');
 try{if(process.env.APP_ORIGIN)allowed.add(new URL(process.env.APP_ORIGIN).origin);}catch{}
 if(process.env.VERCEL){for(const key of ['VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL']){
  const host=process.env[key];if(typeof host!=='string'||!host||/[\s/@?#:]/.test(host))continue;
  try{allowed.add(new URL(`https://${host}`).origin);}catch{}
 }}
 return allowed.has(origin);
}
