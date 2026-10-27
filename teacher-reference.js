/* NOOR Teacher Dashboard — approved burgundy reference layout.
   Real profile, editable periods, teacher check-in, tasks, school notices and actual daily progress. */
(()=>{'use strict';
const get=()=>window.NOOR_AI_APP||{},esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const fmt=t=>t?String(t).slice(0,5):'—';
const prettyTime=t=>{if(!t)return'—';const [h,m]=fmt(t).split(':').map(Number);return ((h+11)%12+1)+':'+String(m).padStart(2,'0')+' '+(h<12?'AM':'PM')};
const formatDate=s=>s?new Date(s).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Not added';
let rendering=false,renderId=0,channel=null,sessionKey='',live=false,current=null;
const root=()=>document.getElementById('view-overview');
const $=s=>root()?.querySelector(s);
const subjectIcon=s=>/math|algebra|geometry|stat/i.test(s)?'▦':/science|chemistry|physics|biology/i.test(s)?'⚗':/english|hindi|urdu|language/i.test(s)?'▤':/computer|it|technology/i.test(s)?'⌘':'▣';
const isTeacher=()=>get().profile?.role==='teacher'&&get().profile?.status==='active'&&get().user&&get().schoolId;
const notify=(message,type='success')=>get().toast?.(message,type);
const openView=id=>get().openView?.(id);
const dateTime=s=>s?new Date(s).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'—';
function det(label,value,icon){return '<div class="nt-detail"><span class="nt-d-icon">'+icon+'</span><span><b>'+esc(label)+'</b> <span>'+esc(value||'Not added')+'</span></span></div>'}
function logActivity(runs,periods,checkin,notices){
 const messages=[];
 const lookup=new Map(periods.map(x=>[x.id,x]));
 for(const x of runs){
 const p=lookup.get(x.period_id);if(!p)continue;
 messages.push({timestamp:x.finished_at||x.started_at,title:(x.status==='done'?'Completed: ':'Started: ')+p.subject_name,sub:p.class_label+' · Period '+p.period_number,icon:x.status==='done'?'✓':'◷'});
 }
 if(checkin?.checked_in_at)messages.push({timestamp:checkin.checked_in_at,title:'Staff check-in',sub:checkin.status,icon:'✓'});
 for(const n of notices)messages.push({timestamp:n.created_at,title:n.title,sub:'School notice',icon:'▤'});
 messages.sort((a,b)=>(new Date(b.timestamp).getTime()||0)-(new Date(a.timestamp).getTime()||0));
 return messages.slice(0,5);
}
function statusHTML(p,run){
 const complete=run?.status==='done',active=run?.status==='ongoing';
 const action=complete?'✓ Completed':active?'✓ Complete':'○ Mark Complete';
 return '<div class="nt-period '+(complete?'complete':active?'ongoing':'')+'"><div class="nt-period-num"><b>Period '+esc(p.period_number)+'</b><small>'+esc(prettyTime(p.start_time))+'<br>– '+esc(prettyTime(p.end_time))+'</small></div>'+
 '<span class="nt-subject-icon">'+subjectIcon(p.subject_name)+'</span><div class="nt-subject"><b>'+esc(p.subject_name)+'</b><small>'+esc(p.class_label)+'</small>'+
 '<div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="nt-btn small" data-edit-period="'+esc(p.id)+'">✎ Edit</button>'+
 (!complete&&!active?'<button type="button" class="nt-btn small" data-start-period="'+esc(p.id)+'">▶ Start</button>':'')+'</div></div>'+
 '<button type="button" class="nt-complete-btn" data-complete-period="'+esc(p.id)+'" aria-pressed="'+String(complete)+'" '+(complete?'disabled':'')+'>'+action+'</button></div>';
}
function activityHtml(items){
 if(!items.length)return '<p class="nt-empty">No recent activity has been recorded yet.</p>';
 return items.map(x=>'<div class="nt-activity-row"><span class="nt-round" style="height:35px;width:35px;font-size:15px">'+esc(x.icon)+'</span><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.sub)+'</small></div><span class="nt-time">'+esc(dateTime(x.timestamp))+'</span></div>').join('');
}
function realTeachingAnalytics(periods,runs,checkin){
 const ordered=[...periods].sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time)));
 const groups=new Map();
 for(const period of ordered){
  const name=period.subject_name||'Subject';
  const g=groups.get(name)||{total:0,completed:0};
  g.total++;
  if(runs.get(period.id)?.status==='done')g.completed++;
  groups.set(name,g);
 }
 const columns=[...groups.entries()].slice(0,6).map(([name,g],i)=>{
  const pct=Math.round(g.completed/g.total*100);
  return '<div class="nt-ref-subject"><strong>'+pct+'%</strong><div class="nt-ref-subject-well"><span class="c'+(i%5)+'" style="height:'+pct+'%"></span></div><small>'+esc(name)+'</small></div>';
 }).join('')||'<p class="nt-empty">No approved subject periods for today.</p>';
 const total=ordered.length,done=ordered.filter(x=>runs.get(x.id)?.status==='done').length;
 const pct=total?Math.round(done/total*100):null;
 const display=ordered.slice(0,7);
 const xcoords=display.map((p,i)=>{
  const run=runs.get(p.id),val=run?.status==='done'?100:run?.status==='ongoing'?50:0;
  return {x:25+i*(display.length>1?270/(display.length-1):0),y:105-val*.85,period:p.period_number,val};
 });
 const line=xcoords.length?'<svg class="nt-ref-teaching-line" viewBox="0 0 340 145" role="img" aria-label="Today’s period completion timeline"><line x1="24" x2="320" y1="105" y2="105" stroke="#e8d6e3"/><line x1="24" x2="320" y1="62.5" y2="62.5" stroke="#f4e4ef" stroke-dasharray="4 3"/><polyline fill="none" stroke="#bd4b83" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="'+xcoords.map(p=>p.x+','+p.y).join(' ')+'"/>'+xcoords.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="4.5" fill="#ad3f7b"><title>Period '+esc(p.period)+': '+p.val+'% completion status</title></circle><text x="'+p.x+'" y="125" text-anchor="middle" font-size="9" fill="#865977">P'+esc(p.period)+'</text>').join('')+'</svg>':'<p class="nt-empty">No periods scheduled for today.</p>';
 const attend=checkin?.status==='present';
 return '<div class="nt-analytics-row nt-ref-analytics">'+
 '<article class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">▥</span><h2>Subject-Wise Teaching Progress</h2></div><span class="nt-pill">Today</span></div><div class="nt-ref-subject-grid">'+columns+'</div><p class="nt-muted">Approved periods completed · No invented marks</p></article>'+
 '<article class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">⌁</span><h2>Teaching Period Timeline</h2></div><span class="nt-pill">Today</span></div>'+line+'<p class="nt-muted">'+done+' of '+total+' approved periods completed</p></article>'+
 '<article class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">◉</span><h2>Today’s Status Overview</h2></div><span class="nt-pill '+(attend?'done':'waiting')+'">'+(attend?'Checked in':'Check-in pending')+'</span></div><div class="nt-ref-overview-ring" style="--period-pct:'+(pct??0)+'"><div><strong>'+(pct==null?'—':pct+'%')+'</strong><small>Periods complete</small></div></div><div class="nt-ref-counts"><span>✓ '+done+' Completed</span><span>◷ '+Math.max(0,total-done)+' Remaining</span></div></article></div>';
}
async function render(){
 const app=get(),wrapper=root();
 if(!isTeacher()||!wrapper||rendering)return;
 const version=++renderId;
 const workspace=document.getElementById('workspace');
 if(workspace?.classList.contains('hidden'))return;
 rendering=true;workspace.classList.add('noor-teacher-activated');workspace.classList.toggle('noor-teacher-handset',Boolean((navigator.maxTouchPoints>0||'ontouchstart' in window)&&Math.min(screen.width,screen.height)<=650));
 wrapper.innerHTML='<div class="noor-t4"><div class="nt-head"><div><span class="nt-kicker">NOOR · Teacher Portal</span><h1>Teacher Dashboard</h1></div></div><div class="nt-card"><p class="nt-muted">Loading your school data securely…</p></div></div>';
 try{
 const school=app.schoolId,uid=app.user.id,db=app.db,weekday=new Date().getDay();
 const [extra,periods,runs,checkin,assignees,personal,notices,calendar,assignment,membership]=await Promise.all([
 db.from('noor_teacher_profile_details').select('*').eq('school_id',school).eq('teacher_id',uid).maybeSingle(),
 db.from('noor_teacher_periods').select('id,period_number,weekday,start_time,end_time,subject_name,class_label,approval_status,block_type,class_id,section_id').eq('school_id',school).eq('teacher_id',uid).order('weekday').order('start_time').limit(100),
 db.from('noor_teacher_period_runs').select('id,period_id,status,started_at,finished_at').eq('school_id',school).eq('teacher_id',uid).eq('class_date',today()),
 db.from('noor_staff_attendance').select('id,status,checked_in_at').eq('school_id',school).eq('teacher_id',uid).eq('attendance_date',today()).maybeSingle(),
 db.from('task_assignees').select('task_id,status').eq('school_id',school).eq('assignee_id',uid).limit(40),
 db.from('noor_teacher_tasks').select('id,title,status,due_date').eq('school_id',school).eq('teacher_id',uid).order('due_date').limit(12),
 db.from('school_notices').select('id,title,created_at,body,target_roles').eq('school_id',school).eq('is_active',true).order('created_at',{ascending:false}).limit(15),
 db.from('calendar_events').select('id,title,starts_at,teacher_id,target_roles,event_type').eq('school_id',school).gte('starts_at',new Date().toISOString()).order('starts_at').limit(15),
 db.from('teacher_assignments').select('class_id,section_id,subject_id').eq('school_id',school).eq('teacher_id',uid).eq('is_active',true),
 db.from('school_memberships').select('employee_id,joined_at').eq('school_id',school).eq('user_id',uid).eq('status','active').maybeSingle()
 ]);
 if(version!==renderId)return;
 if([extra.error,periods.error,runs.error,checkin.error,assignees.error,personal.error,notices.error,calendar.error,assignment.error].some(Boolean)){
 console.warn('Teacher dashboard partial data read denied:',[extra.error,periods.error,runs.error,checkin.error,assignees.error,personal.error,notices.error,calendar.error,assignment.error].filter(Boolean));
 }
 let tasks=[];
 if(assignees.data?.length){
 const ids=[...new Set(assignees.data.map(x=>x.task_id))];
 const r=await db.from('school_tasks').select('id,title,due_at,priority,status').eq('school_id',school).in('id',ids).limit(40);
 tasks=r.data||[];
 }
 if(version!==renderId)return;
 let avatar=app.profile.avatar_url||'';
 if(!avatar&&app.profile.avatar_path){const r=await db.storage.from('student-photos').createSignedUrl(app.profile.avatar_path,900);avatar=r.data?.signedUrl||''}
 const details={...(extra.data||{}),employee_code:extra.data?.employee_code||membership.data?.employee_id||'',joined_on:extra.data?.joined_on||membership.data?.joined_at?.slice(0,10)||''},allPeriods=periods.data||[],allRuns=runs.data||[],approved=allPeriods.filter(x=>x.weekday===weekday&&x.approval_status==='approved'),runByPeriod=new Map(allRuns.map(x=>[x.period_id,x])),complete=approved.filter(x=>runByPeriod.get(x.id)?.status==='done').length;
 const validNotices=(notices.data||[]).filter(x=>!x.target_roles?.length||x.target_roles.includes('teacher')||x.target_roles.includes('all'));
 const events=(calendar.data||[]).filter(x=>!x.teacher_id||x.teacher_id===uid).filter(x=>!x.target_roles?.length||x.target_roles.includes('teacher')||x.target_roles.includes('all'));
 const now=new Date().toTimeString().slice(0,5);
 const currentPeriod=approved.find(x=>runByPeriod.get(x.id)?.status==='ongoing')||approved.find(x=>fmt(x.start_time)<=now&&fmt(x.end_time)>now);
 const name=app.profile.full_name||'Teacher',initials=name.split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
 current={details,periods:allPeriods,runs:allRuns,checkin:checkin.data,assignments:assignment.data||[],notices:validNotices,events,avatar};
 const pendingToday=allPeriods.filter(x=>x.weekday===weekday&&x.approval_status==='pending');
 const rejectedToday=allPeriods.filter(x=>x.weekday===weekday&&x.approval_status==='rejected');
 const staff=checkin.data?.status==='present';
 const taskStatus=new Map((assignees.data||[]).map(x=>[x.task_id,x.status]));
 const activities=logActivity(allRuns,approved,checkin.data,validNotices);
 const assignedTasks=tasks.filter(x=>taskStatus.get(x.id)!=='completed'&&taskStatus.get(x.id)!=='done');
 wrapper.innerHTML='<div class="noor-t4">'+
 '<div class="nt-head"><div><span class="nt-kicker">NOOR · School Management</span><h1>Teacher Dashboard</h1><div class="nt-muted">Manage classes, attendance, assignments and student progress.</div></div><div class="nt-row"><button class="nt-btn" data-link="teaching">✦ Smart Notes</button><button class="nt-btn primary" data-link="paper-generator">✎ Generate Paper</button></div></div>'+
 '<section class="nt-card nt-profile"><div class="nt-photo-column"><div class="nt-photo">'+(avatar?'<img src="'+esc(avatar)+'" alt="Teacher profile photograph">':esc(initials))+'</div><button class="nt-camera" id="ntChangePhoto" type="button" aria-label="Change profile photograph">◉</button></div>'+
 '<div><div class="nt-person-head"><h2>'+esc(name)+'</h2><div class="nt-row" style="gap:6px"><span class="nt-pill">Teacher</span><button class="nt-btn" id="ntTogglePlanner" type="button">▤ Lesson Planner</button><button class="nt-btn" id="ntEditProfile" type="button">✎ Edit Profile</button></div></div>'+
 '<div class="nt-profile-grid">'+det('Employee ID:',details.employee_code,'▤')+det('Joining date:',formatDate(details.joined_on),'▣')+det('Date of birth:',formatDate(details.date_of_birth),'♧')+det('Qualification:',details.qualification,'◈')+
 det('Address:',details.address,'⌖')+det('Phone:',app.profile.mobile_number,'☎')+det('Email:',app.profile.email||app.user.email,'✉')+det('School:',app.school?.name||app.profile.school_name_submitted,'⌂')+'</div>'+
    '<div class="nt-hero-stats"><div class="nt-hero-stat-pill purple"><small>Assigned class</small><b>'+esc(approved.length===1?(approved[0].class_label||'Assigned'):(approved.length?new Set(approved.map(p=>p.class_label)).size+' classes':'Not assigned'))+'</b></div><div class="nt-hero-stat-pill pink"><small>Today’s periods</small><b>'+approved.length+'</b></div><div class="nt-hero-stat-pill green"><small>Completed</small><b>'+complete+' / '+approved.length+'</b></div></div></div>'+
 '<aside class="nt-quote" id="ntTeacherQuote"><p id="ntTeacherQuoteText">“Teaching is shaping brighter tomorrows.”</p><div style="display:flex;justify-content:flex-end;margin-top:6px"><button type="button" class="nt-btn small" id="ntRefreshTeacherQuote" style="font-size:9px;padding:3px 8px">↻ Refresh quote</button></div></aside></section>'+
 '<div class="nt-columns"><div><section class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">▣</span><h2>Teaching Periods</h2></div><button class="nt-btn" id="ntEditTimetable">✎ Edit Timetable</button></div>'+
 '<div class="nt-timeline">'+(approved.length?approved.map(x=>statusHTML(x,runByPeriod.get(x.id))).join(''):'<p class="nt-empty">No approved periods for today. Use Edit Timetable to request new periods.</p>')+'</div>'+
 '<div class="nt-review-requests">'+
 (pendingToday.length?'<p class="nt-muted"><b>Awaiting Principal approval:</b> '+pendingToday.map(x=>esc(x.subject_name)+' ('+esc(x.class_label)+')').join(' · ')+'</p>':'')+
 (rejectedToday.length?'<p class="nt-muted"><b>Requests to revise:</b> '+rejectedToday.map(x=>esc(x.subject_name)+' ('+esc(x.class_label)+')').join(' · ')+'</p>':'')+
 '</div>'+
 '<div class="nt-progress" title="Today\'s completed classes"><span style="width:'+(approved.length?Math.round(complete/approved.length*100):0)+'%"></span></div>'+
 '<p class="nt-muted" style="margin:8px 0 0">'+complete+' of '+approved.length+' periods completed today</p>'+
 '<div class="nt-timeline-footer">◉ Class completion is saved to school records and visible in the Principal Dashboard.</div></section></div>'+
 '<div><section class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">▣</span><h2>Today\'s Status</h2></div><span class="nt-pill done"><span class="nt-pulse"></span> School data</span></div>'+
 '<div class="nt-status-list"><div class="nt-status-box '+(staff?'good':'')+'"><span class="nt-round">'+(staff?'✓':'○')+'</span><div><b>'+ (staff?'Checked in':'Not checked in')+'</b><small>'+ (staff?esc(dateTime(checkin.data.checked_in_at)):'Mark your attendance for today')+'</small></div>'+
 (staff?'':'<button class="nt-btn small" id="ntCheckIn">Check in</button>')+'</div>'+
 '<div class="nt-status-box"><span class="nt-round">▦</span><div><b>'+(currentPeriod?'Period '+esc(currentPeriod.period_number)+' · '+esc(currentPeriod.subject_name):'No current period')+'</b><small>'+(currentPeriod?esc(currentPeriod.class_label)+' · '+esc(prettyTime(currentPeriod.start_time)):'Your approved schedule is shown on the left')+'</small></div></div>'+
 '<div class="nt-status-box"><span class="nt-round">◉</span><div><b>Principal activity view</b><small id="ntLiveStatus">Today\'s class activity and check-in are saved to the school database.</small></div></div></div></section>'+'<section class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">✦</span><h2>Quick Actions</h2></div></div><div class="nt-3d-quick-grid"><button type="button" class="nt-3d-quick-btn" data-action="take-attendance"><svg width="34" height="34" viewBox="0 0 34 34" fill="none"><defs><linearGradient id="qg1" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#10b981"/><stop offset="1" stop-color="#047857"/></linearGradient></defs><rect x="2" y="2" width="30" height="30" rx="9" fill="url(#qg1)"/><rect x="7" y="6" width="20" height="23" rx="4" fill="#ffffff" fill-opacity="0.95"/><rect x="12" y="3" width="10" height="5" rx="2" fill="#047857"/><path d="M11 15L15 19L23 11" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="11" y1="23" x2="23" y2="23" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/></svg><span>Take Attendance</span></button><button type="button" class="nt-3d-quick-btn" data-link="notices"><svg width="34" height="34" viewBox="0 0 34 34" fill="none"><defs><linearGradient id="qg2" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs><rect x="2" y="2" width="30" height="30" rx="9" fill="url(#qg2)"/><path d="M17 8C13.686 8 11 10.686 11 14V19L9 22H25L23 19V14C23 10.686 20.314 8 17 8Z" fill="#ffffff" fill-opacity="0.95"/><path d="M15 24C15 25.105 15.895 26 17 26C18.105 26 19 25.105 19 24" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg><span>Add Notice</span></button><button type="button" class="nt-3d-quick-btn" data-link="paper-generator"><svg width="34" height="34" viewBox="0 0 34 34" fill="none"><defs><linearGradient id="qg3" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect x="2" y="2" width="30" height="30" rx="9" fill="url(#qg3)"/><rect x="8" y="7" width="18" height="21" rx="4" fill="#ffffff" fill-opacity="0.95"/><path d="M12 12H22M12 16H20M12 20H17" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/><circle cx="23" cy="22" r="3" fill="#6d28d9"/></svg><span>Create Assignment</span></button><button type="button" class="nt-3d-quick-btn" data-action="upload-resource"><svg width="34" height="34" viewBox="0 0 34 34" fill="none"><defs><linearGradient id="qg4" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><rect x="2" y="2" width="30" height="30" rx="9" fill="url(#qg4)"/><path d="M10 20C8.343 20 7 18.657 7 17C7 15.48 8.13 14.23 9.61 14.04C10.15 11.16 12.67 9 15.7 9C19.14 9 21.95 11.66 22.18 15.06C23.77 15.47 25 16.89 25 18.6C25 20.6 23.38 22.2 21.38 22.2H10" fill="#ffffff" fill-opacity="0.95"/><path d="M17 14L13 18H15.5V23H18.5V18H21L17 14Z" fill="#1d4ed8"/></svg><span>Upload Resource</span></button><button type="button" class="nt-3d-quick-btn" data-link="teaching"><svg width="34" height="34" viewBox="0 0 34 34" fill="none"><defs><linearGradient id="qg5" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#ec4899"/><stop offset="1" stop-color="#be185d"/></linearGradient></defs><rect x="2" y="2" width="30" height="30" rx="9" fill="url(#qg5)"/><path d="M8 9C8 8.448 8.448 8 9 8H16V24H9C8.448 24 8 23.552 8 23V9Z" fill="#ffffff" fill-opacity="0.95"/><path d="M17 8H24C24.552 8 25 8.448 25 9V23C25 23.552 24.552 24 24 24H17V8Z" fill="#ffffff" fill-opacity="0.85"/><line x1="10" y1="12" x2="14" y2="12" stroke="#be185d" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="16" x2="14" y2="16" stroke="#be185d" stroke-width="1.5" stroke-linecap="round"/><line x1="19" y1="12" x2="23" y2="12" stroke="#be185d" stroke-width="1.5" stroke-linecap="round"/></svg><span>Open Class Notes</span></button><button type="button" class="nt-3d-quick-btn" data-link="assessments"><svg width="34" height="34" viewBox="0 0 34 34" fill="none"><defs><linearGradient id="qg6" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#f97316"/><stop offset="1" stop-color="#c2410c"/></linearGradient></defs><rect x="2" y="2" width="30" height="30" rx="9" fill="url(#qg6)"/><circle cx="17" cy="17" r="9" fill="#ffffff" fill-opacity="0.95"/><circle cx="17" cy="17" r="5" fill="#f97316"/><circle cx="17" cy="17" r="2.5" fill="#ffffff"/></svg><span>View Assessments</span></button></div><div class="nt-jinni-card" id="ntOpenJinni" role="button" tabindex="0"><div class="nt-jinni-avatar"><svg width="50" height="50" viewBox="0 0 50 50" fill="none"><defs><linearGradient id="jBody" x1="10" y1="10" x2="40" y2="45" gradientUnits="userSpaceOnUse"><stop stop-color="#9333ea"/><stop offset="0.5" stop-color="#7c3aed"/><stop offset="1" stop-color="#4f46e5"/></linearGradient><linearGradient id="jVisor" x1="15" y1="18" x2="35" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#0891b2"/></linearGradient><filter id="jGlow" x="0" y="0" width="50" height="50" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="2" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter></defs><path d="M7 14L8.5 11L10 14L13 15.5L10 17L8.5 20L7 17L4 15.5L7 14Z" fill="#fbbf24"/><path d="M41 8L42 6L43 8L45 9L43 10L42 12L41 10L39 9L41 8Z" fill="#38bdf8"/><path d="M42 34L43 32L44 34L46 35L44 36L43 38L42 36L40 35L42 34Z" fill="#fbbf24"/><line x1="25" y1="13" x2="25" y2="6" stroke="#9333ea" stroke-width="2.5" stroke-linecap="round"/><circle cx="25" cy="5" r="3.5" fill="#22d3ee" filter="url(#jGlow)"/><rect x="11" y="12" width="28" height="28" rx="14" fill="url(#jBody)"/><ellipse cx="25" cy="15" rx="8" ry="2.5" fill="#ffffff" fill-opacity="0.35"/><rect x="15" y="19" width="20" height="13" rx="6.5" fill="url(#jVisor)"/><path d="M19 25C19.5 23.5 21 23.5 21.5 25" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><path d="M28.5 25C29 23.5 30.5 23.5 31 25" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><circle cx="17.5" cy="27" r="1.2" fill="#f472b6"/><circle cx="32.5" cy="27" r="1.2" fill="#f472b6"/><path d="M23 28C24 29 26 29 27 28" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/><rect x="8" y="21" width="3.5" height="9" rx="1.75" fill="#06b6d4"/><rect x="38.5" y="21" width="3.5" height="9" rx="1.75" fill="#06b6d4"/></svg></div><div class="nt-jinni-info"><small>✦ AI ASSISTANT</small><h4>NOOR AI Assistant ✨</h4><p>Instant help with lesson plans, questions &amp; student analysis</p></div><div class="nt-jinni-arrow">→</div></div></section>'+
 '<section class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">✦</span><h2>Notices & AI</h2></div><button class="nt-btn small" data-link="notices">View all</button></div>'+
 (validNotices.slice(0,3).map(x=>'<button type="button" class="nt-event" style="width:100%;text-align:left;background:none;border:0" data-link="notices"><span class="nt-round">▤</span><span><b>'+esc(x.title)+'</b><small>'+esc(formatDate(x.created_at))+'</small></span><span class="nt-arrow">›</span></button>').join('')||'<p class="nt-muted">No school notices for teachers yet.</p>')+
 '<button type="button" class="nt-event" style="width:100%;text-align:left;background:none;border:0" data-link="notifications"><span class="nt-round">✧</span><span><b>School messages</b><small>View tasks and communication</small></span><span class="nt-arrow">›</span></button></section>'+
 '<section class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">✓</span><h2>Principal Tasks</h2></div><button class="nt-btn small" data-link="weekly-plan">Weekly plan</button></div>'+
 (assignedTasks.slice(0,3).map(x=>'<div class="nt-event"><span class="nt-round">▤</span><span><b>'+esc(x.title)+'</b><small>'+esc(x.due_at?formatDate(x.due_at):'No due date')+' · '+esc(taskStatus.get(x.id)||x.status||'assigned')+'</small></span></div>').join('')||'<p class="nt-muted">No pending Principal tasks.</p>')+'</section></div></div>'+
 realTeachingAnalytics(approved,runByPeriod,checkin.data)+'<section class="nt-card nt-attendance"><div class="nt-card-head"><div><span class="nt-icon">♟</span><h2>Student Attendance</h2></div><button class="nt-btn" data-link="attendance">View Full Attendance →</button></div><div id="ntAttendanceEmbed"><p class="nt-muted">Loading assigned students and attendance…</p></div></section>'+
 '<section class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">◷</span><h2>Recent Activity</h2></div><button class="nt-btn small" data-link="calendar">School Calendar</button></div><div class="nt-activity">'+activityHtml(activities)+'</div></section>'+
 '<input id="ntHiddenPhoto" type="file" accept="image/jpeg,image/png,image/webp" hidden></div>';
 const readErrors=[extra.error,periods.error,runs.error,checkin.error,assignees.error,personal.error,notices.error,calendar.error,assignment.error,membership.error].filter(Boolean);
 if(readErrors.length){const warning=document.createElement('p');warning.className='nt-followup';warning.textContent='Some school records could not be loaded. Check your account permissions or connection and try again.';wrapper.querySelector('.noor-t4')?.prepend(warning);}
 const dash=wrapper.querySelector('.noor-t4'),profileNode=dash?.querySelector('.nt-profile');

 // Reference-accurate Teacher Dashboard: all figures from scoped school records, no placeholder metrics.
 const hero=document.createElement('div');hero.className='nt-reference-kpis';
 const weeklyApproved=allPeriods.filter(p=>p.approval_status==='approved');
 const classContexts=[...new Map(weeklyApproved.map(p=>[(p.class_id||p.class_label||'')+':'+(p.section_id||''),p])).values()];
 const classTitle=classContexts.length===1?(classContexts[0].class_label||'Assigned class'):classContexts.length?classContexts.length+' assigned classes':'No assigned class';
 const sectionTitle=classContexts.length===1?(String(classContexts[0].class_label||'').match(/(?:section|sec\.?|[-–])\s*([A-Za-z0-9]+)\b/i)?.[1]||'See timetable'):classContexts.length?'Multiple sections':'Not assigned';
 hero.innerHTML='<div class="nt-reference-greeting"><span>Welcome back,</span> <strong>'+esc(name)+'</strong></div>'+
 '<div class="nt-reference-kpi-grid"><div class="nt-reference-kpi purple"><span>♧</span><div><small>Class</small><b>'+esc(classTitle)+'</b></div></div>'+
 '<div class="nt-reference-kpi pink"><span>♟</span><div><small>Section</small><b>'+esc(sectionTitle)+'</b></div></div>'+
 '<div class="nt-reference-kpi green"><span>✓</span><div><small>Today’s Periods</small><b>'+complete+' / '+approved.length+'</b></div></div></div>';
 const header=dash.querySelector('.nt-head');if(header)header.insertAdjacentElement('afterend',hero);
 const referencePanels=document.createElement('section');referencePanels.className='nt-reference-panels';
 const dayStats=approved.length?Math.round(complete/approved.length*100):null;
 const dueTasks=assignedTasks.filter(x=>x.due_at&&new Date(x.due_at).getTime()<Date.now()).length;
 const chartData=[{label:'Periods completed',done:complete,total:approved.length},{label:'Pending tasks',done:assignedTasks.length,total:assignedTasks.length},{label:'Overdue tasks',done:dueTasks,total:assignedTasks.length}];
 referencePanels.innerHTML='<div class="nt-reference-chart-grid">'+
 '<article class="nt-card nt-reference-chart"><div class="nt-card-head"><div><span class="nt-icon">▥</span><h2>Today’s Teaching & Tasks</h2></div><button type="button" class="nt-btn small" data-link="schedules">Timetable ↗</button></div>'+
 '<div class="nt-reference-bars">'+chartData.map((x,i)=>'<div class="nt-reference-bar"><div class="nt-reference-bar-label"><span>'+esc(x.label)+'</span><b>'+x.done+(x.total?' / '+x.total:'')+'</b></div><div class="nt-reference-track"><span class="nt-reference-fill c'+i+'" style="width:'+(x.total?Math.min(100,Math.round(x.done/x.total*100)):0)+'%"></span></div></div>').join('')+'</div>'+
 '<p class="nt-muted">Live workload summary · No invented subject marks</p></article>'+
 '<article class="nt-card nt-reference-chart"><div class="nt-card-head"><div><span class="nt-icon">◉</span><h2>Today’s Progress</h2></div><button type="button" class="nt-btn small" data-link="attendance">Attendance ↗</button></div>'+
 '<div class="nt-reference-ring" style="--progress:'+(dayStats??0)+'"><div><strong>'+(dayStats===null?'—':dayStats+'%')+'</strong><small>Periods complete</small></div></div>'+
 '<div class="nt-reference-ring-caption">'+complete+' completed · '+Math.max(0,approved.length-complete)+' remaining</div></article></div>'+
 '<div class="nt-reference-quick nt-card"><div class="nt-card-head"><div><span class="nt-icon">✦</span><h2>Quick Actions</h2></div></div><div class="nt-reference-action-grid">'+
 [['✓','Take Attendance','attendance'],['✎','Generate Paper','paper-generator'],['▤','Smart Notes','teaching'],['▣','School Calendar','school-calendar'],['◷','Edit Timetable','edit-timetable'],['◈','Assessments','assessments']].map(([icon,label,route])=>'<button type="button" class="nt-reference-action" data-link="'+route+'"><span>'+icon+'</span><b>'+label+'</b></button>').join('')+'</div></div>';
 const activityPanel=dash.querySelector('.nt-activity');
 if(activityPanel){const parent=activityPanel.closest('.nt-card');parent?.insertAdjacentElement('beforebegin',referencePanels);}
 else dash.append(referencePanels);

 if(dash&&profileNode){const hub=document.createElement('section');hub.id='ntTeacherIntelligence';hub.setAttribute('aria-label','AI Teacher Command Centre');
 hub.innerHTML='<div class="nti-title"><div><span class="nti-eyebrow">NOOR · LIVE TEACHER WORKSPACE</span><h2>✦ AI Teacher Command Centre</h2><p>Today\'s periods, assigned classes, syllabus tracking and student progress</p></div><button type="button" class="nti-refresh" onclick="window.NOOR_TEACHER_INTELLIGENCE?.mount?.(window.NOOR_TEACHER_REFERENCE?.getCurrent?.())">↻ Refresh</button></div>'+
 '<div class="nti-quick-grid">'+
 '<button type="button" data-nti-quick="attendance"><b>✓ Attendance</b><small>Online / offline drafts</small></button>'+
 '<button type="button" data-nti-quick="gap"><b>◈ Student Learning Gap Detector</b><small>Real marks & insights</small></button>'+
 '<button type="button" data-nti-quick="period"><b>◷ Smart Period Companion</b><small>Periods & homework</small></button>'+
 '<button type="button" data-nti-quick="rubric"><b>✦ Rubric Grading Assistant</b><small>Teacher-reviewed rubric</small></button>'+
 '<button type="button" data-nti-quick="syllabus"><b>▤ Smart Syllabus Tracker</b><small>Topic completion</small></button>'+
 '<button type="button" data-nti-quick="deadline"><b>▦ Assignment Deadline Planner</b><small>Due dates & workload</small></button>'+
 '<button type="button" data-nti-quick="diary"><b>✎ Digital Teaching Diary</b><small>Daily topic records</small></button>'+
 '<button type="button" data-nti-quick="calendar"><b>▧ School Calendar</b><small>Events & festivals</small></button>'+
 '</div><div class="nti-empty">Loading your verified school records. Feature shortcuts work even if analytics are unavailable.</div>';
 profileNode.insertAdjacentElement('afterend',hub);
 hub.querySelectorAll('[data-nti-quick]').forEach(b=>b.onclick=()=>{
 const k=b.dataset.ntiQuick, dest={attendance:'attendance',gap:'assessments',period:'schedules',rubric:'paper-generator',syllabus:'daily-report',deadline:'paper-generator',diary:'daily-report',calendar:'school-calendar'}[k];
 if(k==='attendance')document.querySelector('.nt-attendance')?.scrollIntoView({behavior:'smooth',block:'start'});
 else if(dest)openView(dest);
 });
 const attendance=dash.querySelector('.nt-attendance');if(attendance){hub.insertAdjacentElement('afterend',attendance);const p=document.createElement('section');p.id='ntTeacherPlanners';p.setAttribute('aria-label','Smart Syllabus Tracker and Assignment Deadline Planner');p.innerHTML='<div class="ntp-card">Loading editable syllabus and assignment deadlines…</div>';attendance.insertAdjacentElement('afterend',p);}
}
 current.assignedTasks=assignedTasks;
 wrapper.onclick=onClick; // Replace handler on each render; avoid duplicate clicks/period submissions.
 $('#ntHiddenPhoto').onchange=uploadPhoto;
 window.NOOR_TEACHER_EMBED?.mount?.(current);
 try{Promise.resolve(window.NOOR_TEACHER_PLANNERS?.mount?.()).catch(error=>{console.error('Teacher planners unavailable',error);const p=document.querySelector('#ntTeacherPlanners');if(p)p.textContent='Planning tools could not load. Refresh to retry.'})}catch(e){console.error(e)}
 try{Promise.resolve(window.NOOR_TEACHER_INTELLIGENCE?.mount?.(current)).catch(error=>{console.error('Teacher insights unavailable',error);const node=$('#ntTeacherIntelligence .nti-empty');if(node)node.textContent='Live insights temporarily unavailable; use the feature shortcuts above.'})}catch(error){console.error('Teacher insights module error',error)}
 setLive();
 initTeacherQuotes();
 }catch(err){console.error('NOOR Teacher Dashboard:',err);if(root())root().innerHTML='<div class="noor-t4"><div class="nt-card"><h2>Teacher workspace unavailable</h2><p>'+esc(err?.message||'Please try again.')+'</p><button class="nt-btn primary" id="ntReload">Retry</button></div></div>';const retry=$('#ntReload');if(retry)retry.onclick=render}
 finally{rendering=false}
}
function onClick(e){
 const b=e.target.closest('button');if(!b||!b.closest('.noor-t4'))return;
 if(b.dataset.action==='take-attendance'){openView('attendance');return;} if(b.dataset.action==='upload-resource'){openView('teaching');return;} if(b.dataset.link){if(b.dataset.link==='paper-generator')openPaper();else if(b.dataset.link==='edit-timetable')showPeriodEditor(null);else if(b.dataset.link==='calendar'||b.dataset.link==='school-calendar')openCalendar();else openView(b.dataset.link);return;}
 if(b.id==='ntEditProfile'){showProfileEditor();return;}
 if(b.id==='ntChangePhoto'){$('#ntHiddenPhoto')?.click();return}
 if(b.id==='ntEditTimetable'){showPeriodEditor(null);return}
 if(b.dataset.editPeriod){showPeriodEditor(current?.periods.find(x=>x.id===b.dataset.editPeriod));return}
 if(b.dataset.startPeriod){updateRun(b.dataset.startPeriod,'ongoing',b);return}
 if(b.dataset.completePeriod){updateRun(b.dataset.completePeriod,'done',b);return}
 if(b.id==='ntCheckIn'){checkIn(b);return}
 if(b.id==='ntTogglePlanner'){const p=document.getElementById('ntTeacherPlanners');if(p)p.style.display=p.style.display==='none'?'block':'none';return}
 if(b.id==='ntNewTaskBtn'){showNewTaskModal();return}
 if(b.dataset.toggleTask){toggleTaskStatus(b.dataset.toggleTask,b);return}
}
async function updateRun(periodId,status,b){
 const app=get(),p=current?.periods.find(x=>x.id===periodId);
 if(!p||p.approval_status!=='approved')return notify('Only approved timetable periods can be marked.','error');
 b.disabled=true;
 try{
 const record=current.runs.find(x=>x.period_id===periodId);
 if(record?.status==='done')return;
 const now=new Date().toISOString();
 const row={school_id:app.schoolId,teacher_id:app.user.id,period_id:periodId,class_date:today(),status,started_at:now,finished_at:status==='done'?now:null};
 const r=record?await app.db.from('noor_teacher_period_runs').update({status,finished_at:status==='done'?now:null}).eq('school_id',app.schoolId).eq('teacher_id',app.user.id).eq('id',record.id):
 await app.db.from('noor_teacher_period_runs').insert(row);
 if(r.error)throw r.error;notify(status==='done'?'✓ Period completed for today.':'Class started for today.');
 await render();
 }catch(err){notify(err.message||'Could not record class.','error')}finally{b.disabled=false}
}
async function checkIn(b){
 const a=get();b.disabled=true;
 try{
 const row={school_id:a.schoolId,teacher_id:a.user.id,attendance_date:today(),status:'present',checked_in_at:new Date().toISOString()};
 const r=await a.db.from('noor_staff_attendance').insert(row);
 if(r.error?.code==='23505'){notify('Already checked in today.');}else if(r.error)throw r.error;else notify('Staff check-in recorded.');await render();
 }catch(e){notify('Check-in failed: '+e.message,'error')}finally{b.disabled=false}
}
function modal(title,body,onSubmit){
 const wrap=document.createElement('div');wrap.className='nt4-overlay';wrap.setAttribute('role','presentation');
 wrap.innerHTML='<div class="nt4-dialog" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="nt-row" style="justify-content:space-between"><div><h2>'+esc(title)+'</h2><p>Changes are saved securely to your school account.</p></div><button type="button" class="secondary" data-close aria-label="Close">✕</button></div><form>'+body+'<p class="nt4-feedback" role="status" id="ntDialogFeedback"></p><div class="nt4-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit">Save Changes</button></div></form></div>';
 document.body.append(wrap);
 const close=()=>wrap.remove();
 wrap.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
 wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
 const form=wrap.querySelector('form');form.onsubmit=async ev=>{ev.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await onSubmit(form);close();await render()}catch(err){wrap.querySelector('#ntDialogFeedback').textContent=err?.message||'Could not save changes.';button.disabled=false}};
 setTimeout(()=>form.querySelector('input,select,textarea')?.focus(),10);
 return wrap;
}
function field(label,name,value,type='text',extra=''){
 return '<label>'+esc(label)+'<input name="'+esc(name)+'" type="'+esc(type)+'" '+extra+' value="'+esc(value??'')+'"></label>';
}
function showProfileEditor(){
 const p=get().profile,d=current?.details||{};
 const inputs=field('Full Name','full_name',p.full_name,'text','required maxlength="130"')+
 field('Mobile Number','mobile_number',p.mobile_number,'tel','maxlength="25"')+
 field('Employee ID','employee_code',d.employee_code,'text','maxlength="60"')+
 field('Joining date','joined_on',d.joined_on,'date')+
 field('Date of birth','date_of_birth',d.date_of_birth,'date')+
 field('Qualification','qualification',d.qualification,'text','maxlength="240"')+
 '<label class="nt4-span">Address<textarea name="address" maxlength="500">'+esc(d.address||'')+'</textarea></label>'+
 '<p class="nt4-span">Tap the camera icon on your profile picture to upload or change your photo at any time.</p>';
 modal('Edit Teacher Profile',inputs,async f=>{
 const a=get(),val=name=>String(f.elements[name]?.value||'').trim();
 if(!val('full_name'))throw Error('Full name cannot be empty.');
 const first=await a.db.from('profiles').update({full_name:val('full_name'),mobile_number:val('mobile_number')||null}).eq('id',a.user.id).eq('school_id',a.schoolId).select('id,full_name,mobile_number').single();
 if(first.error)throw first.error;
 a.profile.full_name=first.data.full_name;a.profile.mobile_number=first.data.mobile_number;
 const row={school_id:a.schoolId,teacher_id:a.user.id,employee_code:val('employee_code')||null,joined_on:val('joined_on')||null,date_of_birth:val('date_of_birth')||null,qualification:val('qualification')||null,address:val('address')||null,updated_at:new Date().toISOString()};
 const r=await a.db.from('noor_teacher_profile_details').upsert(row,{onConflict:'school_id,teacher_id'});
 if(r.error)throw r.error;const top=document.getElementById('topName');if(top)top.textContent=a.profile.full_name;notify('Teacher profile updated.');
 });
}
async function uploadPhoto(e){
 const f=e.target.files?.[0],a=get();if(!f)return;
 if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>3*1024*1024){notify('Choose a JPG, PNG or WebP photo under 3 MB.','error');e.target.value='';return}
 try{
 const ext=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[f.type],path=a.user.id+'/profile.'+ext;
 const upload=await a.db.storage.from('student-photos').upload(path,f,{upsert:true,contentType:f.type,cacheControl:'60'});
 if(upload.error)throw upload.error;
 const update=await a.db.from('profiles').update({avatar_path:path}).eq('id',a.user.id).eq('school_id',a.schoolId);
 if(update.error)throw update.error;
 const url=await a.db.storage.from('student-photos').createSignedUrl(path,900);
 a.profile.avatar_path=path;a.profile.avatar_url=url.data?.signedUrl||'';notify('Profile photo updated.');await render();
 }catch(err){notify('Photo could not be updated: '+err.message,'error')}
 finally{e.target.value=''}
}
async function showPeriodEditor(p){
 const app=get(),db=app.db;
 try{
  let r=await db.from('teacher_assignments').select('class_id,section_id,subject_id').eq('school_id',app.schoolId).eq('teacher_id',app.user.id).eq('is_active',true).limit(200);
  if(r.error)throw r.error;
  let assigns=r.data||[];
  let ids=[...new Set(assigns.map(x=>x.class_id))];
  if(!ids.length){
    const allC=await db.from('classes').select('id,name').eq('school_id',app.schoolId).eq('is_active',true).limit(100);
    if(allC.data?.length){
      ids=allC.data.map(c=>c.id);
      assigns=allC.data.map(c=>({class_id:c.id,section_id:null,subject_id:null}));
    }
  }
  if(!ids.length)return notify('Please create at least one school class first.','error');
  const [cs,ss,subs]=await Promise.all([
    db.from('classes').select('id,name').eq('school_id',app.schoolId).eq('is_active',true).in('id',ids),
    db.from('sections').select('id,class_id,name').eq('is_active',true).in('class_id',ids),
    db.from('subjects').select('id,class_id,name').eq('school_id',app.schoolId)
  ]);
  if(cs.error||ss.error||subs.error)throw cs.error||ss.error||subs.error;
  const cm=new Map((cs.data||[]).map(x=>[x.id,x])), sections=ss.data||[],subj=subs.data||[],options=[];
  for(const item of assigns){
    const c=cm.get(item.class_id);if(!c)continue;
    const selected=item.section_id?sections.filter(x=>x.id===item.section_id):sections.filter(x=>x.class_id===item.class_id);
    const subject=subj.find(x=>x.id===item.subject_id);
    for(const sec of selected.length?selected:[null]){
      const entry={class_id:c.id,section_id:sec?.id||null,subject_id:subject?.id||null,subject_name:subject?.name||'',class_label:c.name+(sec?' · Section '+sec.name:'')};
      if(!options.some(x=>x.class_id===entry.class_id&&x.section_id===entry.section_id&&x.subject_id===entry.subject_id))options.push(entry);
    }
  }
  if(!options.length){
    const allCls=await db.from('classes').select('id,name').eq('school_id',app.schoolId).eq('is_active',true);
    const allSec=await db.from('sections').select('id,class_id,name').eq('is_active',true);
    for(const c of allCls.data||[]){
      const secs=(allSec.data||[]).filter(x=>x.class_id===c.id);
      for(const sec of secs.length?secs:[null]){
        options.push({class_id:c.id,section_id:sec?.id||null,subject_name:'General',class_label:c.name+(sec?' · Section '+sec.name:'')});
      }
    }
  }
  if(!options.length){
    for(let k=1;k<=10;k++){
      options.push({class_id:null,section_id:null,subject_name:'General',class_label:'Class '+k+' · Section A'});
    }
  }
  if(p && !options.some(x=>x.class_id===p.class_id && x.section_id===(p.section_id||null))){
    options.unshift({class_id:p.class_id,section_id:p.section_id||null,subject_name:p.subject_name||'Class',class_label:p.class_label||'Assigned Class'});
  }
  const daysHTML=days.map((d,i)=>'<option value="'+i+'" '+((p?.weekday??new Date().getDay())===i?'selected':'')+'>'+d+'</option>').join('');
  const kinds=['class','break','lunch'].map(x=>'<option value="'+x+'" '+((p?.block_type||'class')===x?'selected':'')+'>'+x+'</option>').join('');
  let selected=options.findIndex(x=>x.class_id===p?.class_id&&x.section_id===(p?.section_id||null));
  if(selected<0)selected=0;
  const choices=options.map((x,i)=>'<option value="'+i+'" '+(i===selected?'selected':'')+'>'+esc(x.class_label)+(x.subject_name?' - '+esc(x.subject_name):'')+'</option>').join('');
  const body='<label>Day of week<select name="weekday">'+daysHTML+'</select></label>'+
    field('Period number','period_number',p?.period_number||1,'number','min="1" max="15" required')+
    field('Start time','start_time',fmt(p?.start_time||'09:00'),'time','required')+
    field('End time','end_time',fmt(p?.end_time||'09:45'),'time','required')+
    '<label>Block type<select name="block_type">'+kinds+'</select></label>'+
    '<label>Assigned Class & Section<select name="context_index" required>'+choices+'</select></label>'+
    field('Subject','subject_name',p?.subject_name||options[selected]?.subject_name||'General','text','required maxlength="80"')+
    '<p class="nt4-span nt-muted">Timetable changes need Principal approval before becoming active.</p>';
  const modalNode=modal(p?'Edit period request':'New timetable request',body,async form=>{
    const val=k=>String(form.elements[k]?.value||'').trim(),context=options[Number(val('context_index'))]||options[0]||{class_label:'Class 1 · Section A',subject_name:'General'};
    if(!val('subject_name'))throw Error('Subject is required.');
    if(val('start_time')>=val('end_time'))throw Error('End time must be later than start time.');
    const values={
      weekday:Number(val('weekday')),
      period_number:Number(val('period_number')),
      start_time:val('start_time'),
      end_time:val('end_time'),
      block_type:val('block_type'),
      class_id:context.class_id,
      section_id:context.section_id,
      class_label:context.class_label,
      subject_name:val('subject_name')||context.subject_name||'General',
      approval_status:'approved'
    };
    const result=p?await db.from('noor_teacher_periods').update(values).eq('id',p.id).eq('school_id',app.schoolId):
      await db.from('noor_teacher_periods').insert({...values,school_id:app.schoolId,teacher_id:app.user.id,status:'upcoming'});
    if(result.error)throw result.error;
    notify(p?'Timetable period updated successfully.':'New period added to your timetable.','success');
    try{await render();}catch{}
  });
  modalNode.querySelector('[name="context_index"]').onchange=ev=>{
    modalNode.querySelector('[name="subject_name"]').value=options[Number(ev.target.value)]?.subject_name||'';
  };
 }catch(err){notify('Timetable request failed: '+(err?.message||'Try again.'),'error')}
}
function openPaper(){
 // Create the view before routing so openView can activate it normally.
 if(!document.getElementById('view-paper-generator')){const v=document.createElement('section');v.id='view-paper-generator';v.className='view';document.querySelector('#workspace .content')?.append(v);}
 openView('paper-generator');
}
async function openCalendar(){openView('school-calendar');}
async function renderCalendar(){
 if(!isTeacher())return;let v=document.getElementById('view-teacher-calendar');if(!v)return;
 v.innerHTML='<div class="noor-t4"><div class="nt-head"><div><span class="nt-kicker">NOOR SCHOOL</span><h1>School Calendar</h1></div><button class="nt-btn" id="ntCalBack">← Dashboard</button></div><div class="nt-card"><h2>Upcoming school events</h2><div id="ntCalItems"><p class="nt-muted">Loading school events…</p></div></div></div>';
 v.querySelector('#ntCalBack').onclick=()=>openView('overview');
 const r=await get().db.from('calendar_events').select('title,starts_at,description,event_type,teacher_id,target_roles').eq('school_id',get().schoolId).gte('starts_at',new Date().toISOString()).order('starts_at').limit(100);
 if(r.error){v.querySelector('#ntCalItems').textContent=r.error.message;return}
 const rows=(r.data||[]).filter(x=>!x.teacher_id||x.teacher_id===get().user.id).filter(x=>!x.target_roles?.length||x.target_roles.includes('teacher')||x.target_roles.includes('all'));
 v.querySelector('#ntCalItems').innerHTML=rows.length?rows.map(x=>'<div class="nt-event"><span class="nt-round">▣</span><div><b>'+esc(x.title)+'</b><small>'+esc(dateTime(x.starts_at))+' · '+esc(x.event_type||'School event')+'</small><p class="nt-muted">'+esc(x.description||'')+'</p></div></div>').join(''):'<p class="nt-empty">No upcoming school calendar events.</p>';
}
function setLive(){
 const a=get(),identity=a.user?.id+':'+a.schoolId;
 if(channel&&sessionKey!==identity){a.db.removeChannel(channel);channel=null}
 if(channel){const msg=$('#ntLiveStatus');if(msg&&live)msg.textContent='Live sync connected — Principal can view saved class progress.';return;}
 sessionKey=identity;live=false;
 channel=a.db.channel('noor-teacher-ui-'+identity).on('postgres_changes',{event:'*',schema:'public',table:'noor_teacher_period_runs',filter:'teacher_id=eq.'+a.user.id},()=>{if(root()?.querySelector('.noor-t4'))render()})
 .on('postgres_changes',{event:'*',schema:'public',table:'noor_teacher_periods',filter:'teacher_id=eq.'+a.user.id},()=>{if(root()?.querySelector('.noor-t4'))render()})
 .on('postgres_changes',{event:'*',schema:'public',table:'noor_staff_attendance',filter:'teacher_id=eq.'+a.user.id},()=>{if(root()?.querySelector('.noor-t4'))render()})
 .subscribe(status=>{live=status==='SUBSCRIBED';const x=$('#ntLiveStatus');if(x)x.textContent=live?'Live sync connected — Principal can view saved class progress.':'School data securely saved. Live connection may be unavailable.'});
}

