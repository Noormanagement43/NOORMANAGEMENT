/* NOOR Teacher: editable syllabus progress and class assignment deadline planner, real records only. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{},E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(q,r=document)=>r?.querySelector(q),root=()=>$('#ntTeacherPlanners');
let generation=0,cache={};
const timeLocal=s=>{if(!s)return'';const d=new Date(s),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,16)};
const notice=(s,err=false)=>{const r=$('#ntpStatus');if(r){r.textContent=s;r.style.color=err?'#b43d50':'#26744b'}};
const good=()=>{const a=A();return a.profile?.role==='teacher'&&a.profile?.status==='active'&&a.user?.id&&a.schoolId};
async function mount(){
 const holder=root(),app=A();if(!holder||!good())return;
 const revision=++generation,uid=app.user.id,school=app.schoolId,db=app.db;
 holder.innerHTML='<header class="ntp-title"><div><small>ADVANCED TEACHING TOOLS</small><h2>Smart Syllabus Tracker & Deadline Planner</h2><p>Real academic-year data with teacher-controlled saves.</p></div><button type="button" id="ntpRefresh">↻ Refresh</button></header>'+
 '<div class="ntp-grid"><section class="ntp-card" id="ntiSyllabus"><h3>▤ Smart Syllabus Tracker</h3><div id="ntpSyllabus">Loading assigned chapters…</div></section>'+
 '<section class="ntp-card" id="ntiDeadlines"><h3>▦ Assignment Deadline Planner</h3><div id="ntpDeadlines">Loading your published assignments…</div></section></div><p id="ntpStatus" role="status"></p>';
 $('#ntpRefresh',holder).onclick=mount;
 const [assign,years,units,progress,papers,classes,subjects,sections]=await Promise.all([
 db.from('teacher_assignments').select('class_id,section_id,subject_id').eq('school_id',school).eq('teacher_id',uid).eq('is_active',true).limit(300),
 db.from('academic_years').select('id,label,is_current,starts_on,ends_on').eq('school_id',school).order('starts_on',{ascending:false}).limit(8),
 db.from('syllabus_units').select('id,title,class_id,section_id,subject_id,academic_year_id').eq('school_id',school).eq('is_active',true).order('sequence_no').limit(400),
 db.from('syllabus_progress').select('id,syllabus_unit_id,academic_year_id,class_id,section_id,subject_id,progress_status,teacher_reported_percentage').eq('school_id',school).eq('teacher_id',uid).limit(400),
 db.from('noor_class_assignments').select('id,title,class_id,section_id,due_at,max_marks,status').eq('school_id',school).eq('teacher_id',uid).eq('status','published').order('due_at').limit(100),
 db.from('classes').select('id,name').eq('school_id',school).limit(200),
 db.from('subjects').select('id,name').eq('school_id',school).limit(250),
 db.from('sections').select('id,name,class_id').limit(400)
 ]);
 if(revision!==generation||!root()||A().schoolId!==school)return;
 const error=[assign,years,units,progress,papers,classes,subjects,sections].filter(r=>r.error).map(r=>r.error.message);
 if(error.length)notice('Some school data was unavailable: '+error.join(' | '),true);
 const as=assign.data||[],y=years.data||[],u=units.data||[],rows=progress.data||[],published=papers.data||[];
 const cm=new Map((classes.data||[]).map(x=>[x.id,x.name])),sm=new Map((subjects.data||[]).map(x=>[x.id,x.name])),sec=new Map((sections.data||[]).map(x=>[x.id,x.name]));
 const contexts=[];
 for(const unit of u){
  for(const a of as){
   if(a.class_id!==unit.class_id||a.subject_id&&a.subject_id!==unit.subject_id||a.section_id&&unit.section_id&&a.section_id!==unit.section_id)continue;
   const section_id=unit.section_id||a.section_id||null;
   if(contexts.some(c=>c.unit.id===unit.id&&c.section_id===section_id))continue;
   contexts.push({unit,section_id});
  }
 }
 cache={contexts,published,school,uid,progress:rows,years:y};
 const unitsHtml=contexts.length?contexts.map((c,i)=>{
  const p=rows.find(x=>x.syllabus_unit_id===c.unit.id&&x.section_id===c.section_id);
  return '<option value="'+i+'">'+E(cm.get(c.unit.class_id)||'Class')+(c.section_id?' · '+E(sec.get(c.section_id)||'Section'):'')+
  ' · '+E(sm.get(c.unit.subject_id)||'Subject')+' · '+E(c.unit.title)+(p?' ('+E(p.progress_status)+')':'')+'</option>';
 }).join(''):'<option value="">Principal must assign curriculum units first</option>';
 $('#ntpSyllabus',holder).innerHTML='<p>Track exactly which chapter or topic was taught. Every change is saved to your school database.</p>'+
 '<form id="ntpSyllabusForm"><label>Assigned chapter<select id="ntpUnit" name="unit" required>'+unitsHtml+'</select></label>'+
 '<div class="ntp-inline"><label>Status<select name="status"><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="requires_revision">Requires revision</option></select></label>'+
 '<label>Actual completion (%)<input type="number" name="percentage" min="0" max="100" step="1" value="0" required></label></div>'+
 '<button type="submit" '+(contexts.length?'':'disabled')+'>Save Syllabus Progress</button></form>'+
 '<p class="ntp-muted">'+E(y.find(x=>x.is_current)?.label||'Current academic year not configured')+' · '+contexts.length+' assigned chapter contexts found.</p>';
 $('#ntpUnit',holder).onchange=()=>{
  const c=contexts[Number($('#ntpUnit',holder).value)];
  const r=rows.find(x=>x.syllabus_unit_id===c?.unit.id&&x.section_id===c?.section_id);
  const f=$('#ntpSyllabusForm',holder);if(r){f.elements.status.value=r.progress_status;f.elements.percentage.value=Number(r.teacher_reported_percentage)||0}
  else {f.elements.status.value='not_started';f.elements.percentage.value=0}
 };
 if(contexts.length)$('#ntpUnit',holder).onchange();
 $('#ntpSyllabusForm',holder).onsubmit=async event=>{
  event.preventDefault();const f=event.currentTarget,c=contexts[Number(f.elements.unit.value)];
  if(!c)return notice('Select an assigned chapter.',true);
  const progress_status=f.elements.status.value,n=Number(f.elements.percentage.value);
  if(!Number.isInteger(n)||n<0||n>100)return notice('Completion must be between 0 and 100.',true);
  const actual=progress_status==='completed'?100:progress_status==='not_started'?0:n;
  const rec={school_id:school,academic_year_id:c.unit.academic_year_id,syllabus_unit_id:c.unit.id,
   teacher_id:uid,class_id:c.unit.class_id,section_id:c.section_id,subject_id:c.unit.subject_id,
   progress_status,completion_source:'teacher_report',teacher_reported_percentage:actual,last_updated_by:uid};
  const old=rows.find(x=>x.syllabus_unit_id===c.unit.id&&x.section_id===c.section_id),button=f.querySelector('button');
  button.disabled=true;notice('Saving chapter progress to this school…');
  const saved=old?await db.from('syllabus_progress').update(rec).eq('id',old.id).eq('school_id',school).eq('teacher_id',uid).select('id').single():
   await db.from('syllabus_progress').insert(rec).select('id').single();
  button.disabled=false;
  if(saved.error)return notice('Could not save chapter: '+saved.error.message,true);
  notice('✓ Chapter progress saved to the school database.');await mount();
 };
 if(published.length){
  const perDay=new Map();for(const x of published){const key=x.class_id+':'+(x.due_at||'').slice(0,10);perDay.set(key,(perDay.get(key)||0)+1)}
  $('#ntpDeadlines',holder).innerHTML='<p>Review student workload and reschedule your published assignments.</p>'+
  '<div class="ntp-deadlines">'+published.map(x=>{
   const count=perDay.get(x.class_id+':'+x.due_at.slice(0,10))||0;
   return '<div class="ntp-deadline" data-ntp-assignment="'+E(x.id)+'"><div><b>'+E(x.title)+'</b><small>'+E(cm.get(x.class_id)||'Class')+(x.section_id?' · '+E(sec.get(x.section_id)||'Section'):'')+
   (count>=3?' · <strong>'+count+' assignments on same day</strong>':'')+'</small></div>'+
   '<label>Due date<input type="datetime-local" value="'+E(timeLocal(x.due_at))+'" data-new-date></label>'+
   '<button type="button" data-ntp-reschedule="'+E(x.id)+'">Update due date</button></div>';
  }).join('')+'</div>';
 }else $('#ntpDeadlines',holder).innerHTML='<p class="ntp-muted">No teacher-published assignments yet. Create one in Assignments & Papers.</p>'+
 '<button type="button" data-ntp-new-paper>✎ Create first assignment</button>';
 $('#ntpDeadlines [data-ntp-new-paper]',holder)?.addEventListener('click',()=>app.openView?.('paper-generator'));
 holder.querySelectorAll('[data-ntp-reschedule]').forEach(b=>b.onclick=async()=>{
  const row=b.closest('[data-ntp-assignment]'),value=$('[data-new-date]',row).value;
  const d=new Date(value);if(!value||!Number.isFinite(d.getTime())||d.getTime()<Date.now())return notice('Select a valid future due date.',true);
  b.disabled=true;notice('Updating assignment deadline…');
  const r=await db.from('noor_class_assignments').update({due_at:d.toISOString()}).eq('id',b.dataset.ntpReschedule).eq('school_id',school).eq('teacher_id',uid).select('id').single();
  b.disabled=false;if(r.error)return notice('Deadline was not updated: '+r.error.message,true);
  notice('✓ Deadline updated; students will see the revised date.');await mount();
 });
}
window.NOOR_TEACHER_PLANNERS={mount};
})();