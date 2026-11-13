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
 function currentPeriod(rows=[],runs=new Map(),timeZone,at){
  const now=clock(timeZone,at),today=rows.filter(p=>Number(p.weekday)===now.weekday&&(!p.approval_status||p.approval_status==='approved')).sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time)));
  const completed=p=>p.completed||p.progress_status==='completed'||runs.get(p.id)?.status==='done';
  const running=today.find(p=>!completed(p)&&String(p.start_time).slice(0,5)<=now.time&&now.time<String(p.end_time).slice(0,5));
  return {period:running||today.find(p=>!completed(p)&&String(p.start_time).slice(0,5)>now.time)||null,live:!!running,total:today.length};
 }
 function teacherFocus(rows,runs){
  const {period:p,live,total}=currentPeriod(rows,runs),topic=p?[p.lesson,p.topic].filter(Boolean).join(' · '):'';
  return '<section class="noor-current-card" aria-label="Current teaching period"><div><span class="noor-section-label">'+(p?(live?'Current period':'Next period'):'Today’s teaching')+'</span><h2>'+escape(p?.subject_name||(total?'Today’s scheduled periods have finished':'No periods scheduled today'))+'</h2><p>'+escape(p?[p.class_label,String(p.start_time).slice(0,5)+'–'+String(p.end_time).slice(0,5)].filter(Boolean).join(' · '):'Open your timetable to review your saved schedule.')+'</p>'+(p?'<p class="noor-current-topic"><strong>Lesson / topic:</strong> '+escape(topic||'Not added by teacher yet')+'</p>':'')+'</div><div class="noor-current-actions"><button type="button" class="noor-primary-action" data-action="take-attendance">Take Attendance</button><button type="button" class="noor-secondary-action" data-noor-day-schedule>View all timetable</button></div></section>';
 }
 document.addEventListener('click',event=>{if(event.target.closest('[data-noor-day-schedule]'))window.NOOR_SHARED_TIMETABLE?.openDay();});
 function tick(){if(document.hidden)return;const a=app();if(!a.user||!a.schoolId)return;document.querySelectorAll('[data-noor-greeting]').forEach(el=>el.textContent=clock().greeting);document.querySelectorAll('[data-noor-clock]').forEach(el=>el.textContent=new Date().toLocaleString('en-IN',{timeZone:a.school?.timezone||'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit'}));}
 window.NOOR_DASHBOARD_EXPERIENCE=Object.freeze({clock,greeting,dateLine,brand,currentPeriod,teacherFocus});
 setInterval(tick,30000);
 document.addEventListener('visibilitychange',tick);
})();
