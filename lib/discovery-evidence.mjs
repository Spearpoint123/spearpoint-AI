import {CAPABILITIES} from '../views/talent-taxonomy.js';
import {roleMatches} from './matching.mjs';
export const DISCOVERY_SIGNALS=[
 ['market_entry','Regulated market entry',/\b(?:led|completed|delivered)\b.{0,30}\bregulated market entry\b/i],['market_making','Market making',/\bmarket making\b/i],['electronic_trading','Electronic trading',/\belectronic trading\b/i],['low_latency','Low-latency systems',/\blow[- ]latency\b/i],['tokenisation','Tokenisation',/\btokeni[sz]ation\b/i],['cybersecurity','Cybersecurity',/\bcybersecurity\b/i],['generative_ai','Generative AI',/\bgenerative AI\b|\bLLM\b/i],['data_platforms','Data platforms',/\bdata platforms?\b/i],['product_strategy','Product strategy',/\bproduct strategy\b/i],['revenue_growth','Revenue growth',/\brevenue growth\b/i],['partnerships','Commercial partnerships',/\bcommercial partnerships?\b/i],['operations','Operations leadership',/\boperations leadership\b|\bled operations\b/i],['finance','Financial management',/\bfinancial management\b/i],['business_transformation','Business transformation',/\bbusiness transformation\b/i],['executive_leadership','Executive leadership',/\bexecutive leadership\b/i],
 ['nfa_membership','NFA membership',/\bNFA\b.{0,20}\bmember(?:ship)?\b|\bmember(?:ship)?\b.{0,20}\bNFA\b/i],
 ['series_3','Series 3',/\bseries\s*3\b/i],['nfa_registration','NFA registration',/\bNFA\b.{0,40}\bregist|\bregist\w*\b.{0,40}\bNFA\b/i],['cftc','CFTC regulations',/\bCFTC\b/i],['associated_person','Associated person registration',/\bassociated person\b/i],['compliance_program','Compliance program delivery',/\bcompliance program(?:me)?s?\b/i],['aml','AML',/\bAML\b|anti[- ]money laundering/i],['sanctions','Sanctions',/\bsanctions\b/i],['surveillance','Trade surveillance',/\btrade surveillance\b/i],['regulatory_reporting','Regulatory reporting',/\bregulatory reporting\b/i],
 ['defi','DeFi',/\bdefi\b|\bdecentrali[sz]ed finance\b/i],['solidity','Solidity',/\bsolidity\b/i],['smart_contracts','Smart contracts',/\bsmart contracts?\b/i],['digital_assets','Digital assets',/\bdigital assets?\b|\bcrypto(?:currency)?\b/i],['cloud','Cloud infrastructure',/\bcloud\b|\baws\b|\bkubernetes\b/i],['engineering_leadership','Engineering leadership',/\bengineering leadership\b|\bled engineering\b|\bleading engineering\b/i],['exchange_infrastructure','Exchange infrastructure',/\bexchange infrastructure\b|\bmatching engine\b/i],['licensing','Regulatory licensing',/\blicensing\b|\blicen[cs]e applications?\b/i],['funds','Funds and asset management',/\basset management\b|\bfund management\b/i],['quant_research','Quantitative research',/\bquantitative\b|\bquant research\b/i],['machine_learning','Machine learning',/\bmachine learning\b/i],['payments','Payments',/\bpayments\b/i],['custody','Digital asset custody',/\bcustody\b/i],['risk_management','Risk management',/\brisk management\b/i]
];
// Read professional summary/skill fields locally. Never send CRM text to a model.
export function professionalSignals(copy){
 if(typeof copy!=='string')return [];const sentences=copy.slice(0,12000).replace(/<[^>]*>/g,' ').split(/[.!?;\n]+/);
 return DISCOVERY_SIGNALS.filter(([, ,re])=>sentences.some(s=>re.test(s)&&!(/\bno\b|\bnot\b|\bwithout\b|\black\b|\bnever\b|\bunverified\b|\bunconfirmed\b|\bseeking\b|\binterested in\b|\baspir/i.test(s)))).map(([criterion])=>({kind:'professional_signal',criterion}));
}
export function crmSignals(c){return professionalSignals([c.summary,c.skill,typeof c.skills==='string'?c.skills:''].filter(v=>typeof v==='string').join('. ')).map(s=>({...s,evidenceSource:'summary_or_skills'}));}
export function discoveryExplanation(criteria,row){
 const title=typeof row.reported_title==='string'?row.reported_title:'';
 const signals=new Set([...(Array.isArray(row.sources)?row.sources:[]).filter(s=>s.kind==='professional_signal'&&DISCOVERY_SIGNALS.some(([key])=>key===s.criterion)).map(s=>s.criterion),...professionalSignals(title+'; '+(row.source==='public'?row.source_excerpt||'':'')).map(s=>s.criterion)]);
 const requested=new Set([...criteria.requirements,...professionalSignals((criteria.customRequirements||[]).join('. ')).map(s=>s.criterion)]);
 const matching=DISCOVERY_SIGNALS.filter(([key])=>signals.has(key)&&requested.has(key));
 const roleOK=roleMatches(criteria.role,title)||(/chief technology officer|\bcto\b/i.test(criteria.role)&&/chief technology officer|\bcto\b/i.test(title));
 const reasons=matching.map(([,label])=>`${label} is mentioned in the source profile, matching a requested requirement.`);

 const gaps=DISCOVERY_SIGNALS.filter(([key])=>requested.has(key)&&!signals.has(key)).map(([,label])=>`${label}: not evidenced in the available source information.`);
 if(!roleOK)gaps.push('The requested role needs confirmation.');
 return {matchedSignalCount:matching.length,fitReasons:reasons.slice(0,2),gaps:[...gaps.slice(0,3),'Location, interest and availability are unconfirmed.'],matchLabel:matching.length?'Relevant source evidence':'Role evidence only',signalKeys:[...signals],focus:matching.map(([,label])=>label)};
}

