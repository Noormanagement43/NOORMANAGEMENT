/* NOOR AI assessment marks and in-app notifications. Additive module bound to the existing authenticated Supabase client. */
(() => {
 'use strict';
 const A=()=>window.NOOR_AI_APP||{};
 const db=()=>A().db;
 const me=()=>A().user;
 const profile=()=>A().profile;
 const school=()=>A().schoolId;
 const role=()=>profile()?.role||'';
 const $=id=>document.getElementById(id);
 const E=v=>(A().escapeHtml|| (x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))))(v??'');
 const msg=(s,t)=>A().toast?A().toast(s,t||'info'):alert(s);
 const error=e=>e?.message||'Could not complete the request. Check your permissions and connection.';
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const shell=(title,desc,body)=>'<div class="acad-page"><section class="acad-hero"><div class="eyebrow">NOOR AI · ACADEMIC RECORDS</div><h1>'+E(title)+'</h1><p>'+E(desc)+'</p></section>'+body+'</div>';
 const empty=s=>'<div class="acad-empty">'+E(s)+'</div>';
 const notice=(s,kind)=>'<div class="acad-notice '+(kind||'')+'">'+E(s)+'</div>';
 const btn=(id,s,cl)=>'<button class="acad-btn '+(cl||'')+'" type="button" id="'+id+'">'+E(s)+'</button>';
 const opts=(rows,key,label,first)=>'<option value="">'+E(first||'Select')+'</option>'+(rows||[]).map(x=>'<option value="'+E(x[key])+'">'+E(x[label])+'</option>').join('');
 const val=id=>$(id)?.value?.trim?.()||'';
 const table=(headers,rows)=>rows?.length?'<div class="acad-table-wrap"><table class="acad-table"><thead><tr>'+headers.map(h=>'<th>'+E(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>':empty('No saved records match this view.');
 const status=(id,text,kind)=>{const el=$(id);if(el){el.className='acad-notice '+(kind||'');el.textContent=text;el.style.display='block';}};
 const st={years:[],classes:[],sections:[],subjects:[],assessments:[],roster:[],results:[],selectedAssessment:null};
 async function canManage(){
  if(['creator','owner','principal'].includes(role()))return true;
  if(role()!=='manager')return false;
  const q=await db().from('role_permissions').select('is_allowed').eq('school_id',school()).eq('role','manager').eq('permission_key','manage_assessments').maybeSingle();
  return !q.error&&q.data?.is_allowed===true;
 }
 async function loadContext(){
  const [y,c,s,sub]=await Promise.all([
   db().from('academic_years').select('id,label,is_current').eq('school_id',school()).order('starts_on',{ascending:false}),
   db().from('classes').select('id,name').eq('school_id',school()).eq('is_active',true).order('name'),
   db().from('sections').select('id,class_id,name').eq('is_active',true).order('name'),
   db().from('subjects').select('id,name,class_id').eq('school_id',school()).eq('is_active',true).order('name')
  ]);
  for(const r of [y,c,s,sub])if(r.error)throw r.error;
  st.years=y.data||[];st.classes=c.data||[];st.sections=s.data||[];st.subjects=sub.data||[];
  if(role()==='teacher'){
   const as=await db().from('teacher_assignments').select('class_id,section_id,subject_id,is_active').eq('school_id',school()).eq('teacher_id',me().id).eq('is_active',true);
   if(as.error)throw as.error;
   const ca=new Set((as.data||[]).map(x=>x.class_id));st.classes=st.classes.filter(x=>ca.has(x.id));
   const su=new Set((as.data||[]).map(x=>x.subject_id).filter(Boolean));if(su.size)st.subjects=st.subjects.filter(x=>su.has(x.id));
  }
 }
 function contextHtml(){
  return '<div class="acad-fields"><div class="field"><label for="asYear">Academic year *</label><select id="asYear" required>'+opts(st.years,'id','label','Select year')+'</select></div><div class="field"><label for="asClass">Class *</label><select id="asClass" required>'+opts(st.classes,'id','name','Select class')+'</select></div><div class="field"><label for="asSection">Section</label><select id="asSection">'+opts(st.sections.filter(x=>st.classes.some(c=>c.id===x.class_id)),'id','name','Whole class')+'</select></div><div class="field"><label for="asSubject">Subject *</label><select id="asSubject" required>'+opts(st.subjects,'id','name','Select subject')+'</select></div></div>';
 }
 function bindContext(){
  if($('asClass'))$('asClass').onchange=()=>{$('asSection').innerHTML=opts(st.sections.filter(x=>x.class_id===val('asClass')),'id','name','Whole class');fillSubject()};
  if($('asSubject'))$('asSubject').onchange=fillSubject;
  if($('asYear')){const y=st.years.find(x=>x.is_current)||st.years[0];if(y)$('asYear').value=y.id;}
  if(st.classes.length===1)$('asClass').value=st.classes[0].id;
  if(st.subjects.length===1)$('asSubject').value=st.subjects[0].id;
  fillSubject();
 }
 function fillSubject(){
  if(!$('asSubject'))return;
  const c=val('asClass'),previous=val('asSubject');
  const list=st.subjects.filter(s=>!s.class_id||!c||s.class_id===c);
  $('asSubject').innerHTML=opts(list,'id','name','Select subject');if(list.some(x=>x.id===previous))$('asSubject').value=previous;
 }
 function renderAssessment(){
  if(role()==='student')return renderStudentAssessmentResults();
  const body='<div class="acad-grid"><section class="acad-panel"><h3>Create assessment / test</h3><p>Saved assessment metadata does not imply that a test has been conducted. Enter actual marks only after marking student work.</p><form id="assessmentForm" class="acad-form">'+contextHtml()+
  '<div class="acad-fields"><div class="field full"><label for="asTitle">Assessment title *</label><input id="asTitle" required maxlength="180" placeholder="Unit test / chapter assessment"></div><div class="field"><label for="asType">Type</label><select id="asType"><option value="test">Test</option><option value="exam">Exam</option><option value="quiz">Quiz</option><option value="assignment">Assignment</option><option value="project">Project</option><option value="oral">Oral</option><option value="practical">Practical</option><option value="other">Other</option></select></div><div class="field"><label for="asDate">Assessment date *</label><input id="asDate" type="date" value="'+today()+'" required></div><div class="field"><label for="asMaxMarks">Maximum marks *</label><input id="asMaxMarks" type="number" min="0.5" step="0.5" value="100" required></div><div class="field full"><label for="asInstructions">Instructions / chapter</label><textarea id="asInstructions"></textarea></div></div><div id="assessmentStatus" style="display:none"></div>'+btn('saveAssessment','Save assessment')+'</form></section><section class="acad-panel"><div class="acad-toolbar"><div><h3>Saved assessments</h3><p>Open an assessment to enter actual marks, where authorized.</p></div>'+btn('refreshAssessments','Refresh','alt')+'</div><div id="assessmentRows">'+empty('Loading assessments…')+'</div></section></div><section id="marksWorkspace" class="acad-panel" style="margin-top:16px;display:none"></section>';
  $('view-assessments').innerHTML=shell('Assessments & Marks','Assessments, Tests & Marks','Class, subject and academic-year results are stored as school records. Teachers can work only in their assigned teaching context.',body);
  $('assessmentForm').onsubmit=saveAssessment;$('refreshAssessments').onclick=loadAssessments;
  loadContext().then(()=>{bindContext();loadAssessments()}).catch(e=>status('assessmentStatus',error(e),'error'));
 }
 async function saveAssessment(e){
  e.preventDefault();
  try{
   if(role()==='manager'&&!(await canManage()))throw new Error('Your Manager role needs the manage_assessments permission.');
   const row={school_id:school(),academic_year_id:val('asYear'),class_id:val('asClass'),section_id:val('asSection')||null,subject_id:val('asSubject'),title:val('asTitle'),assessment_type:val('asType'),assessment_date:val('asDate'),max_marks:Number(val('asMaxMarks')),instructions:val('asInstructions')||null,status:'planned',created_by:me().id};
   if(!row.academic_year_id||!row.class_id||!row.subject_id||!row.title||!Number.isFinite(row.max_marks)||row.max_marks<=0)throw new Error('Complete year, class, subject, title and maximum marks.');
   const r=await db().from('school_assessments').insert(row).select('id').single();if(r.error)throw r.error;
   status('assessmentStatus','Assessment saved as PLANNED. It is not marked conducted or completed.','success');$('assessmentForm').reset();bindContext();await loadAssessments();
  }catch(e){status('assessmentStatus',error(e),'error')}
 }
 async function loadAssessments(){
  const box=$('assessmentRows');if(!box)return;
  let q=db().from('school_assessments').select('id,academic_year_id,class_id,section_id,subject_id,title,assessment_type,assessment_date,max_marks,status,instructions').eq('school_id',school()).order('assessment_date',{ascending:false}).limit(250);
  const r=await q;if(r.error){box.innerHTML=notice(error(r.error),'error');return;}st.assessments=r.data||[];
  if(role()==='teacher'){
   const assignments=await db().from('teacher_assignments').select('class_id,section_id,subject_id').eq('school_id',school()).eq('teacher_id',me().id).eq('is_active',true);
   if(assignments.error){box.innerHTML=notice(error(assignments.error),'error');return;}
   const allowed=assignments.data||[];
   st.assessments=st.assessments.filter(a=>allowed.some(x=>x.class_id===a.class_id&&(!x.section_id||!a.section_id||x.section_id===a.section_id)&&(!x.subject_id||x.subject_id===a.subject_id)));
  }
  box.innerHTML=table(['Date','Title','Class / subject','Maximum','Status','Action'],st.assessments.map(a=>{
   const klass=st.classes.find(x=>x.id===a.class_id)?.name||'Class';
   const subject=st.subjects.find(x=>x.id===a.subject_id)?.name||'Subject';
   return '<tr><td>'+E(a.assessment_date)+'</td><td><b>'+E(a.title)+'</b><div class="acad-muted">'+E(a.assessment_type)+'</div></td><td>'+E(klass)+'<div class="acad-muted">'+E(subject)+'</div></td><td>'+E(a.max_marks)+'</td><td>'+E(a.status)+'</td><td><button class="acad-btn alt" type="button" data-mark-assessment="'+E(a.id)+'">Open / enter marks</button></td></tr>';
  }));
  box.querySelectorAll('[data-mark-assessment]').forEach(b=>b.onclick=()=>openMarks(b.dataset.markAssessment));
 }
 async function openMarks(id){
  const a=st.assessments.find(x=>x.id===id);if(!a)return;
  const box=$('marksWorkspace');box.style.display='block';st.selectedAssessment=a;
  try{
   const [roster,previous]=await Promise.all([
    db().from('profiles').select('id,full_name,roll_number,section_id,status').eq('school_id',school()).eq('role','student').eq('status','active').eq('class_id',a.class_id).order('full_name').limit(600),
    db().from('assessment_results').select('student_id,marks_obtained,grade_label,teacher_feedback').eq('assessment_id',id).eq('school_id',school())
   ]);
   if(roster.error)throw roster.error;if(previous.error)throw previous.error;
   st.roster=(roster.data||[]).filter(s=>!a.section_id||s.section_id===a.section_id);
   st.results=previous.data||[];
   const students=st.roster;
   box.innerHTML='<div class="acad-toolbar"><div><h3>Enter marks: '+E(a.title)+'</h3><p>Maximum marks: '+E(a.max_marks)+' · Status: '+E(a.status)+'. Saves are checked against the assessment maximum and class/section on the database.</p></div>'+btn('closeMarks','Close','alt')+'</div><div id="marksStatus" style="display:none"></div>'+table(['Student','Roll','Marks obtained','Grade (optional)','Teacher feedback'],students.map(s=>{
    const old=st.results.find(x=>x.student_id===s.id);
    return '<tr><td>'+E(s.full_name)+'</td><td>'+E(s.roll_number||'—')+'</td><td><input type="number" min="0" max="'+E(a.max_marks)+'" step="0.5" data-marks="'+E(s.id)+'" value="'+(old?E(old.marks_obtained):'')+'" aria-label="Marks for '+E(s.full_name)+'"></td><td><input data-grade="'+E(s.id)+'" value="'+E(old?.grade_label||'')+'" maxlength="24" placeholder="—"></td><td><input data-feedback="'+E(s.id)+'" value="'+E(old?.teacher_feedback||'')+'" maxlength="1200" placeholder="Optional"></td></tr>';
   }))+'<div class="acad-actions" style="margin-top:14px">'+btn('saveMarks','Save marks','gold')+btn('markAssessmentConducted','Mark conducted','alt')+btn('printMarks','Print / Save PDF','alt')+'</div>';
   $('closeMarks').onclick=()=>box.style.display='none';$('saveMarks').onclick=saveMarks;$('markAssessmentConducted').onclick=()=>setAssessmentStatus('conducted');$('printMarks').onclick=()=>window.print();
  }catch(e){box.innerHTML=notice(error(e),'error');}
 }
 async function saveMarks(){
  const a=st.selectedAssessment;if(!a)return;
  try{
   if(role()==='manager'&&!(await canManage()))throw new Error('Your Manager role needs manage_assessments permission.');
   const inputs=[...document.querySelectorAll('[data-marks]')];
   for(const input of inputs){
    if(input.value==='')continue;
    const sid=input.dataset.marks,marks=Number(input.value);
    if(!Number.isFinite(marks)||marks<0||marks>a.max_marks)throw new Error('Marks must be between 0 and '+a.max_marks+'.');
    const existing=st.results.find(r=>r.student_id===sid);
    const row={school_id:school(),assessment_id:a.id,student_id:sid,marks_obtained:marks,grade_label:$('[data-grade="'+CSS.escape(sid)+'"]')?.value.trim()||null,teacher_feedback:$('[data-feedback="'+CSS.escape(sid)+'"]')?.value.trim()||null,marked_by:me().id,marked_at:new Date().toISOString()};
    const r=existing?await db().from('assessment_results').update(row).eq('assessment_id',a.id).eq('student_id',sid):await db().from('assessment_results').insert(row);
    if(r.error)throw r.error;
   }
   const q=await db().from('school_assessments').update({status:'marked',updated_at:new Date().toISOString()}).eq('id',a.id);
   if(q.error)throw q.error;
   status('marksStatus','Saved marks for '+inputs.filter(x=>x.value!=='').length+' students. Assessment status is now MARKED.','success');await loadAssessments();await openMarks(a.id);
  }catch(e){status('marksStatus',error(e),'error')}
 }
 async function setAssessmentStatus(newStatus){
  const a=st.selectedAssessment;if(!a)return;
  try{
   const q=await db().from('school_assessments').update({status:newStatus,updated_at:new Date().toISOString()}).eq('id',a.id);
   if(q.error)throw q.error;msg('Assessment status updated to '+newStatus+'.','success');await loadAssessments();await openMarks(a.id);
  }catch(e){msg(error(e),'error')}
 }
 async function renderStudentAssessmentResults(){
  $('view-assessments').innerHTML=shell('My Assessments & Marks','My Assessments & Marks','Results are shown only after the school records an assessment and the teacher enters marks.','<section class="acad-panel"><div class="acad-toolbar"><div><h3>My results</h3><p>Only results linked to your own student profile are requested.</p></div>'+btn('refreshMyMarks','Refresh','alt')+'</div><div id="studentAssessmentStatus" style="display:none"></div><div id="studentAssessmentRows"></div></section>');
  $('refreshMyMarks').onclick=loadStudentMarks;await loadStudentMarks();
 }
 async function loadStudentMarks(){
  const box=$('studentAssessmentRows'),p=profile();if(!box||!p?.class_id){if(box)box.innerHTML=empty('Your account has no assigned class yet. Contact school administration.');return;}
  try{
   const a=await db().from('school_assessments').select('id,title,assessment_type,assessment_date,max_marks,status,subject_id,section_id').eq('school_id',school()).eq('class_id',p.class_id).in('status',['conducted','marked']).order('assessment_date',{ascending:false}).limit(200);
   if(a.error)throw a.error;
   const applicable=(a.data||[]).filter(x=>!x.section_id||x.section_id===p.section_id);
   const ids=applicable.map(x=>x.id);
   const r=ids.length?await db().from('assessment_results').select('assessment_id,marks_obtained,grade_label,teacher_feedback,marked_at').eq('school_id',school()).eq('student_id',me().id).in('assessment_id',ids):{data:[],error:null};
   if(r.error)throw r.error;
   box.innerHTML=table(['Date','Assessment','Subject','Marks','Grade / feedback','Status'],applicable.map(x=>{
    const result=(r.data||[]).find(y=>y.assessment_id===x.id),subject=st.subjects.find(y=>y.id===x.subject_id)?.name||'Subject';
    return '<tr><td>'+E(x.assessment_date)+'</td><td>'+E(x.title)+'<div class="acad-muted">'+E(x.assessment_type)+'</div></td><td>'+E(subject)+'</td><td>'+(result?E(result.marks_obtained)+' / '+E(x.max_marks):'Not marked')+'</td><td>'+E(result?.grade_label||'—')+'<div class="acad-muted">'+E(result?.teacher_feedback||'')+'</div></td><td>'+E(x.status)+'</td></tr>';
   }));
   if(!applicable.length)box.innerHTML=empty('No conducted or marked assessments are available for your class yet.');
  }catch(e){box.innerHTML=notice(error(e),'error')}
 }
 async function renderNotifications(){
  $('view-notifications').innerHTML=shell('In-app notifications','My Notifications & Feedback','Only notifications available to your signed-in account and current school are requested. “Queued” does not mean an email has been delivered.','<section class="acad-panel"><div class="acad-toolbar"><div><h3>Recent notices</h3><p>Includes report-review feedback and schedule changes where recorded.</p></div>'+btn('refreshMyNotifications','Refresh','alt')+'</div><div id="myNotificationsRows"></div></section>');
  $('refreshMyNotifications').onclick=loadNotifications;await loadNotifications();
 }
 async function loadNotifications(){
  const box=$('myNotificationsRows');if(!box)return;
  let q=db().from('notification_events').select('id,event_type,subject,status,created_at,school_id').eq('recipient_profile_id',me().id).order('created_at',{ascending:false}).limit(100);
  if(school())q=q.eq('school_id',school());
  const r=await q;if(r.error){box.innerHTML=notice(error(r.error),'error');return;}
  box.innerHTML=table(['Date','Notice','Status'],(r.data||[]).map(x=>'<tr><td>'+E(new Date(x.created_at).toLocaleString())+'</td><td><b>'+E(x.subject||x.event_type||'Notification')+'</b></td><td><span class="acad-status">'+E(x.status||'queued')+'</span></td></tr>'));
 }
 const original=window.NOOR_ACADEMIC?.open;
 if(!original)return;
 window.NOOR_ACADEMIC.open=async id=>{
  if(id==='assessments'){try{await loadContext();if(role()==='student')return await renderStudentAssessmentResults();return renderAssessment();}catch(e){const el=$('view-assessments');if(el)el.innerHTML=shell('Assessments','Could not load assessments',error(e),notice(error(e),'error'));return true;}}
  if(id==='notifications'){return await renderNotifications();}
  return original(id);
 };
})();