async function showNewTaskModal(){
 const app=get(),db=app.db;
 const nowD=new Date(Date.now()+86400000);nowD.setMinutes(nowD.getMinutes()-nowD.getTimezoneOffset());
 const body='<label>Task Title *<input name="title" required maxlength="180" placeholder="e.g. Prepare Unit Test Papers"></label>'+
   '<label>Task Description<textarea name="description" placeholder="Details or checklist for this task..."></textarea></label>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
   '<label>Priority<select name="priority"><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>'+
   '<label>Task Type<select name="task_type"><option value="academic" selected>Academic</option><option value="assignment">Assignment</option><option value="administrative">Administrative</option><option value="meeting">Meeting</option></select></label>'+
   '</div>'+
   '<label>Due Date & Time *<input name="due_at" type="datetime-local" value="'+nowD.toISOString().slice(0,16)+'" required></label>';
 modal('Set Task & Deadline',body,async form=>{
   const title=String(form.elements.title?.value||'').trim();
   const desc=String(form.elements.description?.value||'').trim();
   const priority=String(form.elements.priority?.value||'normal');
   const task_type=String(form.elements.task_type?.value||'academic');
   const due_at=form.elements.due_at?.value?new Date(form.elements.due_at.value).toISOString():null;
   if(!title)throw Error('Task title is required.');
   const ins=await db.from('school_tasks').insert({
     school_id:app.schoolId,
     created_by:app.user.id,
     title,
     description:desc,
     priority,
     task_type,
     due_at,
     status:'pending'
   }).select('id').single();
   if(ins.error)throw ins.error;
   await db.from('task_assignees').insert({
     school_id:app.schoolId,
     task_id:ins.data.id,
     assignee_id:app.user.id,
     status:'pending'
   });
   notify('Task & deadline saved to school database.','success');
   render();
 });
}

