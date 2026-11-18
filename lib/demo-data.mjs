// Clearly fictional demonstration records. Never mix these with a live RecruitCRM response.
const far='2099-01-01T00:00:00.000Z';
export const DEMO_CLIENT_ID='11111111-1111-4111-8111-111111111111';
export const DEMO_RECRUITER_ID='22222222-2222-4222-8222-222222222222';
export const DEMO_ROLE_ID='33333333-3333-4333-8333-333333333333';
export const DEMO_INTRO_ID='44444444-4444-4444-8444-444444444444';
export const DEMO_CANDIDATE_ID='55555555-5555-4555-8555-555555555555';

export const demoPeople=[
 {slug:'fictional-avery-quinn',reference:'SP-DE00000000000001',name:'Avery Quinn',title:'Head of quantitative trading',company:'Northwind Digital Markets (fictional)',location:'London',email:'avery.quinn@example.invalid',skills:'systematic equities, Python, portfolio construction',summary:'Fictional profile. Built a paper-trading research stack and a London equities book for a made-up firm. Not a real person.',notes:'Demo note: interested in a move within systematic equities.',mustHaves:['Systematic equities','Python research','Portfolio construction']},
 {slug:'fictional-jordan-hale',reference:'SP-DE00000000000002',name:'Jordan Hale',title:'Quantitative developer',company:'Example Ledger Ltd (fictional)',location:'Dubai',email:'jordan.hale@example.invalid',skills:'low-latency execution, C++, market data',summary:'Fictional profile. Designed an execution simulator for a made-up Dubai trading desk. Not a real person.',notes:'Demo note: notice period is invented.',mustHaves:['Low-latency execution','C++','Market data']},
 {slug:'fictional-samira-cole',reference:'SP-DE00000000000003',name:'Samira Cole',title:'Portfolio manager, digital assets',company:'Harbour Lane Capital (fictional)',location:'London',email:'samira.cole@example.invalid',skills:'digital assets, risk, portfolio construction',summary:'Fictional profile. Ran a made-up multi-strategy digital-asset book. Not a real person.',notes:'Demo note: compensation figures are invented.',mustHaves:['Digital assets','Risk management','Portfolio construction']}
];

export function demoRecords(){
 return demoPeople.map(p=>({
  slug:p.slug,first_name:p.name.split(' ')[0],last_name:p.name.split(' ').slice(1).join(' '),
  position:p.title,current_organization:p.company,city:p.location,skill:p.skills,
  candidate_summary:p.summary,notes:p.notes,email:p.email,status_label:'available',
  fictional:true,label:'Fictional demonstration profile. Not a real person.'
 }));
}

