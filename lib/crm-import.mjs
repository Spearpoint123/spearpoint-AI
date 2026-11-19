import {randomUUID} from 'node:crypto';
import {encryptIdentity} from './candidate-crypto.mjs';
import {generalise} from './anonymise.mjs';

const regions=[['dubai','Dubai'],['london','London'],['singapore','Singapore'],['new york','New York'],['zurich','Zurich'],['europe','Europe'],['remote','Remote']];
export function regionOf(value){
 const text=String(value||'').toLowerCase();
 return (regions.find(([name])=>text.includes(name))||[,'Several cities'])[1];
}
export function yearsOf(value){
 const years=Number(String(value||'').match(/\d+/)?.[0]||0);
 if(years>=20)return '20+ yrs';
 if(years>=15)return '15–20 yrs';
 if(years>=10)return '10–15 yrs';
 if(years>=5)return '5–10 yrs';
 return 'Under 5 yrs';
}
export function levelOf(title){
 const text=String(title||'').toLowerCase();
 if(/\b(head|chief|board)\b/.test(text))return ['Head','director'];
 if(/director/.test(text))return ['Director','director'];
 if(/\bvp\b|vice president/.test(text))return ['VP','vp'];
 if(/staff|principal/.test(text))return ['Staff','staff'];
 if(/junior|associate/.test(text))return ['Junior','junior'];
 return ['Senior','senior'];
}
export function firmOf(company,title){
 const text=`${company||''} ${title||''}`.toLowerCase();
 if(/hft|high[- ]frequency/.test(text))return 'tier-1 HFT';
 if(/market mak/.test(text))return 'crypto market maker';
 if(/hedge/.test(text))return 'hedge fund';
 if(/exchange/.test(text))return 'crypto exchange';
 if(/payment|fintech/.test(text))return 'payments firm';
 if(/\bai\b|machine learning|research lab/.test(text))return 'AI lab';
 if(/prop/.test(text))return 'prop trading';
 if(/bank/.test(text))return 'bank';
 return 'Trading or technology firm';
}
export function sectorOf(text){
 const value=String(text||'').toLowerCase();
 if(/crypto|digital asset/.test(value))return 'digital assets';
 if(/payment/.test(value))return 'payments';
 if(/\bai\b|machine learning/.test(value))return 'artificial intelligence';
 if(/equit|trading|quant/.test(value))return 'equities';
 return 'Several sectors';
}
export function payOf(value){
 const number=Number(String(value||'').replace(/[^0-9.]/g,''));
 if(!number)return 'Undisclosed band';
 const thousands=number>1000?number/1000:number;
 if(thousands<150)return 'Under 150';
 if(thousands<200)return '150–200';
 if(thousands<250)return '200–250';
 if(thousands<350)return '250–350';
 if(thousands<500)return '350–500';
 return '500 and above';
}
export function mapCrmRecord(raw={}){
 const title=String(raw.position||raw.title||raw.level||'Specialist');
 const company=String(raw.current_organization||raw.company||raw.employer||'');
 const place=String(raw.city||raw.location||raw.region||'');
 const [level,seniority]=levelOf(title);
 const firm_type=firmOf(company,title);
 const sector=sectorOf(`${title} ${raw.skill||''} ${raw.sector||''} ${company}`);
 const region=regionOf(place);
 const years_bucket=yearsOf(raw.years||raw.experience||title);
 const pay_band=payOf(raw.pay||raw.salary||raw.compensation);
 const skills=String(raw.skill||raw.skills||'').split(/[,;/]/).map(item=>item.trim().toLowerCase()).filter(item=>item&&item.length<40).slice(0,6);
  const name=String(raw.name||`${raw.first_name||''} ${raw.last_name||''}`).trim();
  const slug=String(raw.slug||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,128);
  return {
  projection:{source:'recruitcrm',crm_slug:slug,level,seniority,years_bucket,region,firm_type,sector,pay_band,scope:{team:'Undisclosed',pnl:'Undisclosed',asset_classes:[sector],products:skills.slice(0,2)},sector_history:[firm_type],skills,summary:`${level} profile. ${firm_type}. ${region}. Pay band ${pay_band}.`,fictional:false,publication:'unpublished'},
  identity:name&&company?{name:name.slice(0,80),employer:company.slice(0,120),fictional:false}:null
 };
}
export function prepareImport(records,existing=[],k=5){
 const mapped=(Array.isArray(records)?records:[]).map((raw,index)=>{const item=mapCrmRecord(raw);item.projection.import_index=index;return item;});
 const shaped=generalise(mapped.map(row=>row.projection),existing,k);
 const kept=new Set(shaped.rows.map(row=>row.import_index));
 const rows=shaped.rows.map(row=>{const {import_index,...projection}=row;return projection;});
 return {rows,suppressed:shaped.suppressed.length,identities:mapped.filter(row=>kept.has(row.projection.import_index)).map(row=>row.identity)};
}
export async function storeImport(db,prepared){
 const created=[];
 for(const [index,projection] of prepared.rows.entries()){
  const id=randomUUID();
  await db('sp_candidates',{method:'POST',body:{...projection,id,created_at:new Date().toISOString()}});
  const identity=prepared.identities[index];
  if(identity&&process.env.CANDIDATE_IDENTITY_KEY){
   const stored=encryptIdentity(identity);
   await db('sp_candidate_identity',{method:'POST',body:{id:randomUUID(),candidate_id:id,ciphertext:stored.ciphertext,key_version:stored.key_version,created_at:new Date().toISOString()}}).catch(()=>{});
  }
  created.push(id);
 }
 return {imported:created.length,suppressed:prepared.suppressed,ids:created,ranLive:false};
}
export function recruitCrmPull(){
 return {ran:false,reason:'live_import_disabled',records:[]};
}
