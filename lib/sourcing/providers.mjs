// Pluggable licensed-source interface. Providers that are not configured return a stub.
// Do not add a LinkedIn scraper here. LinkedIn use is limited to recruiter-pasted search
// strings and CSV exports the team downloads from LinkedIn Recruiter themselves.
import {discoverExternal} from '../external-profiles.mjs';

export function providerCatalogue(){
 return [
  {id:'recruitcrm',label:'RecruitCRM',kind:'ats',configured:process.env.RECRUIT_CRM_ENABLED==='true'&&!!process.env.RECRUIT_CRM_API_KEY,docs:'Official RecruitCRM API. Reads candidates, skills and notes. Writes only when RECRUIT_CRM_WRITE=true and a recruiter confirms the action.'},
  {id:'rocketreach',label:'RocketReach',kind:'licensed',configured:!!process.env.ROCKETREACH_API_KEY,docs:'Existing licensed lookup used by employer search. Leave the key unset to keep it disconnected.'},
  {id:'people-data-labs',label:'People Data Labs',kind:'licensed',configured:!!process.env.PEOPLE_DATA_LABS_API_KEY,docs:'Stub. Set PEOPLE_DATA_LABS_API_KEY only after the contract and GDPR position are agreed. No requests are made until a real adapter is added.'},
  {id:'coresignal',label:'Coresignal',kind:'licensed',configured:!!process.env.CORESIGNAL_API_KEY,docs:'Stub. Set CORESIGNAL_API_KEY only after the contract and GDPR position are agreed. No requests are made until a real adapter is added.'},
  {id:'csv-import',label:'LinkedIn Recruiter CSV',kind:'import',configured:true,docs:'A recruiter exports a project from LinkedIn Recruiter and uploads the CSV. Spearpoint parses the file and does not call LinkedIn.'}
 ];
}
export async function searchLicensed(providerId,criteria,ownerId){
 const known=providerCatalogue().find(p=>p.id===providerId);
 if(!known)return {status:'unknown_provider',records:[]};
 if(providerId==='rocketreach')return discoverExternal(criteria,ownerId);
 if(providerId==='people-data-labs'||providerId==='coresignal')return {status:known.configured?'not_implemented':'not_connected',records:[],message:`${known.label} is not connected. ${known.docs}`};
 return {status:'not_connected',records:[]};
}
