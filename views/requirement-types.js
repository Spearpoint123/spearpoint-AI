const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const places=new Set(['Chicago','London','New York','Dubai','Abu Dhabi','Singapore','Hong Kong','Zurich','Paris','Tokyo','Sydney','San Francisco','Boston','Miami','United States','United Kingdom','UAE','USA','UK','Europe','Remote','Hybrid','On site'].map(norm));
export function isPracticalRequirement(value,location=''){
 const v=norm(value).replace(/^(?:(?:must|should|needs to|need to|required to|required|able to) )(?:be )?/,''),l=norm(location);if(!v)return false;
 return places.has(v)||!!l&&(v===l||String(location).split(/[,;|]/).some(part=>norm(part)===v))||/^(?:based (?:in|near)|located (?:in|near)|live in|living in|work (?:in|from)|working (?:in|from)|willing to relocate|must relocate|remote(?: working)?(?: only)?$|hybrid(?: working)?(?: only)?$|on site$|available (?:from|by|to start)|start (?:date|by|in)|salary(?: |$)|compensation(?: |$)|notice period)/.test(v);
}
export const isFitCheck=c=>c?.isFitCriterion!==false&&c?.sourceKind!=='provider_location'&&!isPracticalRequirement(c?.requirement);
export const supportedFitChecks=checks=>(checks||[]).filter(c=>isFitCheck(c)&&['source_supported','reviewed_evidence'].includes(c.status));
export const isThreeCriterionMatch=p=>(p.mustHaveChecks||[]).length===3&&(p.mustHaveChecks||[]).every(isFitCheck)&&supportedFitChecks(p.mustHaveChecks).length===3;

export function mustHaveProblems(values,location=''){
 const clean=Array.from({length:3},(_,i)=>String(values?.[i]||'').trim());
 const keys=clean.map(s=>norm(s).replace(/\bexperience\b/g,'').trim());
 return clean.map((value,i)=>value.length<3?'Enter professional must-have '+(i+1)+'.':isPracticalRequirement(value,location)?'Use this field for professional experience, skills, qualifications or results. Put location and practical details in their separate fields.':keys.filter(k=>k===keys[i]).length>1?'Choose three different professional must-haves.':'');
}
