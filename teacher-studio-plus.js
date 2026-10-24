/* NOOR Teacher Studio extensions: accessible calendar, editable timetable,
   tasks, Jinni notices, and school-scoped live refresh. */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const $=(sel,root=document)=>root.querySelector(sel);
const day=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let active=false,channel=null,loadedKey='';
const style=document.createElement('style');style.textContent=`
.noor-teacher-studio .nts-extra{margin-top:16px}
.noor-teacher-studio .nts-tools{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:14px}
.noor-teacher-studio .nts-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.noor-teacher-studio .nts-form label{font-size:11px;font-weight:800;display:grid;gap:5px}
.noor-teacher-studio .nts-form input,.noor-teacher-studio .nts-form select{width:100%;min-width:0;padding:9px;border:1px solid #dcd6ef;border-radius:10px;background:#fff;color:#30284b}
.noor-teacher-studio .nts-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
.noor-teacher-studio .nts-calendar span{min-height:37px;border-radius:9px;background:#f5f2fd;display:grid;place-items:center;font-size:11px}
.noor-teacher-studio .nts-calendar .present{background:#d6f6e5;color:#13603c}
.noor-teacher-studio .nts-calendar .absent{background:#ffe1e3;color:#8d2637}
.noor-teacher-studio .nts-calendar .leave{background:#ffe9c8;color:#835210}
.noor-teacher-studio .nts-calendar .holiday{background:#e6def8;color:#51408c}
.noor-teacher-studio .nts-overlay{position:fixed;inset:0;z-index:10000;background:#17122b77;display:flex;justify-content:flex-end}
.noor-teacher-studio .nts-drawer{width:min(410px,100%);height:100%;overflow:auto;background:#faf8ff;padding:24px;box-shadow:-10px 0 40px #24133b30}
.noor-teacher-studio .nts-row{padding:10px;border-bottom:1px solid #e5def4}
.noor-teacher-studio .nts-row small{display:block;color:#756d89}
.noor-teacher-studio .nts-status{font-size:12px;color:#685b8d}
@media(max-width:650px){.noor-teacher-studio .nts-form{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;document.head.append(style);
async function boot(){
const api=window.NOOR_AI_APP,root=$('.noor-teacher-studio');
if(!api?.user||api.profile?.role!=='teacher'||!root||!api.schoolId)return;
const key=api.user.id+':'+api.schoolId;
if(root.dataset.extended===key||active)return;
active=true;
try{
const db=api.db,school=api.schoolId,uid=api.user.id;
const [attendance,notices,events,tasks,periods]=await Promise.all([
db.from('noor_staff_attendance').select('attendance_date,status').eq('school_id',school).eq('teacher_id',uid).gte('attendance_date',new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10)),
db.from('school_notices').select('id,title,body,created_at,target_roles').eq('school_id',school).eq('is_active',true).order('created_at',{ascending:false}).limit(20),
db.from('calendar_events').select('id,title,starts_at,event_type,teacher_id').eq('school_id',school).gte('starts_at',new Date().toISOString()).order('starts_at').limit(12),
db.from('noor_teacher_tasks').select('id,title,status,due_date,priority').eq('school_id',school).eq('teacher_id',uid).order('due_date').limit(25),
db.from('noor_teacher_periods').select('*').eq('school_id',school).eq('teacher_id',uid).order('weekday').order('start_time')
]);
const noteData=(notices.data||[]).filter(n=>!n.target_roles?.length||n.target_roles.includes('teacher')||n.target_roles.includes('all'));
const eventData=(events.data||[]).filter(e=>!e.teacher_id||e.teacher_id===uid);
const d=new Date(),month=d.getMonth(),year=d.getFullYear(),start=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate();
const attendanceMap=Object.fromEntries((attendance.data||[]).map(x=>[x.attendance_date,x.status]));
const calendar=Array.from({length:start},()=>'<span aria-hidden="true"></span>').concat(Array.from({length:days},(_,i)=>{const date=[year,String(month+1).padStart(2,'0'),String(i+1).padStart(2,'0')].join('-'),weekday=new Date(year,month,i+1).getDay();const status=attendanceMap[date]||(weekday===0?'holiday':'');return '<span class="'+esc(status)+'" title="'+esc(date+' '+(status||'Not recorded'))+'">'+(i+1)+'</span>'})).join('');
const present=(attendance.data||[]).filter(a=>a.status==='present').length,absent=(attendance.data||[]).filter(a=>a.status==='absent').length,leave=(attendance.data||[]).filter(a=>a.status==='leave').length;
const extra=document.createElement('section');extra.className='nts-extra';
extra.innerHTML=`<div class="nts-grid">
<div class="nts-card" style="grid-column:span 2"><h3>Attendance calendar · ${esc(d.toLocaleString('en',{month:'long',year:'numeric'}))}</h3><p class="nts-muted">Present ${present} · Absent ${absent} · Leave ${leave} · Recorded attendance ${present+absent?Math.round(present/(present+absent)*100):0}%</p><div class="nts-calendar">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>'<span><b>'+x+'</b></span>').join('')}${calendar}</div><p class="nts-muted">Purple = Sundays; green = present; red = absent; amber = leave. Official holidays require a school calendar entry.</p></div>
<div class="nts-card"><h3>Jinni · Notice Board</h3><p>${noteData.length} notices · ${eventData.length} upcoming events</p><button id="ntsJinni">Open Jinni ✦</button><p class="nts-muted">Tasks, notices and meetings in one place</p></div></div>
<div class="nts-card"><h3>My timetable editor</h3><p class="nts-muted">Submit a proposed period. Principal approval is required before it becomes an official timetable.</p><form id="ntsPeriodForm" class="nts-form">
<label>Day<select name="weekday">${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((x,i)=>'<option value="'+i+'" '+(i===d.getDay()?'selected':'')+'>'+x+'</option>').join('')}</select></label>
<label>Period<input name="period_number" type="number" min="1" max="12" required></label>
<label>Block<select name="block_type"><option value="class">Class</option><option value="break">Break</option><option value="lunch">Lunch</option></select></label>
<label>Start<input name="start_time" type="time" required></label>
<label>End<input name="end_time" type="time" required></label>
<label>Subject<input name="subject_name" maxlength="80" placeholder="Maths / Break" required></label>
<label>Class + section<input name="class_label" maxlength="60" placeholder="8-B" required></label>
<div><button type="submit">Request period</button></div></form>
<p class="nts-status" id="ntsPeriodStatus" role="status"></p>
<div>${(periods.data||[]).map(p=>'<div class="nts-row"><strong>'+esc(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][p.weekday])+' · '+esc(p.subject_name)+' · '+esc(p.class_label)+'</strong><small>'+esc(p.start_time?.slice(0,5))+'–'+esc(p.end_time?.slice(0,5))+' · '+esc(p.approval_status||'pending')+'</small>'+(p.approval_status==='pending'?'<button type="button" data-edit-period="'+esc(p.id)+'">Edit request</button>':'')+'</div>').join('')||'<p class="nts-muted">No timetable entries yet.</p>'}</div></div>
<div class="nts-card"><h3>Personal task board</h3><form id="ntsTaskForm" class="nts-form"><label>Task<input name="title" required maxlength="150" placeholder="Prepare lesson notes"></label><label>Due date<input name="due_date" type="date"></label><label>Priority<select name="priority"><option>normal</option><option>high</option><option>low</option></select></label><div><button type="submit">Add task</button></div></form><p id="ntsTaskStatus" class="nts-status" role="status"></p>
${(tasks.data||[]).map(t=>'<div class="nts-row"><strong>'+esc(t.title)+'</strong><small>'+esc(t.status)+' · '+esc(t.due_date||'No due date')+'</small><button data-task="'+esc(t.id)+'" '+(t.status==='done'?'disabled':'')+'>Mark done</button></div>').join('')||'<p class="nts-muted">No personal tasks yet.</p>'}</div>`;
root.append(extra);root.dataset.extended=key;
$('#ntsJinni',extra).onclick=()=>{
const overlay=document.createElement('div');overlay.className='nts-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Jinni notice board');
overlay.innerHTML='<div class="nts-drawer"><button id="ntsClose">Close ✕</button><h2>Jinni · Notice Board</h2><h3>Tasks</h3>'+((tasks.data||[]).map(t=>'<div class="nts-row">'+esc(t.title)+'<small>'+esc(t.status)+'</small></div>').join('')||'<p>No tasks</p>')+'<h3>Notices</h3>'+noteData.map(n=>'<div class="nts-row"><strong>'+esc(n.title)+'</strong><small>'+esc(n.body)+'</small></div>').join('')+'<h3>Meetings & events</h3>'+eventData.map(e=>'<div class="nts-row">'+esc(e.title)+'<small>'+esc(new Date(e.starts_at).toLocaleString())+'</small></div>').join('')+'</div>';
root.append(overlay);$('#ntsClose',overlay).onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};$('#ntsClose',overlay).focus();
};
$('#ntsPeriodForm',extra).onsubmit=async e=>{
e.preventDefault();const form=e.currentTarget,values=Object.fromEntries(new FormData(form));if(values.start_time>=values.end_time){$('#ntsPeriodStatus',extra).textContent='End time must be after start time';return;}
const b=$('button[type=submit]',form);b.disabled=true;
const payload={...values,weekday:Number(values.weekday),period_number:Number(values.period_number)};
const editing=form.dataset.editPeriod||'';
const response=editing
 ?await db.from('noor_teacher_periods').update(payload).eq('id',editing).eq('teacher_id',uid).eq('school_id',school).eq('approval_status','pending').select('id').maybeSingle()
 :await db.from('noor_teacher_periods').insert({...payload,school_id:school,teacher_id:uid,status:'upcoming',approval_status:'pending'}).select('id').maybeSingle();
const error=response.error||(!response.data?{message:'Request no longer pending or access denied.'}:null);
$('#ntsPeriodStatus',extra).textContent=error?error.message:editing?'Pending request updated.':'Period submitted for approval.';
b.disabled=false;if(!error){root.dataset.extended='';extra.remove();boot();}
};
$('#ntsTaskForm',extra).onsubmit=async e=>{
e.preventDefault();const form=e.currentTarget,values=Object.fromEntries(new FormData(form));if(!values.due_date)delete values.due_date;
const b=$('button[type=submit]',form);b.disabled=true;
const {error}=await db.from('noor_teacher_tasks').insert({...values,school_id:school,teacher_id:uid,status:'todo'});
$('#ntsTaskStatus',extra).textContent=error?error.message:'Task added';b.disabled=false;if(!error){root.dataset.extended='';extra.remove();boot();}
};
extra.addEventListener('click',async e=>{
const edit=e.target.closest('[data-edit-period]');if(edit){
 const row=(periods.data||[]).find(p=>p.id===edit.dataset.editPeriod);
 if(!row)return;
 const form=$('#ntsPeriodForm',extra);
 ['weekday','period_number','start_time','end_time','subject_name','class_label','block_type'].forEach(k=>{if(form.elements[k])form.elements[k].value=String(row[k]??'').slice(0,(k==='start_time'||k==='end_time')?5:255)});
 form.dataset.editPeriod=row.id;form.querySelector('button[type=submit]').textContent='Update pending request';
 form.scrollIntoView({behavior:'smooth',block:'center'});return;
}
const b=e.target.closest('[data-task]');if(!b)return;b.disabled=true;
const {error}=await db.from('noor_teacher_tasks').update({status:'done'}).eq('id',b.dataset.task).eq('teacher_id',uid).eq('school_id',school);
if(error){api.toast(error.message,'error');b.disabled=false}else{root.dataset.extended='';extra.remove();boot();}
});
if(channel)db.removeChannel(channel);
channel=db.channel('noor-teacher-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'noor_teacher_tasks',filter:'teacher_id=eq.'+uid},()=>{root.dataset.extended='';extra.remove();boot()}).subscribe();
}catch(e){console.warn('Teacher studio extension unavailable',e)}finally{active=false}
}
const observer=new MutationObserver(()=>{const root=$('.noor-teacher-studio');if(root&&!root.dataset.extended)boot()});
observer.observe(document.body,{subtree:true,childList:true});
})();