export const BOOKING_URL='https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone';
export function text(value,min,max){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw Error('validation');return value.trim();}
export function searchInput(body){return {role:text(body.role,3,100),location:text(body.location,2,80),skills:body.skills?text(body.skills,1,240):'',...(body.jobDescription?{jobDescription:text(body.jobDescription,1,4000)}:{}),...(body.niche?{niche:text(body.niche,2,100)}:{}),...(body.function?{function:text(body.function,2,100)}:{})};}
export function briefInput(body){const {role,location,skills}=searchInput(body);const search={role,location,skills};const email=text(body.email,5,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||body.consent!==true||body.website)throw Error('validation');return {...search,email,name:text(body.name,2,100),company:text(body.company,2,160),notes:typeof body.notes==='string'?text(body.notes||'No additional details',1,7000):'No additional details',privacy_version:'2026-10-30'};}
// Only manually approved public copy can leave the server. Never project raw CRM fields.
export function publicProfile(row,matchedSlugs,now=Date.now()){
 const reviewed=Date.parse(row.reviewed_at),expires=Date.parse(row.consent_expires_at);
 const basis=row.approval_basis||'candidate_permission';
 if(!['candidate_permission','owner_approved_anonymised_summary'].includes(basis)||(basis==='owner_approved_anonymised_summary'&&(typeof row.approved_by!=='string'||!row.approved_by.trim())))return null;
 if(!matchedSlugs.has(row.crm_slug)||row.external_sharing_consent!==true||typeof row.consent_evidence!=='string'||!row.consent_evidence.trim()||row.revoked_at||!Number.isFinite(reviewed)||!Number.isFinite(expires)||expires<=now||reviewed>now||reviewed<now-30*86400000||!Array.isArray(row.public_skills)||row.public_skills.length<1||row.public_skills.length>10)return null;
 const clean=s=>typeof s==='string'&&s.trim().length>0&&s.length<=600&&!/[\u0000-\u001f]|@|https?:|www\.|\b\+?\d[\d ().-]{7,}\b/i.test(s);
 if(![row.public_title,row.public_summary,...(row.public_skills||[])].every(clean))return null;
 return {kind:'real',label:'Confidential candidate profile',title:row.public_title,summary:row.public_summary,focus:row.public_skills,reviewedAt:new Date(reviewed).toISOString().slice(0,10),availability:'Availability and interest must be confirmed by a consultant.'};
}
