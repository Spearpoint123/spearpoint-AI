// Partner-desk adapters only. Disabled until a contract is chosen. No requests are made.
const adapters=[
 {id:'rocketreach',label:'RocketReach',kind:'licensed'},
 {id:'people_data_labs',label:'People Data Labs',kind:'licensed'},
 {id:'coresignal',label:'Coresignal',kind:'licensed'}
];
export function partnerProviders(){
 return adapters.map(adapter=>({...adapter,enabled:false,configured:false,reason:'No key is configured. This adapter is not called.'}));
}
export async function searchPartnerProvider(id){
 const adapter=partnerProviders().find(item=>item.id===id);
 if(!adapter)return {called:false,records:[],reason:'unknown'};
 return {called:false,records:[],reason:adapter.reason,id:adapter.id};
}
