export const BOOKING_URL='https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone';
export function text(value,min,max){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw Error('validation');return value.trim();}
export function searchInput(body){return {role:text(body.role,3,100),location:text(body.location,2,80),skills:text(body.skills||'Relevant sector experience',2,240)};}
export function briefInput(body){const search=searchInput(body);const email=text(body.email,5,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||body.consent!==true||body.website)throw Error('validation');return {...search,email,name:text(body.name,2,100),company:text(body.company,2,160),notes:typeof body.notes==='string'?text(body.notes||'No additional details',1,2000):'No additional details',privacy_version:'2026-10-21'};}
// These are search-planning templates, never generated candidate identities.
export function archetypes(input){return ['Sector specialist','Transformation leader','Adjacent-sector operator'].map((angle,i)=>({id:`illustrative-${i+1}`,kind:'synthetic',label:'Synthetic illustrative archetype',title:angle,summary:`A hypothetical ${input.role} profile to explore during your briefing.`,focus:[input.skills,input.location],availability:'Not a real person. No availability or market supply is implied.'}));}
// Only manually approved public copy can leave the server. Never project raw CRM fields.
export function publicProfile(row,matchedSlugs,now=Date.now()){
 const reviewed=Date.parse(row.reviewed_at),expires=Date.parse(row.consent_expires_at);
 if(!matchedSlugs.has(row.crm_slug)||row.external_sharing_consent!==true||row.revoked_at||!Number.isFinite(reviewed)||!Number.isFinite(expires)||expires<=now||reviewed>now||reviewed<now-30*86400000||!Array.isArray(row.public_skills))return null;
 const clean=s=>typeof s==='string'&&s.length<=600&&!/@|https?:|\b\+?\d[\d ().-]{7,}\b/i.test(s);
 if(![row.public_title,row.public_summary,...(row.public_skills||[])].every(clean))return null;
 return {kind:'real',label:'Consented, redacted real profile',title:row.public_title,summary:row.public_summary,focus:row.public_skills,availability:'Availability and interest must be confirmed by a consultant.'};
}
