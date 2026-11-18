const stop=new Set(['senior','junior','with','from','that','this','and','for','the','role','person','above','about','into','over','under','than','must','have','years','year']);
const themes=[[/quant|quantitative/,'Quantitative research'],[/security/,'Security engineering'],[/payment/,'Payments'],[/crypto|digital asset/,'Digital assets'],[/market mak/,'Market making'],[/\bai\b|machine learning/,'Artificial intelligence'],[/trading/,'Trading']];
const clean=value=>String(value||'').replace(/[\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim();
export function suggestMustHaves(text,filters={}){
 const parts=String(text||'').split(/[,;]|\band\b/).map(clean).filter(part=>part.length>2&&!/^\$?\d/.test(part)&&!/^\d{2,4}\s*k?$/i.test(part));
 const out=[];
 const push=value=>{
  const item=clean(value).slice(0,80);
  if(item.length<2||out.some(have=>have.toLowerCase()===item.toLowerCase()))return;
  out.push(item);
 };
 for(const part of parts)push(part);
 for(const [pattern,label] of themes)if(pattern.test(String(text||'').toLowerCase()))push(label);
 for(const value of [filters.firm_type,filters.sector,filters.region,filters.level])push(value);
 return pad(out);
}
function pad(out){
 for(const item of ['Relevant seniority','Sector experience','A record in the role']){
  if(out.length>=3)break;
  if(!out.some(have=>have.toLowerCase()===item.toLowerCase()))out.push(item);
 }
 while(out.length<3)out.push(`Requirement ${out.length+1}`);
 return out.slice(0,3);
}
export function normaliseMustHaves(value,fallback=[]){
 const out=[];
 const push=item=>{const text=clean(item).slice(0,80);if(text.length<2||out.some(have=>have.toLowerCase()===text.toLowerCase()))return;out.push(text);};
 for(const item of Array.isArray(value)?value:[])push(item);
 for(const item of fallback||[])push(item);
 return pad(out);
}
function tokens(phrase){return clean(phrase).toLowerCase().split(/[^a-z0-9+]+/).filter(word=>word.length>2&&!stop.has(word));}
export function scoreMustHaves(candidate,mustHaves){
 const hay=[candidate?.summary,candidate?.level,candidate?.seniority,candidate?.region,candidate?.firm_type,candidate?.sector,candidate?.pay_band,candidate?.years_bucket,candidate?.scope?.team,...(candidate?.scope?.products||[]),...(candidate?.skills||[])].join(' ').toLowerCase();
 const items=(mustHaves||[]).slice(0,3).map(label=>{
  const words=tokens(label);
  const hits=words.filter(word=>hay.includes(word));
  const met=words.length?hits.length>=Math.min(words.length,Math.max(1,Math.ceil(words.length/2))):false;
  return {label,met};
 });
 return {items,count:items.filter(item=>item.met).length};
}
