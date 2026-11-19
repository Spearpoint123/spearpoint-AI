import {anonymiseExperience,researchMeta} from './profile-research.mjs';
const sourceNames={provider_career_history:'Provider-reported career history',provider_location:'Provider-reported location',summary:'CRM professional summary',work_history:'CRM career history',skills:'Recorded skills',qualifications:'Recorded qualifications',public_biography:'Public biography',public_profile:'Public profile',cv:'CV experience'};
// Only already anonymised source passages leave the private research record.
export function profileEvidence(row,criteria){
 const meta=researchMeta(row,criteria),facts=[],seen=new Set();
 for(const passage of meta?.passages||[]){
  if(passage.kind==='skills'||/\b(?:appears to be|candidate assessment|low.to.mid|high.level position|work experience, with|company (?:is|be)|is an? .{0,70}company|is a recruitment agency|employees)\b/i.test(passage.text))continue;
  const original=anonymiseExperience(passage.text,row,criteria);
  const words=original.replace(/\[redacted\]/g,'').match(/[\p{L}\p{N}]+/gu)||[];
  const removed=(original.match(/\[redacted\]/g)||[]).length;
  if(words.length<(passage.kind==='provider_career_history'?8:12)||removed>words.length/4||original.length>550)continue;
  const text=original.replace(/(?:\s*\[redacted\]\s*)+/g,' … ').replace(/\s+/g,' ').trim();
  const key=text.toLowerCase();if(seen.has(key))continue;seen.add(key);
  facts.push({text,source:(row.provider==='rocketreach'&&!passage.kind.startsWith('provider_')?'RocketReach professional record':sourceNames[passage.kind])||(row.source==='internal'?'CRM professional record':'Public professional source')});
  if(facts.length===6)break;
 }
 const titleText=String(row.reported_title||'');
 const roles=[[/\bria relationship manager\b/i,'RIA Relationship Manager'],[/\bregional director\b/i,'Regional Director'],[/\bwholesaler\b/i,'Investment Wholesaler'],[/\bchief technology officer\b|\bCTO\b/i,'Chief Technology Officer'],[/\bchief compliance officer\b|\bCCO\b/i,'Chief Compliance Officer'],[/\bportfolio manager\b/i,'Portfolio Manager'],[/\bchief financial officer\b|\bCFO\b/i,'Chief Financial Officer'],[/\bchief executive officer\b|\bCEO\b/i,'Chief Executive Officer'],[/\bhead of engineering\b/i,'Head of Engineering'],[/\bcompliance\b/i,'Compliance professional'],[/\bengineer\b/i,'Engineering professional']];
 return {title:roles.find(([re])=>re.test(titleText))?.[1]||'Professional profile',professionalFacts:facts,evidenceReady:facts.length>=2,sourceCheckedAt:meta?.checkedAt||null};
}
