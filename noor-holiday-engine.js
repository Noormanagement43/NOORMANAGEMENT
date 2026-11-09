/* Verified Telangana State Government GENERAL holidays for 2026 only.
   Source: https://www.telangana.gov.in/downloads/calendar-2026/
   Optional/religious observances are never silently assumed to be school closures.
   For other states/years, principals approve school holiday dates via School Calendar. */
(()=>{'use strict';
 const TL2026=[
  ['01-14','Bhogi'],['01-15','Sankranti'],['01-26','Republic Day'],
  ['02-15','Mahashivaratri'],['03-03','Holi'],['03-19','Ugadi'],
  ['03-21','Eid-ul-Fitr'],['03-22','Following Eid-ul-Fitr'],['03-27','Sri Rama Navami'],
  ['04-03','Good Friday'],['04-05','Babu Jagjivan Ram Birthday'],['04-14','Ambedkar Jayanti'],
  ['05-27','Eid-ul-Adha'],['06-26','Muharram'],['08-10','Bonalu'],
  ['08-15','Independence Day'],['08-26','Milad-un-Nabi'],
  ['09-04','Sri Krishna Ashtami'],['09-14','Vinayaka Chavithi'],
  ['10-02','Gandhi Jayanti'],['10-18','Saddula Bathukamma'],
  ['10-20','Vijaya Dasami'],['10-21','Following Vijaya Dasami'],
  ['11-08','Deepavali'],['11-24','Karthika Pournami/Guru Nanak Jayanti'],
  ['12-25','Christmas'],['12-26','Boxing Day']
 ];
 const plus=(d,n)=>{const date=new Date(d+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);};
 const weekday=d=>new Date(d+'T12:00:00Z').getUTCDay();
 function holidays(region,year,enabled=true){
  if(!enabled||region!=='TS'||Number(year)!==2026)return[];
  return TL2026.map(([md,name])=>({date:'2026-'+md,name,source:'Telangana Government General Holidays 2026'}));
 }
 function workingDates(start,end,offDays=[0],closedDates=[]){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)return[];
  const blocked=new Set(closedDates),days=new Set(offDays);
  const output=[];let count=0;
  for(let d=start;d<=end&&count<1500;d=plus(d,1),count++){
    if(!days.has(weekday(d))&&!blocked.has(d))output.push(d);
  }
  return output;
 }
 window.NOOR_HOLIDAY_ENGINE=Object.freeze({holidays,workingDates});
})();