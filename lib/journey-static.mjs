import {readFile} from 'node:fs/promises';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.map':'application/json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2'};
export async function serveJourney(pathname,res){
 if(pathname.includes('..'))return false;
 const rel=pathname.replace(/^\/begin\/?/, '');
 const root=new URL('../web/out/',import.meta.url);
 const names=rel===''||rel==='/'?['index.html']:[rel.replace(/\/$/,'')+'.html',rel.replace(/\/$/,'')+'/index.html',rel];
 for(const name of names){
  if(name.startsWith('/')||name.includes('..'))continue;
  try{
   const file=new URL(name,root);
   const body=await readFile(file);
   const ext=name.includes('.')?name.slice(name.lastIndexOf('.')):'';
   res.setHeader('Content-Type',types[ext]||'application/octet-stream');
   if(ext===''||ext==='.html')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' https://static.hsappstatic.net https://js.hs-scripts.com https://js.hubspot.com; style-src 'self' 'unsafe-inline' https://static.hsappstatic.net; connect-src 'self' https://*.hubspot.com https://*.hsappstatic.net; img-src 'self' data: https://*.hubspot.com https://*.hsforms.com; frame-src https://meetings-eu1.hubspot.com https://*.hubspot.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://meetings-eu1.hubspot.com");
   res.setHeader('Cache-Control',name.includes('_next/')?'public, max-age=86400':'no-store');
   res.end(body);
   return true;
  }catch{/* try the next candidate */}
 }
 return false;
}
