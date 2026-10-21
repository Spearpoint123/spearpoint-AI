// Guided-search dependencies. Browsing between steps preserves valid choices.
export function canVisitStep(selection,step,groups){
 if(!Number.isInteger(step)||step<0||step>3)return false;
 if(step===0)return true;
 if(!selection.niche)return false;
 if(step===1)return true;
 if(!groups[selection.function])return false;
 if(step===2)return true;
 return typeof selection.role==='string'&&selection.role.trim().length>=3&&(selection.customRole===true||groups[selection.function].roles.includes(selection.role));
}
export function selectSearchOption(selection,key,value,groups){
 const next={...selection};
 if(!['niche','function','role','customRole','location'].includes(key))throw Error('Unknown search field');
 if(key==='function'){
  if(!groups[value])throw Error('Unknown specialism');
  next.function=value;
  if(next.role&&!groups[value].roles.includes(next.role)){delete next.role;delete next.customRole;}
 }else if(key==='customRole'){
  if(!groups[next.function]||typeof value!=='string'||value.trim().length<3||value.trim().length>100)throw Error('Invalid role');
  next.role=value.trim();next.customRole=true;
 }else if(key==='role'){
  const group=Object.keys(groups).find(name=>groups[name].roles.includes(value));
  if(!group)throw Error('Unknown role');
  next.function=group;next.role=value;delete next.customRole;
 }else next[key]=value;
 return next;
}
