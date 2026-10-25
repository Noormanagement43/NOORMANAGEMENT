/* NOOR Teacher: beautiful dashboard attendance backed by actual assigned rosters and submitted sessions. */
(()=>{'use strict';
const APP=()=>window.NOOR_AI_APP||{},E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const nat=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
const initials=s=>String(s||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'S';
let model=null,revision=0,working=false,offlineMode=false;
const root=()=>document.getElementById('ntAttendanceEmbed');
const $=q=>root()?.querySelector(q);
const say=(s,bad=false)=>{const el=$('#ntAttStatus');if(el){el.textContent=s;el.style.color=bad?'#b93c4d':'#815a73'}};
function marks(){
 let present=0,absent=0,late=0;
 for(const x of model.students){if(model.selection[x.id]==='present')present++;else if(model.selection[x.id]==='absent')absent++;else if(model.selection[x.id]==='late')late++;}
 return {present,absent,late,unmarked:model.students.length-present-absent-late};
}
function stats(){
 if(!model)return;
 const t=marks();
 const s=$('#ntAttSummary');if(s)s.innerHTML=
 '<span class="nt-att-chip">✓ '+t.present+' Present</span><span class="nt-att-chip absent">✕ '+t.absent+' Absent</span><span class="nt-att-chip late">◷ '+t.late+' Late</span>'+
 (t.unmarked?'<span class="nt-att-chip unmarked">'+t.unmarked+' Unmarked</span>':'');
 const submit=$('#ntAttSave');if(submit)submit.disabled=working||!model.students.length||t.unmarked!==0;
 const footer=$('#ntAttFooter');if(footer)footer.textContent='Total '+model.students.length+' students · '+t.present+' Present · '+t.absent+' Absent · '+t.late+' Late · '+t.unmarked+' Unmarked';
}
function classOptions(){
 const classes=model.classes;
 $('#ntAttClass').innerHTML=classes.map(x=>'<option value="'+E(x.id)+'">'+E(x.name)+'</option>').join('');
 if(!classes.length)$('#ntAttClass').innerHTML='<option value="">No assigned classes</option>';
}
function sectionOptions(){
 const classId=$('#ntAttClass').value,as=model.assignments.filter(x=>x.class_id===classId);
 const all=as.some(x=>!x.section_id),available=model.sections.filter(x=>x.class_id===classId&&(all||as.some(y=>y.section_id===x.id)));
 $('#ntAttSection').innerHTML=(available.length?'<option value="">Choose section</option>':'<option value="">No sections (entire class)</option>')+
 available.map(x=>'<option value="'+E(x.id)+'">'+E(x.name)+'</option>').join('');
 if(available.length)$('#ntAttSection').value=available[0].id;
}
function table(){
 const box=$('#ntAttTable'),students=model.students;
 if(!students.length){box.innerHTML='<p class="nt-empty">No active students found for this class and section.</p>';stats();return}
 const mobile=window.matchMedia?.('(max-width:760px)').matches||document.getElementById('workspace')?.classList.contains('noor-teacher-handset');
 const getStatusStyle=(sel, status)=>{
  const active=sel===status;
  if(status==='present')return active?'background:#16a34a;color:#fff;border-color:#15803d;box-shadow:0 2px 4px rgba(22,163,74,0.3)':'background:#f0fdf4;color:#166534;border-color:#bbf7d0';
  if(status==='absent')return active?'background:#dc2626;color:#fff;border-color:#b91c1c;box-shadow:0 2px 4px rgba(220,38,38,0.3)':'background:#fef2f2;color:#991b1b;border-color:#fecaca';
  if(status==='late')return active?'background:#d97706;color:#fff;border-color:#b45309;box-shadow:0 2px 4px rgba(217,119,6,0.3)':'background:#fffbeb;color:#92400e;border-color:#fde68a';
  return '';
 };
 const renderAvatar=x=>'<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#f3e8ff;border:1px solid #e9d5ff">'+
  (x.avatar_url?'<img src="'+E(x.avatar_url)+'" alt="" style="width:100%;height:100%;object-fit:cover">':'<span style="font-weight:800;font-size:12px;color:#7e22ce">'+E(initials(x.full_name))+'</span>')+
  '</div>';

 if(mobile){
  box.innerHTML='<div class="nt-att-scrollable-wrap" style="max-height:480px;overflow-y:auto;padding-right:4px"><div class="nt-att-mobile-list">'+students.map(x=>
   '<article class="nt-att-mobile-row" data-att-student="'+E(x.id)+'" style="display:flex;flex-direction:column;gap:10px;padding:12px;background:#fff;border:1px solid #f1e4eb;border-radius:14px;margin-bottom:8px">'+
   '<div style="display:flex;align-items:center;gap:10px">'+renderAvatar(x)+
   '<div class="nt-att-mobile-name"><b>'+E(x.full_name)+'</b><small style="display:block;color:#8e7885;font-size:11px">Roll No. '+E(x.roll_number||'Not assigned')+'</small></div></div>'+
   '<div class="nt-att-mobile-options" role="group" aria-label="Mark attendance for '+E(x.full_name)+'" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'+
   ['present','absent','late'].map(status=>'<button type="button" class="nt-radio '+status+'" role="radio" aria-label="'+E(x.full_name)+' '+status+'" aria-checked="'+String(model.selection[x.id]===status)+'" data-student="'+E(x.id)+'" data-choice="'+status+'" style="padding:8px 4px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;'+getStatusStyle(model.selection[x.id],status)+'">'+{present:'✓ Present',absent:'✕ Absent',late:'◷ Late'}[status]+'</button>').join('')+
   '</div></article>').join('')+'</div></div>';
 }else{
  box.innerHTML='<div class="nt-att-scrollable-wrap" style="max-height:480px;overflow-y:auto;border:1px solid #ecdde5;border-radius:14px;background:#fff">'+
  '<table class="nt-att-table" style="width:100%;border-collapse:collapse"><thead style="position:sticky;top:0;background:#fdf8fa;z-index:3;border-bottom:2px solid #ecdde5"><tr><th style="padding:12px 14px">Student & Photo</th><th style="padding:12px 14px">Roll No.</th><th style="text-align:center;padding:12px">Present</th><th style="text-align:center;padding:12px">Absent</th><th style="text-align:center;padding:12px">Late</th></tr></thead><tbody>'+
  students.map(x=>'<tr style="border-bottom:1px solid #f6edf1"><td style="padding:10px 14px"><div style="display:flex;align-items:center;gap:10px">'+renderAvatar(x)+'<div><b style="font-size:13px;color:#3b1e2e">'+E(x.full_name)+'</b></div></div></td>'+
  '<td style="padding:10px 14px"><b style="font-size:12px;color:#784e64">'+E(x.roll_number||'—')+'</b></td>'+
  ['present','absent','late'].map(status=>'<td style="text-align:center;padding:10px"><button type="button" class="nt-radio '+status+'" role="radio" aria-label="'+E(x.full_name)+' '+status+'" aria-checked="'+String(model.selection[x.id]===status)+'" data-student="'+E(x.id)+'" data-choice="'+status+'" style="min-width:76px;padding:6px 10px;font-size:11px;font-weight:700;border-radius:8px;border:1px solid;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;'+getStatusStyle(model.selection[x.id],status)+'">'+{present:'✓ Present',absent:'✕ Absent',late:'◷ Late'}[status]+'</button></td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 }
 stats();
}
async function mount(){
 const a=APP(),box=root();if(!box||a.profile?.role!=='teacher'||a.profile?.status!=='active'||!a.schoolId)return;
 const v=++revision;model={assignments:[],classes:[],sections:[],students:[],selection:{},session:null};
 const teacherName=a.profile?.full_name||'Teacher';
  box.innerHTML='<div class="nt-att-greeting" style="margin-bottom:12px;padding:12px 14px;background:linear-gradient(135deg,#fcf4f7,#f9eaf0);border:1px solid #ebd4de;border-radius:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><h3 style="margin:0;font:800 15px Manrope;color:#5a233c">Hello Class Teacher, '+E(teacherName)+' 👋</h3><small style="color:#815a73">Mark student attendance or switch between Online and Offline storage.</small></div><div style="display:flex;gap:6px;align-items:center"><button type="button" class="nt-btn small" id="ntAttModeToggle" style="font-weight:700">'+(offlineMode?'◷ Mode: Offline (Device queue)':'⚡ Mode: Online (Direct sync)')+'</button><button type="button" class="nt-btn small" id="ntAttAddSectionBtn">+ Add Section</button></div></div>'+
  '<div class="nt-att-head"><div class="nt-att-controls"><label>Date<input id="ntAttDate" type="date" max="'+day()+'" value="'+day()+'"></label><label>Class<select id="ntAttClass"></select></label><label>Section<select id="ntAttSection"></select></label></div><div class="nt-att-summary" id="ntAttSummary"><span class="nt-att-chip unmarked">Loading…</span></div></div>'+
 '<div class="nt-att-scroll" id="ntAttTable"><p class="nt-muted">Loading real class roster…</p></div>'+
 '<div class="nt-att-actions"><div><button class="nt-btn" type="button" id="ntAttMarkAll">✓ Mark all Present</button><span class="nt-muted" style="margin-left:8px">Review before saving.</span></div><button class="nt-btn primary" type="button" id="ntAttSave" disabled>Save Attendance →</button></div>'+
 '<div class="nt-offline-bar"><span>◷ Offline: draft stays on this device until synced.</span><button type="button" class="nt-btn" id="ntAttSync">Sync pending drafts</button></div><p class="nt-muted" id="ntAttOfflineStatus" role="status"></p>'+ '<p class="nt-muted" id="ntAttFooter"></p><p class="nt-muted" role="status" id="ntAttStatus"></p><div id="ntAttRisk"></div>';
 $('#ntAttDate').onchange=loadRoster;$('#ntAttClass').onchange=()=>{sectionOptions();loadRoster()};$('#ntAttSection').onchange=loadRoster;
 $('#ntAttTable').addEventListener('click',ev=>{const b=ev.target.closest('[data-student][data-choice]');if(!b||!model.students.some(x=>x.id===b.dataset.student))return;
 model.selection[b.dataset.student]=b.dataset.choice;
 const row=b.closest('tr')||b.closest('.nt-att-mobile-row');
 if(row){
  row.querySelectorAll('[data-choice]').forEach(x=>{
   const active=x.dataset.choice===b.dataset.choice;
   x.setAttribute('aria-checked',String(active));
   const status=x.dataset.choice;
   if(status==='present'){x.style.background=active?'#16a34a':'#f0fdf4';x.style.color=active?'#fff':'#166534';x.style.borderColor=active?'#15803d':'#bbf7d0';x.style.boxShadow=active?'0 2px 4px rgba(22,163,74,0.3)':'none';}
   else if(status==='absent'){x.style.background=active?'#dc2626':'#fef2f2';x.style.color=active?'#fff':'#991b1b';x.style.borderColor=active?'#b91c1c':'#fecaca';x.style.boxShadow=active?'0 2px 4px rgba(220,38,38,0.3)':'none';}
   else if(status==='late'){x.style.background=active?'#d97706':'#fffbeb';x.style.color=active?'#fff':'#92400e';x.style.borderColor=active?'#b45309':'#fde68a';x.style.boxShadow=active?'0 2px 4px rgba(217,119,6,0.3)':'none';}
  });
 }
 stats();
 });
 $('#ntAttMarkAll').onclick=()=>{for(const x of model.students)model.selection[x.id]='present';table();say('Everyone marked Present. Check before saving.')};
 $('#ntAttSave').onclick=save;$('#ntAttSync').onclick=syncPending;refreshPending();
  $('#ntAttModeToggle').onclick=()=>{
    offlineMode=!offlineMode;
    $('#ntAttModeToggle').textContent=offlineMode?'◷ Mode: Offline (Device queue)':'⚡ Mode: Online (Direct sync)';
    say(offlineMode?'Offline mode active: saves will stay on this device until you sync.':'Online mode active: saves will submit directly to school database.');
  };
  $('#ntAttAddSectionBtn').onclick=openAddSectionModal;
 const db=a.db;
 const assignment=await db.from('teacher_assignments').select('class_id,section_id').eq('school_id',a.schoolId).eq('teacher_id',a.user.id).eq('is_active',true).limit(200);
 if(v!==revision||!root())return;
 if(assignment.error){$('#ntAttTable').textContent=assignment.error.message;return}
 model.assignments=assignment.data||[];
 if(!model.assignments.length){$('#ntAttTable').innerHTML='<p class="nt-empty">No classes assigned yet. Ask your Principal to assign a class and section.</p>';return}
 const ids=[...new Set(model.assignments.map(x=>x.class_id))];
 const [c,s]=await Promise.all([
 db.from('classes').select('id,name').eq('school_id',a.schoolId).eq('is_active',true).in('id',ids).limit(200),
 db.from('sections').select('id,class_id,name').eq('is_active',true).in('class_id',ids).limit(300)
 ]);
 if(v!==revision||!root())return;
 if(c.error||s.error){$('#ntAttTable').textContent=(c.error||s.error).message;return}
 model.classes=(c.data||[]).sort((x,y)=>nat.compare(x.name,y.name));model.sections=s.data||[];
 classOptions();sectionOptions();await loadRoster();
}
async function loadRoster(){
 const a=APP(),m=model,instance=++revision;
 if(!root()||!m)return;
 const classId=$('#ntAttClass').value,sectionId=$('#ntAttSection').value||null,date=$('#ntAttDate').value;
 if(!classId||!date)return;
 const all=m.assignments.some(x=>x.class_id===classId&&!x.section_id);
 if((!all||m.sections.some(x=>x.class_id===classId))&&!sectionId){say('Choose your assigned section.',true);return}
 if(date>day()){say('Attendance cannot be marked for a future date.',true);return}
 $('#ntAttTable').innerHTML='<p class="nt-muted">Reading enrolled student records…</p>';
 let q=a.db.from('profiles').select('id,full_name,roll_number,avatar_path').eq('school_id',a.schoolId).eq('role','student').eq('status','active').eq('class_id',classId).limit(1000);
 q=sectionId?q.eq('section_id',sectionId):q.is('section_id',null);
 let ses=a.db.from('attendance_sessions').select('id,status').eq('school_id',a.schoolId).eq('class_id',classId).eq('attendance_date',date);
 ses=sectionId?ses.eq('section_id',sectionId):ses.is('section_id',null);
 const [users,sessions]=await Promise.all([q,ses.limit(1)]);
 if(instance!==revision||!root())return;
 if(users.error||sessions.error){$('#ntAttTable').textContent=(users.error||sessions.error).message;return}
 const rawStudents=(users.data||[]).sort((x,y)=>nat.compare(x.roll_number||'zzzz',y.roll_number||'zzzz')||nat.compare(x.full_name,y.full_name));
 const studentsWithAvatars=await Promise.all(rawStudents.map(async s=>{
  let avatar_url=null;
  if(s.avatar_path){
   try{
    const {data:signData}=await a.db.storage.from('student-photos').createSignedUrl(s.avatar_path,3600);
    if(signData?.signedUrl)avatar_url=signData.signedUrl;
   }catch(e){}
  }
  return {...s,avatar_url};
 }));
 m.students=studentsWithAvatars;
 m.selection={};m.session=sessions.data?.[0]||null;
 if(m.session){
 const records=await a.db.from('attendance_records').select('student_id,status').eq('school_id',a.schoolId).eq('session_id',m.session.id).limit(1000);
 if(instance!==revision||!root())return;
 if(records.error)say('Could not load existing attendance: '+records.error.message,true);
 else for(const row of records.data||[])m.selection[row.student_id]=row.status;
 }
 table();checkAbsences(instance);
}
async function refreshPending(){
 try{const rows=await window.NOOR_OFFLINE_ATTENDANCE?.all?.()||[];if($('#ntAttOfflineStatus'))$('#ntAttOfflineStatus').textContent=rows.length?rows.length+' draft(s) NOT yet sent to Principal.':'No unsynced attendance drafts.';}
 catch(e){if($('#ntAttOfflineStatus'))$('#ntAttOfflineStatus').textContent='Offline storage unavailable: '+e.message}
}
async function syncPending(){
 const b=$('#ntAttSync');if(!b)return;b.disabled=true;say('Checking login, syncing drafts to school…');
 try{const results=await window.NOOR_OFFLINE_ATTENDANCE.sync(),bad=results.filter(x=>!x.ok);
 say(bad.length?'Synced '+(results.length-bad.length)+'; '+bad.length+' need correction: '+bad[0].error:results.length?'✓ '+results.length+' draft(s) synced to Principal.':'No pending drafts.',!!bad.length);await refreshPending();}
 catch(e){say('Sync failed: '+e.message,true)}finally{b.disabled=false}
}
async function save(){
 if(working||!model?.students.length)return;
 const n=marks();
 if(n.unmarked)return say('Mark Present, Absent or Late for every student first.',true);
 const a=APP(),db=a.db,classId=$('#ntAttClass').value,sectionId=$('#ntAttSection').value||null,attendance_date=$('#ntAttDate').value,m=model;
 working=true;stats();say('Saving attendance securely…');
 try{
 const request={class_id:classId,section_id:sectionId,attendance_date,marks:m.students.map(x=>({student_id:x.id,status:m.selection[x.id]}))};
 if(navigator.onLine===false){await window.NOOR_OFFLINE_ATTENDANCE.queue(request);say('◷ Saved on THIS DEVICE only. NOT sent to Principal. Tap Sync when online.');await refreshPending();return;}
 const result=await db.rpc('noor_submit_class_attendance',{p_school_id:a.schoolId,p_class_id:classId,p_section_id:sectionId,p_attendance_date:attendance_date,p_marks:request.marks});
 if(result.error)throw result.error;
 if(!result.data?.session_id||Number(result.data.count)!==m.students.length)throw Error('The database did not confirm the complete roster.');
 await window.NOOR_OFFLINE_ATTENDANCE?.discard?.(request).catch(()=>{});await refreshPending();
 m.session={id:result.data.session_id,status:result.data.status};say('✓ Saved '+n.present+' Present, '+n.absent+' Absent and '+n.late+' Late to school records.');a.toast?.('Student attendance submitted.','success');
 await checkAbsences(revision);
 }catch(err){
 if(window.NOOR_OFFLINE_ATTENDANCE?.isNetworkFailure?.(err)){
  try{await window.NOOR_OFFLINE_ATTENDANCE.queue({class_id:classId,section_id:sectionId,attendance_date,marks:m.students.map(x=>({student_id:x.id,status:m.selection[x.id]}))});say('Offline draft saved on device only. Principal has NOT received it.');await refreshPending();}
  catch(storageError){say('Not saved to server OR device: '+storageError.message,true)}
 }else say('Attendance NOT submitted: '+(err.message||'Retry after checking permissions.'),true);
}
 finally{working=false;stats()}
}
async function checkAbsences(instance){
 const box=$('#ntAttRisk');if(!box||!model?.students.length)return;
 const a=APP(),classId=$('#ntAttClass').value,sectionId=$('#ntAttSection').value||null;
 let query=a.db.from('attendance_sessions').select('id,attendance_date').eq('school_id',a.schoolId).eq('class_id',classId).in('status',['submitted','corrected']).order('attendance_date',{ascending:false}).limit(8);
 query=sectionId?query.eq('section_id',sectionId):query.is('section_id',null);
 const sessions=await query;if(instance!==revision||!root())return;
 if(sessions.error){box.innerHTML='<div class="nt-followup">Attendance history could not be loaded.</div>';return}
 const latest=sessions.data||[],ids=latest.map(x=>x.id);if(latest.length<3){box.textContent='';return}
 const r=await a.db.from('attendance_records').select('session_id,student_id,status').eq('school_id',a.schoolId).in('session_id',ids).limit(10000);
 if(instance!==revision||!root()||r.error)return;
 const mapping=new Map(latest.map(s=>[s.id,new Map()]));for(const x of r.data||[])mapping.get(x.session_id)?.set(x.student_id,x.status);
 const concern=[];
 for(const st of model.students){let count=0;for(const session of latest){if(mapping.get(session.id)?.get(st.id)==='absent')count++;else break}if(count>=3)concern.push({st,count})}
 box.innerHTML=concern.length?'<div class="nt-followup"><b>⚠ Attendance follow-up</b><div>'+concern.map(x=>E(x.st.full_name)+' (Roll '+E(x.st.roll_number||'—')+') · '+x.count+' consecutive absences').join('<br>')+'</div></div>':'';
}

async function openAddSectionModal(){
  const a=APP(), currentClassId=$('#ntAttClass')?.value;
  if(!currentClassId) return say('Select a class first before creating a section.', true);
  const currentClassName = model?.classes?.find(c=>c.id===currentClassId)?.name || 'selected class';
  const name=prompt('Enter new Section name for ' + currentClassName + ' (e.g. "Section A" or "Section B"):');
  if(!name||!name.trim()) return;
  say('Creating section "'+name.trim()+'"…');
  try{
    const res=await a.db.from('sections').insert({
      school_id:a.schoolId,
      class_id:currentClassId,
      name:name.trim(),
      is_active:true
    }).select('id,class_id,name').single();
    if(res.error) throw res.error;
    if(!model.sections) model.sections=[];
    model.sections.push(res.data);
    sectionOptions();
    if($('#ntAttSection')) $('#ntAttSection').value=res.data.id;
    say('✓ Section "'+res.data.name+'" created successfully.');
    a.toast?.('Section added.','success');
    await loadRoster();
  }catch(e){
    say('Could not create section: '+(e.message||e), true);
  }
}

window.NOOR_TEACHER_EMBED={mount};
})();