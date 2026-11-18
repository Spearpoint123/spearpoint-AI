import {fitCohort,releaseForClient} from './anonymise.mjs';
import {scoreMustHaves} from './must-haves.mjs';
import {templateSnapshot,writeSnapshots} from './snapshot.mjs';

const secret=/rocketreach|@[a-z0-9.-]+\.[a-z]{2,}|\blinkedin\.com\b|https?:|www\.|\+\d[\d\s().-]{6,}|\b\d{8,}\b/i;
function visible(row,snapshot,musts){
 const team=row.scope?.team&&!/undisclosed/i.test(String(row.scope.team))?String(row.scope.team):'';
 const card={origin:row.origin==='Wider market'?'Wider market':'Spearpoint network',seniority:row.level||row.seniority||'',years_bucket:row.years_bucket||'',firm_type:row.firm_type||'',region:row.region||'',snapshot,musts:musts.items,met:musts.count};
 if(row.pay_band&&!/undisclosed/i.test(String(row.pay_band)))card.pay_band=row.pay_band;
 if(team)card.team=team;
 if(row.fictional===true)card.fictional=true;
 if(card.origin!=='Wider market'&&/^[0-9a-f-]{36}$/i.test(row.id||''))card.id=row.id;
 const {id:ignored,...readable}=card;
 if(secret.test(JSON.stringify(readable)))return null;
 return card;
}
export function oneSnapshot(row){
 return visible({...row,origin:'Spearpoint network'},templateSnapshot(row),{items:[],count:0});
}
export async function presentCards(internal,wider,mustHaves,cohort){
 const own=releaseForClient(internal.map(row=>({...row,origin:'Spearpoint network'})),cohort,5).rows;
 const rows=[...own,...(wider||[]).map(row=>({...fitCohort(row,cohort,5),origin:'Wider market'}))];
 const snaps=await writeSnapshots(rows);
 const cards=rows.map((row,index)=>visible(row,snaps[index],scoreMustHaves(row,mustHaves))).filter(Boolean);
 cards.sort((a,b)=>b.met-a.met||b.score-a.score);
 return cards;
}
export function mixCards(cards,networkLimit,widerLimit){
 const network=[],wider=[];
 for(const card of cards)(card.origin==='Wider market'?wider:network).push(card);
 const chosen=[...network.slice(0,networkLimit),...wider.slice(0,widerLimit)];
 const seen=new Set(chosen);
 for(const card of cards){if(chosen.length>=networkLimit+widerLimit)break;if(!seen.has(card)){chosen.push(card);seen.add(card);}}
 return chosen.sort((a,b)=>b.met-a.met||b.score-a.score);
}
