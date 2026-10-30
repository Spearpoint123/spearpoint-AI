import {EXPERIENCE_LEVELS,WORK_MODES} from '../views/brief-settings.js';
export function briefSettings(value,requirements){
 const custom=value.customRequirements||[];
 if(!Array.isArray(custom)||custom.length>8||custom.some(s=>typeof s!=='string'||s.trim().length<3||s.length>160||/[\u0000-\u001f]|@|https?:/i.test(s)))throw Error('validation');
 if(value.experienceLevel&&!Object.hasOwn(EXPERIENCE_LEVELS,value.experienceLevel)||value.workMode&&!Object.hasOwn(WORK_MODES,value.workMode))throw Error('validation');
 const keys=new Set([...requirements,...custom.map((_,i)=>'custom_'+i)]),weights=value.weights,essential=value.essential;
 if(weights&&(typeof weights!=='object'||Array.isArray(weights)||Object.keys(weights).length>20||Object.entries(weights).some(([k,v])=>!keys.has(k)||!Number.isInteger(v)||v<1||v>5)))throw Error('validation');
 if(essential&&(!Array.isArray(essential)||essential.length>20||essential.some(k=>!keys.has(k))))throw Error('validation');
 return {...(custom.length?{customRequirements:custom.map(s=>s.trim())}:{}),...(weights?{weights:{...weights}}:{}),...(essential?{essential:[...new Set(essential)]}:{}),...(value.experienceLevel?{experienceLevel:value.experienceLevel}:{}),...(value.workMode?{workMode:value.workMode}:{})};
}
export function evidenceWeights(criteria,profile){const custom=criteria.customRequirements||[],keys=[...criteria.requirements,...custom.map((_,i)=>'custom_'+i)],essential=criteria.essential||keys,covered=k=>!k.startsWith('custom_')&&profile.evidence.some(e=>e.criterion===k),weight=k=>criteria.weights?.[k]||3;return {coveredWeight:keys.filter(covered).reduce((n,k)=>n+weight(k),0),totalWeight:keys.reduce((n,k)=>n+weight(k),0),missingEssentials:essential.filter(k=>!covered(k)).length};}
export function compareEvidence(a,b){const x=a.weightedEvidence,y=b.weightedEvidence;return Number(x.missingEssentials>0)-Number(y.missingEssentials>0)||(y.totalWeight?y.coveredWeight/y.totalWeight:1)-(x.totalWeight?x.coveredWeight/x.totalWeight:1)||b.matchedRequirements-a.matchedRequirements;}
