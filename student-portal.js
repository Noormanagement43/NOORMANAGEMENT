/* NOOR Student Learning Centre — real, RLS-controlled school data only. */
(()=>{'use strict';
const app=()=>window.NOOR_AI_APP||{},db=()=>app().db,p=()=>app().profile,u=()=>app().user,sid=()=>app().schoolId,root=()=>document.getElementById('view-overview');
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>v==null?'—':N(v).toLocaleString('en-IN',{maximumFractionDigits:1});
const date=v=>v?new Date(v).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
const isoDay=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day};
const dayTime=v=>v?new Date(v).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'—';
const empty=v=>'<div class="sp-empty">'+E(v)+'</div>';
const badge=v=>'<span class="sp-chip">'+E(v)+'</span>';
const btn=(title,target)=>'<button type="button" class="sp-action secondary" data-sp-nav="'+E(target)+'">'+E(title)+' →</button>';
const box=(title,description,content,action='')=>'<section class="sp-card"><div class="sp-card-head"><div><h2>'+E(title)+'</h2><p class="sp-muted">'+E(description||'')+'</p></div>'+action+'</div>'+content+'</section>';
const item=(title,small,extra='')=>'<div class="sp-item sp-row sp-between"><div><div class="sp-item-title">'+E(title)+'</div><div class="sp-muted">'+E(small)+'</div></div>'+extra+'</div>';
const status=(el,msg,err=false)=>{const x=document.querySelector(el);if(x){x.className='sp-status'+(err?' error':'');x.textContent=msg;x.hidden=false;}};
let data={},errors=[],calMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1),mode='month',dateFocus=isoDay(new Date()),period='90',focusSubject='all',noteQuery='',noteTab='notes',loading=false,activeStudent='',channel=null;
const mine=()=>p()?.role==='student'&&p()?.status==='active'&&sid()&&u()&&db();
function view(id){let v=document.getElementById('view-'+id);if(!v){v=document.createElement('section');v.className='view';v.id='view-'+id;document.querySelector('#workspace .content')?.append(v)}return v}
function renderShell(id,title,subtitle,content){view(id).innerHTML='<div class="sp-root"><header class="sp-head"><div><span class="sp-kicker">NOOR · MY LEARNING CENTRE</span><h1>'+E(title)+'</h1><p class="sp-muted">'+E(subtitle||'')+'</p></div><button type="button" class="sp-action secondary" data-sp-refresh>↻ Refresh</button></header>'+content+'</div>'}
async function readAll(){
 if(!mine())return;const school=sid(),me=p(),id=u().id;
 const jobs={
  classes:db().from('classes').select('id,name').eq('school_id',school).eq('is_active',true),
  sections:db().from('sections').select('id,name,class_id').eq('class_id',me.class_id||'00000000-0000-0000-0000-000000000000'),
  periods:db().from('noor_teacher_periods').select('id,weekday,period_number,start_time,end_time,subject_name,class_label,block_type,section_id,approval_status').eq('school_id',school).eq('class_id',me.class_id||'00000000-0000-0000-0000-000000000000').eq('approval_status','approved').order('weekday').order('start_time'),
  subjects:db().from('subjects').select('id,name,class_id').eq('school_id',school),
  notes:db().from('smart_notes').select('id,title,content,subject_id,updated_at,teacher_id').eq('school_id',school).eq('class_id',me.class_id||'00000000-0000-0000-0000-000000000000').eq('status','published').eq('published_to_students',true).order('updated_at',{ascending:false}).limit(150),
  notices:db().from('school_notices').select('id,title,body,starts_at,ends_at,created_at').eq('school_id',school).eq('is_active',true).contains('target_roles',['student']).order('starts_at',{ascending:false}).limit(100),
  events:db().from('calendar_events').select('id,title,description,event_type,starts_at,ends_at,location').eq('school_id',school).gte('starts_at',new Date(Date.now()-90*86400000).toISOString()).order('starts_at').limit(500),
  assessments:db().from('school_assessments').select('id,title,assessment_date,max_marks,subject_id,assessment_type,status,section_id').eq('school_id',school).eq('class_id',me.class_id||'00000000-0000-0000-0000-000000000000').in('status',['planned','conducted','marked']).order('assessment_date',{ascending:false}).limit(250),
  results:db().from('assessment_results').select('id,assessment_id,marks_obtained,grade_label,teacher_feedback,marked_at').eq('school_id',school).eq('student_id',id).order('marked_at',{ascending:false}).limit(400),
  attendance:db().from('attendance_records').select('id,session_id,status,marked_at').eq('school_id',school).eq('student_id',id).order('marked_at',{ascending:false}).limit(420),
  assignments:db().from('noor_student_assignments').select('id,title,instructions,paper_text,assignment_type,max_marks,due_at,published_at,subject_id,section_id').eq('school_id',school).eq('class_id',me.class_id||'00000000-0000-0000-0000-000000000000').eq('is_active',true).lte('published_at',new Date().toISOString()).order('published_at',{ascending:false}).limit(250),
  submissions:db().from('noor_student_submissions').select('id,assignment_id,answer_text,file_path,status,marks_obtained,teacher_feedback,reviewed_at,submitted_at').eq('school_id',school).eq('student_id',id).order('submitted_at',{ascending:false}).limit(250),
  plans:db().from('noor_student_study_plans').select('id,title,planned_for,is_done').eq('school_id',school).eq('student_id',id).order('planned_for').limit(250),
  questions:db().from('noor_student_questions').select('id,question,reply,replied_at,created_at').eq('school_id',school).eq('student_id',id).order('created_at',{ascending:false}).limit(80),
  portfolio:db().from('noor_student_portfolio').select('id,title,description,evidence_url,created_at').eq('school_id',school).eq('student_id',id).order('created_at',{ascending:false}).limit(100),
  notifications:db().from('notification_events').select('id,event_type,subject,status,created_at').eq('school_id',school).eq('recipient_profile_id',id).order('created_at',{ascending:false}).limit(100)
 };
 const entries=Object.entries(jobs);const ans=await Promise.all(entries.map(async([k,v])=>{try{return [k,await v]}catch(e){return[k,{error:e,data:[]}]}}));
 errors=[];data={};ans.forEach(([k,r])=>{data[k]=r.data||[];if(r.error)errors.push(k+': '+(r.error.message||String(r.error)))});
 const sessionIds=[...new Set(data.attendance.map(x=>x.session_id).filter(Boolean))];
 data.sessions=[];
 if(sessionIds.length){const z=await db().from('attendance_sessions').select('id,attendance_date,status').in('id',sessionIds).in('status',['submitted','corrected']);if(z.error)errors.push('attendance sessions: '+z.error.message);else data.sessions=z.data||[];}
 const sectionId=me.section_id;
 data.assignments=data.assignments.filter(x=>!x.section_id||x.section_id===sectionId);
 data.assessments=data.assessments.filter(x=>!x.section_id||x.section_id===sectionId);
 data.marks=data.results.map(r=>{const a=data.assessments.find(x=>x.id===r.assessment_id && x.status!=='planned');return a?{...r,assessment:a,pct:N(a.max_marks)>0?100*N(r.marks_obtained)/N(a.max_marks):null}:null}).filter(Boolean).sort((a,b)=>new Date(a.assessment.assessment_date)-new Date(b.assessment.assessment_date));
 data.periods=data.periods.filter(x=>!x.section_id||x.section_id===sectionId);data.exams=data.assessments.filter(x=>x.status==='planned'&&x.assessment_date>=isoDay(new Date()));const reviewedHomework=data.submissions.filter(x=>x.status==='reviewed'&&x.marks_obtained!=null).map(x=>{const asg=data.assignments.find(a=>a.id===x.assignment_id);if(!asg||!N(asg.max_marks))return null;return {marks_obtained:x.marks_obtained,teacher_feedback:x.teacher_feedback,assessment:{id:asg.id,title:asg.title,subject_id:asg.subject_id,assessment_type:'homework',assessment_date:(x.reviewed_at||x.submitted_at).slice(0,10),max_marks:asg.max_marks},pct:100*N(x.marks_obtained)/N(asg.max_marks)};}).filter(Boolean);data.marks=data.marks.concat(reviewedHomework).sort((a,b)=>new Date(a.assessment.assessment_date)-new Date(b.assessment.assessment_date));data.recordDays=data.attendance.map(r=>{const s=data.sessions.find(s=>s.id===r.session_id);return s?{day:s.attendance_date,status:r.status}:null}).filter(Boolean);
}
const subject=id=>data.subjects?.find(s=>s.id===id)?.name||'General subject';
const eligible=()=>data.marks||[];
const visibleMarks=()=>eligible().filter(m=>period==='all'||new Date(m.assessment.assessment_date)>=new Date(Date.now()-Number(period)*86400000)).filter(m=>focusSubject==='all'||m.assessment.subject_id===focusSubject);
const average=arr=>arr.length?Math.round(arr.reduce((sum,x)=>sum+x,0)/arr.length):null;
const attendanceRate=()=>{const r=data.recordDays||[];return r.length?Math.round(r.filter(x=>x.status==='present'||x.status==='late').length*100/r.length):null;};
const latestMark=()=>eligible().slice(-1)[0];
const pending=()=>data.assignments?.filter(a=>!(data.submissions||[]).some(s=>s.assignment_id===a.id))||[];
const classText=()=>data.classes?.find(x=>x.id===p().class_id)?.name||p().requested_class_name||'Class not assigned';
const sectionText=()=>data.sections?.find(x=>x.id===p().section_id)?.name||p().requested_section_name||'No section';
const notices=()=>data.notices?.filter(x=>(!x.starts_at||Date.parse(x.starts_at)<=Date.now())&&(!x.ends_at||Date.parse(x.ends_at)>Date.now()))||[];
const greeting=()=>{let n=p().full_name||'Student';return n;};
const alertErrors=()=>errors.length?'<div class="sp-status error">Some records could not load: '+E(errors.slice(0,3).join('; '))+'. Review database access and refresh.</div>':'';
function dayEvents(d){return [...(data.events||[]).filter(x=>x.starts_at?.slice(0,10)===d).map(x=>({text:x.title,type:'event'})),...(data.assignments||[]).filter(x=>x.due_at?.slice(0,10)===d).map(x=>({text:'Due: '+x.title,type:'due'})),...(data.exams||[]).filter(x=>x.assessment_date===d).map(x=>({text:'Exam: '+x.title,type:'event'}))]}
function calGrid(year,month,attendance=false){
 const first=new Date(year,month,1),start=first.getDay(),end=new Date(year,month+1,0).getDate(),cells=[];
 for(let i=0;i<start;i++)cells.push('<div class="sp-day empty"></div>');
 for(let d=1;d<=end;d++){
  const value=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const rec=(data.recordDays||[]).filter(x=>x.day===value).slice(-1)[0];
  const ev=attendance?(rec?[{text:rec.status,type:rec.status}]:[]):dayEvents(value);
  cells.push('<button type="button" class="sp-day'+(value===isoDay(new Date())?' today':'')+'" data-sp-day="'+value+'"><b>'+d+'</b>'+ev.slice(0,2).map(x=>'<span class="sp-dot '+E(x.type==='absent'?'sick':x.type)+'">'+E(x.text)+'</span>').join('')+(ev.length>2?'<small>+'+(ev.length-2)+' more</small>':'')+'</button>')
 }
 return '<div class="sp-calendar">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>'<div class="sp-weekday">'+x+'</div>').join('')+cells.join('')+'</div>';
}
function miniCalendar(){const now=new Date(),mn=now.getMonth(),y=now.getFullYear();return box('My Calendar','School events, assessments and deadlines',calGrid(y,mn),btn('Full calendar','student-calendar'))}
function overview(){
 if(!mine())return;
 const m=visibleMarks(),avg=average(m.map(x=>x.pct).filter(x=>x!=null)),last=latestMark(),a=attendanceRate();
 const av=p().avatar_url?'<img src="'+E(p().avatar_url)+'" alt="Student photograph">':E(greeting().slice(0,1));
 const kpis=[['Attendance',a==null?'—':a+'%','Based on recorded sessions'],['My Progress',avg==null?'—':avg+'%','Average of selected actual tests'],['Pending Tasks',pending().length,'Homework not submitted'],['Latest Marks',last?money(last.marks_obtained)+' / '+money(last.assessment.max_marks):'—',last?.assessment?.title||'No marked assessment yet']];
 const header='<div class="sp-intro"><div><span class="sp-kicker">NOOR · MY SCHOOL</span><h1>Good to see you, '+E(greeting())+'</h1><p class="sp-muted">'+E(app().school?.name||'My school')+' · '+E(classText())+' · '+E(sectionText())+'</p><div class="sp-subline">'+badge('Roll '+(p().roll_number||'Not assigned'))+badge('My Learning Centre')+'</div></div><div class="sp-avatar">'+av+'</div></div>';
 const kp='<div class="sp-kpis">'+kpis.map((x,i)=>'<button type="button" class="sp-kpi" data-sp-nav="'+['student-attendance','student-progress','student-homework','student-progress'][i]+'" style="text-align:left"><div class="sp-label">'+E(x[0])+'</div><div class="sp-value">'+E(x[1])+'</div><small>'+E(x[2])+'</small></button>').join('')+'</div>';
 const next=(data.assignments||[]).filter(x=>!data.submissions.some(s=>s.assignment_id===x.id)).slice(0,4).map(x=>item(x.title,subject(x.subject_id)+' · '+(x.due_at?'Due '+dayTime(x.due_at):'No deadline'),btn('Open','student-homework'))).join('')||empty('No outstanding homework.');
 const recentNotes=(data.notes||[]).slice(0,3).map(x=>item(x.title,subject(x.subject_id)+' · '+date(x.updated_at),btn('Read','student-learning'))).join('')||empty('No published teacher notes yet.');
 const examNext=(data.exams||[]).slice().sort((a,b)=>a.assessment_date.localeCompare(b.assessment_date)).slice(0,3);const recentNotice=notices().slice(0,3).map(x=>item(x.title,x.body?.slice(0,110)||date(x.created_at),btn('Read','notices'))).join('')||empty('No active school announcements.');
 const mini=box('My Classroom','Latest teacher-published learning material','<div class="sp-list">'+recentNotes+'</div>',btn('Learning','student-learning'));
 const graph=box('Academic Performance','Actual school-assessed marks only',barsMarkup(m),btn('Progress','student-progress'));
 const due=box('Homework & Deadlines','Tasks requiring your response','<div class="sp-list">'+next+'</div>',btn('All tasks','student-homework'));
 const exbox=box('Upcoming Exams','Countdown to school-planned assessments',examNext.length?'<div class="sp-list">'+examNext.map(x=>item(x.title,subject(x.subject_id)+' · '+date(x.assessment_date)+' · '+Math.max(0,Math.ceil((new Date(x.assessment_date+'T23:59:59')-new Date())/86400000))+' day(s) left')).join('')+'</div>':empty('No upcoming school exams have been scheduled yet.'));const daily=box('My Daily Schedule','Today’s approved class periods',scheduleRows(new Date().getDay()),btn('All periods','student-schedule'));const nbox=box('Latest School Notices','Relevant authorised announcements','<div class="sp-list">'+recentNotice+'</div>',btn('All notices','notices'));
 root().innerHTML='<div class="sp-root">'+header+kp+alertErrors()+'<div class="sp-grid">'+miniCalendar()+mini+'</div><div class="sp-grid">'+graph+due+'</div>'+daily+exbox+nbox+'</div>';
 document.body.classList.add('noor-student-mode');
}
function barsMarkup(marks){const groups={};marks.forEach(x=>{const k=subject(x.assessment.subject_id);(groups[k]??=[]).push(x.pct)});
 const vals=Object.entries(groups).map(([k,x])=>[k,average(x.filter(z=>z!=null))]).filter(x=>x[1]!=null);
 return vals.length?vals.map(([k,value],i)=>'<div class="sp-bar-row"><b>'+E(k)+'</b><div class="sp-bar-track"><div class="sp-bar-fill '+['pink','blue','mint','lilac','peach'][i%5]+'" style="width:'+value+'%"></div></div><strong>'+value+'%</strong></div>').join(''):empty('No marked assessments available yet. Graphs will appear when teachers enter real results.');}
