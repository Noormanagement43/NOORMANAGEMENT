/* NOOR single-school bell and recurring class timetable.
   Principal: bell times once. Teacher: recurring class/section/subject assignments and
   daily lesson topic. Student: own class/section timetable, read-only.
   Requires school_id migration 20261028203000; never writes to legacy
   noor_teacher_periods/teacher_assignments and never fabricates real data. */
(function(){
'use strict';
const app=()=>window.NOOR_AI_APP||{};
const isTeacher=()=>app().profile?.role==='teacher';
const isLeader=()=>['owner','principal','manager'].includes(app().profile?.role);
const canSetBells=()=>['owner','principal'].includes(app().profile?.role);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const two=x=>String(x).padStart(2,'0');
const formatTime=t=>String(t||'').slice(0,5);
const formatDate=d=>{const local=new Date(d+'T12:00:00');return Number.isNaN(local.getTime())?d:local.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})};
const localDay=()=>{const d=new Date();return [d.getFullYear(),two(d.getMonth()+1),two(d.getDate())].join('-')};
const school=()=>app().schoolId,db=()=>app().db;
const icon=n=>{const r=window.NOOR_SUBJECT_ICONS?.display(n);return r?.icon||'📚'};
const migrationError=e=>e&&(e.code==='42P01'||e.code==='42703'||/does not exist|relation .*not found|schema cache/i.test(e.message||''));
const setupHint='The one-time school timetable database migration has not been applied to this school connection yet. Ask the account owner to apply the NOOR School Bell & Teacher Timetable migration in Supabase.';
let teacherKey='',teacherChannel=null,refreshTimer=null,teacherLoading=false;
let principalLoading=false;
async function loadBells({includeArchived=false}={}){
 let query=db().from('noor_school_bell_slots')
  .select('school_id,period_number,start_time,end_time,is_active')
  .eq('school_id',school()).order('period_number');
 if(!includeArchived)query=query.eq('is_active',true);
 const r=await query;
 if(r.error)throw r.error;return r.data||[];
}
async function loadClassSections(){
 const cl=await db().from('classes').select('id,name').eq('school_id',school()).eq('is_active',true).order('sort_order').limit(300);
 if(cl.error)throw cl.error;
 const classes=cl.data||[];
 const sections=classes.length?await db().from('sections').select('id,class_id,name').in('class_id',classes.map(x=>x.id)).eq('is_active',true).limit(900):{data:[]};
 if(sections.error)throw sections.error;return {classes,sections:sections.data||[]};
}
async function fetchTeacherRows(){
 const r=await db().from('noor_class_timetable').select('id,school_id,teacher_id,class_id,section_id,weekday,period_number,subject_name,is_active')
  .eq('school_id',school()).eq('teacher_id',app().user.id).eq('is_active',true).order('weekday').order('period_number').limit(500);
 if(r.error)throw r.error;return r.data||[];
}
async function fetchSchoolRows(){
 const r=await db().from('noor_class_timetable').select('id,teacher_id,class_id,section_id,weekday,period_number,subject_name')
  .eq('school_id',school()).eq('is_active',true).order('weekday').order('period_number').limit(1000);
 if(r.error)throw r.error;return r.data||[];
}
async function fetchLessons(ids,date){
 if(!ids.length)return [];
 const r=await db().from('noor_daily_lesson_topics').select('id,timetable_id,lesson_date,topic,homework')
  .eq('school_id',school()).eq('lesson_date',date).in('timetable_id',ids).limit(1000);
 if(r.error)throw r.error;return r.data||[];
}
function dialog(title,body,onSubmit){
 document.querySelector('#noorTimetableDialog')?.remove();
 const overlay=document.createElement('div');overlay.id='noorTimetableDialog';overlay.className='nsto-overlay';
 overlay.innerHTML='<section role="dialog" aria-modal="true" aria-label="'+esc(title)+'" class="nsto-dialog">'+
 '<header><div><span class="nsto-kicker">NOOR · SCHOOL TIMETABLE</span><h2>'+esc(title)+'</h2></div><button type="button" data-nsto-close aria-label="Close">✕</button></header>'+
 '<form id="nstoForm">'+body+'<p class="nsto-alert" id="nstoError" role="alert"></p><footer><button type="button" data-nsto-close>Cancel</button><button class="nsto-save" type="submit">Save Changes</button></footer></form></section>';
 document.body.append(overlay);
 const close=()=>overlay.remove();
 overlay.querySelectorAll('[data-nsto-close]').forEach(x=>x.onclick=close);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 const form=overlay.querySelector('form');
 form.onsubmit=async e=>{
   e.preventDefault();const b=form.querySelector('button[type=submit]');b.disabled=true;
   try{const completed=await onSubmit(new FormData(form));if(completed===false){b.disabled=false;return;}close();if(isTeacher())await mountTeacher();if(isLeader())await mountPrincipal();window.NOOR_AI_APP?.toast?.('Saved to your school records.','success')}
   catch(error){overlay.querySelector('#nstoError').textContent=error.message||String(error);b.disabled=false}
 };
 return overlay;
}
function option(value,label,selected){return '<option value="'+esc(value)+'" '+(String(value)===String(selected)?'selected':'')+'>'+esc(label)+'</option>'}
async function openSchoolTimes(){
 if(!canSetBells())return;
 try{
  const existing=await loadBells({includeArchived:true});
  // Only active rows are shown to Principal. Archived periods are kept
  // in the database so teachers' historical lesson plans are never deleted.
  const active=existing.filter(x=>x.is_active!==false);
  const activeNumbers=new Set(active.map(x=>Number(x.period_number)));
  const makeRow=(n,b={})=>'<div class="nsto-bell-row" data-number="'+n+'">'+
   '<b>Period '+n+'</b>'+
   '<label>Start<input type="time" name="start_'+n+'" value="'+esc(formatTime(b.start_time))+'" required></label>'+
   '<label>End<input type="time" name="end_'+n+'" value="'+esc(formatTime(b.end_time))+'" required></label>'+
   '<button type="button" class="nsto-remove-bell" data-nsto-remove-bell="'+n+'" aria-label="Remove Period '+n+'">Remove ✕</button>'+
   '</div>';
  const intro='<p class="nsto-muted">You control only the school bell: Period 1, Period 2 and their start/end times. Tap + Add Period or Remove whenever required. Teachers independently choose classes, sections and subjects for the periods you publish.</p>';
  const initial=active.length?active.map(x=>makeRow(Number(x.period_number),x)).join(''):makeRow(1);
  const overlay=dialog('School Period Timings · Principal Only',intro+
   '<div class="nsto-bell-grid" id="nstoBellGrid">'+initial+'</div>'+
   '<button type="button" class="nsto-add-bell" id="nstoAddBell">＋ Add Another Period</button>'+
   '<p class="nsto-muted">Existing teacher assignments are preserved if a period is removed. Such lessons stop appearing in current school and student timetables until the period is restored or the teacher reassigns the class.</p>',
   async()=>{
    const cards=[...overlay.querySelectorAll('#nstoBellGrid [data-number]')];
    const next=cards.map(card=>{
     const n=Number(card.dataset.number);
     const start=card.querySelector('[name="start_'+n+'"]').value;
     const end=card.querySelector('[name="end_'+n+'"]').value;
     if(!start||!end||start>=end)throw Error('Period '+n+': choose valid start and end times.');
     return {school_id:school(),period_number:n,start_time:start,end_time:end,is_active:true,
       updated_by:app().user.id,updated_at:new Date().toISOString()};
    });
    const numbers=new Set(next.map(x=>x.period_number));
    if(numbers.size!==next.length)throw Error('Each period number must be unique.');
    const ordered=[...next].sort((a,b)=>a.start_time.localeCompare(b.start_time));
    for(let i=1;i<ordered.length;i++){
     if(ordered[i].start_time<ordered[i-1].end_time)throw Error(
       'Period '+ordered[i-1].period_number+' overlaps Period '+ordered[i].period_number+
       '. Please correct the school timing.'
     );
    }
    const removed=existing.filter(x=>x.is_active!==false&&!numbers.has(Number(x.period_number)))
     .map(x=>Number(x.period_number));
    if(removed.length){
     const q=await db().from('noor_class_timetable')
      .select('id',{head:true,count:'exact'}).eq('school_id',school())
      .eq('is_active',true).in('period_number',removed);
     if(q.error)throw new Error('Cannot check existing teacher lessons: '+q.error.message);
     const count=q.count||0;
     const warning=count
       ?'Removing '+removed.map(n=>'Period '+n).join(', ')+' will hide '+count+
         ' currently assigned teacher lesson(s) from active class timetables. Their lesson records will NOT be deleted. Continue?'
       :'Remove '+removed.map(n=>'Period '+n).join(', ')+' from the school timetable?';
     if(!window.confirm(warning))return false;
    }
    // Save active slots first. Archived entries can be restored by re-adding
    // that period number. Nothing automatically alters teacher ownership.
    if(next.length){
     const r=await db().from('noor_school_bell_slots')
      .upsert(next,{onConflict:'school_id,period_number'}).select('period_number');
     if(r.error)throw r.error;
     if((r.data||[]).length!==next.length)throw Error('Some bell slots failed to save.');
    }
    if(removed.length){
     const result=await db().from('noor_school_bell_slots')
      .update({is_active:false,updated_by:app().user.id,updated_at:new Date().toISOString()})
      .eq('school_id',school()).in('period_number',removed).select('period_number');
     if(result.error)throw result.error;
     if((result.data||[]).length!==removed.length)throw Error('Some removed periods could not be archived.');
    }
    return true;
   });
  const grid=overlay.querySelector('#nstoBellGrid');
  const addButton=overlay.querySelector('#nstoAddBell');
  const refreshRemoveButtons=()=>{
   grid.querySelectorAll('[data-nsto-remove-bell]').forEach(btn=>{
    btn.onclick=()=>{
     const number=Number(btn.dataset.nstoRemoveBell);
     const card=grid.querySelector('[data-number="'+number+'"]');
     card?.remove();
     if(!grid.children.length){
      const hint=document.createElement('div');
      hint.className='nsto-empty';hint.id='nstoNoBells';
      hint.textContent='No periods selected. Add a period or save to archive all active school bell times.';
      grid.append(hint);
     }
    };
   });
  };
  addButton.onclick=()=>{
   grid.querySelector('#nstoNoBells')?.remove();
   const used=new Set([...grid.querySelectorAll('[data-number]')].map(x=>Number(x.dataset.number)));
   let n=1;
   while(used.has(n)&&n<=100)n++;
   if(n>100){overlay.querySelector('#nstoError').textContent='Maximum 100 periods per school.';return;}
   // Prefer next consecutive number; a previously removed period can
   // intentionally be restored by choosing its numbered slot.
   grid.insertAdjacentHTML('beforeend',makeRow(n,existing.find(x=>Number(x.period_number)===n)||{}));
   refreshRemoveButtons();
   grid.lastElementChild?.querySelector('input')?.focus();
  };
  refreshRemoveButtons();
 }catch(e){app().toast?.(migrationError(e)?setupHint:e.message,'error')}
}
function weekdayBoxes(selected){
 const active=new Set(selected||[new Date().getDay()]);
 return '<fieldset class="nsto-weekdays"><legend>Repeat every week on</legend>'+days.slice(1,7).map((d,i)=>
 '<label><input type="checkbox" name="weekdays" value="'+(i+1)+'" '+(active.has(i+1)?'checked':'')+'><span>'+esc(d.slice(0,3))+'</span></label>').join('')+'</fieldset>';
}
async function openTeacherEditor(row=null){
 if(!isTeacher())return;
 try{
  const [{classes,sections},bells]=await Promise.all([loadClassSections(),loadBells()]);
  if(!bells.length){app().toast?.('The Principal needs to set the school bell times once. You can then assign classes and edit topics yourself.','error');return;}
  if(!classes.length){app().toast?.('The school must create classes and sections before teachers can schedule lessons.','error');return;}
  const group=classes.map(c=>({id:c.id,label:c.name,sections:sections.filter(x=>x.class_id===c.id)}));
  const classOptions=group.map(x=>option(x.id,x.label,row?.class_id)).join('');
  const sectionOptions=sections.filter(x=>x.class_id===(row?.class_id||classes[0]?.id)).map(x=>option(x.id,x.name,row?.section_id)).join('');
  const bellOptions=bells.map(x=>option(x.period_number,'Period '+x.period_number+' · '+formatTime(x.start_time)+'–'+formatTime(x.end_time),row?.period_number||bells[0].period_number)).join('');
  const body='<p class="nsto-muted">Principal sets the times once. You choose your subject, class and section here. The same lesson stays on your weekly timetable; update just the daily topic.</p>'+
  '<div class="nsto-grid">'+
  '<label>Class<select name="class_id" id="nstoClass" required>'+classOptions+'</select></label>'+
  '<label>Section<select name="section_id" id="nstoSection" required>'+sectionOptions+'</select></label>'+
  '<label>School Period<select name="period_number" required>'+bellOptions+'</select></label>'+
  '<label>Subject<div class="nsto-subject"><span id="nstoSubjectIcon">'+icon(row?.subject_name)+'</span><input type="text" name="subject_name" maxlength="140" required placeholder="e.g. Zoology, English, Mathematics" value="'+esc(row?.subject_name||'')+'"></div></label>'+
  '</div>'+(row?'<p class="nsto-muted">Repeats on '+esc(days[row.weekday])+'. Other weekdays can be added separately.</p>':weekdayBoxes([new Date().getDay()||1]))+
  '<div class="nsto-lesson-inputs"><h3>Lesson details</h3><p class="nsto-muted">Optional when setting your timetable. After first setup, edit only the daily topic.</p>'+
  '<label>Lesson date<input type="date" name="lesson_date" value="'+esc(localDay())+'"></label>'+
  '<label>Lesson / Chapter topic<textarea name="topic" maxlength="600" rows="2" placeholder="Daily teaching topic (optional)"></textarea></label>'+
  '<label>Homework / follow-up<textarea name="homework" maxlength="1500" rows="2" placeholder="Optional"></textarea></label></div>'+
  '<div class="nsto-tip">✓ Principal owns the time slots; your class, subject and lesson entries are yours. Students see their own class/section timetable.</div>';
  const wrap=dialog(row?'Edit My Class Period':'Assign My Class Period',body,async f=>{
    const uid=app().user.id,cls=f.get('class_id'),sec=f.get('section_id'),subject=String(f.get('subject_name')||'').trim();
    const weekdays=row?[row.weekday]:f.getAll('weekdays').map(Number);
    const periodNum=Number(f.get('period_number'));
    if(!sec||!cls||!sections.some(x=>x.id===sec&&x.class_id===cls))throw Error('Choose a section that belongs to this class.');
    if(!subject)throw Error('Enter your subject.');
    if(!weekdays.length)throw Error('Select at least one weekday for the repeating class.');
    if(!bells.some(x=>Number(x.period_number)===periodNum))throw Error('The selected school bell period no longer exists.');
    const values={class_id:cls,section_id:sec,subject_name:subject,period_number:periodNum};
    let savedRows=[];
    if(row){
      const r=await db().from('noor_class_timetable').update(values).eq('id',row.id).eq('school_id',school()).eq('teacher_id',uid).select('id,weekday');
      if(r.error)throw r.error;
      if((r.data||[]).length!==1)throw Error('Your teacher account could not edit this period.');
      savedRows=r.data||[];
    }else{
      const records=weekdays.map(weekday=>({...values,school_id:school(),teacher_id:uid,weekday}));
      const r=await db().from('noor_class_timetable').insert(records).select('id,weekday');
      if(r.error)throw r.error;
      if((r.data||[]).length!==records.length)throw Error('Some periods were not saved. Check for timetable conflicts.');
      savedRows=r.data||[];
    }
    const lessonTopic=String(f.get('topic')||'').trim(),lessonDate=String(f.get('lesson_date')||''),homework=String(f.get('homework')||'').trim();
    if(lessonTopic){
      const dateObject=new Date(lessonDate+'T12:00:00');
      if(!lessonDate||Number.isNaN(dateObject.getTime()))throw Error('The timetable is saved. Choose a valid lesson date before adding the topic.');
      const target=savedRows.find(x=>x.weekday===dateObject.getDay());
      if(!target)throw Error('The timetable is saved. Select a lesson date matching one of the selected weekdays to publish the topic.');
      const data={timetable_id:target.id,school_id:school(),teacher_id:uid,lesson_date:lessonDate,topic:lessonTopic,homework:homework||null};
      const result=await db().from('noor_daily_lesson_topics').upsert(data,{onConflict:'timetable_id,lesson_date'}).select('id');
      if(result.error||!result.data?.length)throw Error('Timetable saved. Daily topic could not be saved: '+(result.error?.message||'Use Edit Topic to retry.'));
    }
  });
  const sel=wrap.querySelector('#nstoSection'),cls=wrap.querySelector('#nstoClass'),input=wrap.querySelector('[name=subject_name]'),badge=wrap.querySelector('#nstoSubjectIcon');
  cls.onchange=()=>{const matching=sections.filter(x=>x.class_id===cls.value);sel.innerHTML=matching.map(x=>option(x.id,x.name,'')).join('');};
  input.oninput=()=>{badge.textContent=icon(input.value)};
  if(row){
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove My Period';remove.className='nsto-remove';
    const foot=wrap.querySelector('footer');foot.prepend(remove);
    remove.onclick=async()=>{
      if(!confirm('Remove this weekday period from your schedule and student timetable?'))return;
      remove.disabled=true;
      const r=await db().from('noor_class_timetable').update({is_active:false}).eq('id',row.id).eq('school_id',school()).eq('teacher_id',app().user.id).select('id');
      if(r.error||r.data?.length!==1){wrap.querySelector('#nstoError').textContent=r.error?.message||'Could not remove your period.';remove.disabled=false;return}
      wrap.remove();await mountTeacher();app().toast?.('This period was removed from the class timetable.','success');
    };
  }
 }catch(e){app().toast?.(migrationError(e)?setupHint:e.message,'error')}
}
function topicForRow(row,lessonDate,topics){return topics.find(x=>x.timetable_id===row.id&&x.lesson_date===lessonDate)}
async function openDailyTopic(row){
 if(!isTeacher()||row.teacher_id!==app().user.id)return;
 try{
  const date=localDay(),clockDate=new Date(date+'T12:00:00');
  const shift=(row.weekday-clockDate.getDay()+7)%7;
  clockDate.setDate(clockDate.getDate()+shift);
  const chosen=[clockDate.getFullYear(),two(clockDate.getMonth()+1),two(clockDate.getDate())].join('-');
  const previous=await fetchLessons([row.id],chosen);
  const found=previous[0]||{};
  const wrap=dialog('Daily Lesson Topic · '+row.subject_name,
    '<p class="nsto-muted">Class '+esc(row.class_label||'')+' · Every '+esc(days[row.weekday])+'. School period and class assignment stay unchanged.</p>'+
    '<label>Lesson date<input type="date" name="lesson_date" required value="'+esc(chosen)+'"></label>'+
    '<label>Today’s lesson / chapter topic<textarea name="topic" maxlength="600" required rows="3" placeholder="Chapter, topic or teaching objective">'+esc(found.topic||'')+'</textarea></label>'+
    '<label>Homework / follow-up (optional)<textarea name="homework" maxlength="1500" rows="2">'+esc(found.homework||'')+'</textarea></label>',
    async form=>{
     const date=String(form.get('lesson_date')||''),topic=String(form.get('topic')||'').trim();
     const when=new Date(date+'T12:00:00');
     if(!date||Number.isNaN(when.getTime())||when.getDay()!==row.weekday)throw Error('Select a '+days[row.weekday]+' date for this scheduled period.');
     if(!topic)throw Error('Write the lesson topic.');
     const data={timetable_id:row.id,school_id:school(),teacher_id:app().user.id,lesson_date:date,topic,homework:String(form.get('homework')||'').trim()||null};
     const res=await db().from('noor_daily_lesson_topics').upsert(data,{onConflict:'timetable_id,lesson_date'}).select('id');
     if(res.error)throw res.error;
     if(!res.data?.length)throw Error('The lesson topic was not saved.');
    });
  wrap.querySelector('input[name=lesson_date]').addEventListener('change',async e=>{
    try{
     const val=e.target.value;if(new Date(val+'T12:00:00').getDay()!==row.weekday)return;
     const records=await fetchLessons([row.id],val);
     const current=records[0]||{};
     wrap.querySelector('textarea[name=topic]').value=current.topic||'';
     wrap.querySelector('textarea[name=homework]').value=current.homework||'';
    }catch(err){wrap.querySelector('#nstoError').textContent=err.message}
  });
 }catch(e){app().toast?.(migrationError(e)?setupHint:e.message,'error')}
}
async function mountTeacher(){
 const host=document.querySelector('#workspace .noor-t4');
 if(!host||!isTeacher()||teacherLoading)return;
 const card=host.querySelector('.nt-columns .nt-card');
 if(!card)return;
 teacherLoading=true;
 try{
  const [bells,rows,ctx]=await Promise.all([loadBells(),fetchTeacherRows(),loadClassSections()]);
  const byBell=new Map(bells.map(x=>[Number(x.period_number),x]));
  const date=localDay(),week=new Date().getDay();
  const topics=await fetchLessons(rows.filter(x=>x.weekday===week).map(x=>x.id),date);
  const label=row=>ctx.classes.find(c=>c.id===row.class_id)?.name+' · '+(ctx.sections.find(c=>c.id===row.section_id)?.name||'Entire class');
  const sorted=rows.map(x=>({...x,class_label:label(x),bell:byBell.get(Number(x.period_number))})).sort((a,b)=>a.weekday-b.weekday||a.period_number-b.period_number);
  card.innerHTML='<div class="nt-card-head"><div><span class="nt-icon">◷</span><h2>My Weekly Teaching Timetable</h2><p class="nsto-muted">School bell times are fixed by Principal · you own classes, subjects and daily topics.</p></div><button type="button" id="nstoAddPeriod" class="nt-btn primary">+ Assign My Period</button></div>'+
   (!bells.length?'<div class="nsto-warning">Principal needs to set the school bell timetable once before teachers can assign classes.</div>':'')+
   '<div class="nsto-list">'+(sorted.length?sorted.map(row=>{
     const topic=topicForRow(row,date,topics),bell=row.bell,time=bell?formatTime(bell.start_time)+'–'+formatTime(bell.end_time):'Bell time missing';
     return '<article class="nsto-item"><div class="nsto-item-icon">'+icon(row.subject_name)+'</div><div class="nsto-item-main"><b>'+esc(row.subject_name)+'</b>'+
       '<small>'+esc(days[row.weekday])+' · Period '+esc(row.period_number)+' · '+esc(time)+'</small><small>'+esc(row.class_label)+'</small>'+
       (row.weekday===week?'<div class="nsto-topic-note">'+(topic?'📖 '+esc(topic.topic):'Lesson topic not entered today')+'</div>':'')+'</div>'+
       '<div class="nsto-actions"><button type="button" data-nsto-topic="'+esc(row.id)+'">✎ Topic</button><button type="button" data-nsto-edit="'+esc(row.id)+'">Edit</button></div></article>';
   }).join(''):'<div class="nsto-empty">No class periods assigned yet. Once the Principal sets school bell times, assign your own subjects and sections here.</div>')+'</div>';
  card.querySelector('#nstoAddPeriod').onclick=()=>openTeacherEditor(null);
  card.querySelectorAll('[data-nsto-edit]').forEach(btn=>btn.onclick=()=>openTeacherEditor(sorted.find(x=>x.id===btn.dataset.nstoEdit)));
  card.querySelectorAll('[data-nsto-topic]').forEach(btn=>btn.onclick=()=>openDailyTopic(sorted.find(x=>x.id===btn.dataset.nstoTopic)));
  const hero=host.querySelector('.nt-hero-stats');
  if(hero){
    const values=hero.querySelectorAll('.nt-hero-stat-pill b'),todayRows=sorted.filter(x=>x.weekday===week);
    if(values[0])values[0].textContent=new Set(todayRows.map(x=>x.class_label)).size.toString()+' class(es)';
    if(values[1])values[1].textContent=todayRows.length.toString();
    if(values[2])values[2].textContent=topics.length+' topics today';
  }
  const status=host.querySelector('#ntLiveStatus');
  if(status)status.textContent='Teacher controls class allocation; the Principal controls school bell times.';
  // Replace legacy period status text derived from Principal assignments with
  // the real teacher-owned timetable and current bell slot.
  const schoolTime=new Date().toTimeString().slice(0,5);
  const ongoing=sorted.find(x=>x.weekday===week&&x.bell&&formatTime(x.bell.start_time)<=schoolTime&&formatTime(x.bell.end_time)>schoolTime);
  const periodStatus=host.querySelector('.nt-status-list .nt-status-box:nth-child(2)');
  if(periodStatus){
    const heading=periodStatus.querySelector('b'),details=periodStatus.querySelector('small');
    if(heading)heading.textContent=ongoing?'Scheduled: '+ongoing.subject_name:'No period scheduled right now';
    if(details)details.textContent=ongoing?'Period '+ongoing.period_number+' · '+ongoing.class_label:'Your teacher-managed timetable is shown on the left.';
  }
  if(teacherKey!==app().user.id+':'+school()){
   if(teacherChannel)await db().removeChannel(teacherChannel);
   teacherKey=app().user.id+':'+school();
   teacherChannel=db().channel('noor-school-timetable-teacher-'+teacherKey)
    .on('postgres_changes',{event:'*',schema:'public',table:'noor_class_timetable',filter:'school_id=eq.'+school()},()=>{if(!document.querySelector('#noorTimetableDialog'))mountTeacher()})
    .on('postgres_changes',{event:'*',schema:'public',table:'noor_school_bell_slots',filter:'school_id=eq.'+school()},()=>{if(!document.querySelector('#noorTimetableDialog'))mountTeacher()})
    .on('postgres_changes',{event:'*',schema:'public',table:'noor_daily_lesson_topics',filter:'school_id=eq.'+school()},()=>{if(!document.querySelector('#noorTimetableDialog'))mountTeacher()})
    .subscribe();
  }
 }catch(err){
  card.innerHTML='<h2>My Teaching Timetable</h2><p class="nsto-warning">'+esc(migrationError(err)?setupHint:'Unable to read the school timetable: '+err.message)+'</p>';
 }finally{teacherLoading=false}
}
async function principalTable(){
 const [bells,rows,people,ctx]=await Promise.all([
  loadBells(),fetchSchoolRows(),db().from('profiles').select('id,full_name').eq('school_id',school()).eq('role','teacher').eq('status','active').limit(350),loadClassSections()
 ]);
 if(people.error)throw people.error;
 const names=new Map((people.data||[]).map(x=>[x.id,x.full_name]));
 const bellMap=new Map(bells.map(x=>[Number(x.period_number),x]));
 const date=localDay(),week=new Date().getDay();
 const todayRows=rows.filter(x=>x.weekday===week);
 const topics=await fetchLessons(todayRows.map(x=>x.id),date);
 const html=rows.length?rows.filter(x=>x.weekday===week).sort((a,b)=>a.period_number-b.period_number).map(x=>{
  const bell=bellMap.get(Number(x.period_number));
  const lesson=topicForRow(x,date,topics);
  return '<tr><td>'+esc(names.get(x.teacher_id)||'Teacher')+'</td><td>'+icon(x.subject_name)+' '+esc(x.subject_name)+'</td><td>'+
   esc(ctx.classes.find(c=>c.id===x.class_id)?.name||'—')+'</td><td>'+esc(ctx.sections.find(c=>c.id===x.section_id)?.name||'—')+
   '</td><td>'+esc(bell?formatTime(bell.start_time)+'–'+formatTime(bell.end_time):'Not set')+
   '</td><td>'+esc(lesson?.topic||'Not entered yet')+'</td></tr>'
 }).join(''):'';
 return {rows,bells,html,topicCount:topics.length};
}
async function mountPrincipal(){
 const container=document.querySelector('#noor-principal #pd-periods');
 if(!container||!isLeader()||principalLoading)return;
 principalLoading=true;
 try{
  const hdr=container.closest('.pd-schedule')?.querySelector('header');
  const d=await principalTable();
  if(hdr){
   const add=hdr.querySelector('#pd-add-teacher');
   if(add){add.textContent='⚙ School Bell Times';add.id='nstoBellSettings';add.hidden=!canSetBells();add.onclick=openSchoolTimes;}
   const all=hdr.querySelector('#pd-timetable');
   if(all){all.textContent='View School Timetable →';all.onclick=showPrincipalSchedule;}
  }
  container.innerHTML='<div class="nsto-principal-desc">School bell times are set by Principal. Each teacher manages their own subject, section and daily lesson topic.</div>'+
   (d.rows.length?d.html?'<div class="pd-table-wrap"><table><thead><tr><th>Teacher</th><th>Subject</th><th>Class</th><th>Section</th><th>Time</th><th>Today’s Topic</th></tr></thead><tbody>'+d.html+'</tbody></table></div>':
    '<p class="nsto-empty">No teacher periods scheduled for today. View full weekly timetable for other days.</p>':
    '<p class="nsto-empty">No teacher-assigned lessons yet. Principal can configure school bell times above.</p>');
 }catch(err){
  container.innerHTML='<p class="nsto-warning">'+esc(migrationError(err)?setupHint:'Unable to load timetable: '+err.message)+'</p>';
 }finally{principalLoading=false}
}
async function showPrincipalSchedule(){
 if(!isLeader())return;
 try{
  const [bells,rows,ctx]=await Promise.all([loadBells(),fetchSchoolRows(),loadClassSections()]);
  const times=new Map(bells.map(x=>[Number(x.period_number),x]));
  dialog('School-wide Weekly Timetable','<p class="nsto-muted">Read-only class schedule. Teachers manage their own assignments and daily topics.</p>'+
   '<div class="nsto-list">'+(rows.length?rows.map(row=>{
    const bell=times.get(Number(row.period_number));
    return '<div class="nsto-item"><div class="nsto-item-icon">'+icon(row.subject_name)+'</div><div class="nsto-item-main"><b>'+esc(row.subject_name)+'</b><small>'+esc(days[row.weekday])+' · Period '+esc(row.period_number)+' · '+esc(bell?formatTime(bell.start_time)+'–'+formatTime(bell.end_time):'Bell time not set')+'</small><small>'+esc(ctx.classes.find(x=>x.id===row.class_id)?.name||'')+' · '+esc(ctx.sections.find(x=>x.id===row.section_id)?.name||'')+'</small></div></div>'
   }).join(''):'<p class="nsto-empty">No teacher-assigned class periods yet.</p>')+'</div>',
   async()=>{});
  const form=document.querySelector('#noorTimetableDialog form');
  if(form)form.querySelector('button[type=submit]').hidden=true;
 }catch(e){app().toast?.(migrationError(e)?setupHint:e.message,'error')}
}
async function studentPeriods(classId,sectionId){
 if(!classId||!school())return [];
 const [bells,rows]=await Promise.all([
   loadBells(),
   db().from('noor_class_timetable').select('id,weekday,period_number,subject_name,section_id,class_id')
    .eq('school_id',school()).eq('class_id',classId).eq('is_active',true).order('weekday').order('period_number')
 ]);
 if(rows.error)throw rows.error;
 const bmap=new Map(bells.map(x=>[Number(x.period_number),x]));
 const visible=(rows.data||[]).filter(x=>!x.section_id||x.section_id===sectionId);
 const date=localDay(),topics=await fetchLessons(visible.filter(x=>x.weekday===new Date().getDay()).map(x=>x.id),date);
 return visible.map(x=>{
  const bell=bmap.get(Number(x.period_number)),topic=topicForRow(x,date,topics);
  return {...x,start_time:bell?.start_time||'',end_time:bell?.end_time||'',class_label:'Class timetable',
    approval_status:'approved',block_type:'class',lesson_topic:topic?.topic||'',homework:topic?.homework||''};
 });
}
function connectStudentLive(handler){
 if(!app().schoolId||!app().user||typeof handler!=='function')return null;
 const ident=app().user.id+':'+school();
 return db().channel('noor-student-class-timetable-'+ident)
  .on('postgres_changes',{event:'*',schema:'public',table:'noor_class_timetable',filter:'school_id=eq.'+school()},handler)
  .on('postgres_changes',{event:'*',schema:'public',table:'noor_school_bell_slots',filter:'school_id=eq.'+school()},handler)
  .on('postgres_changes',{event:'*',schema:'public',table:'noor_daily_lesson_topics',filter:'school_id=eq.'+school()},handler)
  .subscribe();
}
window.NOOR_SCHOOL_TIMETABLE=Object.freeze({mountTeacher,mountPrincipal,openTeacherEditor,openSchoolTimes,showPrincipalSchedule,studentPeriods,connectStudentLive,setupHint});
})();