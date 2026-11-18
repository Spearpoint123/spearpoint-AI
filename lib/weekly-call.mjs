import {bookingLink} from './client-search.mjs';

const week=7*24*60*60*1000;
export function nextCallDate(anchor,now=new Date()){
 const start=new Date(anchor);
 if(Number.isNaN(start.getTime()))throw Error('validation');
 start.setUTCMinutes(0,0,0);
 start.setUTCHours(9);
 while(start.getTime()<=now.getTime())start.setTime(start.getTime()+week);
 return start.toISOString();
}
export function weeklyBooking(){
 const url=bookingLink({});
 if(process.env.HUBSPOT_MEETINGS_AUTOBOOK==='true'){
  return {mode:'autobook_unavailable',status:'autobook_unavailable',meeting_url:url,notice:'Automatic booking is switched on, but the HubSpot Meetings API is not connected. The date below is a reminder, not a booked slot.'};
 }
 return {mode:'reminder',status:'reminder',meeting_url:url,notice:'The weekly call is a reminder every seven days, with the HubSpot link. Spearpoint has not booked the slot automatically.'};
}