function lineMarkup(m){
 if(!m.length)return empty('No dated results for this range.');
 const w=640,h=205;const pts=m.map((x,i)=>[30+(m.length===1?300:i*570/(m.length-1)),190-Math.max(0,Math.min(100,x.pct))*1.6]).filter(x=>x.every(Number.isFinite));
 return '<svg class="sp-linechart" viewBox="0 0 640 205" role="img" aria-label="Test score trend in percent"><path d="M30 30H610 M30 110H610 M30 190H610" stroke="#eee5f0" fill="none"/><polyline points="'+pts.map(x=>x.join(',')).join(' ')+'" fill="none" stroke="#9c77b1" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+pts.map((x,i)=>'<circle cx="'+x[0]+'" cy="'+x[1]+'" r="5" fill="#6e4d80"><title>'+E(m[i].assessment.title)+' · '+Math.round(m[i].pct)+'% · '+E(date(m[i].assessment.assessment_date))+'</title></circle>').join('')+'<text x="5" y="34" fill="#856f87" font-size="11">100%</text><text x="12" y="194" fill="#856f87" font-size="11">0%</text></svg>';
}

function weekTrend(){
 const r=data.recordDays||[];if(!r.length)return empty('Teacher attendance sessions have not been recorded.');
 const now=new Date();const bins=[];
 for(let i=5;i>=0;i--){const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i*7),start=new Date(end);start.setDate(start.getDate()-6);
 const grouped=r.filter(x=>x.day>=isoDay(start)&&x.day<=isoDay(end)),pct=grouped.length?Math.round(100*grouped.filter(x=>x.status==='present'||x.status==='late').length/grouped.length):null;
 bins.push({label:date(isoDay(start)),pct,days:grouped.length});}
 return bins.some(x=>x.pct!=null)?bins.map((x,i)=>'<div class="sp-bar-row"><b>'+E(x.label)+'</b><div class="sp-bar-track"><div class="sp-bar-fill '+['pink','blue','mint','lilac','peach'][i%5]+'" style="width:'+(x.pct??0)+'%"></div></div><strong>'+(x.pct==null?'—':x.pct+'%')+'</strong></div>').join(''):empty('No attendance data in the last six weeks.');
}
function topicBars(m){
 if(!m.length)return empty('No marked assessments available.');
 return m.slice(-12).reverse().map((x,i)=>'<div class="sp-bar-row"><b title="'+E(x.assessment.title)+'">'+E(x.assessment.title.slice(0,29))+'</b><div class="sp-bar-track"><div class="sp-bar-fill '+['pink','blue','mint','lilac','peach'][i%5]+'" style="width:'+Math.max(0,Math.min(100,x.pct||0))+'%"></div></div><strong>'+Math.round(x.pct||0)+'%</strong></div>').join('');
}