export function scoreDemo(query=''){
 const q=query.toLowerCase();
 const terms=q.split(/[^a-z0-9+#]+/).filter(t=>t.length>2);
 return demoPeople.map(p=>{
  const hay=`${p.title} ${p.skills} ${p.summary} ${p.notes} ${p.location} ${p.company}`.toLowerCase();
  const hits=terms.filter(t=>hay.includes(t));
  const reasons=hits.length?hits.map(t=>`Fictional record mentions “${t}”.`):['Shown because this is the labelled demonstration set. Add a RecruitCRM key to search live records.'];
  return {...p,fictional:true,score:hits.length,matchReasons:reasons,evidence:[p.summary],source:'demonstration',pipeline_stage:p.slug==='fictional-avery-quinn'?'intro_requested':'new'};
 }).sort((a,b)=>b.score-a.score);
}

export function demoInstantSearch(body){
 const mustHaves=[body?.mustHaves].flat().map(v=>String(v||'').trim()).filter(Boolean);
 if(mustHaves.length!==3)throw Error('professional_must_haves_required');
 const people=scoreDemo([body.query,body.location,...mustHaves].filter(Boolean).join(' ')).slice(0,3);
 return {
  searchId:'66666666-6666-4666-8666-666666666666',
  criteria:{role:String(body.query||'Senior hire').slice(0,120),location:body.location||'Any location',niches:[],customRequirements:mustHaves,mustHaves},
  candidates:people.map(p=>({
   id:p.reference,reference:p.reference,title:`Fictional ${p.title}`,summary:`FICTIONAL DEMO. ${p.summary}`,
   source:'internal',reviewStatus:'approved',evidenceReady:true,mustHaveReviewed:3,sourceLabel:'Fictional demonstration · not RecruitCRM',
   focus:p.skills.split(',').map(s=>s.trim()),
   mustHaveChecks:mustHaves.map(requirement=>({requirement,status:'source_supported',evidence:`Fictional illustration only. The made-up record was labelled against “${requirement}”.`})),
   fitReasons:p.matchReasons,gaps:['Availability, interest and permission are not real in this demonstration.'],
   canRequestIntro:false,introUnavailableReason:'Demonstration only. Open the team workspace to rehearse an introduction request.',
   pipeline_stage:'new',fictional:true
  })),
  internalStatus:'demo',publicStatus:'not_searched',externalStatus:'not_connected',
  message:'These profiles are fictional and exist only for the demonstration. They are not RecruitCRM records and not real people.'
 };
}

export function seedDemoRows(){
 const client=DEMO_CLIENT_ID;
 return {
  sp_employers:[{owner_id:client,company_name:'Harbour Lane Capital (fictional)',website:'https://example.com',company_context:'Fictional asset manager used for the Spearpoint demonstration.',updated_at:far,expires_at:far}],
  sp_roles:[{id:DEMO_ROLE_ID,owner_id:client,title:'Head of Quantitative Trading',job_description:'Fictional mandate for a London systematic equities lead. Not a live vacancy.',compensation:'Fictional range',pitch:'Demonstration brief',criteria:{role:'Head of Quantitative Trading',location:'London',mustHaves:['Systematic equities','Python research','Portfolio construction'],niches:['Hedge funds']},state:'active',internal_status:'demo',public_status:'not_searched',brief_version:1,last_searched_at:null,created_at:'2026-11-01T09:00:00.000Z',updated_at:far,expires_at:far}],
  sp_role_candidates:[{id:DEMO_CANDIDATE_ID,owner_id:client,role_id:DEMO_ROLE_ID,brief_version:1,source:'internal',reference:'SP-DE00000000000001',pipeline_stage:'intro_requested',feedback:'',created_at:'2026-11-02T09:00:00.000Z',updated_at:far,expires_at:far}],
  sp_introductions:[{id:DEMO_INTRO_ID,owner_id:client,role_id:DEMO_ROLE_ID,candidate_id:DEMO_CANDIDATE_ID,reference:'SP-DE00000000000001',status:'requested',request_note:'Fictional introduction request for the demonstration.',created_at:'2026-11-02T10:00:00.000Z',updated_at:far,expires_at:far}],
  sp_product_events:[
   {id:'77777777-7777-4777-8777-777777777771',owner_id:client,name:'brief_created',props:{fictional:true},created_at:'2026-11-01T09:00:00.000Z'},
   {id:'77777777-7777-4777-8777-777777777772',owner_id:DEMO_RECRUITER_ID,name:'search_run',props:{fictional:true,surfaced:3},created_at:'2026-11-02T09:30:00.000Z'},
   {id:'77777777-7777-4777-8777-777777777773',owner_id:client,name:'intro_requested',props:{fictional:true},created_at:'2026-11-02T10:00:00.000Z'}
  ],
  sp_import_leads:[],
  sp_recruiter_pipeline:[],
  sp_employer_domains:[{domain:'demo.spearpoint.test',status:'approved',company_type:'direct_employer',company_name:'Harbour Lane Capital (fictional)',review_evidence:'Demonstration approval. Not a real company.',reviewed_by:DEMO_RECRUITER_ID,reviewed_at:'2026-11-01T00:00:00.000Z'}],
  sp_briefs:[],sp_activity:[],sp_saved_searches:[],sp_shortlists:[],sp_profile_approvals:[],sp_public_discoveries:[],sp_candidate_submissions:[],sp_rate_limits:[]
 };
}
