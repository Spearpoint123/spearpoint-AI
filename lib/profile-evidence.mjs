import {anonymiseExperience,researchMeta} from './profile-research.mjs';
const sourceNames={summary:'CRM professional summary',work_history:'CRM career history',skills:'Recorded skills',qualifications:'Recorded qualifications',public_biography:'Public biography',public_profile:'Public profile',cv:'CV experience'};
// Only already anonymised source passages leave the private research record.
export function profileEvidence(row,criteria){
 const meta=researchMeta(row,criteria),facts=[],seen=new Set();
 for(const passage of meta?.passages||[]){
  const original=anonymiseExperience(passage.text,row,criteria);
  const words=original.replace(/\[redacted\]/g,'').match(/[\p{L}\p{N}]+/gu)||[];
  const removed=(original.match(/\[redacted\]/g)||[]).length;
  if(words.length<12||removed>words.length/4||original.length>900)continue;
  const text=original.replace(/(?:\s*\[redacted\]\s*)+/g,' … ').replace(/\s+/g,' ').trim();
  const key=text.toLowerCase();if(seen.has(key))continue;seen.add(key);
  facts.push({text,source:sourceNames[passage.kind]||(row.source==='internal'?'CRM professional record':'Public professional source')});
  if(facts.length===6)break;
 }
 const titleText=String(row.reported_title||'');
 const roles=[[/\bchief technology officer\b|\bCTO\b/i,'Chief Technology Officer'],[/\bchief compliance officer\b|\bCCO\b/i,'Chief Compliance Officer'],[/\bportfolio manager\b/i,'Portfolio Manager'],[/\bchief financial officer\b|\bCFO\b/i,'Chief Financial Officer'],[/\bchief executive officer\b|\bCEO\b/i,'Chief Executive Officer'],[/\bhead of engineering\b/i,'Head of Engineering'],[/\bcompliance\b/i,'Compliance professional'],[/\bengineer\b/i,'Engineering professional']];
 return {title:roles.find(([re])=>re.test(titleText))?.[1]||'Professional profile',professionalFacts:facts,evidenceReady:facts.length>=2,sourceCheckedAt:meta?.checkedAt||null};
}
