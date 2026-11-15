/* Shared presentation helpers. No demo records, persistence or access grants. */
(()=>{'use strict';
 const app=()=>window.NOOR_AI_APP||{};
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function clock(timeZone=app().school?.timezone||'Asia/Kolkata',at=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
  const value=key=>parts.find(p=>p.type===key)?.value;
  const hour=Number(value('hour'));
  return {hour,time:value('hour')+':'+value('minute'),weekday:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(value('weekday')),greeting:hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'};
 }
 function greeting(name){return '<span data-noor-greeting>'+escape(clock().greeting)+'</span>, '+escape(name);}
 function dateLine(){return '<time class="noor-identity-time" data-noor-clock>'+escape(new Date().toLocaleString('en-IN',{timeZone:app().school?.timezone||'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit'}))+'</time>';}
 function brand(){const school=app().school||{},name=school.name||app().profile?.school_name_submitted||'Your school';return '<span class="noor-identity-school">'+(/^https:\/\//.test(school.logo_url||'')?'<img src="'+escape(school.logo_url)+'" alt="'+escape(name)+' logo">':'<span class="noor-school-initial" aria-hidden="true">'+escape(name.slice(0,1))+'</span>')+'<strong>'+escape(name)+'</strong></span>';}
 function periodState(row,runs=new Map(),timeZone,at){
  const now=clock(timeZone,at),start=String(row.start_time||'').slice(0,5),end=String(row.end_time||'').slice(0,5),run=runs.get(row.id);
  const valid=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)&&start<end;
  if(row.completed||row.progress_status==='completed'||['done','completed'].includes(run?.status))return 'Completed';
  if(!valid||Number(row.weekday)!==now.weekday||row.approval_status&&row.approval_status!=='approved'||row.block_type&&row.block_type!=='class')return 'Scheduled';
  if(now.time<start)return 'Upcoming';
  if(now.time>=end)return 'Awaiting update';
  return row.progress_status==='ongoing'||run?.status==='ongoing'?'In progress':'Scheduled now';
 }
 function runningPeriods(rows=[],runs=new Map(),timeZone,at){
  return rows.filter(p=>['In progress','Scheduled now'].includes(periodState(p,runs,timeZone,at))).sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time)));
 }
 function readerFocus(rows=[],options={}){
  const tz=options.timeZone||app().school?.timezone,live=runningPeriods(rows,new Map(),tz,options.at);
  return '<section class="noor-live-periods" aria-label="Current active periods"><header><div><span class="noor-section-label">Current periods</span><h2>Running now</h2></div><span class="noor-live-indicator">'+(live.length?'● '+live.length+' scheduled now':'No current period')+'</span></header>'+ (live.length?live.map(p=>'<article><div><strong>'+escape(p.subject_name||'Class period')+'</strong><p>'+escape(p.class_label||'Class timetable')+' · '+escape(String(p.start_time).slice(0,5)+'–'+String(p.end_time).slice(0,5))+'</p><small>'+escape(p.teacher_name||'Teacher')+([p.lesson,p.topic].filter(Boolean).length?' · '+escape([p.lesson,p.topic].filter(Boolean).join(' · ')):'')+'</small></div><span class="noor-live-badge">'+escape(periodState(p,new Map(),tz,options.at))+'</span></article>').join(''):'<p class="noor-period-empty">No periods are running right now. Open today’s timetable to see the full schedule.</p>')+'<button type="button" class="noor-secondary-action" data-noor-day-schedule>View today’s timetable</button></section>';
 }
 function currentPeriod(rows=[],runs=new Map(),timeZone,at){
  const now=clock(timeZone,at),today=rows.filter(p=>Number(p.weekday)===now.weekday&&(!p.approval_status||p.approval_status==='approved')).sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time)));
  const completed=p=>p.completed||p.progress_status==='completed'||['done','completed'].includes(runs.get(p.id)?.status);
  const running=runningPeriods(today,runs,timeZone,at)[0];
  return {period:running||today.find(p=>!completed(p)&&String(p.start_time).slice(0,5)>now.time)||null,live:!!running,total:today.length};
 }
 function teacherFocus(rows,runs){
  const {period:p,live,total}=currentPeriod(rows,runs),topic=p?[p.lesson,p.topic].filter(Boolean).join(' · '):'';
  return '<section class="noor-current-card" aria-label="Current teaching period"><div><span class="noor-section-label">'+(p?(live?'Current period':'Next period'):'Today’s teaching')+'</span><h2>'+escape(p?.subject_name||(total?'Today’s scheduled periods have finished':'No periods scheduled today'))+'</h2><p>'+escape(p?[p.class_label,String(p.start_time).slice(0,5)+'–'+String(p.end_time).slice(0,5)].filter(Boolean).join(' · '):'Open your timetable to review your saved schedule.')+'</p>'+(p?'<p class="noor-current-topic"><strong>Lesson / topic:</strong> '+escape(topic||'Not added by teacher yet')+'</p>':'')+'</div><div class="noor-current-actions"><button type="button" class="noor-primary-action" data-action="take-attendance">Take Attendance</button><button type="button" class="noor-secondary-action" data-noor-day-schedule>View all timetable</button></div></section>';
 }
 document.addEventListener('click',event=>{if(event.target.closest('[data-noor-day-schedule]'))window.NOOR_SHARED_TIMETABLE?.openDay();});
 function tick(){if(document.hidden)return;const a=app();if(!a.user||!a.schoolId)return;document.querySelectorAll('[data-noor-greeting]').forEach(el=>el.textContent=clock().greeting);document.querySelectorAll('[data-noor-clock]').forEach(el=>el.textContent=new Date().toLocaleString('en-IN',{timeZone:a.school?.timezone||'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit'}));}
 window.NOOR_DASHBOARD_EXPERIENCE=Object.freeze({clock,greeting,dateLine,brand,currentPeriod,teacherFocus,periodState,runningPeriods,readerFocus});
 setInterval(()=>{tick();if(!document.hidden&&app().user&&app().schoolId)window.dispatchEvent(new CustomEvent('noor:period-clock'));},15000);
 document.addEventListener('visibilitychange',tick);
})();
