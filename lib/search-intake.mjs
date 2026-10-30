import {text} from './domain.mjs';
export function searchIntake(body){
 const optional=(v,max)=>v?text(v,1,max):'';const mustHaves=body.mustHaves||[];
 if(!Array.isArray(mustHaves)||mustHaves.length>3||mustHaves.some(s=>typeof s!=='string'||s.length>160||/@|https?:|[\u0000-\u001f]/i.test(s)))throw Error('validation');
 const startDate=optional(body.startDate,10),dateReason=optional(body.dateReason,300);
 if(startDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isFinite(Date.parse(startDate))||new Date(startDate).toISOString().slice(0,10)!==startDate||startDate<new Date().toISOString().slice(0,10)||!dateReason))throw Error('validation');
 return {mustHaves:mustHaves.map(s=>s.trim()).filter(Boolean),location:optional(body.location,80),impact:optional(body.impact,600),startDate,dateReason,budget:optional(body.budget,180),hasJD:!!body.jobDescription};
}
export function professionalMandate(query,jd,intake){
 const description=jd?text(jd,12,20000):'';
 const value=['Find candidates: '+text(query,3,800),description?'Job description: '+description:'',intake.location?'Required location: '+intake.location:'',...intake.mustHaves.map((s,i)=>`Must-have ${i+1}: ${s}`)].filter(Boolean).join('\n');
 if(value.length>22000)throw Error('validation');return value;
}
export function applyIntakeCriteria(criteria,intake){
 if(!intake.mustHaves.length)return {...criteria,...(intake.location?{location:intake.location}:{})};
 const seen=new Set(),custom=[...intake.mustHaves,...(criteria.customRequirements||[])].filter(s=>{const key=s.toLowerCase().trim();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8);
 const important=intake.mustHaves.map(s=>'custom_'+custom.findIndex(c=>c.toLowerCase()===s.toLowerCase()));
 return {...criteria,...(intake.location?{location:intake.location}:{}),customRequirements:custom,essential:important,weights:Object.fromEntries(important.map(k=>[k,5]))};
}
