/* NOOR Teacher Classroom: verified school scopes, class notices, questions, homework and grading. */
(()=>{'use strict';
const a=()=>window.NOOR_AI_APP||{},e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const d=()=>a().db,me=()=>a().user,school=()=>a().schoolId,ready=()=>a().profile?.role==='teacher'&&a().profile?.status==='active'&&d()&&me()&&school();
let ctx=[],classes=[],sections=[],subjects=[],assignmentRows=[],questionRows=[],selectedContext='',busy=false;
const root=()=>document.getElementById('view-teacher-classroom');
const find=x=>root()?.querySelector(x);
const toast=(msg,kind='success')=>a().toast?.(msg,kind);
const when=x=>x?new Date(x).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—';
const blank=t=>'<div class="sp-empty">'+e(t)+'</div>';
const panel=(name,desc,body)=>'<section class="sp-card"><div class="sp-card-head"><div><h2>'+e(name)+'</h2><p class="sp-muted">'+e(desc)+'</p></div></div>'+body+'</section>';
const dateVal=()=>{const x=new Date(Date.now()+86400000);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,16);};
function current(){return ctx.find((x,i)=>String(i)===selectedContext)||ctx[0]||null}
function label(c){return (classes.find(x=>x.id===c.class_id)?.name||'Assigned class')+' / '+(c.section_id?sections.find(x=>x.id===c.section_id)?.name||'Section':'All sections')+' · '+(c.subject_id?subjects.find(x=>x.id===c.subject_id)?.name||'Subject':'General')}
function picker(){return '<label>Assigned classroom<select id="tcContext">'+ctx.map((c,i)=>'<option value="'+i+'"'+(String(i)===selectedContext?' selected':'')+'>'+e(label(c))+'</option>').join('')+'</select></label>'}
async function prepare(){
 const sid=school(),id=me().id;const [ta,cl,se,su]=await Promise.all([
 d().from('teacher_assignments').select('class_id,section_id,subject_id,is_active').eq('school_id',sid).eq('teacher_id',id).eq('is_active',true),
 d().from('classes').select('id,name').eq('school_id',sid),
 d().from('sections').select('id,name,class_id').eq('is_active',true),
 d().from('subjects').select('id,name').eq('school_id',sid)
 ]);
 for(const z of [ta,cl,se,su])if(z.error)throw z.error;
 ctx=ta.data||[];classes=cl.data||[];sections=se.data||[];subjects=su.data||[];selectedContext=String(Math.min(Math.max(0,Number(selectedContext)||0),Math.max(0,ctx.length-1)));
}
function layout(){
 root().innerHTML='<div class="sp-root"><header class="sp-head"><div><div class="sp-kicker">NOOR · TEACHER → STUDENTS</div><h1>Student Communication & Review</h1><p class="sp-muted">Publish only to your assigned class. Save grades to the actual school records.</p></div><button class="sp-action secondary" id="tcRefresh">↻ Refresh</button></header>'+
 (ctx.length?'<div class="sp-card" style="margin-bottom:14px">'+picker()+'</div>':'<div class="sp-status error">No active class/section assignment. Ask school management to assign your teaching context before publishing.</div>')+
 '<div class="sp-grid equal">'+panel('Publish Homework or Quiz','Class-specific school work with a deadline','<form id="tcHomeworkForm" class="sp-form">'+
 '<label>Title<input name="title" required maxlength="180" placeholder="Maths chapter 3 homework"></label>'+
 '<label>Questions / instructions<textarea name="paper" required rows="5" maxlength="25000" placeholder="Write questions students should answer"></textarea></label>'+
 '<div class="sp-form two"><label>Type<select name="type"><option value="homework">Homework</option><option value="worksheet">Worksheet</option><option value="practice">Practice paper</option><option value="quiz">Quiz</option><option value="project">Project</option></select></label><label>Total marks<input type="number" name="marks" min="1" max="1000" value="20" required></label></div>'+
 '<label>Due date / time<input name="due" type="datetime-local" value="'+dateVal()+'" required></label>'+
 '<label>Teacher-only answer key (optional)<textarea name="key" rows="3" maxlength="30000"></textarea></label>'+
 '<button type="submit" class="sp-action"'+(!ctx.length?' disabled':'')+'>Publish to Students</button></form>')+
 panel('Post Class Notice','Published only for your assigned class/section','<form id="tcNoticeForm" class="sp-form">'+
 '<label>Announcement title<input name="title" required maxlength="180" placeholder="Tomorrow’s revision session"></label>'+
 '<label>Message<textarea name="body" required maxlength="8000"></textarea></label>'+
 '<button type="submit" class="sp-action"'+(!ctx.length?' disabled':'')+'>Send Student Notice</button></form>')+'</div>'+
 '<div class="sp-grid equal">'+panel('Class Event or Deadline','Appears in student school calendar','<form id="tcEventForm" class="sp-form">'+
 '<label>Title<input name="title" maxlength="180" required></label><label>Description<textarea name="body" maxlength="6000"></textarea></label>'+
 '<label>Date and time<input type="datetime-local" name="date" required></label><button class="sp-action" type="submit"'+(!ctx.length?' disabled':'')+'>Add Calendar Event</button></form>')+
 panel('Student Study Questions','Answer questions from assigned classes','<div id="tcQuestions">'+blank('Loading student questions…')+'</div>')+'</div>'+
 panel('Submissions & Grading','Read student responses, review attachment files, and record teacher-approved marks','<div id="tcAssignments">'+blank('Loading teacher-assigned work…')+'</div>')+'</div>';
 find('#tcRefresh').onclick=()=>open();
 find('#tcContext')?.addEventListener('change',ev=>{selectedContext=ev.target.value;loadInbox();loadQuestions();});
 find('#tcHomeworkForm').onsubmit=saveHomework;
 find('#tcNoticeForm').onsubmit=saveNotice;
 find('#tcEventForm').onsubmit=saveEvent;
}
async function saveHomework(ev){
 ev.preventDefault();if(!current())return toast('Assigned class is required.','error');
 const f=ev.target,v=k=>String(f.elements[k]?.value||'').trim(),c=current(),due=new Date(v('due'));
 if(!Number.isFinite(due.getTime())||due<=new Date())return toast('Select a future due date.','error');
 const max=Number(v('marks'));if(max<1||max>1000||!Number.isFinite(max))return toast('Marks must be between 1 and 1000.','error');
 const button=f.querySelector('button[type=submit]');button.disabled=true;
 try{
  const saved=await d().from('noor_student_assignments').insert({school_id:school(),teacher_id:me().id,
   class_id:c.class_id,section_id:c.section_id||null,subject_id:c.subject_id||null,
   title:v('title'),paper_text:v('paper'),instructions:'Answer the questions and submit your work by the deadline.',
   assignment_type:v('type'),max_marks:max,due_at:due.toISOString(),is_active:true}).select('id').single();
  if(saved.error)throw saved.error;
  if(v('key')){const k=await d().from('noor_assignment_answer_keys').insert({assignment_id:saved.data.id,teacher_id:me().id,answer_key_text:v('key')});
   if(k.error){toast('Assignment published but the private answer key could not save: '+k.error.message,'error');f.reset();await loadInbox();return;}}
  toast('Homework published for your assigned class.');f.reset();await loadInbox();
 }catch(x){toast('Could not publish: '+x.message,'error')}finally{button.disabled=false}
}
async function saveNotice(ev){
 ev.preventDefault();const c=current();if(!c)return toast('Choose an assigned class.','error');
 const f=ev.target,v=k=>String(f.elements[k]?.value||'').trim();const button=f.querySelector('button[type=submit]');button.disabled=true;
 try{
  const r=await d().from('school_notices').insert({school_id:school(),created_by:me().id,class_id:c.class_id,section_id:c.section_id||null,
   title:v('title'),body:v('body'),target_roles:['student'],starts_at:new Date().toISOString(),is_active:true});
  if(r.error)throw r.error;toast('Notice published to your students.');f.reset();
 }catch(x){toast('Unable to send notice: '+x.message,'error')}finally{button.disabled=false}
}
async function saveEvent(ev){
 ev.preventDefault();const c=current();if(!c)return toast('Choose an assigned classroom.','error');
 const f=ev.target,v=k=>String(f.elements[k]?.value||'').trim(),dt=new Date(v('date'));if(!Number.isFinite(dt.getTime()))return toast('Select a valid date.','error');
 const b=f.querySelector('button[type=submit]');b.disabled=true;
 try{
  const r=await d().from('calendar_events').insert({school_id:school(),created_by:me().id,class_id:c.class_id,section_id:c.section_id||null,
    title:v('title'),description:v('body'),starts_at:dt.toISOString(),event_type:'academic',target_roles:['student']});
  if(r.error)throw r.error;toast('Student calendar event saved.');f.reset();
 }catch(x){toast('Could not save calendar event: '+x.message,'error')}finally{b.disabled=false}
}
async function loadQuestions(){
 const target=find('#tcQuestions');if(!target||!ready())return;
 if(!ctx.length){target.innerHTML=blank('No assigned classroom.');return;}
 let q=d().from('noor_student_questions').select('id,student_id,question,reply,created_at,school_id,class_id,section_id').eq('school_id',school()).order('created_at',{ascending:false}).limit(60);
 const r=await q;if(r.error){target.textContent=r.error.message;return}
 const c=current();questionRows=(r.data||[]).filter(x=>x.class_id===c?.class_id&&(!c.section_id||x.section_id===c.section_id));
 target.innerHTML=questionRows.length?questionRows.map(x=>'<section class="sp-item"><p><strong>Student question</strong> · '+e(when(x.created_at))+'</p><p>'+e(x.question)+'</p>'+
 '<form class="sp-form" data-tc-reply="'+e(x.id)+'"><label>Teacher response<textarea maxlength="5000" required>'+e(x.reply||'')+'</textarea></label><button class="sp-action secondary" type="submit">Save Reply</button></form></section>').join(''):blank('No student questions for this classroom yet.');
 target.querySelectorAll('form[data-tc-reply]').forEach(form=>form.onsubmit=async ev=>{
  ev.preventDefault();const q=questionRows.find(x=>x.id===form.dataset.tcReply);if(!q)return;const text=form.querySelector('textarea').value.trim();if(!text)return;
  const button=form.querySelector('button');button.disabled=true;
  try{const r=await d().from('noor_student_questions').update({reply:text,replied_by:me().id,replied_at:new Date().toISOString()}).eq('id',q.id).eq('school_id',school());if(r.error)throw r.error;toast('Student question answered.');await loadQuestions();}
  catch(e){toast(e.message,'error')}finally{button.disabled=false}
 });
}
async function loadInbox(){
 const target=find('#tcAssignments');if(!target||!ready())return;
 if(!ctx.length){target.innerHTML=blank('No assigned classes yet.');return}
 const c=current();const r=await d().from('noor_student_assignments').select('id,title,assignment_type,paper_text,max_marks,created_at,due_at,source_paper_id,class_id,section_id').eq('school_id',school()).eq('teacher_id',me().id).eq('class_id',c.class_id).order('created_at',{ascending:false}).limit(75);
 if(r.error){target.textContent=r.error.message;return}
 assignmentRows=(r.data||[]).filter(x=>x.section_id===c.section_id||(c.section_id==null&&x.section_id==null));
 target.innerHTML=assignmentRows.length?assignmentRows.map(x=>'<section class="sp-item"><div class="sp-row sp-between"><div><strong>'+e(x.title)+'</strong><p class="sp-muted">'+e(x.assignment_type)+' · '+e(when(x.due_at))+' · Max '+e(x.max_marks??'not set')+'</p></div><button class="sp-action secondary" type="button" data-tc-open="'+e(x.id)+'">Review Submissions</button></div><div id="tcReview-'+e(x.id)+'"></div></section>').join(''):blank('No published assignments for this class yet.');
 target.querySelectorAll('[data-tc-open]').forEach(b=>b.onclick=()=>loadSubmissions(b.dataset.tcOpen));
}
async function loadSubmissions(id){
 const panel=find('#tcReview-'+id),assignment=assignmentRows.find(x=>x.id===id);if(!panel||!assignment)return;
 panel.innerHTML=blank('Loading student responses…');
 const [res,key]=await Promise.all([
 d().from('noor_student_submissions').select('id,student_id,answer_text,file_path,status,marks_obtained,teacher_feedback,submitted_at').eq('school_id',school()).eq('assignment_id',id).limit(500),
 d().from('noor_assignment_answer_keys').select('answer_key_text').eq('assignment_id',id).maybeSingle()
 ]);
 if(res.error){panel.textContent=res.error.message;return;}
 const ids=[...new Set((res.data||[]).map(x=>x.student_id))];let names={};
 if(ids.length){const p=await d().from('profiles').select('id,full_name,roll_number').eq('school_id',school()).in('id',ids);(p.data||[]).forEach(x=>names[x.id]=x.full_name+(x.roll_number?' · Roll '+x.roll_number:''));}
 let keyText=key.data?.answer_key_text||'';
 if(!keyText&&assignment.source_paper_id){const draft=await d().from('noor_teacher_paper_drafts').select('content').eq('id',assignment.source_paper_id).eq('teacher_id',me().id).maybeSingle();keyText=draft.data?.content?.answer_key_text||'';}
 const answerKey=keyText?'<details class="sp-item"><summary><strong>Private answer key (teacher only)</strong></summary><pre style="white-space:pre-wrap">'+e(keyText)+'</pre></details>':'';
 const subs=(res.data||[]).map(x=>'<form data-tc-grade="'+e(x.id)+'" class="sp-item sp-form"><b>'+e(names[x.student_id]||'Authorised student')+'</b><p class="sp-muted">'+e(when(x.submitted_at))+' · '+e(x.status)+'</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+e(x.answer_text||'(file attached)')+'</p>'+
 (x.file_path?'<button class="sp-action secondary" data-tc-file="'+e(x.id)+'" type="button">Open secure attachment</button>':'')+
 '<div class="sp-form two"><label>Approved marks<input name="marks" type="number" min="0" step="0.5" max="'+e(assignment.max_marks)+'" value="'+e(x.marks_obtained??'')+'" required></label><label>Teacher feedback<input name="feedback" maxlength="3000" value="'+e(x.teacher_feedback||'')+'"></label></div>'+
 '<button class="sp-action" type="submit">Save Approved Grade</button></form>').join('')||blank('No student work submitted yet.');
 panel.innerHTML=answerKey+'<div class="sp-list" style="margin-top:12px">'+subs+'</div>';
 const byId=new Map((res.data||[]).map(x=>[x.id,x]));
 panel.querySelectorAll('[data-tc-file]').forEach(btn=>btn.onclick=async()=>{
  const path=byId.get(btn.dataset.tcFile)?.file_path;if(!path)return;
  const r=await d().storage.from('noor-student-work').createSignedUrl(path,180);
  if(r.error)return toast('Attachment access unavailable: '+r.error.message,'error');
  window.open(r.data.signedUrl,'_blank','noopener,noreferrer');
 });
 panel.querySelectorAll('form[data-tc-grade]').forEach(form=>form.onsubmit=async ev=>{
  ev.preventDefault();const number=Number(form.elements.marks.value);
  if(!form.elements.marks.value||!Number.isFinite(number)||number<0||number>assignment.max_marks)return toast('Marks must be between zero and maximum.','error');
  const b=form.querySelector('[type=submit]');b.disabled=true;
  try{
   const r=await d().from('noor_student_submissions').update({marks_obtained:number,teacher_feedback:form.elements.feedback.value.trim()||null,
    reviewed_by:me().id,reviewed_at:new Date().toISOString(),status:'reviewed'}).eq('id',form.dataset.tcGrade).eq('school_id',school()).select('id').single();
   if(r.error)throw r.error;toast('Approved marks saved. Student dashboard now has this review.');await loadSubmissions(id);
  }catch(x){toast('Grade was not saved: '+x.message,'error')}finally{b.disabled=false}
 });
}
async function open(id){
 if(id!=='teacher-classroom'||!ready())return;
 if(busy)return;busy=true;
 let view=root();if(!view){view=document.createElement('section');view.className='view';view.id='view-teacher-classroom';document.querySelector('#workspace .content')?.append(view);}
 view.innerHTML='<div class="sp-root">'+blank('Loading assigned classes and messages…')+'</div>';
 try{await prepare();layout();await Promise.all([loadQuestions(),loadInbox()]);}
 catch(e){view.innerHTML='<div class="sp-root">'+blank('Teacher classroom could not load: '+e.message)+'</div>';}
 finally{busy=false}
}
window.NOOR_TEACHER_CLASSROOM={open};
})();