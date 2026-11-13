/* Pure presentation helpers. Authorization and money records are server-controlled. */
(()=>{'use strict';
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const date=d=>d?new Date(String(d).length===10?d+'T12:00:00+05:30':d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}):'Not set';
function tenure(d,now=new Date()){if(!d)return 'Not set';const start=new Date(d);let months=(now.getFullYear()-start.getFullYear())*12+now.getMonth()-start.getMonth();if(now.getDate()<start.getDate())months--;months=Math.max(0,months);return months?months+' month'+(months===1?'':'s'):'Less than a month';}
const college=i=>i.institution_type==='university'||i.institution_type==='college';
const paymentStatus=i=>!i.next_due?'Not set':i.last_paid_due&&i.last_paid_due>=i.next_due?'Paid':i.next_due<new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})?'Overdue':'Due';
const enabled=(feature,id,defaults,overrides)=>overrides.find(x=>x.institution_id===id&&x.feature_key===feature)?.enabled??defaults.find(x=>x.feature_key===feature)?.enabled??true;
function totals(rows){return {schools:rows.filter(x=>!college(x)).length,colleges:rows.filter(college).length,students:rows.reduce((n,x)=>n+Number(x.students||0),0),teachers:rows.reduce((n,x)=>n+Number(x.teachers||0),0),active:rows.filter(x=>!x.paused&&x.status==='active').length,paused:rows.filter(x=>x.paused).length,due:rows.filter(x=>['Due','Overdue'].includes(paymentStatus(x))).length};}
window.NOOR_CREATOR_MODEL=Object.freeze({money,date,tenure,college,paymentStatus,enabled,totals});
})();
