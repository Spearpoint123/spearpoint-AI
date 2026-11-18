// Drafts only. Nothing in this module sends email, InMail or a CRM message.
export function outreachDraft({candidate={},role={},channel='email'}={}){
 const name=String(candidate.name||candidate.full_name||'there').split(' ')[0].slice(0,40);
 const title=String(role.title||candidate.title||'a senior role').slice(0,120);
 const company=String(role.company||'a Spearpoint client').slice(0,120);
 const reason=(candidate.matchReasons&&candidate.matchReasons[0])||'your experience looks relevant to the brief';
 const medium=channel==='inmail'?'inmail':'email';
 const subject=`Confidential conversation: ${title}`;
 const body=`Hello ${name},\n\nI am writing from Spearpoint Search about a confidential ${title} brief${company?` with ${company}`:''}. ${reason.replace(/\.$/,'')}.\n\nIf a conversation would be useful, reply to this message or tell me a better time. There is no obligation, and I will not share your details without your agreement.\n\nSam\nSpearpoint Search`;
 return {channel:medium,subject,body,sent:false,notice:'Draft only. Nothing has been sent. Copy it into your own email or LinkedIn Recruiter.'};
}
