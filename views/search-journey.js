// Guided-search dependencies. Browsing between steps preserves valid choices.
export function canVisitStep(selection,step,groups){
 if(!Number.isInteger(step)||step<0||step>3)return false;
 if(step===0)return true;
 if(!selection.niche)return false;
 if(step===1)return true;
 if(!groups[selection.function])return false;
 if(step===2)return true;
 return groups[selection.function].roles.includes(selection.role);
}
export function selectSearchOption(selection,key,value,groups){
 const next={...selection};
 if(!['niche','function','role','location'].includes(key))throw Error('Unknown search field');
 if(key==='function'){
  if(!groups[value])throw Error('Unknown specialism');
  next.function=value;
  if(next.role&&!groups[value].roles.includes(next.role))delete next.role;
 }else if(key==='role'){
  const group=Object.keys(groups).find(name=>groups[name].roles.includes(value));
  if(!group)throw Error('Unknown role');
  next.function=group;next.role=value;
 }else next[key]=value;
 return next;
}
