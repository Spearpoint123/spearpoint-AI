// Fictional, anonymised projections. No names, employers, universities or contact details.
export const sampleCandidates=[
 {id:'c1000001-0000-4000-8000-000000000001',source:'recruitcrm',level:'Senior',seniority:'senior',years_bucket:'10–15 yrs',region:'Dubai',firm_type:'crypto market maker',sector:'digital assets',pay_band:'250–350',scope:{team:'6–15',pnl:'single desk',asset_classes:['crypto'],products:['market making','basis']},sector_history:['crypto market maker','prop trading'],skills:['research','crypto','market making','python','risk'],summary:'Senior quantitative researcher on a crypto market-making desk. Dubai. Pay band 250–350.'},
 {id:'c1000001-0000-4000-8000-000000000002',source:'talent_network',level:'Senior',seniority:'senior',years_bucket:'10–15 yrs',region:'London',firm_type:'crypto market maker',sector:'digital assets',pay_band:'250–350',scope:{team:'6–15',pnl:'single desk',asset_classes:['crypto','equities'],products:['market making']},sector_history:['crypto market maker','tier-1 HFT'],skills:['research','crypto','market making','statistics'],summary:'Senior researcher. Crypto and equity market making. London. Pay band 250–350.'},
 {id:'c1000001-0000-4000-8000-000000000003',source:'recruitcrm',level:'Director',seniority:'director',years_bucket:'15–20 yrs',region:'London',firm_type:'tier-1 HFT',sector:'equities',pay_band:'350–500',scope:{team:'15–40',pnl:'multi-desk',asset_classes:['equities'],products:['market making','execution']},sector_history:['tier-1 HFT','prop trading'],skills:['leadership','equities','execution','research'],summary:'Director. Systematic equities at a tier-1 HFT. London. Pay band 350–500.'},
 {id:'c1000001-0000-4000-8000-000000000004',source:'consented',level:'VP',seniority:'vp',years_bucket:'10–15 yrs',region:'Dubai',firm_type:'crypto exchange',sector:'digital assets',pay_band:'250–350',scope:{team:'15–40',pnl:'venue',asset_classes:['crypto'],products:['spot','derivatives']},sector_history:['crypto exchange','fintech'],skills:['venue','crypto','derivatives','management'],summary:'VP. Crypto exchange, spot and derivatives. Dubai. Pay band 250–350.'},
 {id:'c1000001-0000-4000-8000-000000000005',source:'recruitcrm',level:'Staff',seniority:'staff',years_bucket:'10–15 yrs',region:'London',firm_type:'market maker',sector:'equities',pay_band:'200–250',scope:{team:'6–15',pnl:'single desk',asset_classes:['equities'],products:['low latency']},sector_history:['market maker'],skills:['low latency','c++','equities'],summary:'Staff engineer. Low-latency equities. London. Pay band 200–250.'},
 {id:'c1000001-0000-4000-8000-000000000006',source:'talent_network',level:'Senior',seniority:'senior',years_bucket:'5–10 yrs',region:'London',firm_type:'hedge fund',sector:'equities',pay_band:'150–200',scope:{team:'2–5',pnl:'pod',asset_classes:['equities'],products:['stat arb']},sector_history:['hedge fund'],skills:['research','equities','python'],summary:'Senior researcher. Equity statistical arbitrage. London. Pay band 150–200.'},
 {id:'c1000001-0000-4000-8000-000000000007',source:'recruitcrm',level:'Head',seniority:'director',years_bucket:'15–20 yrs',region:'London',firm_type:'hedge fund',sector:'multi-asset',pay_band:'350–500',scope:{team:'15–40',pnl:'book',asset_classes:['equities','macro'],products:['portfolio']},sector_history:['hedge fund','bank'],skills:['portfolio','leadership','macro'],summary:'Head of trading. Multi-asset hedge fund. London. Pay band 350–500.'},
 {id:'c1000001-0000-4000-8000-000000000008',source:'consented',level:'VP',seniority:'vp',years_bucket:'10–15 yrs',region:'Europe',firm_type:'fintech',sector:'payments',pay_band:'200–250',scope:{team:'15–40',pnl:'product line',asset_classes:['payments'],products:['platform']},sector_history:['fintech','bank'],skills:['platform','payments','management'],summary:'VP engineering. Payments platform. Europe. Pay band 200–250.'},
 {id:'c1000001-0000-4000-8000-000000000009',source:'recruitcrm',level:'Senior',seniority:'senior',years_bucket:'10–15 yrs',region:'Dubai',firm_type:'prop trading',sector:'digital assets',pay_band:'250–350',scope:{team:'2–5',pnl:'pod',asset_classes:['crypto'],products:['research']},sector_history:['prop trading','crypto market maker'],skills:['research','crypto','statistics'],summary:'Senior quantitative researcher. Crypto prop desk. Dubai. Pay band 250–350.'},
 {id:'c1000001-0000-4000-8000-00000000000a',source:'talent_network',level:'Director',seniority:'director',years_bucket:'15–20 yrs',region:'London',firm_type:'bank',sector:'markets',pay_band:'200–250',scope:{team:'40+',pnl:'division',asset_classes:['rates','credit'],products:['risk']},sector_history:['bank'],skills:['risk','markets','leadership'],summary:'Director. Markets risk at a bank. London. Pay band 200–250.'}
].map(row=>({...row,fictional:true,publication:'published'}));

const groups=[
 ['Senior','senior','10–15 yrs','London','crypto market maker','digital assets','250–350','research'],
 ['Senior','senior','10–15 yrs','Dubai','crypto market maker','digital assets','250–350','research'],
 ['Senior','senior','5–10 yrs','London','hedge fund','equities','200–250','portfolio'],
 ['Staff','staff','5–10 yrs','London','AI lab','artificial intelligence','150–200','python'],
 ['Staff','staff','10–15 yrs','Singapore','payments firm','payments','150–200','platform'],
 ['VP','vp','10–15 yrs','London','bank','payments','250–350','risk'],
 ['Director','director','15–20 yrs','New York','hedge fund','equities','350–500','leadership'],
 ['Senior','senior','10–15 yrs','Dubai','prop trading','digital assets','250–350','crypto'],
 ['Head','director','15–20 yrs','London','AI lab','artificial intelligence','350–500','leadership'],
 ['Senior','senior','5–10 yrs','London','payments firm','payments','150–200','product'],
 ['Staff','staff','10–15 yrs','Singapore','crypto market maker','digital assets','200–250','market making'],
 ['VP','vp','15–20 yrs','New York','prop trading','equities','350–500','execution']
];
const extra=groups.flatMap((group,groupIndex)=>Array.from({length:6},(_,seat)=>{
 const [level,seniority,years_bucket,region,firm_type,sector,pay_band,skill]=group;
 const n=groupIndex*6+seat+1;
 return {id:`c2000001-0000-4000-8000-${String(n).padStart(12,'0')}`,source:'talent_network',level,seniority,years_bucket,region,firm_type,sector,pay_band,scope:{team:'6–15',pnl:'single desk',asset_classes:[sector],products:[skill]},sector_history:[firm_type],skills:[skill,sector.split(' ')[0],region.toLowerCase()],summary:`${level} ${skill} profile at a ${firm_type}. ${region}. Pay band ${pay_band}. Fictional sample.`,fictional:true,publication:'published'};
}));
sampleCandidates.push(...extra);
