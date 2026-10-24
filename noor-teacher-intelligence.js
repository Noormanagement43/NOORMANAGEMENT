/* NOOR Teacher Intelligence: real school-scoped insights, learning trends, lesson companions & resources. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(sel,el=document)=>el?.querySelector(sel);
const valid=()=>A().profile?.role==='teacher'&&A().profile?.status==='active'&&A().schoolId&&A().user?.id;
const when=d=>d?new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'—';
const today=()=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const g=k=>p.find(x=>x.type===k)?.value;return g('year')+'-'+g('month')+'-'+g('day')};
let revision=0,activeSchool='',channel=null,last={};
const FEATURE_TILES=[
 ['✓ Online / Offline Attendance','attendance','Mark & sync roster'],
 ['◈ Student Learning Gap Detector','gaps','Actual marked results'],
 ['◷ Smart Period Companion','periods','Lessons & homework'],
 ['✦ Rubric Grading Assistant','rubric','Editable marking criteria'],
 ['▤ Smart Syllabus Tracker','syllabus','Chapter progress'],
 ['▦ Assignment Deadline Planner','deadlines','Review and reschedule'],
 ['✎ Digital Teaching Diary','diary','Saved teaching records'],
 ['▧ School Calendar','calendar','School & festival events']
];
const tileMarkup=()=>'<div class="nti-quick-grid">'+FEATURE_TILES.map(([name,key,sub])=>
 '<button type="button" data-nti-quick="'+key+'"><b>'+name+'</b><small>'+sub+'</small></button>').join('')+'</div>';
function handleTileClicks(slot){
 slot.querySelectorAll('[data-nti-quick]').forEach(btn=>btn.onclick=()=>{
 const key=btn.dataset.ntiQuick;
 if(key==='attendance'){document.querySelector('.nt-attendance')?.scrollIntoView({behavior:'smooth',block:'start'});return}
 if(key==='rubric'){A().openView?.('paper-generator');return}
 if(key==='diary'){const first=document.querySelector('#ntiPeriods [data-nti-log]');if(first){first.click();return}A().openView?.('daily-report');return}
 if(key==='calendar'){A().openView?.('school-calendar');return}
 document.querySelector('#nti'+{gaps:'Gaps',periods:'Periods',syllabus:'Syllabus',deadlines:'Deadlines'}[key])?.scrollIntoView({behavior:'smooth',block:'start'});
 });
}

const safeQuery=async(promise)=>{try{const result=await promise;return result.error?{data:[],error:result.error}:{data:result.data||[],error:null}}catch(err){return{data:[],error:err}}};
const empty=(msg)=>'<p class="nti-empty">'+E(msg)+'</p>';
const action=(label,view,icon='↗')=>'<button type="button" class="nti-action" data-nti-route="'+E(view)+'"><span>'+icon+'</span>'+E(label)+'</button>';
const pct=(n)=>Number.isFinite(n)?Math.min(100,Math.max(0,Math.round(n))):0;
const name=(lookup,id,fallback='Class')=>lookup.get(id)||fallback;
const status=(msg,bad=false)=>{const el=$('#ntiMessage');if(el){el.textContent=msg;el.style.color=bad?'#9d3a4a':'#386b58'}};
function planProgress(assigns,units,progress,year){
 if(!assigns.length)return {count:0,lagging:[],expected:null};
 const tracked=units.filter(u=>(!year?.id||u.academic_year_id===year.id)&&assigns.some(a=>a.class_id===u.class_id&&(!a.subject_id||a.subject_id===u.subject_id)&&(!a.section_id||!u.section_id||a.section_id===u.section_id)));
 const currentP=progress.filter(x=>x.teacher_id===A().user.id);
 const byContext=new Map();
 for(const unit of tracked){const key=unit.class_id+':'+(unit.subject_id||'');let group=byContext.get(key);if(!group){group={class_id:unit.class_id,subject_id:unit.subject_id,units:[]};byContext.set(key,group)}
  const scores=currentP.filter(p=>p.syllabus_unit_id===unit.id);
  const progressValue=scores.length?Math.max(...scores.map(p=>p.progress_status==='completed'?100:Number(p.teacher_reported_percentage)||0)):0;
  group.units.push(pct(progressValue));
 }
 let expected=null;
 if(year?.starts_on&&year?.ends_on){const start=new Date(year.starts_on+'T00:00:00Z').getTime(),end=new Date(year.ends_on+'T00:00:00Z').getTime(),now=new Date(today()+'T00:00:00Z').getTime();if(end>start)expected=pct((now-start)/(end-start)*100)}
 const lagging=[...byContext.values()].map(g=>({...g,progress:pct(g.units.reduce((a,b)=>a+b,0)/g.units.length)})).sort((a,b)=>a.progress-b.progress);
 return {count:tracked.length,lagging:expected===null?lagging:lagging.filter(g=>g.progress+15<expected),expected,byContext:[...byContext.values()].map(g=>({...g,progress:pct(g.units.reduce((a,b)=>a+b,0)/g.units.length)}))};
}
async function mount(ctx){
 const slot=$('#ntTeacherIntelligence');if(!slot||!valid())return;
 const token=++revision,app=A(),db=app.db,school=app.schoolId,user=app.user.id,assignments=ctx?.assignments||[];
 const existingAttendance=slot.querySelector('.nt-attendance'),existingPlanners=slot.querySelector('#ntTeacherPlanners');
 if(existingAttendance){slot.insertAdjacentElement('afterend',existingAttendance);if(existingPlanners)existingAttendance.insertAdjacentElement('afterend',existingPlanners);}

 slot.innerHTML='<div class="nti-title"><div><span class="nti-eyebrow">YOUR TEACHING WORKSPACE</span><h2>✦ AI Teacher Command Centre</h2><p>Live records, clear priorities — no made-up numbers.</p></div><button type="button" class="nti-refresh" id="ntiRefresh">↻ Refresh</button></div>'+tileMarkup()+'<div class="nti-loading">Checking your assigned classes, periods and assignments…</div>';
 $('#ntiRefresh',slot).onclick=()=>mount(ctx);handleTileClicks(slot);
 if(!assignments.length){slot.innerHTML+='<div class="nti-banner">Your Principal has not assigned any class yet. Class-specific analytics will appear after assignment.</div>'}
 const classIds=[...new Set(assignments.map(a=>a.class_id))],day=today();
 const schoolFilter=()=>db.from('noor_class_assignments').select('id,title,class_id,section_id,due_at,max_marks,status').eq('school_id',school).eq('teacher_id',user).eq('status','published').order('due_at',{ascending:true}).limit(120);
 const [schoolAssignments,unitRows,progressRows,yearRows,subjectRows,classRows,logs,resources,assessments,supportRows,studentRows,substituteRows]=await Promise.all([
  safeQuery(schoolFilter()),
  classIds.length?safeQuery(db.from('syllabus_units').select('id,class_id,section_id,subject_id,title,academic_year_id').eq('school_id',school).eq('is_active',true).in('class_id',classIds).limit(900)):Promise.resolve({data:[]}),
  safeQuery(db.from('syllabus_progress').select('syllabus_unit_id,teacher_id,progress_status,teacher_reported_percentage').eq('school_id',school).eq('teacher_id',user).limit(900)),
  safeQuery(db.from('academic_years').select('id,starts_on,ends_on,is_current,label').eq('school_id',school).eq('is_current',true).limit(1)),
  safeQuery(db.from('subjects').select('id,name').eq('school_id',school).limit(300)),
  classIds.length?safeQuery(db.from('classes').select('id,name').eq('school_id',school).in('id',classIds).limit(150)):Promise.resolve({data:[]}),
  safeQuery(db.from('noor_teacher_lesson_logs').select('id,period_id,class_date,topic,homework,reflection,exit_ticket').eq('school_id',school).eq('teacher_id',user).eq('class_date',day).limit(40)),
  safeQuery(db.from('noor_teacher_resource_links').select('id,title,resource_url,visibility,class_id,section_id,created_at').eq('school_id',school).eq('teacher_id',user).order('created_at',{ascending:false}).limit(16)),
  safeQuery(db.from('school_assessments').select('id,class_id,section_id,subject_id,max_marks,assessment_date').eq('school_id',school).eq('created_by',user).in('status',['conducted','marked']).order('assessment_date',{ascending:false}).limit(50)),
  safeQuery(db.from('noor_teacher_student_support').select('id,student_id,note,support_action,follow_up_on,status,created_at').eq('school_id',school).eq('teacher_id',user).order('created_at',{ascending:false}).limit(20)),
  classIds.length?safeQuery(db.from('profiles').select('id,full_name,roll_number,class_id,section_id').eq('school_id',school).eq('role','student').eq('status','active').in('class_id',classIds).limit(500)):Promise.resolve({data:[]}),
  safeQuery(db.from('noor_teacher_substitutions').select('id,period_id,class_date,instructions,original_teacher_id').eq('school_id',school).eq('substitute_teacher_id',user).gte('class_date',day).order('class_date').limit(20))
 ]);
 if(token!==revision||!valid()||A().schoolId!==school||!slot.isConnected)return;
 const ass=schoolAssignments.data||[],idList=ass.map(x=>x.id),tests=assessments.data||[],testIds=tests.map(t=>t.id);
 const [submissions,results]=await Promise.all([
  idList.length?safeQuery(db.from('noor_assignment_submissions').select('id,assignment_id,graded_at').eq('school_id',school).in('assignment_id',idList).limit(800)):Promise.resolve({data:[]}),
  testIds.length?safeQuery(db.from('assessment_results').select('assessment_id,marks_obtained').eq('school_id',school).in('assessment_id',testIds).limit(600)):Promise.resolve({data:[]})
 ]);
 if(token!==revision||A().schoolId!==school||!slot.isConnected)return;
 const cMap=new Map((classRows.data||[]).map(x=>[x.id,x.name])),sMap=new Map((subjectRows.data||[]).map(x=>[x.id,x.name]));
 const periodToday=(ctx?.periods||[]).filter(p=>p.approval_status==='approved'&&p.weekday===new Date(day+'T12:00:00+05:30').getUTCDay());
 const doneCount=periodToday.filter(p=>(ctx?.runs||[]).some(r=>r.period_id===p.id&&r.status==='done')).length;
 const ungraded=(submissions.data||[]).filter(s=>!s.graded_at).length;
 const dueSoon=ass.filter(x=>new Date(x.due_at).getTime()<Date.now()+3*864e5 && new Date(x.due_at).getTime()>=Date.now());
 const overdue=ass.filter(x=>new Date(x.due_at)<new Date());
 const year=(yearRows.data||[])[0],progress=planProgress(assignments,unitRows.data||[],progressRows.data||[],year);
 const workload=new Map();for(const x of ass){const d=x.due_at?.slice(0,10);if(d)workload.set(d,(workload.get(d)||0)+1)}
 const crowded=[...workload].filter(x=>x[1]>=3).sort((a,b)=>a[0].localeCompare(b[0])).slice(0,2);
 const gaps=[];
 for(const t of tests){
  const scores=(results.data||[]).filter(x=>x.assessment_id===t.id&&Number.isFinite(Number(x.marks_obtained)));
  if(scores.length<3||!(Number(t.max_marks)>0))continue;
  const avg=scores.reduce((v,x)=>v+Number(x.marks_obtained),0)/scores.length/Number(t.max_marks)*100;
  if(avg<60)gaps.push({class_id:t.class_id,subject_id:t.subject_id,avg:pct(avg),count:scores.length});
 }
 gaps.sort((a,b)=>a.avg-b.avg);
 const tasks=(ctx?.assignedTasks||[]).filter(x=>!['completed','cancelled','done'].includes(x.status)).length;
 const errors=[schoolAssignments,unitRows,progressRows,yearRows,submissions,results].filter(x=>x.error).map(x=>x.error.message);
 last={ctx,ass,resources:resources.data||[],logs:logs.data||[],periodToday,progress,gaps,classes:cMap,subjects:sMap,day,school};
 const kpi=(value,label,detail,cls)=>'<div class="nti-kpi '+cls+'"><strong>'+E(value)+'</strong><span>'+E(label)+'</span><small>'+E(detail)+'</small></div>';
 const hints=[
  !assignments.length?'Ask Principal to assign your class and section.':null,
  periodToday.length&&doneCount<periodToday.length?(periodToday.length-doneCount)+' approved periods still to complete.':null,
  tasks?tasks+' Principal tasks need attention.':null,
  ungraded?ungraded+' student responses are awaiting your review.':null,
  progress.expected!==null&&progress.lagging.length?progress.lagging.length+' teaching groups are below indicative academic-year pacing.':null,
  !progress.count&&assignments.length?'No syllabus units recorded yet. Add curriculum units to enable pacing insights.':null,
  crowded.length?'Check assignment workload: '+crowded.map(x=>x[1]+' tasks due '+x[0]).join('; ')+'.':null
 ].filter(Boolean);
 const intro=hints.length?hints.map(x=>'<li>'+E(x)+'</li>').join(''):'<li>No outstanding alerts from the records currently available.</li>';
 const pacing=progress.byContext?.length?progress.byContext.slice(0,6).map(x=>'<div class="nti-meter-row"><div><b>'+E(name(cMap,x.class_id))+'</b><small>'+E(name(sMap,x.subject_id,'All subjects'))+' · '+x.units.length+' units</small></div><div class="nti-meter"><span style="width:'+x.progress+'%"></span></div><strong>'+x.progress+'%</strong></div>').join(''):empty('Add school syllabus units to see actual class progress.');
 const gapMarkup=gaps.length?gaps.slice(0,5).map(x=>'<div class="nti-insight"><b>'+E(name(cMap,x.class_id))+' · '+E(name(sMap,x.subject_id,'Assessment'))+'</b><span>'+x.avg+'% class average from '+x.count+' assessed responses · teacher review suggested</span></div>').join(''):empty(tests.length?'No reliable subject-level revision flags (requires at least three marked responses).':'No completed/marked assessments by this teacher yet.');
 const lessonMarkup=periodToday.length?periodToday.map(p=>{
   const run=(ctx?.runs||[]).find(r=>r.period_id===p.id),saved=(logs.data||[]).find(l=>l.period_id===p.id);
   return '<div class="nti-lesson"><div><b>Period '+E(p.period_number)+' · '+E(p.subject_name)+'</b><small>'+E(p.class_label)+' · '+E(p.start_time?.slice(0,5))+'–'+E(p.end_time?.slice(0,5))+' · '+E(run?.status||'scheduled')+'</small>'+
    (saved?'<small class="nti-saved">Lesson diary: '+E(saved.topic)+'</small>':'')+'</div><button type="button" data-nti-log="'+E(p.id)+'">'+(saved?'Edit diary':'Lesson diary')+'</button></div>'
  }).join(''):empty('No approved periods scheduled for today.');
 const links=(resources.data||[]).length?(resources.data||[]).slice(0,5).map(r=>'<div class="nti-resource"><a rel="noopener noreferrer" target="_blank" href="'+E(r.resource_url)+'">'+E(r.title)+'</a><small>'+E(r.visibility==='students'?'Shared with students':'Teacher only')+'</small></div>').join(''):empty('No resources saved yet.');
 const visibleStudents=(studentRows.data||[]).filter(x=>assignments.some(a=>a.class_id===x.class_id&&(!a.section_id||a.section_id===x.section_id)));
 const studentNames=new Map(visibleStudents.map(x=>[x.id,x.full_name]));
 const supportOptions=visibleStudents.map(x=>'<option value="'+E(x.id)+'">'+E(x.full_name)+(x.roll_number?' · '+E(x.roll_number):'')+'</option>').join('');
 const supportList=(supportRows.data||[]).slice(0,6).map(x=>'<div class="nti-insight"><b>'+E(studentNames.get(x.student_id)||'Assigned student')+' · '+E(x.status)+'</b><span>'+E(x.note.slice(0,160))+(x.follow_up_on?' · Follow up '+E(x.follow_up_on):'')+'</span>'+(x.status!=='closed'?'<button type="button" data-nti-close="'+E(x.id)+'" class="nti-refresh">Mark resolved ✓</button>':'')+'</div>').join('')||empty('No support follow-ups recorded.');
 const substitutionList=(substituteRows.data||[]).slice(0,5).map(x=>'<div class="nti-insight"><b>Substitute class · '+E(x.class_date)+'</b><span>'+E(x.instructions||'Principal approved substitute period')+'</span></div>').join('')||empty('No substitute handover assigned.');
 const contextOpts=assignments.map((x,i)=>'<option value="'+i+'">'+E(name(cMap,x.class_id))+(x.section_id?' · Assigned section':' · All sections')+'</option>').join('');
 slot.innerHTML='<div class="nti-title"><div><span class="nti-eyebrow">LIVE · SCHOOL RECORDS</span><h2>✦ AI Teacher Command Centre</h2><p>Your teaching priorities, based on saved NOOR data.</p></div><button id="ntiRefresh" type="button" class="nti-refresh">↻ Refresh</button></div>'+
 tileMarkup()+'<div class="nti-kpis">'+kpi(doneCount+' / '+periodToday.length,'Periods completed','Today · approved timetable','violet')+
 kpi(ungraded,'Answers to review','Teacher-published assignments','peach')+
 kpi(tasks,'Pending school tasks','Assigned by Principal','teal')+
 kpi(progress.count?progress.count:'—','Syllabus units','Assigned class curriculum','rose')+'</div>'+
 '<div class="nti-grid"><section class="nti-pane nti-brief"><h3>✦ Your teaching brief</h3><ul>'+intro+'</ul><p class="nti-help">Deterministic insights, not an AI-generated claim. This view never invents school results.</p></section>'+
 '<section class="nti-pane" id="ntiGaps"><div class="nti-subhead"><h3>Student Learning Gap Detector</h3><button type="button" data-nti-route="assessments">Assessments ↗</button></div>'+gapMarkup+
 '<p class="nti-help">Based on aggregated marked scores. This does not label individual students or diagnose learning ability.</p></section>'+
 '<section class="nti-pane" id="ntiSyllabus"><div class="nti-subhead"><h3>Smart Syllabus Tracker</h3><button type="button" data-nti-route="daily-report">Teaching report ↗</button></div>'+
 (progress.expected===null?'<p class="nti-help">Set the current academic-year dates to enable pacing comparisons.</p>':'<p class="nti-help">Indicative time elapsed this academic year: '+progress.expected+'%. This is not a mandatory chapter deadline.</p>')+pacing+'</section>'+
 '<section class="nti-pane" id="ntiPeriods"><h3>Smart Period Companion</h3><p class="nti-help">Record the topic, homework and exit ticket after teaching. Visible to authorized Principal staff.</p>'+lessonMarkup+'</section></div>'+
 '<section class="nti-pane nti-tools"><div class="nti-subhead"><h3>Smart Teaching Tools</h3><span class="nti-pill">Connected to NOOR</span></div><div class="nti-actions">'+
 action('Smart Notes','teaching','✦')+action('Generate paper','paper-generator','▤')+action('Weekly lesson plan','weekly-plan','◷')+
 action('Daily teaching diary','daily-report','✎')+action('Review assignments','paper-generator','✓')+
 action('School calendar','school-calendar','▦')+action('Teacher notices','notices','◇')+
 action('School messages','notifications','✉')+'</div>'+
 '<p class="nti-help">More workflows, including confidential rubrics and substitute handovers, require Principal-approved setup.</p></section>'+
 '<section class="nti-pane nti-tools"><div class="nti-subhead"><h3>Private Student Support Follow-ups</h3><span class="nti-pill">Teacher + authorized Principal only</span></div>'+
 '<p class="nti-help">Record supportive academic follow-ups for enrolled students. Avoid labels or sensitive medical details.</p>'+
 '<form id="ntiSupportForm" class="nti-resource-form"><label>My assigned student<select name="student_id" required>'+supportOptions+'</select></label>'+
 '<label>Academic observation<input name="note" minlength="4" maxlength="2500" required placeholder="Reading practice discussed"></label>'+
 '<label>Support plan<input name="support_action" maxlength="1500" placeholder="Offer extra practice"></label>'+
 '<label>Follow-up date<input name="follow_up_on" type="date"></label><button type="submit" '+(visibleStudents.length?'':'disabled')+'>Save follow-up</button></form>'+
 '<div>'+supportList+'</div></section>'+
 '<section class="nti-pane nti-tools"><div class="nti-subhead"><h3>Substitute Teacher Handover</h3><span class="nti-pill">Principal assigned</span></div>'+
 '<p class="nti-help">Authorized substitute periods and their teaching instructions appear here.</p>'+substitutionList+'</section>'+
 '<section class="nti-pane nti-tools"><div class="nti-subhead"><h3>Teaching Resource Library</h3><span class="nti-pill">Links saved to your school</span></div>'+
 '<form id="ntiResourceForm" class="nti-resource-form"><label>Assigned class<select name="context" required>'+contextOpts+'</select></label>'+
 '<label>Resource title<input name="title" placeholder="Revision video or notes" maxlength="160" required></label>'+
 '<label>HTTPS link<input name="url" type="url" placeholder="https://..." required></label>'+
 '<label>Access<select name="visibility"><option value="teachers">Teacher only</option><option value="students">Share with class students</option></select></label>'+
 '<button type="submit" '+(assignments.length?'':'disabled')+'>Save Resource</button></form><div id="ntiResources">'+links+'</div></section>'+
 (dueSoon.length?'<div class="nti-banner">'+E(dueSoon.length+' assignment deadlines are coming in the next 3 days.')+'</div>':'')+
 (errors.length?'<p class="nti-error">Some records could not be read: '+E(errors.join('; '))+'</p>':'')+
 '<p id="ntiMessage" role="status" class="nti-feedback"></p>';
 const attendanceNode=document.querySelector('#view-overview .nt-attendance'),planningNode=document.getElementById('ntTeacherPlanners');
 const deepPanels=slot.querySelector('.nti-grid');
 if(deepPanels&&attendanceNode){deepPanels.insertAdjacentElement('beforebegin',attendanceNode);if(planningNode)attendanceNode.insertAdjacentElement('afterend',planningNode);}
 $('#ntiRefresh',slot).onclick=()=>mount(ctx);handleTileClicks(slot);
 slot.querySelectorAll('[data-nti-route]').forEach(b=>b.onclick=()=>A().openView?.(b.dataset.ntiRoute));
 slot.querySelectorAll('[data-nti-log]').forEach(b=>b.onclick=()=>editLesson(b.dataset.ntiLog));
 $('#ntiResourceForm',slot).onsubmit=saveResource;
 $('#ntiSupportForm',slot).onsubmit=saveStudentSupport;
 slot.querySelectorAll('[data-nti-close]').forEach(b=>b.onclick=async()=>{b.disabled=true;const app=A(),r=await app.db.from('noor_teacher_student_support').update({status:'closed'}).eq('id',b.dataset.ntiClose).eq('school_id',app.schoolId).eq('teacher_id',app.user.id);if(r.error){status(r.error.message,true);b.disabled=false}else await mount(last.ctx)});
 connectLive(school,user);
}
function editLesson(periodId){
 const data=last,p=data.periodToday?.find(x=>x.id===periodId);if(!p)return status('Only today’s approved periods can be recorded.',true);
 const saved=data.logs.find(x=>x.period_id===periodId);
 const existing=document.querySelector('#ntiLessonDialog');existing?.remove();
 const d=document.createElement('dialog');d.id='ntiLessonDialog';d.className='nti-dialog';
 d.innerHTML='<form method="dialog" class="nti-modal"><div class="nti-subhead"><h3>Lesson Companion · Period '+E(p.period_number)+'</h3><button value="cancel" aria-label="Close" type="submit">✕</button></div>'+
 '<p class="nti-help">'+E(p.class_label)+' · '+E(p.subject_name)+' · '+E(data.day)+'</p>'+
 '<label>Topic taught<input name="topic" required maxlength="200" minlength="2" value="'+E(saved?.topic||'')+'" placeholder="What did you teach?"></label>'+
 '<label>Homework / practice<textarea name="homework" maxlength="2500" placeholder="Optional homework">'+E(saved?.homework||'')+'</textarea></label>'+
 '<label>Exit ticket question<textarea name="exit_ticket" maxlength="1500" placeholder="One question to check understanding">'+E(saved?.exit_ticket||'')+'</textarea></label>'+
 '<label>Teacher notes<textarea name="reflection" maxlength="2500" placeholder="What should be reviewed next lesson?">'+E(saved?.reflection||'')+'</textarea></label>'+ '<div class="nti-modal-actions"><select name="voiceLang" aria-label="Speech language"><option value="en-IN">English</option><option value="hi-IN">Hindi</option><option value="te-IN">Telugu</option><option value="ur-PK">Urdu</option></select><button type="button" id="ntiVoice">🎙 Dictate topic</button></div>'+ '<p class="nti-help">Optional browser speech recognition. Audio processing depends on your browser; NOOR does not store an audio recording.</p>'+ '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="publishExit" style="width:auto" /> Publish exit question as a 1-mark assignment after saving (requires approved class link)</label>'+
 '<p id="ntiLessonStatus" role="status"></p><div class="nti-modal-actions"><button type="submit" value="cancel">Cancel</button><button type="button" class="nti-primary" id="ntiSaveLesson">Save lesson</button></div></form>';
 document.body.append(d);d.showModal?.();if(!d.open)d.setAttribute('open','');
 d.addEventListener('close',()=>d.remove(),{once:true});
 $('#ntiVoice',d).onclick=()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){$('#ntiLessonStatus',d).textContent='Voice dictation is not supported on this browser. Use the text field.';return}
  const rec=new SpeechRecognition();rec.lang=$('[name="voiceLang"]',d).value;rec.interimResults=false;rec.maxAlternatives=1;
  $('#ntiLessonStatus',d).textContent='Microphone permission is requested by your browser. Speak your topic.';
  rec.onresult=e=>{const words=e.results?.[0]?.[0]?.transcript||'';const input=$('[name="topic"]',d);input.value=(input.value+' '+words).trim().slice(0,200);$('#ntiLessonStatus',d).textContent='Dictation added. Review and save.'};
  rec.onerror=e=>{$('#ntiLessonStatus',d).textContent='Dictation unavailable: '+e.error};
  try{rec.start()}catch(err){$('#ntiLessonStatus',d).textContent=err.message}
  d.addEventListener('close',()=>{try{rec.abort()}catch{}},{once:true});
 };
 $('#ntiSaveLesson',d).onclick=async()=>{
  const form=$('form',d),v=x=>String(form.elements[x]?.value||'').trim(),topic=v('topic');if(topic.length<2)return $('#ntiLessonStatus',d).textContent='Topic needs at least 2 characters.';
  const app=A(),row={topic,homework:v('homework')||null,exit_ticket:v('exit_ticket')||null,reflection:v('reflection')||null},button=$('#ntiSaveLesson',d);
  button.disabled=true;$('#ntiLessonStatus',d).textContent='Saving verified class diary…';
  const query=saved?app.db.from('noor_teacher_lesson_logs').update(row).eq('id',saved.id).eq('teacher_id',app.user.id).eq('school_id',app.schoolId):
   app.db.from('noor_teacher_lesson_logs').insert({...row,teacher_id:app.user.id,school_id:app.schoolId,period_id:p.id,class_date:data.day});
  const res=await query;
  if(res.error){$('#ntiLessonStatus',d).textContent=res.error.message;button.disabled=false;return;}
  const publish=f.elements.publishExit.checked,exitTicket=v('exit_ticket');
  if(publish&&exitTicket){
   if(!window.NOOR_ASSIGNMENT_PORTAL?.publish){$('#ntiLessonStatus',d).textContent='Lesson saved, but assignment publisher is unavailable. Reload the dashboard.';button.disabled=false;return}
   if(!p.class_id){$('#ntiLessonStatus',d).textContent='Lesson saved, but this period has no official class link. Principal must assign it before publishing.';button.disabled=false;return}
   const due=new Date(new Date(data.day+'T12:00:00+05:30').getTime()+48*3600*1000).toISOString();
   try{await window.NOOR_ASSIGNMENT_PORTAL?.publish?.({title:'Exit Ticket: '+topic,body:exitTicket,
    context:{class_id:p.class_id,section_id:p.section_id,subject_id:p.subject_id},due_at:due,max_marks:1})}
   catch(err){$('#ntiLessonStatus',d).textContent='Lesson saved; exit ticket could not be published: '+err.message;button.disabled=false;return}
  }
  d.close();app.toast?.('Lesson diary saved to school records.','success');await mount(data.ctx);
 };
}
async function saveStudentSupport(e){
 e.preventDefault();const f=e.currentTarget,app=A(),student_id=f.elements.student_id.value,
 note=f.elements.note.value.trim(),support_action=f.elements.support_action.value.trim(),
 follow_up_on=f.elements.follow_up_on.value||null,button=f.querySelector('[type="submit"]');
 if(note.length<4||!student_id)return status('Select your student and write a useful academic observation.',true);
 button.disabled=true;status('Saving private academic support follow-up…');
 const r=await app.db.from('noor_teacher_student_support').insert({school_id:app.schoolId,teacher_id:app.user.id,student_id,note,
 support_action:support_action||null,follow_up_on,status:'open'});
 button.disabled=false;if(r.error)return status('Support follow-up could not be saved: '+r.error.message,true);
 app.toast?.('Student follow-up saved privately.','success');await mount(last.ctx);
}
async function saveResource(e){
 e.preventDefault();const f=e.currentTarget,app=A(),ctx=last.ctx,i=Number(f.elements.context?.value),target=ctx.assignments?.[i];
 if(!target)return status('Choose your official assigned class.',true);
 const url=f.elements.url.value.trim(),title=f.elements.title.value.trim(),visibility=f.elements.visibility.value;
 if(!/^https:\/\/\S+$/i.test(url))return status('Use a valid HTTPS link.',true);
 const btn=f.querySelector('[type="submit"]');btn.disabled=true;status('Saving resource…');
 const r=await app.db.from('noor_teacher_resource_links').insert({school_id:app.schoolId,teacher_id:app.user.id,class_id:target.class_id,section_id:target.section_id||null,
 title,resource_url:url,visibility});
 btn.disabled=false;if(r.error)return status('Cannot save resource: '+r.error.message,true);
 app.toast?.('Resource saved securely.','success');await mount(ctx);
}
function connectLive(school,uid){
 const app=A();if(channel&&activeSchool!==school+':'+uid){app.db.removeChannel(channel);channel=null}
 if(channel)return;
 activeSchool=school+':'+uid;
 let queued=false;
 const callback=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;const slot=$('#ntTeacherIntelligence');if(slot?.isConnected&&$('#view-overview')?.classList.contains('active'))mount(last.ctx)})};
 channel=app.db.channel('noor-teacher-command-'+school+'-'+uid);
 for(const table of ['noor_teacher_lesson_logs','noor_teacher_period_runs','noor_class_assignments','noor_assignment_submissions','syllabus_progress','attendance_sessions']){
  channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'school_id=eq.'+school},callback);
 }
 channel.subscribe();
}
window.NOOR_TEACHER_INTELLIGENCE={mount};
})();