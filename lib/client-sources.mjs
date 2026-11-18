// Client search may only use Spearpoint's own database.
// A later partner-only search can register sources with kind 'licensed'.
const licensed=/rocketreach|people[-_ ]?data[-_ ]?labs|\bpdl\b|coresignal/i;
export function assertClientSources(sources){
 if(!Array.isArray(sources)||!sources.length)throw Error('client_source_forbidden');
 for(const source of sources){
  if(!source||source.kind==='licensed'||licensed.test(source.id||'')||licensed.test(source.label||''))throw Error('client_source_forbidden');
 }
}
export function databaseSource(candidates){
 return {id:'spearpoint_database',kind:'internal',label:'Spearpoint database',search:filters=>rank(candidates,filters)};
}
const norm=value=>String(value||'').toLowerCase();
const list=value=>Array.isArray(value)?value.map(norm):norm(value).split(/,| or |\//).map(part=>part.trim()).filter(Boolean);
function hit(candidate,filters){
 const why=[];let score=0;
 const region=list(filters.region);
 if(region.length&&region.some(part=>norm(candidate.region).includes(part)||part.includes(norm(candidate.region)))){score+=20;why.push(`Region matches ${candidate.region}.`);}
 const level=norm(filters.level||filters.seniority);
 if(level&&(norm(candidate.level).includes(level)||norm(candidate.seniority).includes(level)||level.includes(norm(candidate.level)))){score+=20;why.push(`${candidate.level} matches the level you asked for.`);}
 if(filters.years_bucket&&norm(candidate.years_bucket)===norm(filters.years_bucket)){score+=10;why.push(`Experience sits in ${candidate.years_bucket}.`);}
 if(filters.firm_type){const wanted=norm(filters.firm_type),have=norm(candidate.firm_type);if(wanted&&(have.includes(wanted)||wanted.includes(have))){score+=15;why.push(`Firm type is ${candidate.firm_type}.`);}}
 if(filters.sector&&(norm(candidate.sector).includes(norm(filters.sector))||norm(candidate.summary).includes(norm(filters.sector)))){score+=15;why.push(`Sector is ${candidate.sector}.`);}
 if(filters.pay_band&&norm(candidate.pay_band)===norm(filters.pay_band)){score+=15;why.push(`Pay band is ${candidate.pay_band}.`);}
 const words=norm(filters.keywords).split(/[^a-z0-9+]+/).filter(word=>word.length>3);
 const hay=`${candidate.summary} ${(candidate.skills||[]).join(' ')} ${candidate.sector} ${candidate.firm_type}`.toLowerCase();
 const matched=[...new Set(words.filter(word=>word.length>3&&hay.includes(word)))];
 if(matched.length){score+=Math.min(20,matched.length*8);why.push(`Recorded experience includes ${matched.slice(0,3).join(', ')}.`);}
 return {score:Math.min(100,score),why:why.slice(0,2).join(' '),strong:score>=70};
}
export function rank(candidates,filters={}){
 return candidates.map(candidate=>{const judged=hit(candidate,filters);return {...clientCandidate(candidate),score:judged.score,why:judged.why||'Shown from Spearpoint’s database. Add filters to narrow the fit.',strong:judged.strong};}).filter(row=>row.score>0||!hasFilter(filters)).sort((a,b)=>b.score-a.score).slice(0,10);
}
function hasFilter(filters){return ['level','seniority','years_bucket','firm_type','region','sector','pay_band','keywords'].some(key=>filters[key]&&String(filters[key]).length);}
const allowed=['id','source','level','seniority','years_bucket','region','firm_type','sector','pay_band','scope','sector_history','skills','summary','fictional'];
export function clientCandidate(row){
 const out={};
 for(const key of allowed)if(row[key]!==undefined)out[key]=row[key];
 return out;
}
export function marketMap(candidates){
 const count=key=>Object.entries(candidates.reduce((bag,row)=>{const name=row[key]||'Unspecified';bag[name]=(bag[name]||0)+1;return bag;},{})).map(([name,total])=>({name,total}));
 const pay=[...new Set(candidates.map(row=>row.pay_band).filter(Boolean))];
 return {firm_type:count('firm_type'),region:count('region'),seniority:count('level'),pay};
}
