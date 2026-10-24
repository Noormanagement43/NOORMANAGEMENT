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
 db.from('noor_teacher_periods').select('id,period_number,weekday,start_time,end_time,subject_name,class_label,approval_status,block_type,class_id,section_id,subject_id').eq('school_id',school).eq('teacher_id',uid).order('weekday').order('start_time').limit(100),
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
 '<div><div class="nt-person-head"><h2>'+esc(name)+'</h2><div class="nt-row"><span class="nt-pill">Teacher</span><button class="nt-btn" id="ntEditProfile">✎ Edit Profile</button></div></div>'+
 '<div class="nt-profile-grid">'+det('Employee ID:',details.employee_code,'▤')+det('Joining date:',formatDate(details.joined_on),'▣')+det('Date of birth:',formatDate(details.date_of_birth),'♧')+det('Qualification:',details.qualification,'◈')+
 det('Address:',details.address,'⌖')+det('Phone:',app.profile.mobile_number,'☎')+det('Email:',app.profile.email||app.user.email,'✉')+det('School:',app.school?.name||app.profile.school_name_submitted,'⌂')+'</div></div>'+
 '<aside class="nt-quote"><p>Teaching is shaping brighter tomorrows.</p></aside></section>'+
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
 '<div class="nt-status-box"><span class="nt-round">◉</span><div><b>Principal activity view</b><small id="ntLiveStatus">Today\'s class activity and check-in are saved to the school database.</small></div></div></div></section>'+
 '<section class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">✦</span><h2>Notices & AI</h2></div><button class="nt-btn small" data-link="notices">View all</button></div>'+
 (validNotices.slice(0,3).map(x=>'<button type="button" class="nt-event" style="width:100%;text-align:left;background:none;border:0" data-link="notices"><span class="nt-round">▤</span><span><b>'+esc(x.title)+'</b><small>'+esc(formatDate(x.created_at))+'</small></span><span class="nt-arrow">›</span></button>').join('')||'<p class="nt-muted">No school notices for teachers yet.</p>')+
 '<button type="button" class="nt-event" style="width:100%;text-align:left;background:none;border:0" data-link="notifications"><span class="nt-round">✧</span><span><b>School messages</b><small>View tasks and communication</small></span><span class="nt-arrow">›</span></button></section>'+
 '<section class="nt-card"><div class="nt-card-head"><div><span class="nt-icon">✓</span><h2>Principal Tasks</h2></div><button class="nt-btn small" data-link="weekly-plan">Weekly plan</button></div>'+
 (assignedTasks.slice(0,3).map(x=>'<div class="nt-event"><span class="nt-round">▤</span><span><b>'+esc(x.title)+'</b><small>'+esc(x.due_at?formatDate(x.due_at):'No due date')+' · '+esc(taskStatus.get(x.id)||x.status||'assigned')+'</small></span></div>').join('')||'<p class="nt-muted">No pending Principal tasks.</p>')+'</section></div></div>'+
 '<section class="nt-card nt-attendance"><div class="nt-card-head"><div><span class="nt-icon">♟</span><h2>Student Attendance</h2></div><button class="nt-btn" data-link="attendance">View Full Attendance →</button></div><div id="ntAttendanceEmbed"><p class="nt-muted">Loading assigned students and attendance…</p></div></section>'+
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
 }catch(err){console.error('NOOR Teacher Dashboard:',err);if(root())root().innerHTML='<div class="noor-t4"><div class="nt-card"><h2>Teacher workspace unavailable</h2><p>'+esc(err?.message||'Please try again.')+'</p><button class="nt-btn primary" id="ntReload">Retry</button></div></div>';const retry=$('#ntReload');if(retry)retry.onclick=render}
 finally{rendering=false}
}
function onClick(e){
 const b=e.target.closest('button');if(!b||!b.closest('.noor-t4'))return;
 if(b.dataset.link){if(b.dataset.link==='paper-generator')openPaper();else if(b.dataset.link==='edit-timetable')showPeriodEditor(null);else if(b.dataset.link==='calendar'||b.dataset.link==='school-calendar')openCalendar();else openView(b.dataset.link);return;}
 if(b.id==='ntEditProfile'){showProfileEditor();return;}
 if(b.id==='ntChangePhoto'){$('#ntHiddenPhoto')?.click();return}
 if(b.id==='ntEditTimetable'){showPeriodEditor(null);return}
 if(b.dataset.editPeriod){showPeriodEditor(current?.periods.find(x=>x.id===b.dataset.editPeriod));return}
 if(b.dataset.startPeriod){updateRun(b.dataset.startPeriod,'ongoing',b);return}
 if(b.dataset.completePeriod){updateRun(b.dataset.completePeriod,'done',b);return}
 if(b.id==='ntCheckIn'){checkIn(b);return}
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
  const r=await db.from('teacher_assignments').select('class_id,section_id,subject_id').eq('school_id',app.schoolId).eq('teacher_id',app.user.id).eq('is_active',true).limit(200);
  if(r.error)throw r.error;
  if(!r.data?.length)return notify('Principal must assign your classes and sections first.','error');
  const ids=[...new Set(r.data.map(x=>x.class_id))];
  const [cs,ss,subs]=await Promise.all([
    db.from('classes').select('id,name').eq('school_id',app.schoolId).eq('is_active',true).in('id',ids),
    db.from('sections').select('id,class_id,name').eq('is_active',true).in('class_id',ids),
    db.from('subjects').select('id,class_id,name').eq('school_id',app.schoolId)
  ]);
  if(cs.error||ss.error||subs.error)throw cs.error||ss.error||subs.error;
  const cm=new Map((cs.data||[]).map(x=>[x.id,x])), sections=ss.data||[],subj=subs.data||[],options=[];
  for(const item of r.data){
    const c=cm.get(item.class_id);if(!c)continue;
    const selected=item.section_id?sections.filter(x=>x.id===item.section_id):sections.filter(x=>x.class_id===item.class_id);
    const subject=subj.find(x=>x.id===item.subject_id);
    for(const sec of selected.length?selected:[null]){
      const entry={class_id:c.id,section_id:sec?.id||null,subject_id:subject?.id||null,subject_name:subject?.name||'',class_label:c.name+(sec?' · Section '+sec.name:'')};
      if(!options.some(x=>x.class_id===entry.class_id&&x.section_id===entry.section_id&&x.subject_id===entry.subject_id))options.push(entry);
    }
  }
  if(!options.length)throw Error('No active assigned classes.');
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
    field('Subject','subject_name',p?.subject_name||options[selected].subject_name,'text','required maxlength="80"')+
    '<p class="nt4-span nt-muted">Timetable changes need Principal approval before becoming active.</p>';
  const modalNode=modal(p?'Edit period request':'New timetable request',body,async form=>{
    const val=k=>String(form.elements[k]?.value||'').trim(),context=options[Number(val('context_index'))];
    if(!context)throw Error('Choose an assigned school class.');
    if(!val('subject_name'))throw Error('Subject is required.');
    if(val('start_time')>=val('end_time'))throw Error('End time must be later than start time.');
    const values={weekday:Number(val('weekday')),period_number:Number(val('period_number')),start_time:val('start_time'),end_time:val('end_time'),block_type:val('block_type'),
      class_id:context.class_id,section_id:context.section_id,subject_id:context.subject_id,class_label:context.class_label,subject_name:context.subject_name||val('subject_name'),approval_status:'pending'};
    const result=p?await db.from('noor_teacher_periods').update(values).eq('id',p.id).eq('school_id',app.schoolId).eq('teacher_id',app.user.id):
      await db.from('noor_teacher_periods').insert({...values,school_id:app.schoolId,teacher_id:app.user.id,status:'upcoming'});
    if(result.error)throw result.error;
    notify('Timetable request sent for Principal approval.','success');
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
window.NOOR_TEACHER_REFERENCE={render,renderCalendar,openPaper,openCalendar,getCurrent:()=>current};
const watcher=new MutationObserver(()=>{
 const w=document.getElementById('workspace');
 if(!w||w.classList.contains('hidden')||!isTeacher()){w?.classList.remove('noor-teacher-activated','noor-teacher-handset');if(channel&&get().db){get().db.removeChannel(channel);channel=null;}return;}
 if(root()?.classList.contains('active')&&!root()?.querySelector('.noor-t4')&&!rendering)render();
 const c=document.getElementById('view-teacher-calendar');
 if(c?.classList.contains('active')&&!c.querySelector('.noor-t4'))renderCalendar();
});
watcher.observe(document.body,{subtree:true,childList:true});
})();