function scheduleRows(weekday){
 const rows=(data.periods||[]).filter(x=>x.weekday===weekday).sort((a,b)=>a.start_time.localeCompare(b.start_time));
 return rows.length?'<div class="sp-list">'+rows.map(x=>item('Period '+x.period_number+' · '+(x.subject_name||'Subject'),(x.start_time||'').slice(0,5)+'–'+(x.end_time||'').slice(0,5)+' · '+(x.block_type||'Class'))).join('')+'</div>':empty('No approved periods recorded for this day.');
}
function schedule(){
 const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 renderShell('student-schedule','My Daily Schedule','Approved periods from teachers assigned to your class/section. No fictional timetable.',
 '<div class="sp-grid equal">'+days.map((x,i)=>box(x,i===new Date().getDay()?'Today':'Weekly timetable',scheduleRows(i))).join('')+'</div>');
}
function studentNotices(){
 const list=notices();renderShell('notices','Teacher & School Notices','Published notices for your authorised school, class and section.',
 box('Latest Notices','Filtered by school access and publication dates',list.length?'<div class="sp-list">'+list.map(x=>'<article class="sp-item"><h3>'+E(x.title)+'</h3><p class="sp-muted">'+E(dayTime(x.starts_at||x.created_at))+'</p><p style="white-space:pre-wrap;margin-top:9px">'+E(x.body)+'</p></article>').join('')+'</div>':empty('No active classroom or school notices at the moment.')));
}
function studentNotifications(){
 const list=data.notifications||[];renderShell('notifications','My Notifications','Account-specific events saved by your school.',
 box('Messages & Updates','Queued messages are not proof that an external email was delivered',list.length?'<div class="sp-list">'+list.map(x=>item(x.subject||x.event_type||'School update',dayTime(x.created_at)+' · '+(x.status||'queued'))).join('')+'</div>':empty('No account notifications have been recorded yet.')));
}
function marksTable(m){return m.length?'<div class="sp-table-scroll"><table><thead><tr><th>Date</th><th>Test</th><th>Subject</th><th>Marks</th><th>Feedback</th></tr></thead><tbody>'+m.slice().reverse().map(x=>'<tr><td>'+E(date(x.assessment.assessment_date))+'</td><td>'+E(x.assessment.title)+'</td><td>'+E(subject(x.assessment.subject_id))+'</td><td><strong>'+E(money(x.marks_obtained))+' / '+E(money(x.assessment.max_marks))+'</strong></td><td>'+E(x.teacher_feedback||'Awaiting feedback')+'</td></tr>').join('')+'</tbody></table></div>':empty('No teacher-marked results available.');
}
function progress(){
 const list=visibleMarks(),all=eligible();
 const options='<label>Time period<select id="spPeriod"><option value="30"'+(period==='30'?' selected':'')+'>Last 30 days</option><option value="90"'+(period==='90'?' selected':'')+'>Last 90 days</option><option value="365"'+(period==='365'?' selected':'')+'>Last year</option><option value="all"'+(period==='all'?' selected':'')+'>All recorded dates</option></select></label><label>Subject<select id="spSubject"><option value="all">All subjects</option>'+(data.subjects||[]).map(x=>'<option value="'+E(x.id)+'"'+(focusSubject===x.id?' selected':'')+'>'+E(x.name)+'</option>').join('')+'</select></label>';
 const filters='<div class="sp-form two">'+options+'</div>';
 const at=attendanceRate(),score=average(list.map(x=>x.pct).filter(x=>x!=null));
 renderShell('student-progress','My Academic Progress','Real marks, dates and teacher feedback. No sample statistics.',box('Filters','Choose date range and subject',filters)+
 '<div class="sp-kpis"><div class="sp-kpi"><div class="sp-label">Recorded tests</div><div class="sp-value">'+list.length+'</div></div><div class="sp-kpi"><div class="sp-label">Average marks</div><div class="sp-value">'+(score==null?'—':score+'%')+'</div></div><div class="sp-kpi"><div class="sp-label">Attendance trend</div><div class="sp-value">'+(at==null?'—':at+'%')+'</div></div><div class="sp-kpi"><div class="sp-label">All-time tests</div><div class="sp-value">'+all.length+'</div></div></div>'+
 '<div class="sp-grid">'+box('Subject-wise Marks','Average of recorded scored tests',barsMarkup(list))+box('Test Improvement','Chronological score trend; hover points for original test',lineMarkup(list.filter(x=>x.pct!=null)))+'</div>'+
 box('Assessment-wise Performance','Assessment title is used as the topic label until chapter metadata is available',topicBars(list.filter(x=>x.pct!=null)))+box('Attendance Trend','Weekly rates calculated only from teacher-submitted sessions',weekTrend())+
 box('Recent Results & Teacher Feedback','Original marks / maximum marks',marksTable(list)));
}
function attendance(){
 const ar=data.recordDays||[],cnt=ar.length,a=ar.filter(x=>x.status==='present').length,b=ar.filter(x=>x.status==='absent').length,l=ar.filter(x=>x.status==='late').length;
 const rate=attendanceRate(),statusRow='<div class="sp-kpis">'+[['Attendance',rate==null?'—':rate+'%'],['Present',a],['Absent',b],['Late',l]].map(x=>'<div class="sp-kpi"><div class="sp-label">'+x[0]+'</div><div class="sp-value">'+x[1]+'</div><small>'+cnt+' total recorded sessions</small></div>').join('')+'</div>';
 const k=calMonth,control='<div class="sp-month-head"><button type="button" class="sp-action ghost" data-sp-month="-1">←</button><h2>'+E(k.toLocaleDateString('en-IN',{month:'long',year:'numeric'}))+'</h2><button type="button" class="sp-action ghost" data-sp-month="1">→</button></div>';
 renderShell('student-attendance','My Attendance','Teacher-submitted real attendance, not guessed totals.',statusRow+box('Attendance Calendar','Green: present · Pink: absent · Amber: late',control+calGrid(k.getFullYear(),k.getMonth(),true))+
 box('Attendance History','Date-wise approved sessions',ar.length?'<div class="sp-list">'+ar.slice().sort((x,y)=>y.day.localeCompare(x.day)).slice(0,70).map(x=>item(date(x.day),x.status)).join('')+'</div>':empty('No teacher-submitted attendance is available yet.')));
}
function eventRows(events){return events.length?'<div class="sp-list">'+events.map(x=>item(x.title,dayTime(x.starts_at)+(x.event_type?' · '+x.event_type:'')+(x.location?' · '+x.location:''),x.description?badge(x.description.slice(0,60)):'')).join('')+'</div>':empty('No school events recorded for this time.')}
function calendar(){
 const k=calMonth,control='<div class="sp-month-head"><button type="button" class="sp-action ghost" data-sp-month="-1">← Previous</button><h2>'+E(k.toLocaleDateString('en-IN',{month:'long',year:'numeric'}))+'</h2><button type="button" class="sp-action ghost" data-sp-month="1">Next →</button></div>';
 const tabs='<div class="sp-tabs">'+['month','week','day'].map(x=>'<button class="sp-tab'+(mode===x?' active':'')+'" type="button" data-sp-cal-mode="'+x+'">'+x.toUpperCase()+'</button>').join('')+'</div>';
 let content='';
 if(mode==='month')content=control+calGrid(k.getFullYear(),k.getMonth());
 else{const target=new Date(dateFocus+'T12:00:00'),start=new Date(target);if(mode==='week')start.setDate(start.getDate()-start.getDay());
 const stop=new Date(start);stop.setDate(stop.getDate()+(mode==='week'?7:1));
 const ev=[...(data.events||[])].filter(x=>x.starts_at&&new Date(x.starts_at)>=start&&new Date(x.starts_at)<stop);
 const deadlines=(data.assignments||[]).filter(x=>x.due_at&&new Date(x.due_at)>=start&&new Date(x.due_at)<stop).map(x=>({title:'Homework due: '+x.title,starts_at:x.due_at,event_type:'Deadline'}));
 content='<label>Selected day<input type="date" id="spFocusDate" value="'+E(dateFocus)+'"></label><div style="margin-top:14px">'+eventRows([...ev,...deadlines].sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)))+'</div>';
 }
 const selected=dayEvents(dateFocus);
 renderShell('student-calendar','Smart School Calendar','Monthly, weekly and daily class-related events. School-added holidays are shown when published.',box('Academic Calendar','Exams, school holidays, homework and events',tabs+content+'<div class="sp-row" style="margin-top:14px"><button class="sp-action secondary" type="button" data-sp-nav="school-calendar">Indian festival & holiday reference →</button></div>')+box('Selected date: '+date(dateFocus),'Events and assignment deadlines',selected.length?'<div class="sp-list">'+selected.map(x=>item(x.text,x.type)).join('')+'</div>':empty('No events on this date.')));
}
function learning(){
 const list=(data.notes||[]).filter(x=>(focusSubject==='all'||x.subject_id===focusSubject)&&(!noteQuery||[x.title,subject(x.subject_id)].join(' ').toLowerCase().includes(noteQuery.toLowerCase())));
 const filters='<div class="sp-form two"><label>Find notes<input id="spNoteSearch" value="'+E(noteQuery)+'" placeholder="Search chapter or subject"></label><label>Subject<select id="spLearningSubject"><option value="all">All subjects</option>'+(data.subjects||[]).map(x=>'<option value="'+E(x.id)+'"'+(focusSubject===x.id?' selected':'')+'>'+E(x.name)+'</option>').join('')+'</select></label></div>';
 const tabs='<div class="sp-tabs">'+[['notes','Smart Notes'],['papers','Practice Papers'],['revision','Revision Plan']].map(x=>'<button type="button" class="sp-tab'+(noteTab===x[0]?' active':'')+'" data-sp-note-tab="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>';
 let content='';
 if(noteTab==='notes')content=list.length?list.map(x=>'<details class="sp-item"><summary><b>'+E(x.title)+'</b> · <span class="sp-muted">'+E(subject(x.subject_id))+' · '+E(date(x.updated_at))+'</span></summary><div style="white-space:pre-wrap;margin-top:12px">'+E(typeof x.content==='string'?x.content:(x.content?.notes_text||x.content?.summary||JSON.stringify(x.content||{})))+'</div><button type="button" class="sp-action secondary" onclick="window.print()">Print / Save PDF</button></details>').join(''):empty('No published Smart Notes for your class yet.');
 if(noteTab==='papers')content=(data.assignments||[]).filter(x=>x.paper_text).map(x=>'<details class="sp-item"><summary>'+E(x.title)+' · '+E(subject(x.subject_id))+'</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+E(x.paper_text)+'</pre></details>').join('')||empty('No teacher-published practice papers yet.');
 if(noteTab==='revision')content='<div class="sp-muted">Your teacher’s published notes can be used for revision. Add your daily goals in Study Planner.</div>'+btn('Open planner','student-planner');
 renderShell('student-learning','My Learning Library','Only teacher-published notes and papers from your school and class.',box('Classroom Resources','Chapter notes, practice material and revision',filters+tabs+'<div class="sp-list">'+content+'</div>'));
}
async function uploadAnswer(file,assignment){if(!file)return null;const allowed=['application/pdf','image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type))throw Error('Only PDF, JPG, PNG or WebP files are allowed.');if(file.size>10*1024*1024)throw Error('File exceeds the 10 MB limit.');
 const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
 const path=[sid(),u().id,assignment.id,crypto.randomUUID()+'.'+ext].join('/');
 const r=await db().storage.from('noor-student-work').upload(path,file,{upsert:false,contentType:file.type});if(r.error)throw r.error;return path;}
function homework(){
 const list=data.assignments||[];let content=list.length?list.map(x=>{
 const existing=(data.submissions||[]).find(s=>s.assignment_id===x.id),done=existing?.status==='reviewed',late=x.due_at&&new Date(x.due_at)<new Date();
 const form=done?'<div class="sp-status">Reviewed · '+(existing.marks_obtained!=null?money(existing.marks_obtained)+' / '+money(x.max_marks):'Teacher review recorded')+'<p>'+E(existing.teacher_feedback||'')+'</p></div>':
 '<form class="sp-form" data-sp-submit="'+E(x.id)+'"><label>My answer<textarea name="answer" rows="4" maxlength="10000" placeholder="Write your answer here">'+E(existing?.answer_text||'')+'</textarea></label><label>Attach work (optional, 10 MB max)<input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"></label><button class="sp-action" type="submit">'+(existing?'Update submission':'Submit homework')+'</button><p class="sp-muted">Only the assigned teacher can review your answer. Teacher answer keys are private.</p></form>';
 return '<details class="sp-card sp-focus"><summary><strong>'+E(x.title)+'</strong> · '+badge(subject(x.subject_id))+' '+badge(existing?.status||'Not submitted')+(late?' '+badge('Past deadline'):'')+'</summary><p class="sp-muted">'+E(x.assignment_type)+' · '+(x.due_at?'Due '+dayTime(x.due_at):'No due date')+' · '+(x.max_marks==null?'Marks not set':money(x.max_marks)+' marks')+'</p><p style="white-space:pre-wrap;margin:12px 0">'+E(x.instructions||'')+'</p>'+(x.paper_text?'<pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#faf6fc;border-radius:12px;padding:12px">'+E(x.paper_text)+'</pre>':'')+form+'<div class="sp-status" id="spSubmitMsg-'+E(x.id)+'" hidden></div></details>';
 }).join(''):empty('Your teachers have not published any assignments yet.');
 renderShell('student-homework','Homework & Assignment Centre','Submit written answers or secure attachments. Teacher feedback updates after review.',box('Assigned Work','Open an assignment to submit', '<div class="sp-list">'+content+'</div>'));
}
function planner(){
 const list=data.plans||[],today=isoDay(new Date());
 const form='<form class="sp-form two" id="spGoalForm"><label>Study goal<input name="goal" required maxlength="180" placeholder="Revise chapter 2"></label><label>Target date<input type="date" name="date" required value="'+today+'"></label><button class="sp-action" type="submit">Add goal</button></form><div id="spGoalMsg" hidden></div>';
 const rows=list.map(x=>item(x.title,date(x.planned_for)+' · '+(x.is_done?'Completed':'To do'),'<div class="sp-row"><button type="button" class="sp-action secondary" data-sp-goal="'+E(x.id)+'">'+(x.is_done?'↺ Reopen':'✓ Complete')+'</button><button type="button" class="sp-action ghost" data-sp-delete-goal="'+E(x.id)+'">Remove</button></div>')).join('')||empty('No study goals yet.');
 renderShell('student-planner','My Smart Study Planner','Create and complete your personal revision goals.',box('Add a Study Goal','Your own private schedule',form)+box('My Goals','Saved to your account','<div class="sp-list">'+rows+'</div>'));
}
function questions(){
 const form='<form id="spQuestionForm" class="sp-form"><label>Ask a study question<textarea name="question" required minlength="5" maxlength="2000" placeholder="Which part of today’s lesson should I revise?"></textarea></label><button class="sp-action">Send to assigned teachers</button></form><div id="spQuestionMsg" hidden></div>';
 const rows=(data.questions||[]).map(x=>'<div class="sp-item"><b>'+E(x.question)+'</b><p class="sp-muted">'+E(dayTime(x.created_at))+'</p><div class="sp-status'+(x.reply?'':' error')+'">'+(x.reply?'Teacher reply: '+E(x.reply):'Waiting for an assigned teacher reply')+'</div></div>').join('')||empty('No study questions sent yet.');
 renderShell('student-questions','Ask My Teacher','Private classroom questions that authorised assigned teachers can answer.',box('New Question','Connect with your class teachers',form)+box('My Questions','Teacher responses saved to NOOR','<div class="sp-list">'+rows+'</div>'));
}
function portfolio(){
 const form='<form id="spPortfolioForm" class="sp-form"><label>Project or achievement name<input name="title" maxlength="180" required></label><label>About this work<textarea name="description" maxlength="3000"></textarea></label><label>Optional evidence URL (HTTPS)<input name="url" type="url" placeholder="https://..."></label><button class="sp-action">Add to portfolio</button></form><div id="spPortfolioMsg" hidden></div>';
 const rows=(data.portfolio||[]).map(x=>item(x.title,(x.description||'')+' · '+date(x.created_at),'<div class="sp-row">'+(x.evidence_url&&/^https:\/\//.test(x.evidence_url)?'<a class="sp-link" target="_blank" rel="noopener noreferrer" href="'+E(x.evidence_url)+'">View evidence</a>':'')+'<button class="sp-action ghost" data-sp-delete-portfolio="'+E(x.id)+'">Remove</button></div>')).join('')||empty('Your learning portfolio is empty.');
 renderShell('student-portfolio','My Student Portfolio','Track your real school projects and academic achievements.',box('Add Work','Your own private achievements',form)+box('Portfolio History','Projects and achievements','<div class="sp-list">'+rows+'</div>'));
}
async function profile(){
 const q=p(),avatar=q.avatar_url?'<img src="'+E(q.avatar_url)+'" alt="Student profile photo">':E((q.full_name||'S')[0]),fields=[['School',app().school?.name],['Student full name',q.full_name],['Roll number',q.roll_number],['Admission number',q.admission_number],['Class / section',classText()+' / '+sectionText()],['Email address',q.email||u().email],['Parent / Guardian',q.parent_name],['Parent mobile number',q.parent_phone],['Student mobile',q.mobile_number],['City / area',q.city_or_area],['Residential address',q.residential_address]];
 const details='<div class="sp-profile-grid">'+fields.map(([label,value])=>'<div class="sp-detail"><small>'+E(label)+'</small><strong>'+E(value||'Not provided')+'</strong></div>').join('')+'</div>';
 const form='<form id="spProfileForm" class="sp-form two"><label>Student phone<input type="tel" name="phone" maxlength="30" value="'+E(q.mobile_number||'')+'"></label><label>Parent name<input name="parent" maxlength="120" value="'+E(q.parent_name||'')+'"></label><label>Parent phone<input type="tel" name="parentphone" maxlength="30" value="'+E(q.parent_phone||'')+'"></label><label>City / area<input name="city" maxlength="120" value="'+E(q.city_or_area||'')+'"></label><label class="wide">Residential address<textarea name="address" maxlength="500">'+E(q.residential_address||'')+'</textarea></label><label class="wide">Change profile photograph<input type="file" name="photo" accept="image/png,image/jpeg,image/webp"></label><button class="sp-action" type="submit">Save my contact details</button></form><div id="spProfileMsg" hidden></div>';
 renderShell('profile','My Student Profile','Your authorised school identity and personal details. Home address is private.','<div class="sp-intro"><div><span class="sp-kicker">STUDENT IDENTITY</span><h1>'+E(q.full_name)+'</h1><p class="sp-muted">'+E(classText())+' · '+E(sectionText())+'</p>'+badge('Roll '+(q.roll_number||'Unassigned'))+'</div><div class="sp-avatar">'+avatar+'</div></div><div class="sp-grid">'+box('My Details','School records are read-only',details)+box('Edit My Contact Details','Only approved personal fields can be updated',form)+'</div>');
}
async function run(id){
 if(!mine())return;const routes={'student-learning':learning,'student-calendar':calendar,'student-progress':progress,'student-attendance':attendance,'student-homework':homework,'student-planner':planner,'student-questions':questions,'student-portfolio':portfolio,'student-schedule':schedule,'profile':profile,'notices':studentNotices,'notifications':studentNotifications};if(routes[id])await routes[id]();
}

function connectLive(){
 if(!mine())return;
 const current=u().id+':'+sid();if(channel&&activeStudent===current)return;
 if(channel){db().removeChannel(channel);channel=null;}
 activeStudent=current;
 const tables=['noor_student_assignments','noor_student_submissions','school_notices','calendar_events','smart_notes','assessment_results','attendance_records'];
 const c=db().channel('noor-student-live-'+u().id);
 tables.forEach(table=>c.on('postgres_changes',{event:'*',schema:'public',table,filter:'school_id=eq.'+sid()},()=>{
   if(document.visibilityState==='visible')refresh(true);
 }));
 channel=c.subscribe();
}
async function render(){if(!mine())return;document.body.classList.add('noor-student-mode');root().innerHTML='<div class="sp-root">'+empty('Loading your private school records…')+'</div>';loading=true;try{await readAll();overview();connectLive()}catch(e){root().innerHTML='<div class="sp-root">'+empty('Student portal could not load: '+(e.message||e))+'</div>'}finally{loading=false}}
async function refresh(silent=false){if(loading||!mine())return;loading=true;try{await readAll();const id=document.querySelector('#workspace .view.active')?.id?.replace('view-','');if(id==='overview')overview();else await run(id);if(!silent)app().toast?.('Student data refreshed.','success')}catch(e){app().toast?.(e.message||'Refresh failed','error')}finally{loading=false}}
const eventArea=()=>document.getElementById('workspace');
eventArea()?.addEventListener('click',async ev=>{
 if(!mine())return;const t=ev.target.closest('[data-sp-nav],[data-sp-month],[data-sp-cal-mode],[data-sp-day],[data-sp-note-tab],[data-sp-goal],[data-sp-delete-goal],[data-sp-delete-portfolio],[data-sp-refresh]');if(!t)return;
 try{
 if(t.hasAttribute('data-sp-nav'))return app().openView(t.dataset.spNav);
 if(t.hasAttribute('data-sp-refresh'))return await refresh();
 if(t.hasAttribute('data-sp-month')){calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+Number(t.dataset.spMonth),1);const id=document.querySelector('.view.active')?.id;return id==='view-student-attendance'?attendance():calendar();}
 if(t.hasAttribute('data-sp-cal-mode')){mode=t.dataset.spCalMode;return calendar();}
 if(t.hasAttribute('data-sp-day')){dateFocus=t.dataset.spDay;mode='day';if(document.querySelector('.view.active')?.id!=='view-student-calendar')return app().openView('student-calendar');return calendar();}
 if(t.hasAttribute('data-sp-note-tab')){noteTab=t.dataset.spNoteTab;return learning();}
 if(t.hasAttribute('data-sp-goal')){const v=data.plans.find(x=>x.id===t.dataset.spGoal);if(!v)return;const r=await db().from('noor_student_study_plans').update({is_done:!v.is_done}).eq('id',v.id).eq('student_id',u().id);if(r.error)throw r.error;await refresh();return;}
 if(t.hasAttribute('data-sp-delete-goal')){if(!confirm('Remove this study goal?'))return;const r=await db().from('noor_student_study_plans').delete().eq('id',t.dataset.spDeleteGoal).eq('student_id',u().id);if(r.error)throw r.error;return await refresh();}
 if(t.hasAttribute('data-sp-delete-portfolio')){if(!confirm('Remove this portfolio entry?'))return;const r=await db().from('noor_student_portfolio').delete().eq('id',t.dataset.spDeletePortfolio).eq('student_id',u().id);if(r.error)throw r.error;return await refresh();}
 }catch(e){app().toast?.(e.message||String(e),'error')}
});
eventArea()?.addEventListener('change',e=>{if(!mine())return;const t=e.target;if(t.id==='spPeriod'){period=t.value;progress();}if(t.id==='spSubject'){focusSubject=t.value;progress();}if(t.id==='spLearningSubject'){focusSubject=t.value;learning();}if(t.id==='spFocusDate'){dateFocus=t.value;calendar();}});
eventArea()?.addEventListener('input',e=>{if(mine()&&e.target.id==='spNoteSearch')noteQuery=e.target.value;});
eventArea()?.addEventListener('submit',async e=>{
 if(!mine())return;const f=e.target;if(!(f.matches('[data-sp-submit]')||['spGoalForm','spQuestionForm','spPortfolioForm','spProfileForm'].includes(f.id)))return;
 e.preventDefault();const button=f.querySelector('[type=submit]');if(button)button.disabled=true;
 try{
 const v=k=>String(f.elements[k]?.value||'').trim();let output='';
 if(f.hasAttribute('data-sp-submit')){
  const assignment=data.assignments.find(x=>x.id===f.dataset.spSubmit);if(!assignment)throw Error('Assignment no longer available.');
  const answer=v('answer'),file=f.elements.attachment?.files?.[0];if(!answer&&!file)throw Error('Write an answer or choose a file first.');
  const prev=data.submissions.find(x=>x.assignment_id===assignment.id);if(prev?.status==='reviewed')throw Error('Teacher-reviewed submissions cannot be modified.');
  const record={school_id:sid(),assignment_id:assignment.id,student_id:u().id,answer_text:answer};
  const r=prev?await db().from('noor_student_submissions').update({answer_text:answer}).eq('id',prev.id).eq('student_id',u().id).select('id').single():
   await db().from('noor_student_submissions').insert(record).select('id').single();
  if(r.error)throw r.error;
  const id=prev?.id||r.data.id;
  if(file){const path=await uploadAnswer(file,assignment);const upd=await db().from('noor_student_submissions').update({file_path:path}).eq('id',id).eq('student_id',u().id).select('id').single();if(upd.error)throw upd.error;}
  output='Submitted successfully to your school database.';
 }else if(f.id==='spGoalForm'){
  if(v('goal').length<2||!v('date'))throw Error('Enter goal and date.');
  const r=await db().from('noor_student_study_plans').insert({school_id:sid(),student_id:u().id,title:v('goal'),planned_for:v('date')});if(r.error)throw r.error;output='Study goal saved.';
 }else if(f.id==='spQuestionForm'){
  const r=await db().from('noor_student_questions').insert({school_id:sid(),student_id:u().id,class_id:p().class_id,section_id:p().section_id||null,question:v('question')});if(r.error)throw r.error;output='Your question has been sent to authorised class teachers.';
 }else if(f.id==='spPortfolioForm'){
  if(v('url')&&!/^https:\/\//i.test(v('url')))throw Error('Evidence link must use https.');
  const r=await db().from('noor_student_portfolio').insert({school_id:sid(),student_id:u().id,title:v('title'),description:v('description'),evidence_url:v('url')||null});if(r.error)throw r.error;output='Portfolio item saved.';
 }else if(f.id==='spProfileForm'){
  const file=f.elements.photo?.files?.[0];
  const changes={mobile_number:v('phone')||null,parent_name:v('parent')||null,parent_phone:v('parentphone')||null,city_or_area:v('city')||null,residential_address:v('address')||null};
  if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Photo must be JPG, PNG or WebP under 5 MB.');
   const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=u().id+'/profile-'+crypto.randomUUID()+'.'+ext;
   const uploaded=await db().storage.from('student-photos').upload(path,file,{upsert:false,contentType:file.type});if(uploaded.error)throw uploaded.error;changes.avatar_path=path;}
  const r=await db().from('profiles').update(changes).eq('id',u().id).select('*').single();if(r.error)throw r.error;
  Object.assign(p(),r.data);if(r.data.avatar_path){const signed=await db().storage.from('student-photos').createSignedUrl(r.data.avatar_path,3600);p().avatar_url=signed.data?.signedUrl||'';}
  output='Student profile updated.';
 }
 await readAll();const route=f.closest('.view')?.id?.replace('view-','');if(route==='overview')overview();else await run(route);app().toast?.(output,'success');
 }catch(ex){app().toast?.(ex.message||'Unable to save','error');const target=f.closest('.sp-card')?.querySelector('[id$="Msg"],[id^="spSubmitMsg"]');if(target){target.hidden=false;target.className='sp-status error';target.textContent=ex.message||String(ex);}}
 finally{if(button)button.disabled=false}
});
window.NOOR_STUDENT_PORTAL={render,open:run,refresh};
})();