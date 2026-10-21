import http from 'node:http';
import handler from './api/index.mjs';
http.createServer((req,res)=>handler(req,res).catch(()=>{res.statusCode=500;res.end('Service unavailable');})).listen(3000,'127.0.0.1',()=>console.log('Staging preview: http://127.0.0.1:3000 (requires secure environment configuration)'));
