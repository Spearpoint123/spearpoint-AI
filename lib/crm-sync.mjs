// Two-way stage sync. RecruitCRM wins a conflict. Routes never call the writer.
export function planSync({localStage,remoteStage}={}){
 const local=String(localStage||'');
 const remote=String(remoteStage||'');
 if(remote&&remote!==local)return {stage:remote,winner:'recruitcrm',conflict:true,local};
 if(remote)return {stage:remote,winner:'recruitcrm',conflict:false,local};
 return {stage:local,winner:'local',conflict:false,local};
}
export async function applySync(plan,{fetcher}={}){
 if(process.env.RECRUIT_CRM_WRITE!=='true')return {written:false,reason:'disabled',plan};
 if(typeof fetcher!=='function')return {written:false,reason:'not_wired',plan};
 await fetcher({stage:plan.stage});
 return {written:true,reason:'sent',plan};
}
