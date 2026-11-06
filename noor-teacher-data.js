/* Teacher workspace reads/writes the same institution records as Principal and students. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{},E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>window.NOOR_ACCOUNT_CONTEXT?.enabled()&&A().profile?.role==='teacher';
const day=()=>window.NOOR_SHARED_TIMETABLE.schoolDay(A().school?.timezone);
const rows=async make=>{const out=[];for(let i=0;;i+=500){const r=await make().range(i,i+499);if(r.error)throw r.error;out.push(...r.data||[]);if((r.data||[]).length<500)return out;}};
async function context(){const c=await window.NOOR_SHARED_TIMETABLE.context();if(!['teacher','faculty'].includes(c.membership.role))throw Error('Active teacher membership required.');return c;}
async function assignments(c){
 const [groups,enrolled]=await Promise.all([window.NOOR_SCHOOL_STRUCTURE.fetchGroups(c.db,c.school.id),rows(()=>c.db.from('academic_group_memberships').select('group_id,group_role').eq('institution_id',c.school.id).eq('membership_id',c.membership.id).eq('status','active').order('id'))]);
 const ids=enrolled.filter(x=>['teacher','faculty'].includes(x.group_role)).map(x=>x.group_id);
 const allowed=groups.filter(g=>g.is_active&&ids.includes(g.id));
 const list=allowed.map(g=>{const parent=groups.find(x=>x.id===g.parent_group_id);return{group_id:g.id,class_id:parent?.id||g.id,section_id:parent?g.id:null,class_label:parent?parent.name+' · '+g.name:g.name};});
 // These are verified group memberships saved at signup, never user metadata grants.
 Object.assign(A().profile,{class_id:list[0]?.class_id||null,section_id:list[0]?.section_id||null,class_label:list[0]?.class_label||''});
 return list;
}
async function load(){
 const c=await context(),auth=await c.db.auth.getUser();if(auth.error)throw auth.error;
 const contact=auth.data.user.user_metadata?.noor_contact||{};
 const [assigned,tt,checkin,calendar]=await Promise.all([assignments(c),window.NOOR_SHARED_TIMETABLE.load(),c.db.from('noor_staff_checkins').select('status,marked_at').eq('institution_id',c.school.id).eq('membership_id',c.membership.id).eq('checkin_date',day()).maybeSingle(),c.db.from('noor_calendar_events').select('id,title,description,kind,starts_at,ends_at,created_at').eq('institution_id',c.school.id).gte('ends_at',new Date().toISOString()).order('starts_at').limit(30)]);
 for(const r of [tt,checkin,calendar])if(r.error)throw r.error;
 const periods=(tt.data||[]).filter(p=>p.teacher_membership_id===c.membership.id);
 const ok=data=>({data,error:null}),empty=()=>ok([]);
 Object.assign(A().profile,{mobile_number:contact.phone||'',date_of_birth:contact.date_of_birth||''});
 return {extra:ok({joined_on:contact.joined_on||c.membership.joined_at?.slice(0,10)||'',date_of_birth:contact.date_of_birth||'',qualification:contact.qualification||'',address:contact.address||contact.location||''}),periods:ok(periods),runs:ok(periods.filter(p=>p.completed).map(p=>({period_id:p.id,status:'done'}))),checkin:ok(checkin.data?{...checkin.data,checked_in_at:checkin.data.marked_at}:null),assignees:empty(),personal:empty(),notices:ok((calendar.data||[]).filter(x=>x.kind==='notice').map(x=>({...x,body:x.description}))),calendar:ok((calendar.data||[]).filter(x=>x.kind!=='notice')),assignment:ok(assigned),membership:ok({joined_at:c.membership.joined_at})};
}
async function saveProfile(values){
 const c=await context(),auth=await c.db.auth.getUser();if(auth.error||auth.data.user.id!==c.userId)throw Error('Your account changed.');
 const v=k=>String(values[k]||'').trim(),name=v('full_name');if(!name||name.length>160)throw Error('Enter your full name (maximum 160 characters).');
 for(const k of ['joined_on','date_of_birth'])if(v(k)&&(!/^\d{4}-\d{2}-\d{2}$/.test(v(k))||!Number.isFinite(Date.parse(v(k)))||new Date(v(k)).toISOString().slice(0,10)!==v(k)||v(k)>day()||v(k)<'1900-01-01'))throw Error('Enter a valid '+(k==='joined_on'?'joining date':'date of birth')+'.');
 if(v('mobile_number')&&!/^\+?[0-9 ()-]{7,30}$/.test(v('mobile_number')))throw Error('Enter a valid phone number.');
 if(v('qualification').length>240||v('address').length>500)throw Error('Qualification or address is too long.');
 const r=await c.db.from('profiles').update({full_name:name}).eq('id',c.userId).select('full_name').single();if(r.error)throw r.error;
 const contact={...auth.data.user.user_metadata?.noor_contact,phone:v('mobile_number'),joined_on:v('joined_on'),date_of_birth:v('date_of_birth'),qualification:v('qualification'),address:v('address')};
 const u=await c.db.auth.updateUser({data:{noor_contact:contact}});if(u.error)throw Error('Name saved; personal details not saved: '+u.error.message);
 if(A().user?.id!==c.userId)throw Error('Account changed. Refresh your profile.');
 Object.assign(A().profile,{full_name:name,mobile_number:contact.phone,date_of_birth:contact.date_of_birth});
 syncHeader();
}
function syncHeader(){const a=A(),photo=a.profile?.avatar_url;for(const id of ['topName','sideUserName']){const el=document.getElementById(id);if(el)el.textContent=a.profile?.full_name||'Teacher';}const av=document.getElementById('topAvatar');if(av){av.innerHTML=photo&&/^https:\/\//.test(photo)?'<img src="'+E(photo)+'" alt="My profile photo">':'<span aria-label="Profile photo not uploaded">◉</span>';}}
async function checkIn(){const c=await context(),r=await c.db.rpc('noor_teacher_check_in',{p_institution:c.school.id});if(r.error)throw r.error;window.dispatchEvent(new CustomEvent('noor:staff-checkin-saved'));return r.data;}
const shell=(title,body)=>'<div class="ta-page"><header class="ta-header"><h1>'+E(title)+'</h1><button class="ta-soft" type="button" data-back>← Dashboard</button></header>'+body+'</div>';
let registerVersion=0;
const attendanceStatuses=['present','absent','late','leave'];
function attendanceTable(students,marks=[]){
 if(!students.length)return '<p>No students enrolled in this class yet.</p>';
 const saved=new Map(marks.map(m=>[m.student_membership_id,m.attendance_status]));
 return '<div class="ta-register-scroll" tabindex="0" role="region" aria-label="Student attendance table"><table class="ta-register"><caption>Tap one status for each student</caption><thead><tr><th scope="col">#</th><th scope="col">Student</th><th scope="col">Roll No.</th>'+attendanceStatuses.map(s=>'<th scope="col" class="ta-status-heading">'+s[0].toUpperCase()+s.slice(1)+'</th>').join('')+'</tr></thead><tbody>'+students.map((s,i)=>{
 const photo=/^https:\/\//.test(s.photo||'')?'<img src="'+E(s.photo)+'" alt="" loading="lazy">':'<span aria-hidden="true">'+E((s.name||'S').trim().split(/\s+/).slice(0,2).map(n=>n[0]||'').join(''))+'</span>';
 return '<tr><td>'+(i+1)+'</td><th scope="row"><div class="ta-register-student"><span class="ta-register-photo">'+photo+'</span><b>'+E(s.name||'Student')+'</b></div></th><td class="ta-roll-number">'+E(s.roll_number||'—')+'</td>'+attendanceStatuses.map(status=>'<td class="ta-status-cell"><label class="ta-status-option '+status+'"><input type="radio" name="attendance-'+E(s.membership_id)+'" data-student="'+E(s.membership_id)+'" value="'+status+'" aria-label="'+E(status[0].toUpperCase()+status.slice(1)+' — '+(s.name||'Student')+' · Roll '+(s.roll_number||'not assigned'))+'" required '+(saved.get(s.membership_id)===status?'checked':'')+'><span class="ta-radio-hit" aria-hidden="true"></span></label></td>').join('')+'</tr>';
 }).join('')+'</tbody></table></div>';
}
function attendanceRecords(form,students){
 const selected=new Map([...form.querySelectorAll('input[data-student]:checked')].map(input=>[input.dataset.student,input.value]));
 return students.map(s=>{const status=selected.get(s.membership_id);if(!attendanceStatuses.includes(status))throw Error('Mark Present, Absent or Late for every student.');return{student_membership_id:s.membership_id,status};});
}
async function rosterPhotos(db,students){return Promise.all(students.map(async s=>{let photo=/^https:\/\//.test(s.avatar_url||'')?s.avatar_url:null;if(s.avatar_url?.startsWith('noor-profile-photos/')){try{photo=await window.NOOR_AVATAR_SAFE?.signedUrl({client:db,storedReference:s.avatar_url,userId:s.membership_id});}catch{photo=null;}}return{...s,photo};}));}
async function attendance(){
 const host=document.getElementById('view-attendance');if(!host)return;const version=++registerVersion;host.innerHTML=shell('Take Attendance','<p>Loading your class…</p>');
 try{const c=await context(),assigned=await assignments(c);if(version!==registerVersion)return;
 host.innerHTML=shell('Take Attendance','<div class="ta-panel"><div class="ta-fields"><label>My class / section<select data-group>'+assigned.map(x=>'<option value="'+E(x.group_id)+'">'+E(x.class_label)+'</option>').join('')+'</select></label><label>Date<input data-date type="date" value="'+day()+'" max="'+day()+'"></label></div></div><form class="ta-panel" data-register><div class="ta-register-heading"><h2>Student Attendance</h2><div data-attendance-summary aria-live="polite"></div></div><div data-roster></div><p role="status" data-status></p><button class="ta-primary" type="submit" disabled>Save attendance</button></form>');
 host.querySelector('[data-back]').onclick=()=>A().openView('overview');const form=host.querySelector('form'),group=host.querySelector('[data-group]'),date=host.querySelector('[data-date]'),roster=host.querySelector('[data-roster]'),msg=host.querySelector('[data-status]'),button=form.querySelector('[type=submit]');let students=[],request=0;
 async function refresh(){const n=++request;button.disabled=true;students=[];if(!group.value){roster.textContent='No saved class selection. Ask your principal to review your class assignment.';return;}roster.textContent='Loading enrolled students…';msg.textContent='';try{
 const report=await c.db.rpc('noor_class_performance',{p_institution:c.school.id,p_group:group.value,p_from:date.value,p_to:date.value});if(report.error)throw report.error;
 const saved=await c.db.from('class_sessions').select('id').eq('institution_id',c.school.id).eq('academic_group_id',group.value).eq('title','Daily class attendance').gte('starts_at',date.value+'T00:00:00'+offset(c.school.timezone,date.value)).lte('starts_at',date.value+'T23:59:59'+offset(c.school.timezone,date.value)).limit(1);if(saved.error)throw saved.error;
 let marks=[];if(saved.data?.length){const old=await rows(()=>c.db.from('attendance_records').select('id,student_membership_id,attendance_status').eq('institution_id',c.school.id).eq('session_id',saved.data[0].id).order('id'));marks=old;}
 if(n!==request||version!==registerVersion||A().user?.id!==c.userId)return;students=report.data.students||[];
 const withPhotos=await rosterPhotos(c.db,students);if(n!==request||version!==registerVersion||A().user?.id!==c.userId||A().schoolId!==c.school.id)return;students=withPhotos;roster.innerHTML=attendanceTable(students,marks);updateSummary();button.disabled=!students.length;
 }catch(e){if(n===request){roster.textContent='Could not load attendance: '+e.message;}}}
 group.onchange=refresh;date.onchange=refresh;
 function updateSummary(){const selected=[...form.querySelectorAll('input[data-student]:checked')];host.querySelector('[data-attendance-summary]').innerHTML=attendanceStatuses.map(status=>'<span class="ta-count '+status+'">'+selected.filter(x=>x.value===status).length+' '+status[0].toUpperCase()+status.slice(1)+'</span>').join('')+'<span class="ta-count">'+Math.max(0,students.length-selected.length)+' Unmarked</span>';}
 roster.onchange=e=>{if(e.target.matches('input[data-student]')){updateSummary();msg.textContent='Unsaved changes — review and save attendance.';}};
 form.onsubmit=async e=>{e.preventDefault();button.disabled=true;group.disabled=date.disabled=true;msg.textContent='Saving all attendance marks…';try{if(A().user?.id!==c.userId||A().schoolId!==c.school.id)throw Error('Account changed. Reopen attendance.');const records=attendanceRecords(form,students);form.querySelectorAll('input[data-student]').forEach(input=>input.disabled=true);const r=await c.db.rpc('noor_save_class_register',{p_institution:c.school.id,p_group:group.value,p_date:date.value,p_records:records});if(r.error)throw r.error;if(r.data?.count!==students.length)throw Error('Attendance save was incomplete.');msg.textContent='✓ '+r.data.count+' students saved. Principal and My Class now use these records.';window.dispatchEvent(new CustomEvent('noor:attendance-saved'));}catch(ex){msg.textContent='Not saved: '+ex.message;}finally{button.disabled=!students.length;group.disabled=date.disabled=false;form.querySelectorAll('input[data-student]').forEach(input=>input.disabled=false);}};
 await refresh();
 }catch(e){host.innerHTML=shell('Take Attendance','<p>'+E(e.message)+'</p>');}
}
function offset(tz,date){const f=new Intl.DateTimeFormat('en',{timeZone:tz||'Asia/Kolkata',timeZoneName:'longOffset'}).formatToParts(new Date(date+'T12:00:00Z')).find(x=>x.type==='timeZoneName')?.value;return f==='GMT'?'+00:00':f?.replace('GMT','')||'+05:30';}
async function learning(id){
 const host=document.getElementById('view-'+id);if(!host)return;const planner=id==='weekly-plan',kind=id==='paper-generator'?'assignment':'smart_note',title=planner?'Weekly Planner':kind==='assignment'?'Create Assignment':'Smart Notes';host.innerHTML=shell(title,'<p>Loading…</p>');
 try{const c=await context(),assigned=await assignments(c),auth=await c.db.auth.getUser();if(auth.error)throw auth.error;
 host.innerHTML=shell(title,'<form class="ta-panel sp-form"><label>Class / section<select name="group" required>'+assigned.map(x=>'<option value="'+E(x.group_id)+'">'+E(x.class_label)+'</option>').join('')+'</select></label><label>Title<input name="title" required maxlength="180"></label><label>Subject<input name="subject" required maxlength="140"></label><label>'+(planner?'Week starting':'Due / scheduled date')+'<input name="date" type="date" '+(planner||kind==='assignment'?'required':'')+' value="'+day()+'"></label><label>'+(planner?'Weekly plan':'Content / instructions')+'<textarea name="body" required maxlength="50000" rows="8"></textarea></label><button class="ta-primary" type="submit">'+(planner?'Save weekly plan':'Publish to students')+'</button><p role="status"></p></form><section class="ta-panel"><h2>Saved '+(planner?'plans':kind==='assignment'?'assignments':'notes')+'</h2><div data-list></div></section>');
 host.querySelector('[data-back]').onclick=()=>A().openView('overview');const form=host.querySelector('form'),list=host.querySelector('[data-list]');
 async function listSaved(){let q=c.db.from(planner?'noor_teacher_weekly_plans':'noor_learning_items').select('id,institution_id,title,body,subject_name,due_at,academic_group_id').eq('institution_id',c.school.id).eq('created_by',c.userId);if(!planner)q=q.eq('kind',kind);const result=await q.order('created_at',{ascending:false}).limit(100);if(result.error)throw result.error;const data=result.data;list.innerHTML=(data||[]).filter(x=>!planner||x.institution_id===c.school.id).map(x=>'<article class="ta-panel"><b>'+E(x.title)+'</b><p>'+E(x.subject_name)+' · '+E(assigned.find(g=>g.group_id===x.academic_group_id)?.class_label||'Class')+'</p><p style="white-space:pre-wrap">'+E(x.body)+'</p></article>').join('')||'<p>No saved records yet.</p>';}
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button'),msg=form.querySelector('[role=status]');b.disabled=true;try{if(A().user?.id!==c.userId||A().schoolId!==c.school.id)throw Error('Account changed.');const v=Object.fromEntries(new FormData(form));if(!assigned.some(x=>x.group_id===v.group))throw Error('Choose your assigned class.');const row={institution_id:c.school.id,academic_group_id:v.group,title:v.title.trim(),subject_name:v.subject.trim(),body:v.body.trim(),due_at:v.date?v.date+'T12:00:00Z':null};let r;if(planner){r=await c.db.from('noor_teacher_weekly_plans').insert({...row,teacher_membership_id:c.membership.id,created_by:c.userId}).select('id').single();}else r=await c.db.from('noor_learning_items').insert({...row,kind,status:'published',created_by:c.userId}).select('id').single();if(r.error)throw r.error;msg.textContent=planner?'Weekly plan saved.':'Published to your class.';await listSaved();}catch(ex){msg.textContent=ex.message;}finally{b.disabled=false;}};await listSaved();
 }catch(e){host.innerHTML=shell(title,'<p>'+E(e.message)+'</p>');}
}
async function classQuestions(host){
 const c=await context(),r=await c.db.from('noor_class_questions').select('id,question,reply,created_at,academic_group_id').eq('institution_id',c.school.id).order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;if(A().user?.id!==c.userId||A().schoolId!==c.school.id)return;
 const panel=document.createElement('section');panel.className='ta-panel';panel.innerHTML='<h2>Student Questions</h2>'+((r.data||[]).map(x=>'<form data-question="'+E(x.id)+'" class="sp-form"><p>'+E(x.question)+'</p><small>'+E(new Date(x.created_at).toLocaleString())+'</small><label>My reply<textarea name="reply" maxlength="10000" required>'+E(x.reply||'')+'</textarea></label><button class="ta-primary" type="submit">Save reply</button><p role="status"></p></form>').join('')||'<p>No class questions yet.</p>');host.append(panel);
 panel.querySelectorAll('form').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button'),msg=form.querySelector('[role=status]');b.disabled=true;try{if(A().user?.id!==c.userId||A().schoolId!==c.school.id)throw Error('Account changed.');const saved=await c.db.from('noor_class_questions').update({reply:form.elements.reply.value.trim(),replied_at:new Date().toISOString()}).eq('id',form.dataset.question).eq('institution_id',c.school.id).select('id').single();if(saved.error)throw saved.error;msg.textContent='Reply saved to the student’s account.';}catch(ex){msg.textContent=ex.message;}finally{b.disabled=false;}});
}
function supports(id){return current()&&['teaching','paper-generator','weekly-plan','teacher-classroom','today-note'].includes(id);}
async function open(id){if(id==='today-note')return window.NOOR_CLASSROOM_CONNECT.todayNote(document.getElementById('view-'+id));if(id==='teacher-classroom'){const host=document.getElementById('view-'+id);await window.NOOR_CLASS_PERFORMANCE.mount(host);const register=document.createElement('section');host.append(register);try{await window.NOOR_TEACHER_ATTENDANCE_VIEW.mount(register);await classQuestions(host);}catch(e){const note=document.createElement('p');note.textContent='Student questions could not load: '+e.message;host.append(note);}return;}return learning(id);}
window.NOOR_TEACHER_DATA=Object.freeze({current,context,assignments,load,saveProfile,checkIn,syncHeader,attendance,attendanceTable,attendanceRecords,rosterPhotos,supports,open,offset});
})();
