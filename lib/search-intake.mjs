import {isPracticalRequirement} from '../views/requirement-types.js';
import {text} from './domain.mjs';
import {ROLE_TITLES} from '../views/talent-taxonomy.js';
export function mustHaveInput(values,required=false){
 if(!Array.isArray(values))throw Error('must_haves_required');
 if(!required&&!values.length)return [];
 const clean=values.map(s=>typeof s==='string'?s.trim():'');
 if(clean.some(s=>/^nfa$/i.test(s)))throw Error('nfa_clarification_required');
 const norm=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\bexperience\b/g,'').trim();
 const titles=new Set([...Object.values(ROLE_TITLES).flat(),'CTO','CCO','CFO','CEO','CRO','COO','CPO','CISO'].map(norm));
 if(clean.length!==3||clean.some(s=>s.length<3||s.length>160||/@|https?:|[\u0000-\u001f]/i.test(s)||titles.has(norm(s)))||new Set(clean.map(norm)).size!==3)throw Error('must_haves_required');
 return clean;
}
export function searchIntake(body,{requireMustHaves=false}={}){
 const optional=(v,max)=>v?text(v,1,max):'';const mustHaves=body.mustHaves||[];
 if(!Array.isArray(mustHaves)||mustHaves.length>3||mustHaves.some(s=>typeof s!=='string'||s.length>160||/@|https?:|[\u0000-\u001f]/i.test(s)))throw Error('validation');
 if(requireMustHaves){mustHaveInput(mustHaves,true);if(mustHaves.some(s=>isPracticalRequirement(s,body.location)))throw Error('professional_must_haves_required');}
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
 if(!intake.mustHaves.length)return {...criteria,mustHaves:[...intake.mustHaves],...(intake.location?{location:intake.location}:{})};
 const seen=new Set(),custom=[...intake.mustHaves,...(criteria.customRequirements||[])].filter(s=>{const key=s.toLowerCase().trim();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8);
 const important=intake.mustHaves.map(s=>'custom_'+custom.findIndex(c=>c.toLowerCase()===s.toLowerCase()));
 return {...criteria,mustHaves:[...intake.mustHaves],...(intake.location?{location:intake.location}:{}),customRequirements:custom,essential:important,weights:Object.fromEntries(important.map(k=>[k,5]))};
}
