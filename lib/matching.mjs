const aliases={cto:'chief technology officer',ceo:'chief executive officer',cfo:'chief financial officer',coo:'chief operating officer',cpo:'chief product officer',chro:'chief human resources officer',ciso:'chief information security officer'};
export const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu,' ').trim().replace(/\s+/g,' ');
export const correctedTitle=s=>String(s||'').replace(/\bmanaher\b/gi,'manager').replace(/\bportoflio\b/gi,'portfolio');
export const roleName=s=>aliases[normalize(correctedTitle(s))]||normalize(correctedTitle(s)).replace(/\bvice president\b/g,'vp').replace(/\bof\b/g,'').replace(/\s+/g,' ').trim();
export function roleMatches(requested,actual){
 const wanted=roleName(requested),given=roleName(actual);
 if(/\b(former|previous|assistant|deputy)\b/.test(given))return false;
 return !!wanted&&(` ${given} `).includes(` ${wanted} `);
}
export function roleQueries(role){const canonical=roleName(role);const acronym=Object.keys(aliases).find(k=>aliases[k]===canonical);return acronym?[canonical,acronym.toUpperCase()]:[correctedTitle(role)];}
const contains=(text,term)=>{const value=` ${normalize(text)} `;const wanted=normalize(term);return !!wanted&&value.includes(` ${wanted} `);};
const sectorTerms={
 'Market makers & prop trading':['market maker','market makers','market making','proprietary trading','prop trading'],
 'Hedge funds':['hedge fund','hedge funds'],
 'Exchanges':['exchange','exchanges','trading venue','trading venues'],
 'Digital assets':['digital asset','digital assets','crypto','cryptocurrency','tokenisation','tokenization'],
 'Payments':['payments','payment infrastructure','payment processing','acquiring'],
 'Fintech':['fintech','financial technology'],
 'Financial institutions':['bank','banks','banking','asset management','wealth management','financial institution','financial institutions'],
 'AI infrastructure for finance':['ai infrastructure for finance','financial ai infrastructure','machine learning infrastructure for financial markets']
};
const regions={
 'United Kingdom':['United Kingdom','UK','London'],
 'United States':['United States','USA','New York','Chicago'],
 'Europe':['Europe','United Kingdom','UK','London'],
};
export function assessProfile(input,row){
 // Essential criteria are checked only against manually approved, shareable copy.
 // Free-form brief notes are not interpreted as verified requirements or sent to an LLM.
 const skills=[...new Set((input.skills||'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean))];
 const copy=[row.public_title,row.public_summary,...(row.public_skills||[])].join(' ');
 const approvedSkills=(row.public_skills||[]).join(' ');
 const matched=skills.filter(skill=>contains(approvedSkills,skill));
 const missing=skills.filter(skill=>!matched.includes(skill));
 const role=roleMatches(input.role,row.public_title);
 const flexible=input.location==='Global / location flexible';
 const location=flexible||(regions[input.location]||[input.location]).some(term=>contains(copy,term));
 const sector=!input.niche||(sectorTerms[input.niche]||[input.niche]).some(term=>contains(copy,term));
 const checks=[{criterion:'Role',met:role,evidence:role?row.public_title:'Role not evidenced.'},
  ...(input.niche?[{criterion:'Sector',met:sector,evidence:sector?input.niche:'Selected sector not evidenced.'}]:[]),
  {criterion:'Location',met:location,evidence:flexible?'Location flexible':location?input.location:'Requested location not evidenced.'},
  ...skills.map(skill=>({criterion:skill,met:matched.includes(skill),evidence:matched.includes(skill)?'Recorded in approved profile':'Not evidenced in approved profile'}))];
 return {eligible:checks.every(check=>check.met),checks,experience:[row.public_summary],
  fitReasons:checks.filter(check=>check.met).map(check=>`${check.criterion}: ${check.evidence}.`),
  gaps:[...missing.map(skill=>`Essential skill not evidenced: ${skill}.`),...(!location?['Location needs confirmation.']:[]),...(!sector?['Sector experience needs confirmation.']:[]),'Current interest, availability and permission for an introduction require specialist confirmation.',...(input.jobDescription?['Additional brief notes require consultant review; they were not automatically assessed.']:[])],
  matchBasis:'All structured essential criteria must be evidenced in approved information. Matching does not predict hiring success or confirm current availability.'};
}
