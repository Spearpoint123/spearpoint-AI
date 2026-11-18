// Builds a search string for a person to paste into LinkedIn Recruiter.
// Spearpoint does not call LinkedIn, and does not open or scrape profile URLs.
const quote=value=>/\s/.test(value)?`"${value.replace(/"/g,'')}"`:value;
const terms=values=>(values||[]).map(v=>String(v||'').trim()).filter(v=>v.length>1&&v.length<80).slice(0,8);
export function linkedinRecruiterSearch({title='',location='',skills=[],seniority=''}={}){
 const titles=terms([title]);
 const skillTerms=terms(Array.isArray(skills)?skills:String(skills||'').split(','));
 const parts=[];
 if(titles.length)parts.push(titles.map(quote).join(' OR '));
 if(skillTerms.length)parts.push('('+skillTerms.map(quote).join(' OR ')+')');
 if(location&&String(location).trim())parts.push(quote(String(location).trim().slice(0,80)));
 if(seniority&&String(seniority).trim())parts.push(quote(String(seniority).trim().slice(0,40)));
 const query=parts.join(' AND ').slice(0,500);
 return {query,channel:'linkedin_recruiter',sent:false,note:'Copy this into LinkedIn Recruiter yourself. Spearpoint does not search LinkedIn and does not fetch profile pages.'};
}
