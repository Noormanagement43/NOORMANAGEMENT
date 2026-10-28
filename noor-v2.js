/* New NOOR standalone workspace; reads ONLY the new institution-id Supabase.
   This runs independently of the legacy school-id site. No fake KPI data.
 */
(function(){
'use strict';
const conf=window.NOOR_V2_CONFIG;
const $=selector=>document.querySelector(selector);
const root=$('#v2Root'),logout=$('#v2Logout'),toast=$('#v2Toast');
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const icons=window.NOOR_SUBJECT_ICONS;
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const managementRoles=['principal','school_admin','university_admin','academic_admin'];
const teacherRoles=['teacher','faculty'];
const studentRoles=['student','university_student'];
let db=null,authMode='signin',state={user:null,profile:null,groups:[],periods:[],memberships:[],institution:null,membership:null,tab:'home',photoUrl:null,attendance:[],enrollments:[],staffNames:{}};
let channel=null,bootstrapId=0,loading=false,liveRefreshing=false;
function say(message,error=false){toast.textContent=message;toast.hidden=false;toast.dataset.error=error?'yes':'no';setTimeout(()=>{if(toast.textContent===message)toast.hidden=true},5200)}
function err(error){return error?.message||String(error)||'An unexpected error occurred.'}
function button(text,action,primary=false){return '<button type="button" class="v2-btn '+(primary?'v2-primary':'v2-outline')+'" data-action="'+action+'">'+text+'</button>'}
function titleBlock(title,kicker='',description=''){return '<div class="v2-title"><div><span class="v2-kicker">'+escapeHTML(kicker)+'</span><h1>'+escapeHTML(title)+'</h1><p>'+escapeHTML(description)+'</p></div></div>'}
function activeUserId(){return state.user?.id}
function canManage(){return managementRoles.includes(state.membership?.role)}
function canSchedule(){return teacherRoles.includes(state.membership?.role)}
function isStudent(){return studentRoles.includes(state.membership?.role)}
function schoolClock(){
 const tz=state.institution?.timezone||'Asia/Kolkata';
 try{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const find=k=>parts.find(p=>p.type===k)?.value||'';
  return {weekday:days.indexOf(find('weekday')),time:find('hour')+':'+find('minute')};
 }catch{return{weekday:new Date().getDay(),time:String(new Date().getHours()).padStart(2,'0')+':'+String(new Date().getMinutes()).padStart(2,'0')}}
}
function isScheduledNow(row){
 const clock=schoolClock();
 return clock.weekday===Number(row.weekday)&&String(row.start_time).slice(0,5)<=clock.time&&String(row.end_time).slice(0,5)>clock.time;
}
function staffName(row){return state.staffNames?.[row.teacher_membership_id]||'Teacher'}
function viewGroups(){
 if(!isStudent())return state.groups;
 const assigned=new Set(state.enrollments.map(m=>m.group_id));
 const children=state.groups.filter(g=>assigned.has(g.id));
 for(const g of children)if(g.parent_group_id)assigned.add(g.parent_group_id);
 return state.groups.filter(g=>assigned.has(g.id));
}
function noData(text){return '<div class="v2-empty"><span aria-hidden="true">☁️</span><p>'+escapeHTML(text)+'</p></div>'}
function subject(name){return icons?.display(name)||{icon:'📚',tone:'general',hue:230,initials:'?',matched:false}}
function symbol(name){const x=subject(name);return '<span class="v2-subject-symbol" style="--sh:'+x.hue+'" title="'+escapeHTML(x.label||name)+'">'+x.icon+(x.matched?'':'<small>'+escapeHTML(x.initials||'?')+'</small>')+'</span>'}
function renderAuth(){
 state.tab='home';logout.hidden=true;
 root.innerHTML='<div class="v2-auth-shell"><section class="v2-auth-showcase"><div class="v2-kicker">SECURE LOGIN · SCHOOL & UNIVERSITY</div><h1>Inspire learning.<br><em>Organise everything.</em></h1><p>NOOR for schools and universities. Every account has its own picture, timetable, class records and permissions.</p><div class="v2-showcase-art"><span>✦</span><span>📘</span><span>🌿</span><span>🧮</span></div></section>'+
 '<section class="v2-panel v2-auth-card"><h2>'+(authMode==='signup'?'Create NOOR account':'Welcome to NOOR')+'</h2><p>Sign in to your NOOR school or university account.</p>'+
 '<form id="v2AuthForm" class="v2-form">'+(authMode==='signup'?'<label>Full name<input name="name" required autocomplete="name" maxlength="120"></label>':'')+
 '<label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required minlength="8" autocomplete="'+(authMode==='signin'?'current-password':'new-password')+'"></label>'+
 '<button class="v2-btn v2-primary v2-full" type="submit">'+(authMode==='signin'?'Sign in securely':'Register account')+'</button></form>'+
 '<button type="button" class="v2-text-btn" data-action="switch-auth">'+(authMode==='signin'?'New here? Create an account':'Already registered? Sign in')+'</button>'+
 '<p class="v2-footnote">School membership and profile photos are isolated using Supabase RLS. You will see only real records.</p></section></div>';
}
function renderOnboarding(){
 logout.hidden=false;
 root.innerHTML=titleBlock('Welcome to NOOR','ACCOUNT CONFIRMED','Your account does not have an active school or university membership yet.')+
 '<div class="v2-onboard-grid"><section class="v2-panel"><h2>Register your institution</h2><p>If this is a new school or university, create it here. Its Principal account activates immediately.</p>'+
 '<form id="v2CreateInstitution" class="v2-form"><label>School / University name<input name="name" maxlength="160" required placeholder="Institution official name"></label>'+
 '<label>Institution type<select name="type"><option value="school">School</option><option value="university">University / College</option></select></label>'+
 '<label>Unique short ID<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80" required placeholder="example-school"></label>'+
 '<button class="v2-btn v2-primary" type="submit">Create institution & open dashboard</button></form></section>'+
 '<section class="v2-panel v2-guide"><span class="v2-guide-icon">🔐</span><h2>Already cloned your school?</h2><p>If your school already exists, ask its administrator to invite or activate your account. Only your authorised institution will appear here.</p><p>We will not invent classes, students or attendance to fill the dashboard.</p>'+button('Re-check connected data','refresh',true)+'</section></div>';
}
function pickName(){return state.profile?.full_name||state.user?.email?.split('@')[0]||'NOOR member'}
function dateTime(t){return t?new Date(t).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'—'}
function iconMenu(){return [
 ['home','⌂','Dashboard'],
 ['timetable','◷',isStudent()?'My Timetable':canSchedule()?'My Timetable':'School Timetable'],
 ...(isStudent()?[['progress','▥','My Progress']]:[]),
 ['classes','▦',isStudent()?'My Classes':'Classes'],
 ['profile','◉','My Profile']
 ].map(([id,ico,label])=>'<button type="button" data-tab="'+id+'" class="'+(id===state.tab?'active':'')+'"><span>'+ico+'</span><small>'+label+'</small></button>').join('')}
function shell(body){
 const inst=state.institution,role=state.membership?.role||'Member';
 const caption=role.replaceAll('_',' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
 logout.hidden=false;
 root.innerHTML='<div class="v2-layout"><aside class="v2-sidebar"><div class="v2-institution"><span class="v2-logo">✦</span><div><strong>'+escapeHTML(inst?.name||'NOOR')+'</strong><small>'+escapeHTML(inst?.institution_type||'School')+' · '+escapeHTML(caption)+'</small></div></div>'+
 '<nav aria-label="Workspace navigation">'+iconMenu()+'</nav><div class="v2-side-footer">NOOR Management<br>Secure institution workspaces</div></aside>'+
 '<div class="v2-content"><div class="v2-live-status" id="v2LiveStatus" data-connected="'+(state.realtimeStatus==='SUBSCRIBED'?'yes':'no')+'">'+(state.realtimeStatus==='SUBSCRIBED'?'● Live connected':'◷ Auto-syncing')+'</div>'+body+'</div></div><nav class="v2-mobile-nav" aria-label="Phone workspace navigation">'+iconMenu()+'</nav>';
}
function profileHero(){
 const name=pickName(),user=state.user;
 return '<div class="v2-profile-hero"><div class="v2-profile-photo" aria-label="Account profile photograph">'+(state.photoUrl?'<img alt="'+escapeHTML(name)+'" src="'+escapeHTML(state.photoUrl)+'">':'<span>'+escapeHTML(name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join(''))+'</span>')+'</div>'+
 '<div class="v2-profile-details"><span class="v2-kicker">'+escapeHTML(state.membership?.role.replaceAll('_',' ')||'Member')+'</span><h2>'+escapeHTML(name)+'</h2><p>'+escapeHTML(user?.email||'')+'</p><p>'+escapeHTML(state.institution?.name||'')+'</p>'+button('Edit my profile','profile',false)+'</div>'+
 '<div class="v2-profile-note"><span>❦</span><blockquote>Better learning begins with thoughtful teaching.</blockquote></div></div>';
}
function studentAttendanceStats(){
 const all=state.attendance||[];
 const counts={present:0,absent:0,late:0,leave:0};
 for(const row of all)if(Object.prototype.hasOwnProperty.call(counts,row.attendance_status))counts[row.attendance_status]++;
 const rate=all.length?Math.round((counts.present+counts.late)/all.length*100):null;
 return {total:all.length,counts,rate};
}
function renderStudentHome(){
 const classes=viewGroups().filter(g=>g.group_type==='class'),sections=viewGroups().filter(g=>g.group_type==='section');
 const stats=studentAttendanceStats(),periods=state.periods;
 shell(titleBlock('My Learning Dashboard','MY SCHOOL · LIVE RECORDS','Your own classes, teacher timetable and saved academic progress are updated from the school database.')+
 profileHero()+
 '<div class="v2-metrics">'+
 '<div class="v2-metric v2-blue"><span>📘</span><small>My Classes</small><strong>'+classes.length+'</strong><p>Assigned school classes</p></div>'+
 '<div class="v2-metric v2-green"><span>▦</span><small>My Sections</small><strong>'+sections.length+'</strong><p>Verified memberships</p></div>'+
 '<div class="v2-metric v2-rose"><span>◷</span><small>Weekly Lessons</small><strong>'+periods.length+'</strong><p>Shared by your teachers</p></div>'+
 '<div class="v2-metric v2-lilac"><span>✦</span><small>Recorded Attendance</small><strong>'+(stats.rate===null?'—':stats.rate+'%')+'</strong><p>'+(stats.total?stats.total+' actual attendance marks':'Awaiting attendance marks')+'</p></div>'+
 '</div>'+
 '<div class="v2-two-cols"><section class="v2-panel"><header><div><span class="v2-kicker">MY CLASSROOM</span><h2>My Teacher Timetable</h2></div>'+button('View full timetable →','timetable',true)+'</header>'+
 (periods.length?periods.slice(0,5).map(periodCard).join(''):noData('Once your school adds you to a class and teachers publish periods, they will appear here.'))+'</section>'+
 '<section class="v2-panel"><header><div><span class="v2-kicker">PERSONAL PROGRESS</span><h2>My Attendance</h2></div>'+button('View progress →','progress')+'</header>'+
 (stats.total?'<div class="v2-student-progress"><strong>'+stats.rate+'%</strong><span>Attendance from '+stats.total+' recorded entries</span><div class="v2-progress-track"><i style="width:'+stats.rate+'%"></i></div><small>Present: '+stats.counts.present+' · Late: '+stats.counts.late+' · Absent: '+stats.counts.absent+' · Leave: '+stats.counts.leave+'</small></div>':noData('Your teachers have not submitted attendance data for your account yet.'))+
 '</section></div>');
}
function renderProgress(){
 if(!isStudent())return renderHome();
 const stats=studentAttendanceStats();
 const recent=(state.attendance||[]).slice(0,30);
 shell(titleBlock('My Academic Progress','STUDENT RECORDS','Attendance figures are calculated only from your own submitted school records. Marks will appear when verified grading is connected.')+
 '<div class="v2-metrics">'+
 '<div class="v2-metric v2-green"><span>✓</span><small>Present</small><strong>'+stats.counts.present+'</strong><p>Recorded attendances</p></div>'+
 '<div class="v2-metric v2-blue"><span>◷</span><small>Late</small><strong>'+stats.counts.late+'</strong><p>Recorded attendances</p></div>'+
 '<div class="v2-metric v2-rose"><span>○</span><small>Absent</small><strong>'+stats.counts.absent+'</strong><p>Recorded attendances</p></div>'+
 '<div class="v2-metric v2-lilac"><span>▥</span><small>Attendance Rate</small><strong>'+(stats.rate===null?'—':stats.rate+'%')+'</strong><p>'+(stats.total?stats.total+' submitted marks':'No submitted marks')+'</p></div>'+
 '</div><div class="v2-two-cols"><section class="v2-panel"><header><h2>Recent Attendance</h2></header>'+
 (recent.length?recent.map(x=>'<div class="v2-list-line"><strong>'+escapeHTML(x.attendance_status[0].toUpperCase()+x.attendance_status.slice(1))+'</strong><small>'+dateTime(x.marked_at)+'</small></div>').join(''):noData('No attendance marks are saved for this account yet.'))+'</section>'+
 '<section class="v2-panel"><h2>Subject-wise Marks</h2>'+noData('Verified subject marks are not available in this school database yet. No percentages are invented.')+
 '<p class="v2-panel-note">Your teacher’s timetable is available under My Timetable and changes automatically when saved.</p>'+
 button('My Timetable →','timetable',true)+'</section></div>');
}
function renderHome(){
 if(isStudent())return renderStudentHome();
 const all=state.groups,periods=state.periods;
 const classes=all.filter(g=>g.group_type==='class'&&g.is_active!==false),sections=all.filter(g=>g.group_type==='section'&&g.is_active!==false);
 const total=periods.length,own=periods.filter(p=>p.teacher_membership_id===state.membership.id).length;
 const scheduledNow=periods.filter(isScheduledNow);
 shell(titleBlock(canManage()?'School Dashboard':'My Teaching Dashboard','SCHOOL WORKSPACE · LIVE RECORDS','This dashboard uses real school data. Timetable changes sync across authorised accounts.')+
 profileHero()+
 '<div class="v2-metrics"><div class="v2-metric v2-blue"><span>📘</span><small>Active Classes</small><strong>'+classes.length+'</strong><p>Actual academic groups</p></div>'+
 '<div class="v2-metric v2-green"><span>🌿</span><small>Sections</small><strong>'+sections.length+'</strong><p>In this institution</p></div>'+
 '<div class="v2-metric v2-rose"><span>◷</span><small>Weekly Periods</small><strong>'+total+'</strong><p>Saved timetable entries</p></div>'+
 '<div class="v2-metric v2-lilac"><span>✦</span><small>'+(canManage()?'Scheduled Right Now':'My Periods')+'</small><strong>'+(canManage()?scheduledNow.length:own)+'</strong><p>'+(canManage()?'Based on timetable times':'Personally managed lessons')+'</p></div></div>'+
 '<div class="v2-two-cols"><section class="v2-panel"><header><div><span class="v2-kicker">SCHEDULE · LIVE UPDATES</span><h2>'+(canManage()?'School Teaching Timetable':'My Teaching Timetable')+'</h2></div>'+button('Open Timetable →','timetable',true)+'</header>'+
 (periods.length?periods.filter(p=>isScheduledNow(p)).concat(periods.filter(p=>!isScheduledNow(p))).slice(0,5).map(periodCard).join(''):noData(canSchedule()?'No lessons yet. Create your own timetable without waiting for Principal assignment.':'No teacher periods saved in this school yet.'))+'</section>'+
 '<section class="v2-panel"><header><div><span class="v2-kicker">ACADEMICS</span><h2>Classes & Sections</h2></div>'+button('Explore →','classes')+'</header>'+
 (classes.length?classes.slice(0,6).map(c=>'<div class="v2-list-line"><strong>'+escapeHTML(c.name)+'</strong><small>'+sections.filter(x=>x.parent_group_id===c.id).length+' sections</small></div>').join(''):noData('No academic classes created in the school database yet.'))+
 '</section></div>');
}
function groupLabel(id){const x=state.groups.find(v=>v.id===id);if(!x)return'General / not assigned';const parent=state.groups.find(v=>v.id===x.parent_group_id);return parent?parent.name+' · '+x.name:x.name}
function periodCard(row){
 const mine=canSchedule()&&row.teacher_membership_id===state.membership?.id;
 const now=isScheduledNow(row);
 const context=groupLabel(row.academic_group_id);
 const teacher=canManage()?' · '+staffName(row):'';
 return '<div class="v2-period-row'+(now?' v2-period-current':'')+'">'+symbol(row.subject_name)+
  '<div class="v2-period-content"><b>'+escapeHTML(row.subject_name)+'</b><small>'+escapeHTML(context)+' · '+escapeHTML(days[row.weekday]||'')+escapeHTML(teacher)+'</small>'+
  (now?'<span class="v2-now-label">● Scheduled now</span>':'')+'</div>'+
  '<div class="v2-period-time">'+escapeHTML(String(row.start_time).slice(0,5))+'–'+escapeHTML(String(row.end_time).slice(0,5))+'</div>'+
  (mine?'<button type="button" data-edit-period="'+escapeHTML(row.id)+'" class="v2-btn v2-outline">✎ Edit</button>':'')+'</div>';
}
function renderTimetable(){
 const teacher=canSchedule(),mine=state.periods.filter(x=>x.teacher_membership_id===state.membership?.id);
 const selected=teacher?mine:state.periods;
 const grouped=days.map((label,day)=>({label,rows:selected.filter(x=>x.weekday===day)}));
 shell(titleBlock(teacher?'My Weekly Timetable':isStudent()?'My Class Timetable':'School Teaching Timetable',teacher?'MY TEACHING SCHEDULE':isStudent()?'MY CLASSROOM':'SCHOOL SCHEDULE',teacher?'Create, edit or remove your own lessons. No Principal approval step is required.':isStudent()?'Your class and section timetable updates automatically when teachers change their periods.':'View teachers’ school timetables live. Each teacher manages their own periods.')+
 '<div class="v2-title-action">'+(teacher?button('+ Add Period','add-period',true):'<span class="v2-pill">Read-only live schedule</span>')+'</div>'+
 '<div class="v2-timetable-grid">'+grouped.map(d=>'<section class="v2-panel v2-day"><header><h2>'+d.label+'</h2><span class="v2-pill">'+d.rows.length+' periods</span></header>'+
 (d.rows.length?d.rows.map(periodCard).join(''):noData('No saved periods'))+'</section>').join('')+'</div>');
}
function renderClasses(){
 const allowed=viewGroups();const classes=allowed.filter(x=>x.group_type==='class'),sections=allowed.filter(x=>x.group_type==='section');
 shell(titleBlock(isStudent()?'My Classes & Sections':'Classes & Sections','ACADEMIC MANAGEMENT',isStudent()?'Only your assigned classes and sections appear here.':'All entries are real, school-scoped academic groups.')+
 '<div class="v2-title-action">'+(canManage()?button('+ Create Class','new-class',true)+button('+ Add Section','new-section'):'' )+'</div>'+
 '<div class="v2-two-cols"><section class="v2-panel"><h2>Classes · '+classes.length+'</h2>'+
 (classes.length?classes.map(x=>'<div class="v2-list-line"><strong>'+escapeHTML(x.name)+'</strong><small>'+sections.filter(y=>y.parent_group_id===x.id).length+' sections</small>'+(canManage()?'<button class="v2-btn v2-outline" type="button" data-edit-group="'+escapeHTML(x.id)+'">Edit</button>':'')+'</div>').join(''):noData('Your school has no created classes.'))+'</section>'+
 '<section class="v2-panel"><h2>Sections · '+sections.length+'</h2>'+
 (sections.length?sections.map(x=>'<div class="v2-list-line"><strong>'+escapeHTML(groupLabel(x.id))+'</strong><small>'+escapeHTML(x.code||'Section')+'</small>'+(canManage()?'<button class="v2-btn v2-outline" type="button" data-edit-group="'+escapeHTML(x.id)+'">Edit</button>':'')+'</div>').join(''):noData('Sections have not been added yet.'))+'</section></div>');
}
function renderProfile(){
 shell(titleBlock('My Profile','PERSONAL AND PRIVATE','Your picture and name belong only to your own authenticated user ID.')+
 '<div class="v2-two-cols"><section class="v2-panel v2-edit-profile">'+profileHero()+
 '<form id="v2ProfileForm" class="v2-form"><label>Full name<input name="name" value="'+escapeHTML(state.profile?.full_name||'')+'" required maxlength="120"></label>'+
 '<label>Change my photo<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
 '<button class="v2-btn v2-primary" type="submit">Save my own profile</button></form></section>'+
 '<section class="v2-panel"><h2>Account protection</h2><p>Pictures are stored in a private bucket, grouped by your authenticated user ID. Other students cannot replace your profile.</p>'+
 '<p>Your institution: <b>'+escapeHTML(state.institution?.name)+'</b></p><p>Role: <b>'+escapeHTML(state.membership?.role)+'</b></p><p>Signed in as: <b>'+escapeHTML(state.user?.email)+'</b></p></section></div>');
}
function renderCurrent(){
 switch(state.tab){case'timetable':renderTimetable();break;case'classes':renderClasses();break;case'profile':renderProfile();break;case'progress':if(isStudent())renderProgress();else renderHome();break;default:renderHome()}
}
function showDialog(title,body,onSubmit){
 const existing=$('#v2Dialog');if(existing)existing.remove();
 const dialog=document.createElement('dialog');dialog.id='v2Dialog';dialog.className='v2-dialog';
 dialog.innerHTML='<form id="v2DialogForm" class="v2-form"><header><h2>'+escapeHTML(title)+'</h2><button type="button" class="v2-icon-btn" data-close>✕</button></header>'+body+
 '<p id="v2DialogStatus" role="alert" class="v2-status"></p><footer><button class="v2-btn v2-outline" type="button" data-close>Cancel</button><button class="v2-btn v2-primary" type="submit">Save changes</button></footer></form>';
 root.append(dialog);
 dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());
 dialog.querySelector('#v2DialogForm').onsubmit=async e=>{
  e.preventDefault();const b=dialog.querySelector('[type=submit]');b.disabled=true;
  try{await onSubmit(new FormData(e.target));dialog.close();await reloadSchool();say('Saved to your school database.');renderCurrent()}
  catch(error){dialog.querySelector('#v2DialogStatus').textContent=err(error)}
  finally{b.disabled=false}
 };
 dialog.showModal();
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 return dialog;
}
function openPeriod(row){
 if(!canSchedule())return say('Only teachers and faculty can edit their own timetable.',true);
 const list=state.groups.filter(g=>g.is_active!==false && ['class','section','cohort','tutorial_group','course_group'].includes(g.group_type));
 if(!list.length){say('A school administrator needs to create a class or section first. After that, teachers can assign all their own periods.','error');return;}
 if(row&&row.teacher_membership_id!==state.membership.id){say('Only the teacher who created this period can edit it.',true);return;}
 const groupOptions='<option value="">Choose class or section</option>'+list.map(g=>'<option value="'+escapeHTML(g.id)+'" '+(g.id===row?.academic_group_id?'selected':'')+'>'+escapeHTML(groupLabel(g.id))+'</option>').join('');
 const choice=(value)=>days.map((day,idx)=>'<option value="'+idx+'" '+(Number(value)===idx?'selected':'')+'>'+day+'</option>').join('');
 const body='<div class="v2-form-grid"><label>Day<select name="weekday">'+choice(row?.weekday??new Date().getDay())+'</select></label><label>Period number<input name="period_number" type="number" required min="1" max="20" value="'+escapeHTML(row?.period_number||1)+'"></label>'+
 '<label>Start<input name="start_time" type="time" required value="'+escapeHTML(String(row?.start_time||'09:00').slice(0,5))+'"></label><label>End<input name="end_time" type="time" required value="'+escapeHTML(String(row?.end_time||'09:45').slice(0,5))+'"></label></div>'+
 '<label>Class / Section<select name="academic_group_id" required>'+groupOptions+'</select></label>'+
 '<label>Subject<div class="v2-subject-field"><span id="v2LiveSubject" class="v2-subject-symbol">📚</span><input name="subject_name" required maxlength="140" autocomplete="off" value="'+escapeHTML(row?.subject_name||'')+'" placeholder="Type a subject name"></div></label>'+
 '<label>Room / Lab (optional)<input name="room_label" maxlength="100" value="'+escapeHTML(row?.room_label||'')+'"></label>';
 const d=showDialog(row?'Edit my period':'Add my period',body,async form=>{
  const subjectName=String(form.get('subject_name')||'').trim(),start=String(form.get('start_time')||''),end=String(form.get('end_time')||'');
  if(!subjectName||!start||!end||start>=end)throw Error('Enter a subject and a valid period time range.');
  if(!form.get('academic_group_id'))throw Error('Choose a class or section so students can receive this timetable.');
  const payload={institution_id:state.institution.id,teacher_membership_id:state.membership.id,academic_group_id:form.get('academic_group_id')||null,
   subject_name:subjectName,weekday:Number(form.get('weekday')),period_number:Number(form.get('period_number')),start_time:start,end_time:end,room_label:form.get('room_label')||null,created_by:state.user.id};
  await window.NOOR_AVATAR_SAFE.ownUser(db,state.user.id);
  let q=row?db.from('teacher_timetable_periods').update({...payload,created_by:row.created_by}).eq('id',row.id).eq('teacher_membership_id',state.membership.id):
   db.from('teacher_timetable_periods').insert(payload);
  const {data,error}=await q.select('id').single();
  if(error||!data)throw error||Error('The period was not saved. Your teacher membership may be inactive.');
 });
 const subj=d.querySelector('input[name="subject_name"]');
 const live=d.querySelector('#v2LiveSubject');
 const update=()=>{const x=subject(subj.value);live.textContent=x.icon+(x.matched?'':' '+(x.initials||''));live.style.setProperty('--sh',String(x.hue));};
 subj.addEventListener('input',update);update();
 if(row){
  const remove=document.createElement('button');remove.type='button';remove.className='v2-btn v2-danger';remove.textContent='🗑 Remove Period';
  const footer=d.querySelector('footer');footer.prepend(remove);
  remove.onclick=async()=>{
   if(!window.confirm('Remove this period from your timetable? It will also disappear from Principal and Student schedules.'))return;
   remove.disabled=true;
   try{
    await window.NOOR_AVATAR_SAFE.ownUser(db,state.user.id);
    const {data,error}=await db.from('teacher_timetable_periods').delete()
      .eq('id',row.id).eq('institution_id',state.institution.id)
      .eq('teacher_membership_id',state.membership.id).select('id').single();
    if(error||data?.id!==row.id)throw error||Error('No matching period was removed.');
    d.close();
    await reloadSchool();renderCurrent();
    say('Your period was removed. Shared schedules will update automatically.');
   }catch(error){d.querySelector('#v2DialogStatus').textContent=err(error)}
   finally{remove.disabled=false}
  };
 }
}
function newGroup(type,existing=null){
 if(!canManage())return say('Only authorised school managers can edit classes.',true);
 if(!['class','section'].includes(type))return say('This group type is not editable here.',true);
 const classes=state.groups.filter(g=>g.group_type==='class');
 const body='<label>'+ (type==='class'?'Class name':'Section name') +'<input name="name" maxlength="120" required placeholder="'+(type==='class'?'Class 1':'Section A')+'" value="'+escapeHTML(existing?.name||'')+'"></label>'+
 '<label>Code (optional)<input name="code" maxlength="40" value="'+escapeHTML(existing?.code||'')+'"></label>'+
 (type==='section'?'<label>Parent class<select name="parent_group_id" required><option value="">Choose a class</option>'+
 classes.map(c=>'<option value="'+escapeHTML(c.id)+'" '+(existing?.parent_group_id===c.id?'selected':'')+'>'+escapeHTML(c.name)+'</option>').join('')+'</select></label>':'')+
 '<label>Capacity (optional)<input name="capacity" type="number" min="1" value="'+escapeHTML(existing?.capacity||'')+'"></label>';
 showDialog(existing?'Edit '+(type==='class'?'School Class':'Class Section'):(type==='class'?'Create School Class':'Add Class Section'),body,async f=>{
  const name=String(f.get('name')||'').trim();if(!name)throw Error('Enter the class or section name.');
  const payload={institution_id:state.institution.id,group_type:type,name,code:String(f.get('code')||'').trim()||null,
   capacity:f.get('capacity')?Number(f.get('capacity')):null};
  if(type==='section')payload.parent_group_id=f.get('parent_group_id')||null;
  const query=existing?db.from('academic_groups').update(payload).eq('id',existing.id).eq('institution_id',state.institution.id):
   db.from('academic_groups').insert(payload);
  const {data,error}=await query.select('id').single();
  if(error||!data)throw error||Error('Class could not be saved.');
 });
}

async function fetchSchoolPeriods(institutionId){
 const all=[];
 for(let offset=0;offset<12000;offset+=500){
  const {data,error}=await db.from('teacher_timetable_periods')
   .select('id,institution_id,academic_group_id,teacher_membership_id,created_by,subject_name,weekday,period_number,start_time,end_time,room_label')
   .eq('institution_id',institutionId).order('weekday').order('start_time')
   .range(offset,offset+499);
  if(error)throw error;
  all.push(...(data||[]));
  if(!data||data.length<500)break;
  if(offset===11500)console.warn('NOOR: timetable exceeds current 12,000-period page limit.');
 }
 return all;
}
async function reloadSchool(){
 const m=state.membership;
 if(!m)return;
 const current=await db.auth.getUser();
 if(current.error||current.data?.user?.id!==state.user.id)throw Error('Your login changed. Sign in again.');
 const student=isStudent();
 const [institution,groups,periods,profile,enrollments,attendance]=await Promise.all([
  db.from('institutions').select('id,name,institution_type,status,timezone').eq('id',m.institution_id).maybeSingle(),
  db.from('academic_groups').select('id,institution_id,parent_group_id,name,code,group_type,is_active').eq('institution_id',m.institution_id).order('name').limit(1000),
  fetchSchoolPeriods(m.institution_id),
  db.from('profiles').select('id,full_name,avatar_url').eq('id',state.user.id).maybeSingle(),
  student?db.from('academic_group_memberships').select('group_id,membership_id,status')
   .eq('institution_id',m.institution_id).eq('membership_id',m.id).eq('status','active').limit(300):Promise.resolve({data:[]}),
  student?db.from('attendance_records').select('attendance_status,marked_at,session_id')
   .eq('institution_id',m.institution_id).eq('student_membership_id',m.id)
   .order('marked_at',{ascending:false}).limit(600):Promise.resolve({data:[]})
 ]);
 for(const x of [institution,groups,profile,enrollments,attendance])if(x.error)throw x.error;
 if(institution.data?.status!=='active')throw Error('Your school has not been activated.');
 const stillSigned=await db.auth.getUser();
 if(stillSigned.error||stillSigned.data?.user?.id!==state.user.id)throw Error('Account changed during loading; reload your workspace.');
 state.institution=institution.data;
 state.groups=groups.data||[];
 state.periods=periods;
 state.profile=profile.data||state.profile;
 state.enrollments=enrollments.data||[];
 state.attendance=attendance.data||[];
 state.staffNames={};
 // The school Principal sees teacher names on saved periods. Students receive
 // only the timetable for their class, not the staff directory.
 if(canManage()){
  const members=await db.from('institution_memberships').select('id,user_id,role')
   .eq('institution_id',m.institution_id).eq('status','active')
   .in('role',['teacher','faculty']).limit(1000);
  if(!members.error&&members.data?.length){
   const userIds=[...new Set(members.data.map(x=>x.user_id).filter(Boolean))];
   if(userIds.length){
    const names=await db.from('profiles').select('id,full_name').in('id',userIds);
    if(!names.error){
     const lookup=Object.fromEntries((names.data||[]).map(x=>[x.id,x.full_name]));
     state.staffNames=Object.fromEntries(members.data.map(x=>[x.id,lookup[x.user_id]||'Teacher']));
    }
   }
  }
 }
 const ref=state.profile?.avatar_url||'';
 if(ref!==state.photoRef||!state.photoUrl||Date.now()>(state.photoExpiresAt||0)){
  state.photoUrl=ref?await window.NOOR_AVATAR_SAFE.signedUrl({
   client:db,storedReference:ref,userId:state.user.id}):null;
  state.photoRef=ref;
  state.photoExpiresAt=Date.now()+9*60*1000;
 }
}
async function refreshLive(){
 if(liveRefreshing||loading||!state.membership||document.hidden)return;
 liveRefreshing=true;
 try{
  await reloadSchool();
  // Do not destroy a half-completed teacher period editor when another teacher
  // publishes a period at the same time.
  if(!root.querySelector('#v2Dialog[open]'))renderCurrent();
 }catch(error){console.warn('NOOR live school refresh failed:',err(error))}
 finally{liveRefreshing=false}
}
async function bootstrap(){
 if(loading)return;const token=++bootstrapId;loading=true;
 try{
  if(!db){root.innerHTML='<p class="v2-error">The school connection did not load. Check your internet connection.</p>';return}
  const auth=await db.auth.getUser();if(token!==bootstrapId)return;
  if(auth.error||!auth.data?.user){state={user:null,profile:null,groups:[],periods:[],memberships:[],institution:null,membership:null,tab:'home',photoUrl:null};renderAuth();return}
  const user=auth.data.user;state.user=user;logout.hidden=false;
  const [profile,memberships]=await Promise.all([
   db.from('profiles').select('id,full_name,avatar_url').eq('id',user.id).maybeSingle(),
   db.from('institution_memberships').select('id,user_id,institution_id,role,status').eq('user_id',user.id).eq('status','active').limit(20)
  ]);
  if(token!==bootstrapId)return;
  if(profile.error||memberships.error)throw profile.error||memberships.error;
  state.profile=profile.data;state.memberships=memberships.data||[];
  if(!state.profile){
   const name=user.user_metadata?.full_name||user.email?.split('@')[0]||'NOOR member';
   const res=await db.from('profiles').insert({id:user.id,full_name:name}).select('id,full_name,avatar_url').single();
   if(res.error)throw res.error;state.profile=res.data;
  }
  if(!state.memberships.length){state.membership=null;renderOnboarding();return}
  const remembered=sessionStorage.getItem('noor.v2.selected-institution');
  state.membership=state.memberships.find(m=>m.institution_id===remembered)||state.memberships[0];
  await reloadSchool();if(token!==bootstrapId)return;
  renderCurrent();
  if(channel)await db.removeChannel(channel);
  const schoolId=state.institution.id;
  channel=db.channel('noor-school-periods-'+schoolId)
   .on('postgres_changes',{event:'*',schema:'public',table:'teacher_timetable_periods',filter:'institution_id=eq.'+schoolId},refreshLive)
   .on('postgres_changes',{event:'*',schema:'public',table:'academic_groups',filter:'institution_id=eq.'+schoolId},refreshLive)
   .on('postgres_changes',{event:'*',schema:'public',table:'academic_group_memberships',filter:'institution_id=eq.'+schoolId},refreshLive)
   .on('postgres_changes',{event:'*',schema:'public',table:'attendance_records',filter:'institution_id=eq.'+schoolId},refreshLive)
   .subscribe(status=>{
     state.realtimeStatus=status;
     const indicator=root.querySelector('#v2LiveStatus');
     if(indicator){
       indicator.textContent=status==='SUBSCRIBED'?'● Live connected':'◷ Auto-syncing';
       indicator.dataset.connected=status==='SUBSCRIBED'?'yes':'no';
     }
   });
 }catch(e){console.error('NOOR v2 workspace:',e);root.innerHTML='<section class="v2-panel v2-main-error"><h2>NOOR account needs attention</h2><p>'+escapeHTML(err(e))+'</p>'+button('Retry','refresh',true)+'</section>'}
 finally{loading=false}
}
async function submitAuth(form){
 const f=new FormData(form),email=String(f.get('email')||'').trim(),password=String(f.get('password')||'');
 const button=form.querySelector('[type="submit"]');button.disabled=true;
 try{
  if(authMode==='signup'){
   const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:String(f.get('name')||'').trim()}}});
   if(error)throw error;
   if(data.session)await bootstrap();else say('Account created. Confirm your email before signing in.');
  }else{
   const {data,error}=await db.auth.signInWithPassword({email,password});
   if(error)throw error;
   if(!data.user)throw Error('Sign-in was not completed.');
   await bootstrap();
  }
 }catch(e){say(err(e),true)}
 finally{button.disabled=false}
}
async function saveProfile(form){
 const f=new FormData(form),u=state.user,p=state.profile;
 if(!u||!p||p.id!==u.id)throw Error('Account identity mismatch. Sign in again.');
 await window.NOOR_AVATAR_SAFE.ownUser(db,u.id);
 const file=f.get('photo');
 if(file instanceof File && file.size){
  const result=await window.NOOR_AVATAR_SAFE.uploadOwn({client:db,userId:u.id,profile:p,file,backend:'v2'});
  state.photoUrl=result.avatar_url;
 }
 const fullName=String(f.get('name')||'').trim();if(!fullName)throw Error('Enter your name.');
 await window.NOOR_AVATAR_SAFE.ownUser(db,u.id);
 const {data,error}=await db.from('profiles').update({full_name:fullName}).eq('id',u.id).select('id,full_name,avatar_url').single();
 if(error||data?.id!==u.id)throw error||Error('No profile was updated.');
 state.profile=data;
 await reloadSchool();renderProfile();say('Your own profile was updated.');
}
root.addEventListener('click',async event=>{
 const nav=event.target.closest('[data-tab]');if(nav){state.tab=nav.dataset.tab;renderCurrent();return}
 const action=event.target.closest('[data-action]');if(action){
  switch(action.dataset.action){
   case'switch-auth':authMode=authMode==='signin'?'signup':'signin';renderAuth();break;
   case'profile':state.tab='profile';renderCurrent();break;
   case'timetable':state.tab='timetable';renderCurrent();break;
   case'classes':state.tab='classes';renderCurrent();break;
   case'add-period':openPeriod(null);break;
   case'new-class':newGroup('class');break;
   case'new-section':newGroup('section');break;
   case'refresh':bootstrap();break;
  }
  return;
 }
 const edit=event.target.closest('[data-edit-period]');if(edit){const p=state.periods.find(x=>x.id===edit.dataset.editPeriod);if(p)openPeriod(p)}
 const group=event.target.closest('[data-edit-group]');if(group){const item=state.groups.find(x=>x.id===group.dataset.editGroup);if(item&&canManage())newGroup(item.group_type,item)}
});
root.addEventListener('submit',async event=>{
 const id=event.target.id;
 if(!['v2AuthForm','v2CreateInstitution','v2ProfileForm'].includes(id))return;
 event.preventDefault();const b=event.target.querySelector('[type=submit]');if(b)b.disabled=true;
 try{
  if(id==='v2AuthForm')await submitAuth(event.target);
  if(id==='v2ProfileForm')await saveProfile(event.target);
  if(id==='v2CreateInstitution'){
   const f=new FormData(event.target),p={p_name:String(f.get('name')||'').trim(),p_slug:String(f.get('slug')||'').trim(),p_type:String(f.get('type')||'school')};
   const {error}=await db.rpc('register_institution_for_current_user',p);
   if(error)throw error;
   await bootstrap();say('Your new institution has been created.');
  }
 }catch(e){say(err(e),true)}
 finally{if(b)b.disabled=false}
});
logout.onclick=async()=>{if(db){await db.auth.signOut();if(channel){await db.removeChannel(channel);channel=null}}state.user=null;state.membership=null;renderAuth()};
// Keep each dashboard current even after brief network disconnects. Realtime is
// primary; this visibility-aware refresh covers missed DELETE changes.
setInterval(()=>{if(state.membership&&!document.hidden)refreshLive()},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.membership)refreshLive()});
$('#v2Theme').onclick=()=>{
 const all=['pastel-aurora','linen-pearl','porcelain-blue','rose-whisper','rose-gold'];
 const now=document.documentElement.dataset.noorTheme;
 const next=all[(all.indexOf(now)+1)%all.length];
 document.documentElement.dataset.noorTheme=next;
 try{localStorage.setItem('noor.v2.theme',next)}catch{}
 say('Theme: '+next.replaceAll('-',' '));
};
try{
 const saved=localStorage.getItem('noor.v2.theme');if(['pastel-aurora','linen-pearl','porcelain-blue','rose-whisper','rose-gold'].includes(saved))document.documentElement.dataset.noorTheme=saved;
 if(!window.supabase?.createClient)throw Error('Supabase JavaScript could not be loaded.');
 db=window.supabase.createClient(conf.SUPABASE_URL,conf.SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.sessionStorage,storageKey:'noor.v2.auth.'+new URL(conf.SUPABASE_URL).hostname}
 });
 db.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'){state.user=null;state.membership=null;renderAuth()}
  else if(event==='SIGNED_IN'&&session?.user?.id&&state.user?.id&&session.user.id!==state.user.id){
   state.user=null;state.membership=null;renderAuth();setTimeout(bootstrap,0);
  }
 });
 bootstrap();
}catch(error){root.innerHTML='<section class="v2-panel v2-main-error"><h2>NOOR connection is unavailable</h2><p>'+escapeHTML(err(error))+'</p></section>'}
})();
