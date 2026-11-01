// Private operator utility. Never expose this file as a web route or paste its output into public materials.
import {db,profileReference} from '../lib/services.mjs';
const reference=process.argv[2];
if(!/^SP-[A-F0-9]{16}$/.test(reference||'')){console.error('Usage: node scripts/profile-reference.mjs SP-<16 uppercase hex characters>');process.exitCode=1;}
else{
 try{
  const now=new Date().toISOString();const cutoff=new Date(Date.now()-30*86400000).toISOString();let found=false;
  for(let offset=0;offset<100000;offset+=1000){
   const rows=await db(`sp_profile_approvals?select=crm_slug&external_sharing_consent=eq.true&revoked_at=is.null&consent_expires_at=gt.${now}&reviewed_at=gte.${cutoff}&order=crm_slug&limit=1000&offset=${offset}`);
   if(!Array.isArray(rows))throw Error();
   const match=rows.find(row=>profileReference(row.crm_slug)===reference);
   if(match){console.log('CRM reference (authorised operator only):',match.crm_slug);found=true;break;}
   if(rows.length<1000)break;
  }
  if(!found){console.error('No current approved record resolved. It may have expired, been revoked, or used a different reference key.');process.exitCode=1;}
 }catch{console.error('Could not read current approvals. Check secure server configuration and database access.');process.exitCode=1;}
}
