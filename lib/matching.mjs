const aliases={cto:'chief technology officer',ceo:'chief executive officer',cfo:'chief financial officer',coo:'chief operating officer',cpo:'chief product officer',chro:'chief human resources officer'};
export const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu,' ').trim().replace(/\s+/g,' ');
export const roleName=s=>aliases[normalize(s)]||normalize(s);
export function roleMatches(requested,actual){
 const wanted=roleName(requested),given=roleName(actual);
 return !!wanted&&(` ${given} `).includes(` ${wanted} `);
}
export function roleQueries(role){const canonical=roleName(role);const acronym=Object.keys(aliases).find(k=>aliases[k]===canonical);return acronym?[canonical,acronym.toUpperCase()]:[role];}
const contains=(text,term)=>{const value=` ${normalize(text)} `;const wanted=normalize(term);return !!wanted&&value.includes(` ${wanted} `);};
export function assessProfile(input,row){
 // All explanations and scores use approved shareable copy, never private notes or inferred traits.
 const skills=[...new Set(input.skills.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean))].slice(0,12);
 const approvedSkills=(row.public_skills||[]).join(', ');
 const matched=skills.filter(skill=>contains(approvedSkills,skill));
 const missing=skills.filter(skill=>!matched.includes(skill));
 const role=roleMatches(input.role,row.public_title);
 const location=contains(`${row.public_summary} ${approvedSkills}`,input.location);
 const score=40*Number(role)+40*(skills.length?matched.length/skills.length:0)+20*Number(location);
 return {score:Math.floor(score),eligible:role&&score>=80,
  experience:[row.public_summary],
  fitReasons:[...(role?[`Role alignment: ${row.public_title}.`]:[]),...(matched.length?[`Relevant experience in the approved profile: ${matched.join(', ')}.`]:[]),...(location?[`The shareable profile supports the requested ${input.location} location.`]:[])],
  gaps:[...missing.map(skill=>`Not evidenced in the shareable profile: ${skill}.`),...(!location?['Location needs confirmation; it is not evidenced in the shareable profile.']:[]),'Interest and availability require consultant confirmation.'],
  matchBasis:'Criteria coverage: role/title 40%, requested experience 40%, location evidence 20%. Only approved shareable information earns points. This is not a prediction of hiring success.'};
}
