import {ensureCandidates} from './client-journey.mjs';
import {db} from './services.mjs';
import {parseQuery} from './client-search.mjs';
import {databaseSource,assertClientSources,marketMap,clientCandidate} from './client-sources.mjs';

const rows=async path=>{const result=await db(path);return Array.isArray(result)?result:[];};
export async function publicTeaser(body){
 await ensureCandidates();
 const all=(await rows('sp_candidates?select=id,source,level,seniority,years_bucket,region,firm_type,sector,pay_band,scope,sector_history,skills,summary,fictional,publication&limit=200')).filter(row=>row.publication!=='unpublished');
 const parsed=await parseQuery(body?.query||'senior quantitative researcher');
 const source=databaseSource(all);
 assertClientSources([source]);
 const matches=source.search(parsed.filters);
 return {filters:parsed.filters,total:all.length,map:marketMap(all.map(clientCandidate)),cards:matches.slice(0,3).map(row=>({level:row.level,firm_type:row.firm_type,region:row.region,pay_band:row.pay_band,score:row.score,why:row.why})),message:'Counts and bands from Spearpoint’s database. Names stay hidden.'};
}
