/* NOOR Teacher Attendance — assigned-class roster, roll numbers and 3-state marking. */
(()=>{'use strict';
const api=()=>window.NOOR_AI_APP,view=()=>document.getElementById('view-attendance');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateNow=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const natural=new Intl.Collator('en',{numeric:true});
const st={assignments:[],classes:[],sections:[],students:[],marks:{},session:null,version:0,busy:false};
const css=document.createElement('style');css.textContent=[
'#view-attendance .ta-page{max-width:1300px;margin:auto;color:#352e56}',
'#view-attendance .ta-panel{background:#fff;border:1px solid #e9e4f5;border-radius:22px;padding:20px;margin-bottom:15px;box-shadow:0 10px 28px #5a489e10}',
'#view-attendance .ta-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}',
'#view-attendance .ta-header h1{margin:4px 0;color:#342b68;font-size:clamp(23px,3vw,31px)}',
'#view-attendance .ta-muted{font-size:12px;color:#766e88}',
'#view-attendance .ta-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
'#view-attendance .ta-fields label{font-size:12px;font-weight:700;color:#635988;display:grid;gap:6px}',
'#view-attendance select,#view-attendance input{width:100%;min-width:0;border-radius:11px;border:1px solid #dcd6ed;padding:10px;color:#3d315e;background:#fcfbff}',
'#view-attendance .ta-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}',
'#view-attendance .ta-stat{padding:12px 14px;border-radius:16px;background:#eeeafb;color:#584b97;font-size:12px}',
'#view-attendance .ta-stat b{display:block;font-size:27px;line-height:1.3}',
'#view-attendance .ta-stat.present{background:#e2f7eb;color:#237449}',
'#view-attendance .ta-stat.absent{background:#fce8eb;color:#b13d52}',
'#view-attendance .ta-stat.late{background:#fff1da;color:#a06b1f}',
'#view-attendance .ta-row{display:flex;gap:11px;align-items:center;border:1px solid #eee9f7;border-radius:15px;padding:12px;margin:9px 0}',
'#view-attendance .ta-avatar{background:#eae5fa;color:#6253a3;border-radius:13px;width:40px;height:40px;display:grid;place-items:center;font-weight:800;flex:none}',
'#view-attendance .ta-name{flex:1;min-width:0}',
'#view-attendance .ta-name b{display:block;overflow-wrap:anywhere}',
'#view-attendance .ta-name small{display:block;color:#746b89}',
'#view-attendance .ta-buttons{display:flex;gap:6px}',
'#view-attendance button{cursor:pointer;font:inherit}',
'#view-attendance .ta-buttons button{border:1px solid #e1ddee;background:#f9f8fc;padding:9px 12px;border-radius:11px;color:#685a91;font-size:11px;font-weight:800}',
'#view-attendance .ta-buttons [data-status=present][aria-pressed=true]{background:#daf3e5;color:#176c42;border-color:#72bc94}',
'#view-attendance .ta-buttons [data-status=absent][aria-pressed=true]{background:#ffdee3;color:#a72d48;border-color:#e79aab}',
'#view-attendance .ta-buttons [data-status=late][aria-pressed=true]{background:#ffedcb;color:#88590f;border-color:#d9ae63}',
'#view-attendance .ta-primary{background:#6252a3;border:0;color:#fff;border-radius:12px;padding:12px 16px;font-weight:800}',
'#view-attendance .ta-soft{background:#ece8f9;border:1px solid #ddd6f0;color:#5d4e9e;border-radius:12px;padding:10px 13px;font-weight:800}',
'#view-attendance button:disabled{opacity:.5;cursor:not-allowed}',
'#view-attendance .ta-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between}',
'#view-attendance .ta-alert{background:#fff3e7;border:1px solid #f2d5a6;border-radius:13px;padding:10px 13px;color:#875921;margin-top:8px}',
'#view-attendance .ta-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
'#view-attendance .ta-error{color:#ae3746}',
'@media(max-width:740px){#view-attendance .ta-fields{grid-template-columns:1fr 1fr}#view-attendance .ta-row{align-items:flex-start;flex-wrap:wrap}#view-attendance .ta-buttons{width:100%}#view-attendance .ta-buttons button{flex:1}}',
'@media(max-width:480px){#view-attendance .ta-fields{grid-template-columns:1fr}#view-attendance .ta-summary{grid-template-columns:1fr 1fr}#view-attendance .ta-header{align-items:flex-start}#view-attendance .ta-panel{padding:14px}}'
].join('');document.head.append(css);
const $=s=>view()?.querySelector(s);
const say=(s,bad=false)=>{const n=$('#taMessage');if(n){n.textContent=s;n.classList.toggle('ta-error',bad)}};
function assignedSections(klass){const a=st.assignments.filter(x=>x.class_id===klass);return a.some(x=>!x.section_id)?st.sections.filter(x=>x.class_id===klass):st.sections.filter(x=>x.class_id===klass&&a.some(t=>t.section_id===x.id));}
function chooseSections(){const c=$('#taClass')?.value;const all=st.assignments.some(x=>x.class_id===c&&!x.section_id);$('#taSection').innerHTML=(assignedSections(c).length?'<option value="">Choose section</option>':'<option value="">No sections (entire class)</option>')+assignedSections(c).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');if(assignedSections(c).length)$('#taSection').value=assignedSections(c)[0].id;}
function tally(){let p=0,a=0,l=0;st.students.forEach(x=>{if(st.marks[x.id]==='present')p++;if(st.marks[x.id]==='absent')a++;if(st.marks[x.id]==='late')l++;});return {p,a,l,missing:st.students.length-p-a-l};}
function refreshTotals(){const t=tally();[['pending',t.missing],['present',t.p],['absent',t.a],['late',t.l]].forEach(([k,n])=>{const el=$('[data-total="'+k+'"]');if(el)el.textContent=n});const bottom=$('#taBottomTotals');if(bottom)bottom.textContent='Total '+st.students.length+'  •  Present '+t.p+'  •  Absent '+t.a+'  •  Late '+t.l+'  •  Unmarked '+t.missing;const b=$('#taSave');if(b)b.disabled=st.busy||!st.students.length||t.missing!==0;}
function showStudents(){const search=$('#taSearch')?.value?.toLowerCase().trim()||'';$('#taRows').innerHTML=st.students.filter(x=>!search||x.full_name?.toLowerCase().includes(search)||String(x.roll_number||'').toLowerCase().includes(search)).map(x=>'<div class="ta-row" data-row="'+esc(x.id)+'"><span class="ta-avatar">'+esc((x.full_name||'S')[0])+'</span><div class="ta-name"><b>'+esc(x.full_name)+'</b><small>Roll number '+esc(x.roll_number||'Not assigned')+'</small></div><div class="ta-buttons" role="group" aria-label="Attendance of '+esc(x.full_name)+'">'+['present','absent','late'].map((a,i)=>'<button type="button" data-id="'+esc(x.id)+'" data-status="'+a+'" aria-pressed="'+(st.marks[x.id]===a)+'">'+['✓ Present','✕ Absent','◷ Late'][i]+'</button>').join('')+'</div></div>').join('')||'<p class="ta-muted">No matching students.</p>';}
function selectMark(id,mark){st.marks[id]=mark;const row=$('[data-row="'+id+'"]');row?.querySelectorAll('button[data-status]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.status===mark)));refreshTotals();}
async function open(){
 const a=api(),root=view();if(!a?.user||a.profile?.role!=='teacher'||a.profile?.status!=='active'||!a.schoolId||!root)return;
 st.assignments=[];st.students=[];st.marks={};st.session=null;++st.version;
 root.innerHTML='<div class="ta-page"><div class="ta-header"><div><small class="ta-muted">NOOR • SCHOOL ATTENDANCE</small><h1>Student attendance</h1><p class="ta-muted">Student names, roll numbers and one clear status per student.</p></div><button type="button" class="ta-soft" id="taBack">← Back</button></div>'+
 '<div class="ta-panel"><div class="ta-fields"><label>Assigned class<select id="taClass"></select></label><label>Section<select id="taSection"></select></label><label>Date<input id="taDate" type="date" max="'+dateNow()+'" value="'+dateNow()+'"></label></div></div>'+
 '<div class="ta-panel"><div class="ta-summary"><div class="ta-stat"><b data-total="pending">0</b>Not marked</div><div class="ta-stat present"><b data-total="present">0</b>Present</div><div class="ta-stat absent"><b data-total="absent">0</b>Absent</div><div class="ta-stat late"><b data-total="late">0</b>Late</div></div></div>'+
 '<div class="ta-panel"><div class="ta-tools"><div><h3 style="margin:0">Class roster</h3><span class="ta-muted" id="taDayInfo">Loading students…</span></div><div class="ta-tools"><input style="max-width:170px" id="taSearch" type="search" placeholder="Find name or roll"><button class="ta-soft" id="taAllPresent" type="button">✓ All present</button></div></div><div id="taRows" aria-live="polite"></div><p id="taBottomTotals" class="ta-muted" aria-live="polite"></p><div class="ta-foot"><div><p id="taMessage" role="status"></p><small class="ta-muted">Mark every student before saving to the school database.</small></div><button id="taSave" class="ta-primary" disabled>Save attendance →</button></div></div>'+
 '<div class="ta-panel ta-offline-panel"><div class="ta-tools"><div><h3>Online / Offline Attendance</h3><p class="ta-muted">Offline drafts are saved on this device only. Principal sees them AFTER manual sync.</p><p id="taOfflineCount" role="status"></p></div><button type="button" class="ta-soft" id="taSyncDrafts">Sync drafts to Principal</button></div></div>'+ '<div class="ta-panel"><h3>Repeated-absence alerts</h3><p class="ta-muted">Students with 3+ consecutive absences across submitted school sessions (not calendar days).</p><div id="taAlerts">Checking attendance history…</div></div></div>';
 $('#taBack').onclick=()=>a.openView('overview');$('#taClass').onchange=()=>{chooseSections();load()};$('#taSection').onchange=load;$('#taDate').onchange=load;
 $('#taRows').onclick=e=>{const b=e.target.closest('[data-id][data-status]');if(b)selectMark(b.dataset.id,b.dataset.status);};
 $('#taAllPresent').onclick=()=>{st.students.forEach(x=>{st.marks[x.id]='present'});showStudents();refreshTotals();say('All marked Present. Please review before submission.');};
 $('#taSearch').oninput=showStudents;$('#taSave').onclick=save;$('#taSyncDrafts').onclick=syncDrafts;refreshDrafts();
 const db=a.db,assigned=await db.from('teacher_assignments').select('class_id,section_id').eq('school_id',a.schoolId).eq('teacher_id',a.user.id).eq('is_active',true);
 if(assigned.error){say('Could not load your assigned classes: '+assigned.error.message,true);return;}
 st.assignments=assigned.data||[];
 if(!st.assignments.length){$('#taRows').textContent='No assigned classes yet. Ask the Principal to assign a class/section.';$('#taDayInfo').textContent='No assigned classes';return;}
 const ids=[...new Set(st.assignments.map(x=>x.class_id))];
 const [classes,sections]=await Promise.all([
 db.from('classes').select('id,name').eq('school_id',a.schoolId).eq('is_active',true).in('id',ids),
 db.from('sections').select('id,class_id,name').eq('is_active',true).in('class_id',ids)
 ]);
 if(classes.error||sections.error){say('Could not load school classes: '+(classes.error||sections.error).message,true);return;}
 st.classes=(classes.data||[]).sort((a,b)=>natural.compare(a.name,b.name));st.sections=sections.data||[];
 $('#taClass').innerHTML=st.classes.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
 if(!st.classes.length){say('No active class assigned. Ask your Principal.',true);return;}
 chooseSections();await load();
}
async function load(){
 const a=api(),db=a.db,version=++st.version,school=a.schoolId,c=$('#taClass')?.value,section=$('#taSection')?.value||null,date=$('#taDate')?.value;
 if(!c||!date)return;
 if(!section&&(st.sections.some(x=>x.class_id===c)||!st.assignments.some(x=>x.class_id===c&&!x.section_id)))return say('Choose your assigned section first.',true);
 if(date>dateNow())return say('Cannot mark future attendance.',true);
 $('#taRows').textContent='Loading enrolled students…';say('');
 let sesQuery=db.from('attendance_sessions').select('id,status').eq('school_id',school).eq('class_id',c).eq('attendance_date',date);
 sesQuery=section?sesQuery.eq('section_id',section):sesQuery.is('section_id',null);
 let studentQuery=db.from('profiles').select('id,full_name,roll_number').eq('school_id',school).eq('class_id',c).eq('role','student').eq('status','active').limit(1000);
 studentQuery=section?studentQuery.eq('section_id',section):studentQuery.is('section_id',null);
 const [rs,ss]=await Promise.all([studentQuery,sesQuery.limit(1)]);
 if(version!==st.version)return;
 if(rs.error||ss.error){$('#taRows').textContent='Unable to load roster.';say((rs.error||ss.error).message,true);return;}
 st.students=(rs.data||[]).sort((a,b)=>natural.compare(a.roll_number||'zzzz',b.roll_number||'zzzz')||natural.compare(a.full_name,b.full_name));
 st.marks={};st.session=ss.data?.[0]||null;
 if(st.session){
   const prior=await db.from('attendance_records').select('student_id,status').eq('school_id',school).eq('session_id',st.session.id).limit(1000);
   if(version!==st.version)return;
   if(prior.error){say(prior.error.message,true)}else for(const r of prior.data||[])st.marks[r.student_id]=r.status;
 }
 $('#taDayInfo').textContent=st.students.length+' students • '+date+' • '+(st.session?.status||'not submitted');
 showStudents();refreshTotals();await alerts(version);
}
async function refreshDrafts(){
 try{const drafts=await window.NOOR_OFFLINE_ATTENDANCE?.all?.()||[];const node=$('#taOfflineCount');if(node)node.textContent=drafts.length?drafts.length+' draft(s) pending ONLY on this device.':'No pending offline attendance drafts.';}
 catch(e){if($('#taOfflineCount'))$('#taOfflineCount').textContent='Offline storage unavailable: '+e.message}
}
async function syncDrafts(){
 const btn=$('#taSyncDrafts');btn.disabled=true;say('Checking your authenticated session and syncing…');
 try{const results=await window.NOOR_OFFLINE_ATTENDANCE.sync(),fail=results.filter(x=>!x.ok);say(fail.length?'Synced '+(results.length-fail.length)+'; '+fail.length+' need correction: '+fail[0].error:results.length?'✓ All '+results.length+' offline class drafts submitted to Principal.':'No drafts pending.',Boolean(fail.length));await refreshDrafts();}
 catch(err){say('Offline sync failed: '+err.message,true)}finally{btn.disabled=false}
}
async function save(){
 if(st.busy)return;
 const current=api(),t=tally(),class_id=$('#taClass').value,section_id=$('#taSection').value||null,attendance_date=$('#taDate').value;
 if(!st.students.length||t.missing)return say('Mark Present / Absent / Late for every student.',true);
 st.busy=true;refreshTotals();say('Saving '+st.students.length+' attendance marks as one transaction…');
 try{
  const marks=st.students.map(student=>({student_id:student.id,status:st.marks[student.id]}));
  const draft={class_id,section_id,attendance_date,marks};
  if(navigator.onLine===false){await window.NOOR_OFFLINE_ATTENDANCE.queue(draft);say('◷ Saved on this device only. Principal has NOT received attendance. Sync once online.');await refreshDrafts();return;}
  const result=await current.db.rpc('noor_submit_class_attendance',{
   p_school_id:current.schoolId,p_class_id:class_id,p_section_id:section_id,
   p_attendance_date:attendance_date,p_marks:marks
  });
  if(result.error)throw result.error;
  if(!result.data?.session_id||Number(result.data.count)!==st.students.length)throw new Error('Server did not confirm the entire class was saved.');
  await window.NOOR_OFFLINE_ATTENDANCE?.discard?.(draft).catch(()=>{});await refreshDrafts();
  st.session={id:result.data.session_id,status:result.data.status};
  $('#taDayInfo').textContent=st.students.length+' students • '+attendance_date+' • '+result.data.status;
  say('✓ All '+result.data.count+' marks saved together: '+t.p+' Present · '+t.a+' Absent · '+t.l+' Late');
  current.toast?.('Complete attendance saved securely.','success');
  try{await alerts(st.version)}catch(err){console.warn('Attendance saved, but alerts could not refresh',err)}
 }catch(err){
  if(window.NOOR_OFFLINE_ATTENDANCE?.isNetworkFailure?.(err)){
   try{await window.NOOR_OFFLINE_ATTENDANCE.queue({class_id,section_id,attendance_date,marks:st.students.map(x=>({student_id:x.id,status:st.marks[x.id]}))});say('◷ Offline draft saved on this device ONLY. It has NOT reached Principal. Sync later.');await refreshDrafts();}
   catch(storageError){say('Not saved to server or device: '+storageError.message,true)}
  }else say('Attendance NOT submitted: '+(err?.message||'Please verify your class permissions.')+' Retry.',true);
 }finally{st.busy=false;refreshTotals()}
}
async function alerts(version){
 const a=api(),c=$('#taClass')?.value,section=$('#taSection')?.value||null;
 if(!c)return;
 let q=a.db.from('attendance_sessions').select('id,attendance_date').eq('school_id',a.schoolId).eq('class_id',c).in('status',['submitted','corrected']).order('attendance_date',{ascending:false}).limit(10);
 q=section?q.eq('section_id',section):q.is('section_id',null);
 const sessions=await q;if(version!==st.version)return;
 if(sessions.error){$('#taAlerts').textContent='History unavailable: '+sessions.error.message;return}
 const days=sessions.data||[];
 if(!days.length){$('#taAlerts').textContent='No submitted attendance history yet.';return}
 const data=[];const keys=days.map(x=>x.id);
 for(let page=0;page<12;page++){
  const r=await a.db.from('attendance_records').select('id,session_id,student_id,status').eq('school_id',a.schoolId).in('session_id',keys).order('id').range(page*1000,page*1000+999);
  if(version!==st.version)return;
  if(r.error){$('#taAlerts').textContent='History error: '+r.error.message;return}
  data.push(...(r.data||[]));if((r.data||[]).length<1000)break;
 }
 const byDay=new Map(days.map(x=>[x.id,new Map()]));
 data.forEach(x=>byDay.get(x.session_id)?.set(x.student_id,x.status));
 const risk=[];
 for(const student of st.students){let count=0;for(const d of days){if(byDay.get(d.id)?.get(student.id)==='absent')count++;else break;}if(count>=3)risk.push({student,count})}
 risk.sort((a,b)=>b.count-a.count);
 $('#taAlerts').innerHTML=risk.length?risk.map(({student,count})=>'<div class="ta-alert">⚠ <strong>'+esc(student.full_name)+'</strong> · Roll '+esc(student.roll_number||'—')+' · <b>'+count+' consecutive recorded absences</b></div>').join(''):'<p class="ta-muted">No student has 3+ consecutive absences in the latest submitted sessions.</p>';
}
window.NOOR_TEACHER_ATTENDANCE={open};
})();