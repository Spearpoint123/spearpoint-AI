// Import a LinkedIn Recruiter project export that a recruiter downloaded themselves.
// The file is parsed locally. Profile URLs are stored as text and are never requested.
const httpsProfile=/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]{3,160}\/?$/i;
function rows(text){
 const src=String(text||'').replace(/^\uFEFF/,'').trim();
 if(!src)return [];
 if(src.length>500000)throw Error('document_large');
 const lines=[];let row='',q=false;
 for(let i=0;i<src.length;i++){
  const c=src[i];
  if(q){if(c==='"'){if(src[i+1]==='"'){row+='"';i++;}else q=false;}else row+=c;continue;}
  if(c==='"'){q=true;continue;}
  if(c==='\n'){lines.push(row);row='';continue;}
  if(c!=='\r')row+=c;
 }
 if(row)lines.push(row);
 return lines.filter(l=>l.trim()).map(l=>l.split(','));
}
const norm=h=>String(h||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
const pick=(header,names)=>header.findIndex(h=>names.includes(norm(h)));
export function parseRecruiterCsv(text){
 const table=rows(text);
 if(table.length<2)throw Error('csv_empty');
 const header=table[0];
 const first=pick(header,['firstname','givenname']);
 const last=pick(header,['lastname','surname','familyname']);
 const name=pick(header,['fullname','name','prospect']);
 const title=pick(header,['title','currenttitle','jobtitle','position']);
 const company=pick(header,['company','currentcompany','organization','organisation','account']);
 const location=pick(header,['location','geography','city']);
 const url=pick(header,['profileurl','linkedinurl','url','publicprofileurl','linkedinprofile']);
 if(title<0&&name<0&&first<0)throw Error('csv_unrecognised');
 const leads=[];
 for(const cells of table.slice(1,201)){
  const joined=[first,last].filter(i=>i>=0).map(i=>cells[i]||'').join(' ').trim();
  const cell=i=>i>=0?String(cells[i]||'').trim():'';
  const full=(joined||cell(name)).replace(/\s+/g,' ').trim().slice(0,180);
  if(full.length<2)continue;
  const profile=cell(url);
  leads.push({
   full_name:full,
   title:cell(title).slice(0,200),
   company:cell(company).slice(0,200),
   location:cell(location).slice(0,120),
   profile_url:httpsProfile.test(profile)?profile:''
  });
 }
 if(!leads.length)throw Error('csv_empty');
 return {leads,ignoredUrls:table.length-1-leads.length,note:'Imported from a file you supplied. LinkedIn was not contacted.'};
}
