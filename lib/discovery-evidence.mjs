import {roleMatches} from './matching.mjs';
export const DISCOVERY_SIGNALS=[
 ['defi','DeFi',/\bdefi\b|\bdecentrali[sz]ed finance\b/i],['solidity','Solidity',/\bsolidity\b/i],['smart_contracts','Smart contracts',/\bsmart contracts?\b/i],['digital_assets','Digital assets',/\bdigital assets?\b|\bcrypto(?:currency)?\b/i],['cloud','Cloud infrastructure',/\bcloud\b|\baws\b|\bkubernetes\b/i],['engineering_leadership','Engineering leadership',/\bengineering leadership\b|\bled engineering\b|\bleading engineering\b/i],['exchange_infrastructure','Exchange infrastructure',/\bexchange infrastructure\b|\bmatching engine\b/i],['licensing','Regulatory licensing',/\blicensing\b|\blicen[cs]e applications?\b/i],['funds','Funds and asset management',/\basset management\b|\bfund management\b/i],['quant_research','Quantitative research',/\bquantitative\b|\bquant research\b/i],['machine_learning','Machine learning',/\bmachine learning\b/i],['payments','Payments',/\bpayments\b/i],['custody','Digital asset custody',/\bcustody\b/i],['risk_management','Risk management',/\brisk management\b/i]
];
// Read professional summary/skill fields locally. Never send CRM text to a model.
export function professionalSignals(copy){
 if(typeof copy!=='string')return [];const sentences=copy.slice(0,12000).replace(/<[^>]*>/g,' ').split(/[.!?;\n]+/);
 return DISCOVERY_SIGNALS.filter(([, ,re])=>sentences.some(s=>re.test(s)&&!(/\bno\b|\bnot\b|\bwithout\b|\black\b|\bnever\b|\bunverified\b|\bunconfirmed\b|\bseeking\b|\binterested in\b|\baspir/i.test(s)))).map(([criterion])=>({kind:'professional_signal',criterion}));
}
export function crmSignals(c){return professionalSignals([c.position,c.summary,c.skill,typeof c.skills==='string'?c.skills:''].filter(v=>typeof v==='string').join('. '));}
export function discoveryExplanation(criteria,row){
 const title=typeof row.reported_title==='string'?row.reported_title:'';
 const signals=new Set([...(Array.isArray(row.sources)?row.sources:[]).filter(s=>s.kind==='professional_signal'&&DISCOVERY_SIGNALS.some(([key])=>key===s.criterion)).map(s=>s.criterion),...professionalSignals(title+'; '+(row.source==='public'?row.source_excerpt||'':'')).map(s=>s.criterion)]);
 const requested=new Set([...criteria.requirements,...professionalSignals((criteria.customRequirements||[]).join('. ')).map(s=>s.criterion)]);
 const matching=DISCOVERY_SIGNALS.filter(([key])=>signals.has(key)&&requested.has(key));
 const roleOK=roleMatches(criteria.role,title)||(/chief technology officer|\bcto\b/i.test(criteria.role)&&/chief technology officer|\bcto\b/i.test(title));
 const reasons=matching.map(([,label])=>`${label} is mentioned in the source profile, matching a requested requirement.`);
 if(roleOK)reasons.push('A matching professional role is recorded in the source.');
 const gaps=DISCOVERY_SIGNALS.filter(([key])=>requested.has(key)&&!signals.has(key)).map(([,label])=>`${label}: not evidenced in the available source information.`);
 if(!roleOK)gaps.push('The requested role needs confirmation.');
 return {matchedSignalCount:matching.length,fitReasons:reasons.slice(0,2),gaps:[...gaps.slice(0,3),'Location, interest and availability are unconfirmed.'],matchLabel:matching.length?'Relevant source evidence':'Role evidence only',signalKeys:[...signals],focus:matching.map(([,label])=>label)};
}