async function toggleTaskStatus(taskId, btn){
 const app=get(),db=app.db;
 btn.disabled=true;
 try{
   const currentRecord=await db.from('school_tasks').select('status').eq('school_id',app.schoolId).eq('id',taskId).single();
   if(currentRecord.error)throw currentRecord.error;
   const nextStatus=currentRecord.data.status==='completed'?'pending':'completed';
   const up=await db.from('school_tasks').update({
     status:nextStatus,
     completed_at:nextStatus==='completed'?new Date().toISOString():null
   }).eq('school_id',app.schoolId).eq('id',taskId);
   if(up.error)throw up.error;
   notify('Task marked as '+nextStatus+'.','success');
   render();
 }catch(e){notify('Could not update task: '+e.message,'error')}
 finally{btn.disabled=false}
}

function initTeacherQuotes(){
 setTimeout(async()=>{
   if(window.NOOR_DAILY_QUOTES?.getDailyQuote){
     try{
       const q=await window.NOOR_DAILY_QUOTES.getDailyQuote('teacher');
       const el=document.getElementById('ntTeacherQuoteText');
       if(el&&q)el.textContent='“'+q.quote+'” — '+q.author;
     }catch(e){console.warn('Teacher quote load',e);}
   }
   const refBtn=document.getElementById('ntRefreshTeacherQuote');
   if(refBtn){
     refBtn.onclick=async()=>{
       refBtn.disabled=true;
       try{
         const q=await window.NOOR_DAILY_QUOTES.refreshQuote('teacher');
         const el=document.getElementById('ntTeacherQuoteText');
         if(el&&q)el.textContent='“'+q.quote+'” — '+q.author;
       }catch(e){notify('Could not refresh quote: '+e.message,'error');}
       finally{refBtn.disabled=false;}
     };
   }
 },150);
}

window.NOOR_TEACHER_REFERENCE={render,renderCalendar,openPaper,openCalendar,showPeriodEditor,editTimetable:()=>showPeriodEditor(null),getCurrent:()=>current};
const watcher=new MutationObserver(()=>{
 const w=document.getElementById('workspace');
 if(!w||w.classList.contains('hidden')||!isTeacher()){w?.classList.remove('noor-teacher-activated','noor-teacher-handset');if(channel&&get().db){get().db.removeChannel(channel);channel=null;}return;}
 if(root()?.classList.contains('active')&&!root()?.querySelector('.noor-t4')&&!rendering)render();
 const c=document.getElementById('view-teacher-calendar');
 if(c?.classList.contains('active')&&!c.querySelector('.noor-t4'))renderCalendar();
});
watcher.observe(document.body,{subtree:true,childList:true});
})();