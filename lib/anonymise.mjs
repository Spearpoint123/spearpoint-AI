const keyOf=row=>[row.level,row.years_bucket,row.firm_type,row.region,row.sector,row.pay_band].join('|');
function payWide(band){
 const match=String(band||'').match(/(\d{2,4})/);
 const start=match?Number(match[1]):0;
 if(start<200)return 'Under 250';
 if(start<400)return '250–500';
 return '500 and above';
}
function regionWide(region){
 const value=String(region||'');
 if(/London|Dubai|Singapore|New York|Zurich/i.test(value))return 'Major financial centre';
 return 'Several cities';
}
function widen(row,step){
 if(step===1)return {...row,region:regionWide(row.region)};
 if(step===2)return {...row,pay_band:payWide(row.pay_band)};
 return {...row,firm_type:'Trading or technology firm',sector:'Several sectors'};
}
export function generalise(incoming,existing=[],k=5){
 let rows=incoming.map(row=>({...row}));
 const base=existing.map(row=>({...row}));
 const count=list=>{
  const bag={};
  for(const row of [...base,...list])bag[keyOf(row)]=(bag[keyOf(row)]||0)+1;
  return bag;
 };
 for(let step=1;step<=3;step++){
  const bag=count(rows);
  if(rows.every(row=>bag[keyOf(row)]>=k))return {rows,suppressed:[]};
  rows=rows.map(row=>bag[keyOf(row)]>=k?row:widen(row,step));
 }
 const bag=count(rows);
 const kept=[],suppressed=[];
 for(const row of rows)(bag[keyOf(row)]>=k?kept:suppressed).push(row);
 return {rows:kept,suppressed};
}
