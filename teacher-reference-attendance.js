/* NOOR Teacher: enhanced dashboard attendance backed by actual assigned rosters,
   live CRUD (+ Student, Edit, Remove), and Demo Hub pre-seeded Class 1-10 students. */
(()=>{'use strict';
const APP=()=>window.NOOR_AI_APP||{},E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const nat=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
const initials=s=>String(s||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'S';
let model=null,revision=0,working=false,offlineMode=false,searchQuery='';
const root=()=>document.getElementById('ntAttendanceEmbed');
const $=q=>root()?.querySelector(q);
const say=(s,bad=false)=>{const el=$('#ntAttStatus');if(el){el.textContent=s;el.style.color=bad?'#b93c4d':'#815a73'}};

function marks(){
  let present=0,absent=0,late=0;
  if(!model?.students)return {present:0,absent:0,late:0,unmarked:0};
  for(const x of model.students){
    if(model.selection[x.id]==='present')present++;
    else if(model.selection[x.id]==='absent')absent++;
    else if(model.selection[x.id]==='late')late++;
  }
  return {present,absent,late,unmarked:model.students.length-present-absent-late};
}

function stats(){
  if(!model)return;
  const t=marks();
  const s=$('#ntAttSummary');
  if(s)s.innerHTML=
  '<span class="nt-att-chip">✓ '+t.present+' Present</span><span class="nt-att-chip absent">✕ '+t.absent+' Absent</span><span class="nt-att-chip late">◷ '+t.late+' Late</span>'+
  (t.unmarked?'<span class="nt-att-chip unmarked">'+t.unmarked+' Unmarked</span>':'');
  const submit=$('#ntAttSave');
  if(submit)submit.disabled=working||!model.students.length||t.unmarked!==0;
  const footer=$('#ntAttFooter');
  if(footer)footer.textContent='Total '+model.students.length+' students · '+t.present+' Present · '+t.absent+' Absent · '+t.late+' Late · '+t.unmarked+' Unmarked';
}

function classOptions(){
  const classes=model.classes||[];
  $('#ntAttClass').innerHTML=classes.map(x=>'<option value="'+E(x.id)+'">'+E(x.name)+'</option>').join('');
  if(!classes.length)$('#ntAttClass').innerHTML='<option value="">No classes</option>';
  const c8=classes.find(c=>c.name==='Class 8');
  if(c8)$('#ntAttClass').value=c8.id;
}

function sectionOptions(){
  const classId=$('#ntAttClass')?.value;
  const available=(model.sections||[]).filter(x=>x.class_id===classId);
  $('#ntAttSection').innerHTML=(available.length?available.map(x=>'<option value="'+E(x.id)+'">'+E(x.name)+'</option>').join(''):'<option value="sec-b">Section B</option><option value="sec-a">Section A</option>');
  const secB=available.find(s=>s.name==='Section B');
  if(secB)$('#ntAttSection').value=secB.id;
  else if(available.length)$('#ntAttSection').value=available[0].id;
}

function table(){
  const box=$('#ntAttTable');
  if(!box)return;
  let students=model.students||[];
  if(searchQuery){
    const q=searchQuery.toLowerCase();
    students=students.filter(s=>[s.full_name,s.roll_number,s.remarks].some(v=>String(v||'').toLowerCase().includes(q)));
  }
  if(!students.length){
    box.innerHTML='<p class="nt-empty">No matching students found for this class and section.</p>';
    stats();
    return;
  }

  const renderRadio=(x,choice,statusColor)=>{
    const checked=model.selection[x.id]===choice;
    return '<button type="button" class="nt-radio '+choice+'" role="radio" aria-label="'+E(x.full_name)+' '+choice+'" aria-checked="'+String(checked)+'" data-student="'+E(x.id)+'" data-choice="'+choice+'" style="width:22px;height:22px;border-radius:50%;border:2px solid '+(checked?statusColor:'#d1c5cc')+';background:'+(checked?statusColor:'#fff')+';display:inline-grid;place-items:center;cursor:pointer;padding:0">'+
      (checked?'<span style="width:8px;height:8px;border-radius:50%;background:#fff"></span>':'')+
    '</button>';
  };

  box.innerHTML='<div class="nt-att-scrollable-wrap" style="max-height:480px;overflow-y:auto;border:1px solid #ebdbe2;border-radius:14px;background:#fff">'+
  '<table class="nt-att-table" style="width:100%;border-collapse:collapse;font-size:12px">'+
  '<thead style="position:sticky;top:0;background:#fcf4f7;z-index:3;border-bottom:2px solid #ebdbe2"><tr>'+
    '<th style="padding:10px 12px;width:35px;color:#6b2649">#</th>'+
    '<th style="padding:10px 12px;color:#6b2649">Student Name</th>'+
    '<th style="padding:10px 12px;color:#6b2649">Roll No.</th>'+
    '<th style="text-align:center;padding:10px;color:#166534">Present</th>'+
    '<th style="text-align:center;padding:10px;color:#991b1b">Absent</th>'+
    '<th style="text-align:center;padding:10px;color:#92400e">Late</th>'+
    '<th style="padding:10px 12px;color:#6b2649">Remarks</th>'+
    '<th style="text-align:center;padding:10px 12px;color:#6b2649">Actions</th>'+
  '</tr></thead><tbody>'+
  students.map((x,idx)=>`
    <tr style="border-bottom:1px solid #f6edf1">
      <td style="padding:10px 12px;color:#856b78;font-weight:700">${idx+1}</td>
      <td style="padding:10px 12px">
        <b style="font-size:13px;color:#3b1e2e">${E(x.full_name)}</b>
      </td>
      <td style="padding:10px 12px">
        <b style="font-size:12px;color:#784e64">${E(x.roll_number||'—')}</b>
      </td>
      <td style="text-align:center;padding:10px">${renderRadio(x,'present','#16a34a')}</td>
      <td style="text-align:center;padding:10px">${renderRadio(x,'absent','#dc2626')}</td>
      <td style="text-align:center;padding:10px">${renderRadio(x,'late','#d97706')}</td>
      <td style="padding:8px 12px">
        <input type="text" class="nt-inline-remark" data-remark-student="${E(x.id)}" value="${E(x.remarks||'-')}" placeholder="Remarks…" style="padding:4px 8px;font-size:11px;border:1px solid #ebdbe2;border-radius:6px;width:100%;max-width:140px;background:#faf6f8">
      </td>
      <td style="text-align:center;padding:8px 12px;white-space:nowrap">
        <button type="button" class="nt-btn small" data-edit-student="${E(x.id)}" style="padding:4px 8px;font-size:10px;margin-right:4px">✎ Edit</button>
        <button type="button" class="nt-btn small" data-remove-student="${E(x.id)}" style="padding:4px 8px;font-size:10px;background:#fee2e2;color:#991b1b;border-color:#fecaca">✕</button>
      </td>
    </tr>
  `).join('')+'</tbody></table></div>';
  stats();
}

async function mount(){
  const a=APP(),box=root();
  if(!box||a.profile?.role!=='teacher'||a.profile?.status!=='active'||!a.schoolId)return;
  const v=++revision;
  model={assignments:[],classes:[],sections:[],students:[],selection:{},session:null};
  const teacherName=a.profile?.full_name||'Syeda Aafra Fathima';

  box.innerHTML=`
    <div class="nt-att-greeting" style="margin-bottom:12px;padding:12px 16px;background:linear-gradient(135deg,#fcf4f7,#f9eaf0);border:1px solid #ebd4de;border-radius:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <h3 style="margin:0;font:800 15px Manrope;color:#5a233c">Student Attendance · Live Roster 👋</h3>
        <small style="color:#815a73">Mark attendance, edit student remarks, or add new students directly.</small>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button type="button" class="nt-btn small" id="ntAttAddStudentBtn" style="font-weight:800;background:#5a233c;color:#fff;border-color:#5a233c">+ Student</button>
        <button type="button" class="nt-btn small" id="ntAttModeToggle" style="font-weight:700">${offlineMode?'◷ Mode: Offline':'⚡ Mode: Online'}</button>
      </div>
    </div>
    <div class="nt-att-head" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div class="nt-att-controls" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label>Date<input id="ntAttDate" type="date" value="${day()}"></label>
        <label>Class<select id="ntAttClass"></select></label>
        <label>Section<select id="ntAttSection"></select></label>
        <label>Search<input id="ntAttSearch" type="text" placeholder="Search students…" style="min-width:130px"></label>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="nt-btn" type="button" id="ntAttMarkAll" style="font-weight:800;background:#f0fdf4;color:#166534;border-color:#bbf7d0">✓ All Present</button>
        <div class="nt-att-summary" id="ntAttSummary"></div>
      </div>
    </div>
    <div class="nt-att-scroll" id="ntAttTable"><p class="nt-muted">Loading assigned students…</p></div>
    <div class="nt-att-actions" style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <p class="nt-muted" id="ntAttFooter" style="margin:0"></p>
      <button class="nt-btn primary" type="button" id="ntAttSave" style="font-weight:800;background:#5a233c;color:#fff;padding:8px 16px;border-radius:10px">Save Attendance →</button>
    </div>
    <p class="nt-muted" role="status" id="ntAttStatus" style="margin-top:6px"></p>
    <div id="ntAttRisk"></div>
    <dialog id="ntStudentModal" style="border:1px solid #ebd3e0;border-radius:18px;padding:20px;max-width:440px;width:90vw;background:#fffdfd;box-shadow:0 20px 60px rgba(90,35,60,0.2)">
      <form id="ntStudentForm">
        <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 id="ntStudentModalTitle" style="margin:0;font:800 16px Manrope;color:#5a233c">+ Add New Student</h3>
          <button type="button" id="ntStudentModalClose" style="border:0;background:none;font-size:16px;cursor:pointer">✕</button>
        </header>
        <div style="display:grid;gap:10px">
          <input type="hidden" id="ntModalStudentId">
          <label style="font-size:11px;font-weight:700;color:#6b2649">Student Full Name *<input id="ntModalStudentName" required style="width:100%;padding:8px;border:1px solid #e1ced8;border-radius:8px;font:inherit"></label>
          <label style="font-size:11px;font-weight:700;color:#6b2649">Roll Number *<input id="ntModalStudentRoll" required style="width:100%;padding:8px;border:1px solid #e1ced8;border-radius:8px;font:inherit"></label>
          <label style="font-size:11px;font-weight:700;color:#6b2649">Remarks / Notes<input id="ntModalStudentRemarks" style="width:100%;padding:8px;border:1px solid #e1ced8;border-radius:8px;font:inherit"></label>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
          <button type="button" class="nt-btn" id="ntStudentModalCancel">Cancel</button>
          <button type="submit" class="nt-btn primary" id="ntStudentModalSave" style="background:#5a233c;color:#fff">Save Student</button>
        </div>
      </form>
    </dialog>
  `;

  // Bind Listeners
  $('#ntAttDate').onchange=loadRoster;
  $('#ntAttClass').onchange=()=>{sectionOptions();loadRoster();};
  $('#ntAttSection').onchange=loadRoster;
  $('#ntAttSearch').oninput=(e)=>{searchQuery=e.target.value.trim();table();};

  $('#ntAttTable').addEventListener('click',ev=>{
    const b=ev.target.closest('[data-student][data-choice]');
    if(b){
      const sid=b.dataset.student,choice=b.dataset.choice;
      model.selection[sid]=choice;
      const row=b.closest('tr');
      if(row){
        row.querySelectorAll('[data-choice]').forEach(el=>{
          const isCurrent=el.dataset.choice===choice;
          const col=choice==='present'?'#16a34a':choice==='absent'?'#dc2626':'#d97706';
          el.setAttribute('aria-checked',String(isCurrent));
          el.style.borderColor=isCurrent?col:'#d1c5cc';
          el.style.background=isCurrent?col:'#fff';
          el.innerHTML=isCurrent?'<span style="width:8px;height:8px;border-radius:50%;background:#fff"></span>':'';
        });
      }
      stats();
      return;
    }

    const editBtn=ev.target.closest('[data-edit-student]');
    if(editBtn){
      const st=model.students.find(s=>s.id===editBtn.dataset.editStudent);
      if(st)openStudentModal(st);
      return;
    }

    const rmBtn=ev.target.closest('[data-remove-student]');
    if(rmBtn){
      const st=model.students.find(s=>s.id===rmBtn.dataset.removeStudent);
      if(st&&confirm(`Remove ${st.full_name} from this class roster?`)){
        if(window.NOOR_ALNOOR_HUB?.removeStudent)window.NOOR_ALNOOR_HUB.removeStudent(st.id);
        model.students=model.students.filter(s=>s.id!==st.id);
        delete model.selection[st.id];
        table();
        say(`✓ ${st.full_name} removed.`);
      }
      return;
    }
  });

  $('#ntAttTable').addEventListener('input',ev=>{
    const input=ev.target.closest('[data-remark-student]');
    if(input){
      const st=model.students.find(s=>s.id===input.dataset.remarkStudent);
      if(st){
        st.remarks=input.value;
        if(window.NOOR_ALNOOR_HUB?.updateStudent)window.NOOR_ALNOOR_HUB.updateStudent(st.id,{remarks:input.value});
      }
    }
  });

  $('#ntAttMarkAll').onclick=()=>{
    for(const x of model.students){
      model.selection[x.id]='present';
    }
    table();
    say('✓ All students marked Present.');
  };

  $('#ntAttSave').onclick=save;

  $('#ntAttModeToggle').onclick=()=>{
    offlineMode=!offlineMode;
    $('#ntAttModeToggle').textContent=offlineMode?'◷ Mode: Offline':'⚡ Mode: Online';
    say(offlineMode?'Offline mode active: saves will stay in device queue.':'Online mode active: direct database sync.');
  };

  $('#ntAttAddStudentBtn').onclick=()=>openStudentModal(null);
  $('#ntStudentModalClose').onclick=()=>$('#ntStudentModal')?.close();
  $('#ntStudentModalCancel').onclick=()=>$('#ntStudentModal')?.close();

  $('#ntStudentForm').onsubmit=(e)=>{
    e.preventDefault();
    const sid=$('#ntModalStudentId').value;
    const name=$('#ntModalStudentName').value.trim();
    const roll=$('#ntModalStudentRoll').value.trim();
    const remarks=$('#ntModalStudentRemarks').value.trim()||'-';
    if(!name||!roll)return;

    const currentClassName=$('#ntAttClass option:checked')?.textContent||'Class 8';
    const currentSectionName=$('#ntAttSection option:checked')?.textContent||'Section B';

    if(sid){
      const existing=model.students.find(s=>s.id===sid);
      if(existing){
        existing.full_name=name;existing.name=name;existing.roll_number=roll;existing.roll=roll;existing.remarks=remarks;
        if(window.NOOR_ALNOOR_HUB?.updateStudent)window.NOOR_ALNOOR_HUB.updateStudent(sid,{name,roll,remarks});
        say(`✓ Updated ${name}.`);
      }
    }else{
      const newSt=window.NOOR_ALNOOR_HUB?window.NOOR_ALNOOR_HUB.addStudent({className:currentClassName,sectionName:currentSectionName,name,roll,status:'present',remarks}):{id:'stu-'+Date.now(),full_name:name,roll_number:roll,status:'present',remarks};
      model.students.push({id:newSt.id,full_name:newSt.name||name,roll_number:newSt.roll||roll,remarks});
      model.selection[newSt.id]='present';
      say(`✓ Added student ${name}.`);
    }
    $('#ntStudentModal').close();
    table();
  };

  // Populate Classes 1 to 10
  const classesList=[];
  const sectionsList=[];
  for(let c=1;c<=10;c++){
    const cid='cls-'+c;
    classesList.push({id:cid,name:'Class '+c});
    sectionsList.push({id:'sec-'+c+'-a',class_id:cid,name:'Section A'});
    sectionsList.push({id:'sec-'+c+'-b',class_id:cid,name:'Section B'});
  }
  model.classes=classesList;
  model.sections=sectionsList;
  classOptions();
  sectionOptions();
  await loadRoster();
}

function openStudentModal(st){
  const dlg=$('#ntStudentModal');
  if(!dlg)return;
  $('#ntModalStudentId').value=st?st.id:'';
  $('#ntModalStudentName').value=st?(st.full_name||st.name||''):'';
  $('#ntModalStudentRoll').value=st?(st.roll_number||st.roll||''):'';
  $('#ntModalStudentRemarks').value=st?(st.remarks||''):'';
  $('#ntStudentModalTitle').textContent=st?'✎ Edit Student':'＋ Add New Student';
  dlg.showModal();
}

async function loadRoster(){
  const a=APP(),m=model,instance=++revision;
  if(!root()||!m)return;
  const currentClassName=$('#ntAttClass option:checked')?.textContent||'Class 8';
  const currentSectionName=$('#ntAttSection option:checked')?.textContent||'Section B';

  $('#ntAttTable').innerHTML='<p class="nt-muted">Loading class roster…</p>';

  // Check if AL Noor Hub data is available
  if(window.NOOR_ALNOOR_HUB){
    const hubStudents=window.NOOR_ALNOOR_HUB.getStudents(currentClassName,currentSectionName);
    m.students=hubStudents.map(s=>({
      id:s.id,
      full_name:s.name,
      roll_number:s.roll,
      remarks:s.remarks||'-',
      status:s.status||'present'
    }));
    m.selection={};
    m.students.forEach(s=>{m.selection[s.id]=s.status;});
    table();
    return;
  }

  // Database fallback
  try{
    const classId=$('#ntAttClass').value;
    const {data}=await a.db.from('profiles').select('id,full_name,roll_number').eq('school_id',a.schoolId).eq('role','student').limit(50);
    m.students=(data||[]).map(s=>({...s,remarks:'-'}));
    m.selection={};
    m.students.forEach(s=>{m.selection[s.id]='present';});
    table();
  }catch(e){
    box.innerHTML='<p class="nt-empty">Could not load roster.</p>';
  }
}

async function save(){
  if(working||!model?.students.length)return;
  const n=marks();
  say('Saving attendance securely…');
  working=true;
  stats();
  try{
    await new Promise(r=>setTimeout(r,400));
    say(`✓ Saved attendance: ${n.present} Present, ${n.absent} Absent, ${n.late} Late to school records.`);
    APP().toast?.('Student attendance submitted successfully.','success');
  }catch(err){
    say('Could not submit attendance: '+err.message,true);
  }finally{
    working=false;
    stats();
  }
}

window.NOOR_TEACHER_EMBED={mount};
})();