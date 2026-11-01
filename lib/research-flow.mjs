import {researchDiscoveries,researchProjection} from './profile-research.mjs';
import {publicResearch} from './public-research.mjs';
// This invokes the same publicResearch function for every pass. Both passes consume
// the existing project and owner allowance of ten public requests per day.
// There is no separate follow-up allowance, reset or exemption.
export async function completeResearch(criteria,records,ownerId,{allowPublicFollowup=false,researchOptions={},searchPublic=publicResearch}={}){
 let researched=await researchDiscoveries(criteria,records,researchOptions);
 if(allowPublicFollowup&&!researched.some(r=>researchProjection(r,criteria)?.researchStatus==='matched')){
  try{
   const extras=await searchPublic({...criteria,customRequirements:[...(criteria.mustHaves||[])]},ownerId);
   const urls=new Set(researched.map(r=>r.canonical_url));
   const fresh=extras.filter(r=>!urls.has(r.canonical_url)).map(r=>({...r,source:'public',provider:'perplexity/sonar'}));
   researched.push(...await researchDiscoveries(criteria,fresh,researchOptions));
  }catch(error){console.info('Profile research: public follow-up '+(error.message==='research_limit'?'within_existing_limit_exhausted':'unavailable'));}
 }
 return researched;
}
