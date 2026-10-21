import {readFileSync} from 'node:fs';
// Versioned, deployment-persisted backend catalogue; no candidate records are used to author it.
const catalogue=JSON.parse(readFileSync(new URL('../data/candidate-archetypes.json',import.meta.url),'utf8'));
export const catalogueVersion=catalogue.version;
export const savedArchetypes=catalogue.records;
const aliases={CTO:'Chief Technology Officer',CEO:'Chief Executive Officer',CFO:'Chief Financial Officer',COO:'Chief Operating Officer',CRO:'Chief Risk Officer'};
const sectors={
 'Market makers & prop trading':'Electronic trading, pricing, inventory and venue risk',
 'Hedge funds':'Investment process, research, portfolio construction and fund controls',
 'Exchanges':'Trading venues, market infrastructure and operational resilience',
 'Digital assets':'Institutional digital assets, custody and regulated infrastructure',
 'Payments':'Payment infrastructure, settlement and commercial partnerships',
 'Fintech':'Financial technology, product scale and regulated environments',
 'Financial institutions':'Banking, investment and financial services transformation',
 'AI infrastructure for finance':'AI, data infrastructure and financial markets deployment'
};
export function findArchetype(input){
 const canonical=aliases[input.role]||input.role;
 const profile=savedArchetypes.find(p=>p.role.toLowerCase()===canonical.toLowerCase());
 if(!profile)throw Error('validation');
 const niche=input.niche||'Capital markets';
 if(input.niche&&!Object.hasOwn(sectors,input.niche))throw Error('validation');
 return {...structuredClone(profile),role:profile.role,niche,location:input.location,
  baseFocus:'Senior mandate: US$150,000+ annual base. Package to be benchmarked for the role and market.',
  sectorContext:sectors[niche]||'Capital markets and financial infrastructure',
  pillars:profile.focus.map((title,i)=>[title,profile.experience[i]]),
  matchBasis:'Saved role archetype selected by role, with sector context and your preferred location. This is not a scored candidate match.',
  matchScore:null,availability:'Candidate availability and interest require consultant confirmation.'};
}
