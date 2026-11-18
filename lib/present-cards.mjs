import {generalise} from './anonymise.mjs';
import {clientCandidate} from './client-sources.mjs';
import {scoreMustHaves} from './must-haves.mjs';
import {writeSnapshots} from './snapshot.mjs';
import {scrubClient} from './client-external.mjs';

const secret=/rocketreach|@[a-z0-9.-]+\.[a-z]{2,}|linkedin\.com|https?:|www\./i;
function visible(row,snapshot,musts){
 const card=scrubClient({...clientCandidate({...row,source:row.origin==='Wider market'?undefined:row.source}),origin:row.origin==='Wider market'?'Wider market':'Spearpoint network',snapshot,musts:musts.items,met:musts.count,score:Number(row.score)||0,why:row.origin==='Wider market'?'Anonymised snapshot from the wider market.':(row.why||''),fictional:row.fictional===true,strong:row.strong===true});
 if(secret.test(JSON.stringify(card)))return null;
 return card;
}
export async function presentCards(internal,wider,mustHaves,cohort){
 const own=generalise(internal.map(row=>({...row,origin:'Spearpoint network'})),cohort,5).rows;
 const rows=[...own,...(wider||[]).map(row=>({...row,origin:'Wider market'}))];
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