export function mustHaveEvidence(criteria,{signals=[],evidence=[],reviewed=false}={}){
 const requirements=criteria.mustHaves||criteria.hiringContext?.mustHaves||[];
 if(requirements.length!==3)return {mustHaveChecks:[],mustHaveReviewed:0,mustHaveMentions:0};
 const norm=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\bexperience\b/g,'').replace(/\s+/g,' ').trim();
 const checks=requirements.map(requirement=>{
  const requested=professionalSignals(requirement).map(s=>s.criterion);
  const exact=Object.entries(CAPABILITIES).filter(([,label])=>norm(label)===norm(requirement)).map(([key])=>key);
  const checked=reviewed&&exact.length===1?evidence.find(e=>e.criterion===exact[0]&&typeof e.text==='string'&&!/\bno\b|\bnot\b|\bwithout\b|\bunconfirmed\b|\bunverified\b/i.test(e.text)):null;
  if(checked)return {requirement,status:'reviewed_evidence',evidence:checked.text};
  const related=requested.filter(key=>signals.includes(key));
  if(related.length)return {requirement,status:'source_mention',evidence:'Source profile mentions '+related.map(key=>DISCOVERY_SIGNALS.find(([k])=>k===key)[1]).join(', ')+'.'};
  return {requirement,status:'not_evidenced',evidence:'No supporting evidence found for this requirement yet.'};
 });
 return {mustHaveChecks:checks,mustHaveReviewed:checks.filter(c=>c.status==='reviewed_evidence').length,mustHaveMentions:checks.filter(c=>c.status==='source_mention').length};
}
export const compareMustHaveEvidence=(a,b)=>(b.mustHaveReviewed||0)-(a.mustHaveReviewed||0)||(b.mustHaveMentions||0)-(a.mustHaveMentions||0);
