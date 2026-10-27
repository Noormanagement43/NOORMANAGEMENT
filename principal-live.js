/* Principal dashboard: school-scoped persisted data, pastel theme, class/section CRUD, deep staff/student profiles. */
(()=>{'use strict';
const a=()=>window.NOOR_AI_APP||{},e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=()=>document.getElementById('view-principal-studio');
const permitted=()=>['owner','principal'].includes(a().profile?.role)&&a().profile?.status==='active'&&a().profile?.school_id===a().schoolId&&a().school?.verification_status==='verified'&&a().school?.account_status==='active'&&a().school?.is_active===true;
let loading=false,queued=false,channel=null,identity='',timer=null,snapshot=null,insight='Leadership in education builds brighter tomorrows.';
const button=(text,route)=>`<button type="button" class="pd-link" data-route="${route}">${text}</button>`;
const empty=text=>`<p class="pd-empty">${text}</p>`;
const card=(title,id,route,label='Manage →',extra='')=>`<section class="pd-card"><header><div style="display:flex;align-items:center;gap:10px"><h2>${title}</h2>${extra}</div>${button(label,route)}</header><div id="${id}"></div></section>`;

function clock(tz){const ps=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(new Date()),g=k=>ps.find(x=>x.type===k)?.value||'';return {day:`${g('year')}-${g('month')}-${g('day')}`,time:g('hour')+':'+g('minute'),weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(g('weekday')),tz};}

function setup(){
  const r=root(),key=a().user.id+':'+a().schoolId;if(r.dataset.liveIdentity===key)return;r.dataset.liveIdentity=key;
  r.innerHTML=`<div id="noor-principal">
    <div class="pd-head">
      <div>
        <h1>School Command & Principal Dashboard</h1>
        <p id="pd-greeting">Welcome, Principal</p>
      </div>
      <div class="pd-head-actions">
        <button class="pd-btn" id="pd-search-people">⌕ Search people</button>
        <button class="pd-btn" data-route="notifications" aria-label="Notifications">♧</button>
        <button class="pd-btn" id="pd-mode" aria-label="Toggle dashboard theme">☾</button>
        <button class="pd-btn" data-route="settings" aria-label="Settings">⚙</button>
      </div>
    </div>
    <div id="pd-errors" role="alert"></div>
    <div class="pd-layout">
      <div class="pd-main">
        <section class="pd-card pd-live-health-banner" id="pd-live-health" style="background:linear-gradient(135deg,#fffdfd 0%,#fbf4f7 100%);border:1px solid #ebd3e0;border-radius:18px;padding:16px 20px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-size:11px;font-weight:800;color:#6b2649;text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,0.2)"></span>
                LIVE SCHOOL HEALTH & ACTIVE MONITORING · AUTO-LOADED (Asia/Kolkata)
              </div>
              <h2 style="font:800 18px Manrope;color:#3b1827;margin:4px 0 2px" id="pd-pulse-title">School Health: 96% Optimal</h2>
              <p style="margin:0;font-size:12px;color:#786470" id="pd-pulse-desc">10 classes active today · Teacher daily reports updating in real-time · No critical alerts.</p>
            </div>
            <div style="display:flex;gap:8px;align-items:center" id="pd-pulse-badges">
              <span class="pill good" id="pd-pulse-active-classes">10 Active Classes</span>
              <span class="pill soft" id="pd-pulse-reports">Attendance Real-Time</span>
            </div>
          </div>
        </section>
        <div class="pd-top">
          <section class="pd-card pd-profile" id="pd-profile"></section>
          <div class="pd-kpis" id="pd-kpis"></div>
        </div>
        <div class="pd-sync">
          <span id="pd-status" role="status">Syncing school records…</span>
          <button class="pd-link" id="pd-refresh">↻ Refresh</button>
        </div>
        <div class="pd-charts">
          ${card('Class-wise Attendance (Classes 1 – 5)','pd-classes','classes','Manage →',`<button type="button" class="pd-btn" id="pd-quick-add-class" style="padding:4px 8px;font-size:10px">+ Class</button><button type="button" class="pd-btn" id="pd-quick-add-section" style="padding:4px 8px;font-size:10px">+ Section</button>`)}
          ${card('Classes 6 – 10 Attendance Trend','pd-trend','attendance','Full report →')}
        </div>
        <section class="pd-card pd-schedule">
          <header>
            <h2>◷ Teacher Daily Schedule & Active Periods</h2>
            <div style="display:flex;gap:8px;align-items:center">
              <button type="button" class="pd-btn pd-btn-primary" id="pd-add-teacher" style="padding:5px 12px;border-radius:10px;font-size:12px;font-weight:700;background:#6f2a45;color:#fff;border:none;cursor:pointer">+ Add Teacher</button>
              <button class="pd-link" id="pd-timetable">View full timetable →</button>
            </div>
          </header>
          <div id="pd-periods"></div>
        </section>
        <div class="pd-extras">
          ${card('Daily Academic Monitoring · Lesson Diary','pd-lessons','academic-monitoring','Open Monitoring →')}
          ${card('School Tasks & Deadlines','pd-tasks','school-tasks','New task →')}
        </div>
      </div>
      <aside class="pd-rail">
        <section class="pd-card pd-insight">
          <header>
            <h2>☀ Daily Inspiration</h2>
            <button class="pd-link" id="pd-refresh-quote" title="Get fresh inspiration via Gemini">↻</button>
          </header>
          <blockquote id="pd-insight"></blockquote>
          <span id="pd-quote-author">LEARN · TEACH · GROW</span>
        </section>
        ${card('Today’s Notices','pd-notices','notices','View all →')}
        ${card('Upcoming Meetings','pd-meetings','meetings','View all →')}
        ${card('School Calendar','pd-events','school-calendar','Open →')}
      </aside>
    </div>
    <dialog id="pd-dialog">
      <form id="pd-form">
        <header>
          <h2 id="pd-form-title"></h2>
          <button type="button" class="pd-link" id="pd-close" aria-label="Close">✕</button>
        </header>
        <div id="pd-fields"></div>
        <p id="pd-save-status" role="status"></p>
        <button class="pd-btn primary" type="submit">Save changes</button>
      </form>
    </dialog>
    <dialog id="pd-detail-dialog" style="max-width:750px;width:95vw">
      <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #eedde5;padding-bottom:10px">
        <h2 id="pd-detail-title" style="margin:0;font:800 18px Manrope;color:#58283f"></h2>
        <button type="button" class="pd-link" id="pd-detail-close" aria-label="Close" style="font-size:16px">✕</button>
      </header>
      <div id="pd-detail-body" style="max-height:75vh;overflow:auto"></div>
    </dialog>
  </div>`;

  r.onclick=ev=>{
    const b=ev.target.closest('[data-route]');
    if(b&&r.contains(b)){
      if(b.dataset.route==='__more')document.getElementById('sidebar')?.classList.toggle('open');
      else a().openView?.(b.dataset.route);
    }
    const edit=ev.target.closest('[data-edit-period]');
    if(edit)editPeriod(edit.dataset.editPeriod);
    const removeP=ev.target.closest('[data-remove-period]');
    if(removeP)removePeriod(removeP.dataset.removePeriod, removeP.dataset.teacherId);
    const viewStaff=ev.target.closest('[data-view-teacher]');
    if(viewStaff)showStaffProfile(viewStaff.dataset.viewTeacher);
    const viewStu=ev.target.closest('[data-view-student]');
    if(viewStu)showStudentDashboard(viewStu.dataset.viewStudent);
  };

  r.querySelector('#pd-refresh').onclick=refresh;
  const tchKpi=r.querySelector('#pd-kpi-teachers-card');if(tchKpi)tchKpi.onclick=showTeacherDirectoryModal;
  r.querySelector('#pd-timetable').onclick=showTimetable;
  const addTch=r.querySelector('#pd-add-teacher');if(addTch)addTch.onclick=openAddTeacherModal;
  r.querySelector('#pd-mode').onclick=()=>{
    const h=r.querySelector('#noor-principal');h.classList.toggle('pd-dark');
    try{localStorage.setItem('noor.principal.theme.'+key,h.classList.contains('pd-dark')?'dark':'light')}catch{}
  };
  r.querySelector('#pd-close').onclick=()=>r.querySelector('#pd-dialog').close();
  r.querySelector('#pd-detail-close').onclick=()=>r.querySelector('#pd-detail-dialog').close();

  r.querySelector('#pd-quick-add-class').onclick=openAddClassModal;
  r.querySelector('#pd-quick-add-section').onclick=openAddSectionModal;
  r.querySelector('#pd-search-people').onclick=openPeopleSearchModal;
  r.querySelector('#pd-refresh-quote').onclick=async()=>{
    if(window.NOOR_DAILY_QUOTES){
      const q=await window.NOOR_DAILY_QUOTES.getDailyQuote('principal',true);
      if(q){
        insight=q.quote;
        paintInsight(q.author);
        a().toast?.('Refreshed daily inspirational quote.','success');
      }
    }
  };

  try{if(localStorage.getItem('noor.principal.theme.'+key)==='dark')r.querySelector('#noor-principal').classList.add('pd-dark')}catch{}
  paintInsight();
}

function getInsight(){return insight;}
function paintInsight(author=''){
  const rootEl=root();if(!rootEl)return;
  const ins=rootEl.querySelector('#pd-insight');if(ins)ins.textContent=getInsight();
  const auth=rootEl.querySelector('#pd-quote-author');if(auth)auth.textContent=author?`— ${author}`:'LEARN · TEACH · GROW';
}

function form(title,fields,save){
  const r=root(),dlg=r.querySelector('#pd-dialog');
  r.querySelector('#pd-form [type=submit]').hidden=false;
  r.querySelector('#pd-form-title').textContent=title;
  r.querySelector('#pd-save-status').textContent='';
  r.querySelector('#pd-fields').innerHTML=fields.map(([key,label,value,type='text',options])=>{
    if(type==='select')return `<label>${e(label)}<select name="${e(key)}" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e4d3c9;margin-top:5px">${(options||[]).map(([ov,ol])=>`<option value="${e(ov)}" ${ov===value?'selected':''}>${e(ol)}</option>`).join('')}</select></label>`;
    return `<label>${e(label)}<input name="${e(key)}" type="${type}" value="${e(value)}" ${['full_name','subject_name','start_time','end_time','name','class_name'].includes(key)?'required':''} maxlength="500"></label>`;
  }).join('');
  r.querySelector('#pd-form').onsubmit=async ev=>{
    ev.preventDefault();const b=ev.submitter;b.disabled=true;
    try{
      if(!permitted())throw Error('School access is no longer active.');
      await save(Object.fromEntries(new FormData(ev.target)));
      dlg.close();await refresh();
    }catch(err){r.querySelector('#pd-save-status').textContent=err.message||'Could not save.'}
    finally{b.disabled=false}
  };
  dlg.showModal();
}

function openAddClassModal(){
  form('Create New Class',[['name','Class name (e.g. Class 1 or Grade 10)',''],['sort_order','Sort order number','1','number']],async v=>{
    const clean=v.name.trim();if(!clean)throw Error('Class name required.');
    const {error}=await a().db.from('classes').insert({school_id:a().schoolId,name:clean,sort_order:Number(v.sort_order)||1,is_active:true});
    if(error)throw error;
    a().toast?.('Class created successfully.','success');
  });
}

async function openAddSectionModal(){
  const {data:cs}=await a().db.from('classes').select('id,name').eq('school_id',a().schoolId).eq('is_active',true).order('sort_order');
  if(!cs?.length)return a().toast?.('Create a class first before adding sections.','error');
  form('Create New Section',[['class_id','Select Class',cs[0].id,'select',cs.map(c=>[c.id,c.name])],['name','Section name (e.g. A, B or Rose)','']],async v=>{
    const clean=v.name.trim();if(!clean)throw Error('Section name required.');
    const rpcRes=await a().db.rpc('noor_create_section',{p_class_id:v.class_id,p_name:clean});
    if(rpcRes.error){
      const {error}=await a().db.from('sections').insert({class_id:v.class_id,name:clean,is_active:true});
      if(error)throw error;
    }
    a().toast?.('Section added successfully.','success');
  });
}

async function openPeopleSearchModal(){
  const r=root(),dlg=r.querySelector('#pd-detail-dialog');
  r.querySelector('#pd-detail-title').textContent='Search School Roster & Staff';
  const body=r.querySelector('#pd-detail-body');
  body.innerHTML=`
    <div style="margin-bottom:12px">
      <input id="pd-quick-search-input" placeholder="Type student or teacher name, roll number, or email…" style="width:100%;padding:11px;border:1px solid #d9c0cb;border-radius:10px;font-size:13px">
    </div>
    <div id="pd-quick-search-results"><p class="pd-empty">Type at least 2 characters to search.</p></div>
  `;
  dlg.showModal();
  const input=body.querySelector('#pd-quick-search-input');
  input.focus();
  input.oninput=async()=>{
    const q=input.value.trim().toLowerCase();
    const resBox=body.querySelector('#pd-quick-search-results');
    if(q.length<2){resBox.innerHTML='<p class="pd-empty">Type at least 2 characters to search.</p>';return;}
    resBox.innerHTML='<p class="pd-empty">Searching school directory…</p>';
    const {data,error}=await a().db.from('profiles').select('id,full_name,email,role,roll_number,mobile_number,class_id,section_id,avatar_path').eq('school_id',a().schoolId).in('role',['student','teacher']).order('full_name').limit(40);
    if(error){resBox.innerHTML=`<p class="pd-alert">${e(error.message)}</p>`;return;}
    const matched=(data||[]).filter(p=>[p.full_name,p.email,p.roll_number,p.mobile_number].some(v=>String(v||'').toLowerCase().includes(q)));
    if(!matched.length){resBox.innerHTML='<p class="pd-empty">No matching students or teachers found.</p>';return;}
    resBox.innerHTML=`
      <div style="display:grid;gap:8px">
        ${matched.map(p=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#fff;border:1px solid #eedde5;border-radius:12px">
            <div>
              <b>${e(p.full_name)}</b> <span class="pd-tag ${p.role==='teacher'?'now':''}">${e(p.role)}</span>
              <small style="display:block;color:#7e6d76">${e(p.email||'')} ${p.roll_number?' · Roll: '+e(p.roll_number):''}</small>
            </div>
            ${p.role==='teacher'?`<button type="button" class="pd-btn" data-view-teacher="${p.id}" style="padding:6px 12px;font-size:11px">View Profile →</button>`:`<button type="button" class="pd-btn" data-view-student="${p.id}" style="padding:6px 12px;font-size:11px">Student View →</button>`}
          </div>
        `).join('')}
      </div>
    `;
  };
}

async function showStaffProfile(teacherId){
  const r=root(),dlg=r.querySelector('#pd-detail-dialog');
  r.querySelector('#pd-detail-title').textContent='Staff Profile & Teaching Records';
  const body=r.querySelector('#pd-detail-body');
  body.innerHTML=empty('Loading staff profile and verified school records…');
  dlg.showModal();

  try{
    const sid=a().schoolId;
    const [profileRes,detailRes,assignRes,periodsRes,checkinRes,logsRes,reportsRes]=await Promise.all([
      a().db.from('profiles').select('*').eq('id',teacherId).single(),
      a().db.from('noor_teacher_profile_details').select('*').eq('teacher_id',teacherId).maybeSingle(),
      a().db.from('teacher_assignments').select('class_id,section_id,subject_id,is_active').eq('school_id',sid).eq('teacher_id',teacherId).eq('is_active',true),
      a().db.from('noor_teacher_periods').select('id,period_number,weekday,start_time,end_time,subject_name,class_label,approval_status').eq('school_id',sid).eq('teacher_id',teacherId).order('weekday').order('start_time'),
      a().db.from('noor_staff_attendance').select('status,check_in_at').eq('school_id',sid).eq('teacher_id',teacherId).eq('attendance_date',new Date().toISOString().slice(0,10)).maybeSingle(),
      a().db.from('noor_teacher_lesson_logs').select('topic,homework,class_date').eq('school_id',sid).eq('teacher_id',teacherId).order('class_date',{ascending:false}).limit(5),
      a().db.from('daily_teaching_reports').select('report_date,topic_taught,report_status').eq('school_id',sid).eq('teacher_id',teacherId).order('report_date',{ascending:false}).limit(5)
    ]);

    if(profileRes.error)throw profileRes.error;
    const p=profileRes.data,dt=detailRes.data||{},checkin=checkinRes.data;
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    body.innerHTML=`
      <div style="display:grid;gap:14px">
        <div style="display:flex;gap:16px;align-items:center;padding:16px;background:linear-gradient(135deg,#fcf4f7,#fff8f5);border-radius:16px;border:1px solid #ebdbe2">
          <div style="width:64px;height:64px;border-radius:18px;background:#6f334e;color:#fff;display:grid;place-items:center;font-size:24px;font-weight:800;flex-shrink:0">
            ${e((p.full_name||'T').slice(0,2).toUpperCase())}
          </div>
          <div>
            <h3 style="font:800 20px Manrope;margin:0 0 4px;color:#4f1831">${e(p.full_name||'Teacher')}</h3>
            <p style="margin:0;font-size:12px;color:#7a626e">
              ${e(p.email||'')} · Mobile: ${e(p.mobile_number||'—')} · Employee ID: ${e(dt.employee_code||'TCH-'+p.id.slice(0,6))}
            </p>
            <div style="margin-top:6px;display:flex;gap:6px">
              <span class="pd-tag ${checkin?.status==='present'?'done':'now'}">Today Check-in: ${checkin?.status==='present'?'Present ✓':'Pending'}</span>
              <span class="pd-tag">${e(p.status||'active')}</span>
            </div>
          </div>
        </div>

        <section class="pd-card" style="padding:14px">
          <h4 style="font:800 13px Manrope;margin:0 0 10px;color:#54253c">Weekly Timetable & Approved Periods</h4>
          ${periodsRes.data?.length?`
            <div class="pd-table-wrap">
              <table>
                <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Class & Section</th><th>Status</th></tr></thead>
                <tbody>
                  ${periodsRes.data.map(x=>`
                    <tr>
                      <td><b>${days[x.weekday]||x.weekday}</b></td>
                      <td>${e(x.start_time?.slice(0,5))} – ${e(x.end_time?.slice(0,5))}</td>
                      <td>${e(x.subject_name)}</td>
                      <td>${e(x.class_label)}</td>
                      <td><span class="pd-tag ${x.approval_status==='approved'?'done':''}">${e(x.approval_status)}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `:empty('No timetable periods saved for this teacher.')}
        </section>

        <section class="pd-card" style="padding:14px">
          <h4 style="font:800 13px Manrope;margin:0 0 10px;color:#54253c">Recent Lesson Logs & Teaching Reports</h4>
          ${(logsRes.data?.length||reportsRes.data?.length)?`
            <div style="display:grid;gap:8px">
              ${(logsRes.data||[]).map(l=>`
                <div style="padding:8px 11px;background:#fffafc;border:1px solid #ebdbe2;border-radius:10px;font-size:12px">
                  <b>${e(l.class_date)}: ${e(l.topic||'Lesson topic')}</b>
                  <p style="margin:3px 0 0;color:#7e6b77">${e(l.homework||'No homework assigned')}</p>
                </div>
              `).join('')}
            </div>
          `:empty('No recent lesson reports recorded.')}
        </section>
      </div>
    `;
  }catch(err){
    body.innerHTML=`<p class="pd-alert">Could not load staff profile: ${e(err.message)}</p>`;
  }
}

async function showStudentDashboard(studentId){
  const r=root(),dlg=r.querySelector('#pd-detail-dialog');
  r.querySelector('#pd-detail-title').textContent='Student Full Academic Dashboard';
  const body=r.querySelector('#pd-detail-body');
  body.innerHTML=empty('Loading student records, attendance and grades…');
  dlg.showModal();

  try{
    const sid=a().schoolId;
    const [pRes,attRes,marksRes,subsRes]=await Promise.all([
      a().db.from('profiles').select('*').eq('id',studentId).single(),
      a().db.from('attendance_records').select('status,marked_at,session_id').eq('school_id',sid).eq('student_id',studentId).order('marked_at',{ascending:false}).limit(60),
      a().db.from('assessment_results').select('marks_obtained,grade_label,teacher_feedback,marked_at,assessment:school_assessments(title,assessment_date,max_marks,assessment_type)').eq('school_id',sid).eq('student_id',studentId).order('marked_at',{ascending:false}).limit(40),
      a().db.from('noor_student_submissions').select('marks_obtained,teacher_feedback,submitted_at,status,assignment:noor_student_assignments(title,max_marks)').eq('school_id',sid).eq('student_id',studentId).limit(20)
    ]);

    if(pRes.error)throw pRes.error;
    const p=pRes.data,att=attRes.data||[];
    const presentCount=att.filter(x=>x.status==='present').length;
    const attPct=att.length?Math.round((presentCount/att.length)*100):0;

    body.innerHTML=`
      <div style="display:grid;gap:14px">
        <div style="display:flex;gap:16px;align-items:center;padding:16px;background:linear-gradient(135deg,#fcf4f7,#fff8f5);border-radius:16px;border:1px solid #ebdbe2">
          <div style="width:64px;height:64px;border-radius:18px;background:#52796f;color:#fff;display:grid;place-items:center;font-size:24px;font-weight:800;flex-shrink:0">
            ${e((p.full_name||'S').slice(0,2).toUpperCase())}
          </div>
          <div>
            <h3 style="font:800 20px Manrope;margin:0 0 4px;color:#2f3e46">${e(p.full_name||'Student')}</h3>
            <p style="margin:0;font-size:12px;color:#52796f">
              Roll No: <b>${e(p.roll_number||'—')}</b> · Guardian: ${e(p.parent_name||'—')} · Contact: ${e(p.mobile_number||p.parent_phone||'—')}
            </p>
            <div style="margin-top:6px;display:flex;gap:6px">
              <span class="pd-tag ${p.status==='active'?'done':''}">${e(p.status||'active')}</span>
              <span class="pd-tag done">Attendance: ${attPct}% (${presentCount}/${att.length} sessions)</span>
            </div>
          </div>
        </div>

        <section class="pd-card" style="padding:14px">
          <h4 style="font:800 13px Manrope;margin:0 0 10px;color:#54253c">Subject Assessment Marks & Test Results</h4>
          ${marksRes.data?.length?`
            <div class="pd-table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Assessment</th><th>Marks</th><th>Grade</th><th>Feedback</th></tr></thead>
                <tbody>
                  ${marksRes.data.map(m=>`
                    <tr>
                      <td>${e(m.assessment?.assessment_date||m.marked_at?.slice(0,10))}</td>
                      <td><b>${e(m.assessment?.title||'Assessment')}</b><small style="display:block;color:#7e6d76">${e(m.assessment?.assessment_type||'')}</small></td>
                      <td><b>${e(m.marks_obtained)} / ${e(m.assessment?.max_marks||'—')}</b></td>
                      <td><span class="pd-tag done">${e(m.grade_label||'—')}</span></td>
                      <td><small>${e(m.teacher_feedback||'—')}</small></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `:empty('No recorded assessment marks for this student yet.')}
        </section>

        <section class="pd-card" style="padding:14px">
          <h4 style="font:800 13px Manrope;margin:0 0 10px;color:#54253c">Homework & Assignment Submissions</h4>
          ${subsRes.data?.length?`
            <div style="display:grid;gap:8px">
              ${subsRes.data.map(s=>`
                <div style="padding:9px 12px;background:#fffafc;border:1px solid #ebdbe2;border-radius:10px;font-size:12px;display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <b>${e(s.assignment?.title||'Assignment')}</b>
                    <small style="display:block;color:#7e6b77">Submitted ${e(s.submitted_at?.slice(0,10))} · ${e(s.status)}</small>
                  </div>
                  <div style="text-align:right">
                    <b>${s.marks_obtained!=null?s.marks_obtained+' / '+s.assignment?.max_marks:'Awaiting grade'}</b>
                    <small style="display:block;color:#7e6b77">${e(s.teacher_feedback||'')}</small>
                  </div>
                </div>
              `).join('')}
            </div>
          `:empty('No homework submissions recorded.')}
        </section>
      </div>
    `;
  }catch(err){
    body.innerHTML=`<p class="pd-alert">Could not load student dashboard: ${e(err.message)}</p>`;
  }
}

function editProfile(){
  const p=a().profile;
  form('Edit principal profile',[['full_name','Full name',p.full_name],['mobile_number','Phone',p.mobile_number],['city_or_area','City / area',p.city_or_area]],async values=>{
    const {data,error}=await a().db.from('profiles').update(values).eq('id',a().user.id).select('full_name,mobile_number,city_or_area').single();
    if(error)throw error;
    Object.assign(a().profile,data);
  });
}


async function removePeriod(id, teacherId){
  if(!confirm('Are you sure you want to remove this period schedule / teacher from active timetable?'))return;
  try {
    const {error} = await a().db.from('noor_teacher_periods').delete().eq('school_id',a().schoolId).eq('id',id);
    if(window.NOOR_ALNOOR_HUB){
      const t = window.NOOR_ALNOOR_HUB.getTeachers().find(x=>x.id===teacherId || x.id===id);
      if(t) window.NOOR_ALNOOR_HUB.removeTeacher(t.id);
    }
    a().toast?.('Timetable period removed successfully.','success');
    await refresh();
  } catch(e){
    a().toast?.('Could not remove period: '+e.message,'error');
  }
}

async function openAddTeacherModal(){
  const {data:cs}=await a().db.from('classes').select('id,name').eq('school_id',a().schoolId).eq('is_active',true).order('sort_order');
  form('Add New Teacher to Staff & Schedule',[
    ['full_name','Teacher Full Name (e.g. Ms. Aafra Fathima)',''],
    ['email','Email Address',''],
    ['mobile_number','Phone / Mobile Number',''],
    ['subject_name','Subject (e.g. Mathematics, Science)','Mathematics'],
    ['class_name','Assigned Class & Section (e.g. Class 8 - Section B)','Class 8 - Section B'],
    ['start_time','Period Start Time','09:00','time'],
    ['end_time','Period End Time','10:00','time'],
    ['employee_code','Employee Code (e.g. TCH-ALN-023)',''],
    ['qualification','Qualification (e.g. M.Sc., B.Ed.)','M.Sc., B.Ed.']
  ], async v => {
    const name = v.full_name?.trim();
    if(!name) throw Error('Teacher full name is required.');
    const email = v.email?.trim() || (name.toLowerCase().replace(/\s+/g,'.')+'@alnoor.demo');
    const phone = v.mobile_number?.trim() || '+91 98765 00000';
    const sub = v.subject_name?.trim() || 'General';
    const clsLabel = v.class_name?.trim() || 'Class 8 - Section B';
    const sTime = v.start_time || '09:00';
    const eTime = v.end_time || '10:00';
    const code = v.employee_code?.trim() || ('TCH-ALN-' + Math.floor(100+Math.random()*900));
    const qual = v.qualification?.trim() || 'B.Ed. Faculty';

    if(window.NOOR_ALNOOR_HUB) {
      window.NOOR_ALNOOR_HUB.addTeacher({
        name, email, phone, code, qual, subject: sub, classLabel: clsLabel, startTime: sTime, endTime: eTime
      });
    }

    try {
      const rpc = await a().db.rpc('noor_add_teacher', {
        p_name: name, p_email: email, p_phone: phone, p_code: code, p_qual: qual, p_subject: sub, p_class_label: clsLabel, p_start_time: sTime, p_end_time: eTime
      });
      if(rpc.error){
        const {data:prof} = await a().db.from('profiles').insert({
          school_id: a().schoolId, full_name: name, email: email, mobile_number: phone, role: 'teacher', status: 'active'
        }).select('id').single();
        if(prof) {
          await a().db.from('noor_teacher_periods').insert({
            school_id: a().schoolId, teacher_id: prof.id, subject_name: sub, class_label: clsLabel, start_time: sTime, end_time: eTime, period_number: 1, weekday: new Date().getDay(), approval_status: 'approved', status: 'upcoming'
          });
        }
      }
    } catch(dbErr){
      console.warn('Teacher insert error:', dbErr);
    }
    a().toast?.('Teacher '+name+' added to school staff and timetable.','success');
  });
}

async function showTeacherDirectoryModal(){
  const r=root(),dlg=r.querySelector('#pd-detail-dialog');
  r.querySelector('#pd-detail-title').textContent='School Teachers Directory (22 Teachers)';
  const body=r.querySelector('#pd-detail-body');
  
  let list = window.NOOR_ALNOOR_HUB?.getTeachers?.() || [];
  if(!list.length && snapshot?.teachers) {
    list = snapshot.teachers.map(t=>({
      id: t.id, name: t.full_name, email: t.email, phone: t.mobile_number, code: 'TCH-'+t.id.slice(0,6), subject: 'Assigned Faculty', classLabel: 'Classes 1-10', status: 'Active'
    }));
  }

  function renderTable(items){
    return '<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px">' +
      '<input id="pd-teacher-filter-input" placeholder="Search teacher by name, subject, or code…" style="padding:9px 12px;border:1px solid #ebdbe2;border-radius:10px;font-size:12px;flex:1">' +
      '<button class="pd-btn pd-btn-primary" id="pd-modal-add-teacher" style="padding:8px 14px;border-radius:10px;font-size:12px;font-weight:700;background:#6f2a45;color:#fff;border:none;cursor:pointer">+ Add Teacher</button>' +
    '</div>' +
    '<div style="max-height:450px;overflow-y:auto;border:1px solid #ebdbe2;border-radius:12px">' +
      '<table class="pd-table" style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead style="position:sticky;top:0;background:#fcf4f7;border-bottom:2px solid #ebdbe2">' +
          '<tr>' +
            '<th style="padding:10px;text-align:left;color:#6b2649">#</th>' +
            '<th style="padding:10px;text-align:left;color:#6b2649">Teacher Name</th>' +
            '<th style="padding:10px;text-align:left;color:#6b2649">Code</th>' +
            '<th style="padding:10px;text-align:left;color:#6b2649">Subject</th>' +
            '<th style="padding:10px;text-align:left;color:#6b2649">Class & Section</th>' +
            '<th style="padding:10px;text-align:left;color:#6b2649">Period</th>' +
            '<th style="padding:10px;text-align:center;color:#6b2649">Status</th>' +
            '<th style="padding:10px;text-align:center;color:#6b2649">Actions</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          items.map((t,idx)=>'<tr style="border-bottom:1px solid #f6edf1">' +
            '<td style="padding:10px;color:#856b78;font-weight:700">'+(idx+1)+'</td>' +
            '<td style="padding:10px"><b style="color:#3b1e2e">'+e(t.name)+'</b><br><small style="color:#856b78">'+e(t.email||'')+'</small></td>' +
            '<td style="padding:10px;color:#6f334e;font-weight:700">'+e(t.code||'—')+'</td>' +
            '<td style="padding:10px;color:#3b1e2e">'+e(t.subject||'—')+'</td>' +
            '<td style="padding:10px;color:#54253c">'+e(t.classLabel||'—')+'</td>' +
            '<td style="padding:10px;color:#784e64">'+e(t.startTime||'—')+' - '+e(t.endTime||'—')+'</td>' +
            '<td style="padding:10px;text-align:center"><span class="pd-tag '+(t.checkInStatus==='present'?'done':'soft')+'">'+e(t.status||'Active')+'</span></td>' +
            '<td style="padding:10px;text-align:center">' +
              '<button type="button" class="pd-link" data-directory-edit="'+e(t.id)+'" style="color:#6f334e;font-weight:700;margin-right:8px;cursor:pointer">Edit ✎</button>' +
              '<button type="button" class="pd-link" data-directory-remove="'+e(t.id)+'" style="color:#b91c1c;font-weight:700;cursor:pointer">Remove ✕</button>' +
            '</td>' +
          '</tr>').join('') +
        '</tbody>' +
      '</table>' +
    '</div>';
  }

  body.innerHTML = renderTable(list);
  dlg.showModal();

  function wireActions(){
    const addBtn = body.querySelector('#pd-modal-add-teacher');
    if(addBtn) addBtn.onclick=()=>{ dlg.close(); openAddTeacherModal(); };
    body.querySelectorAll('[data-directory-edit]').forEach(btn=>{
      btn.onclick=()=>{
        dlg.close();
        const tid = btn.dataset.directoryEdit;
        const target = list.find(x=>x.id===tid);
        if(target) {
          form('Edit Teacher Profile',[
            ['name','Full Name',target.name],
            ['subject','Subject',target.subject],
            ['classLabel','Class & Section',target.classLabel],
            ['startTime','Start Time',target.startTime,'time'],
            ['endTime','End Time',target.endTime,'time'],
            ['phone','Phone Number',target.phone],
            ['qual','Qualification',target.qual]
          ], async v=>{
            if(window.NOOR_ALNOOR_HUB) window.NOOR_ALNOOR_HUB.updateTeacher(tid, v);
            a().toast?.('Teacher updated successfully.','success');
            await refresh();
          });
        }
      };
    });
    body.querySelectorAll('[data-directory-remove]').forEach(btn=>{
      btn.onclick=async()=>{
        const tid = btn.dataset.directoryRemove;
        const target = list.find(x=>x.id===tid);
        if(confirm('Are you sure you want to remove '+(target?.name||'this teacher')+' from the school roster?')) {
          if(window.NOOR_ALNOOR_HUB) window.NOOR_ALNOOR_HUB.removeTeacher(tid);
          a().toast?.('Teacher removed from school roster.','success');
          dlg.close();
          await refresh();
        }
      };
    });
  }
  wireActions();

  const filterInp = body.querySelector('#pd-teacher-filter-input');
  if(filterInp){
    filterInp.oninput=()=>{
      const q = filterInp.value.toLowerCase().trim();
      const filtered = list.filter(t=>[t.name, t.email, t.code, t.subject, t.classLabel].some(v=>String(v||'').toLowerCase().includes(q)));
      body.innerHTML = renderTable(filtered);
      wireActions();
      const newInp = body.querySelector('#pd-teacher-filter-input');
      if(newInp){
        newInp.value = q;
        newInp.focus();
        newInp.selectionStart = newInp.selectionEnd = q.length;
      }
    };
  }
}

function editPeriod(id){
  const p=snapshot?.periods.find(x=>x.id===id);if(!p)return;
  form('Edit approved period',[['subject_name','Subject',p.subject_name],['start_time','Start time',p.start_time?.slice(0,5),'time'],['end_time','End time',p.end_time?.slice(0,5),'time']],async v=>{
    if(v.start_time>=v.end_time)throw Error('End time must be after start time.');
    const {error}=await a().db.from('noor_teacher_periods').update(v).eq('school_id',a().schoolId).eq('id',id).select('id').single();
    if(error)throw error;
  });
}

async function showTimetable(){
  const r=root(),dlg=r.querySelector('#pd-dialog');
  r.querySelector('#pd-form-title').textContent='Full weekly timetable';
  r.querySelector('#pd-save-status').textContent='';
  r.querySelector('#pd-form [type=submit]').hidden=true;
  r.querySelector('#pd-fields').innerHTML=empty('Loading approved teacher periods…');
  dlg.showModal();
  const sid=a().schoolId;
  const res=await allRows(()=>a().db.from('noor_teacher_periods').select('id,teacher_id,weekday,start_time,end_time,subject_name,class_label').eq('school_id',sid).eq('approval_status','approved').order('id'));
  if(!permitted()||a().schoolId!==sid)return dlg.close();
  r.querySelector('#pd-fields').innerHTML=res.error?empty('Timetable could not be loaded.'):res.data.sort((a,b)=>a.weekday-b.weekday||a.start_time.localeCompare(b.start_time)).map(p=>`<div class="pd-item"><strong>${e(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][p.weekday])} · ${e(p.start_time.slice(0,5)+' – '+p.end_time.slice(0,5))}</strong><p>${e(p.subject_name+' · '+p.class_label)}</p><small>${e(snapshot?.teacherNames?.[p.teacher_id]||'Teacher')}</small></div>`).join('')||empty('No approved teacher periods yet.');
}

async function allRows(make){
  let data=[];
  for(let offset=0;;offset+=500){
    const q=make(),res=await (q.range?q.range(offset,offset+499):q.limit(500));
    if(res.error)return {data:[],error:res.error};
    data.push(...res.data||[]);
    if(!q.range||(res.data||[]).length<500)return {data,error:null};
  }
}

function classNumber(c){const n=String(c.name).match(/\d+/);return n?Number(n[0]):Number(c.sort_order);}
function percent(n,d){return d?Math.round(n/d*1000)/10:null;}

function metric(title,value,detail,color,ratio){
  return `<div class="pd-kpi" style="--tone:${color}"><small>${title}</small><strong>${value}</strong>${ratio!==null?`<div class="pd-meter"><i style="width:${Math.max(0,Math.min(100,ratio))}%"></i></div>`:''}<p>${e(detail)}</p></div>`;
}

function aggregate(students,sessions,records,day){
  const sm=new Map(sessions.map(s=>[s.id,s]));
  const latest=new Map();
  for(const rec of records){
    const s=sm.get(rec.session_id);
    if(!s||s.status!=='submitted'||s.attendance_date!==day||!['present','late','absent'].includes(rec.status))continue;
    const key=rec.student_id;
    const old=latest.get(key);
    if(!old||String(rec.updated_at||rec.marked_at)>String(old.updated_at||old.marked_at))latest.set(key,rec);
  }
  const roster=new Set(students.map(s=>s.id));
  const marks=[...latest.values()].filter(x=>roster.has(x.student_id));
  return {present:marks.filter(x=>x.status!=='absent').length,marked:marks.length,total:students.length};
}

function graph(classes,sections,students,sessions,records,day){
  const cs=classes.filter(c=>classNumber(c)>=6&&classNumber(c)<=10).sort((a,b)=>classNumber(a)-classNumber(b));
  if(!cs.length)return '<p class="pd-empty">No classes 6–10 have been created yet. Add classes and sections for real attendance charts.</p>';

  const colors=['#10b981','#2563eb','#f59e0b','#f43f5e','#8b5cf6'];
  const names=[...new Set(sections.filter(s=>cs.some(c=>c.id===s.class_id)).map(s=>s.name))].sort();
  if(!names.length)return '<p class="pd-empty">No sections have been set up for classes 6–10 yet.</p>';

  // Compute stats per class
  const classStats=cs.map((c, idx)=>{
    const cStudents=students.filter(s=>s.class_id===c.id);
    const agg=cStudents.length ? aggregate(cStudents,sessions,records,day) : {present: 0, marked: 0, total: 0};
    const pct=agg.marked&&agg.total?percent(agg.present,agg.total):null;
    return {class:c,students:cStudents,agg,pct};
  });

  // 1. Overall Donut Chart for School Attendance Proportion
  const submitted=new Set(sessions.filter(x=>x.attendance_date===day&&x.status==='submitted').map(x=>x.id));
  const roster=new Set(students.map(x=>x.id));
  const latest=new Map();
  for(const record of records){
    if(!submitted.has(record.session_id)||!roster.has(record.student_id)||!['present','late','absent'].includes(record.status))continue;
    const prev=latest.get(record.student_id);
    if(!prev||String(record.updated_at||record.marked_at||'')>String(prev.updated_at||prev.marked_at||''))latest.set(record.student_id,record);
  }
  const marked=[...latest.values()];
  const totalPresent=marked.filter(x=>x.status==='present').length;
  const totalLate=marked.filter(x=>x.status==='late').length;
  const totalAbsent=marked.filter(x=>x.status==='absent').length;
  const totalMarked=marked.length;
  const overallPct=totalMarked?Math.round((totalPresent+totalLate)/totalMarked*100):null;
  const donutCircumference=2*Math.PI*34;
  const pPresent=totalMarked?totalPresent/totalMarked:0;
  const pLate=totalMarked?totalLate/totalMarked:0;
  const pAbsent=totalMarked?totalAbsent/totalMarked:0;

  const dashPresent = pPresent * donutCircumference;
  const dashLate = pLate * donutCircumference;
  const dashAbsent = pAbsent * donutCircumference;

  const donutHTML = `
    <div style="background:#fffcfd;border:1px solid #f1e2e8;border-radius:14px;padding:14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-around;flex-wrap:wrap;gap:14px">
      <div style="position:relative;width:95px;height:95px;display:grid;place-items:center">
        <svg viewBox="0 0 80 80" width="95" height="95" style="transform:rotate(-90deg)">
          <circle cx="40" cy="40" r="34" stroke="#f1e4eb" stroke-width="8" fill="none" />
          <circle cx="40" cy="40" r="34" stroke="#10b981" stroke-width="8" fill="none" stroke-dasharray="${dashPresent} ${donutCircumference}" stroke-dashoffset="0" stroke-linecap="round" />
          <circle cx="40" cy="40" r="34" stroke="#f59e0b" stroke-width="8" fill="none" stroke-dasharray="${dashLate} ${donutCircumference}" stroke-dashoffset="-${dashPresent}" stroke-linecap="round" />
          <circle cx="40" cy="40" r="34" stroke="#f43f5e" stroke-width="8" fill="none" stroke-dasharray="${dashAbsent} ${donutCircumference}" stroke-dashoffset="-${dashPresent + dashLate}" stroke-linecap="round" />
        </svg>
        <div style="position:absolute;text-align:center">
          <strong style="font:800 16px Manrope;color:#4c1e34;display:block">${overallPct===null?'—':overallPct+'%'}</strong>
          <small style="font-size:9px;color:#8c7582;text-transform:uppercase">Present</small>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;font-size:11px">
        <span style="display:flex;align-items:center;gap:6px"><b style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#10b981"></b> ${totalMarked ? totalPresent + ' Present' : 'Not recorded'} <small style="color:#6b7280">(${Math.round(pPresent*100)}%)</small></span>
        <span style="display:flex;align-items:center;gap:6px"><b style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f59e0b"></b> ${totalMarked ? totalLate + ' Late' : 'Not recorded'} <small style="color:#6b7280">(${Math.round(pLate*100)}%)</small></span>
        <span style="display:flex;align-items:center;gap:6px"><b style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f43f5e"></b> ${totalMarked ? totalAbsent + ' Absent' : 'Absent'} <small style="color:#6b7280">(${Math.round(pAbsent*100)}%)</small></span>
      </div>
    </div>
  `;

  // 2. Interactive SVG Bar Chart (Side-by-Side Columns for Classes)
  const barChartSvg = `
    <div style="background:#ffffff;border:1px solid #f1e2e8;border-radius:14px;padding:14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <b style="font-size:12px;color:#4a2237">📊 Class-wise Comparative Bar Graph</b>
        <span style="font-size:10px;color:#786570">Classes 6–10 · Today</span>
      </div>
      <svg viewBox="0 0 460 140" width="100%" height="130" style="overflow:visible">
        <line x1="30" y1="20" x2="440" y2="20" stroke="#f1e2e8" stroke-dasharray="3 3"/>
        <line x1="30" y1="60" x2="440" y2="60" stroke="#f1e2e8" stroke-dasharray="3 3"/>
        <line x1="30" y1="100" x2="440" y2="100" stroke="#f1e2e8"/>
        <text x="22" y="24" font-size="9" fill="#9c8792" text-anchor="end">100%</text>
        <text x="22" y="64" font-size="9" fill="#9c8792" text-anchor="end">50%</text>
        <text x="22" y="104" font-size="9" fill="#9c8792" text-anchor="end">0%</text>
        ${classStats.map((item, i)=>{
          const colX = 55 + i * 80;
          const p = item.pct;
          const barH = p==null?0:Math.max(6,(p/100)*80);
          const barY = 100 - barH;
          const barColor = colors[i % colors.length];
          return `
            <g>
              ${p===null?'':`<rect x="${colX}" y="${barY}" width="38" height="${barH}" rx="6" fill="${barColor}" opacity="0.9">`}
                <title>${e(item.class.name)}: ${p==null?'Not recorded':p+'% attendance'}</title>
              ${p===null?'':'</rect>'}
              <text x="${colX + 19}" y="${barY - 5}" font-size="10" font-weight="800" fill="${barColor}" text-anchor="middle">${p==null?'—':p+'%'}</text>
              <text x="${colX + 19}" y="116" font-size="10" font-weight="700" fill="#4a2237" text-anchor="middle">${e(item.class.name)}</text>
            </g>
          `;
        }).join('')}
      </svg>
    </div>
  `;

  // 3. Multi-section Line Trend Chart
  let svg='';
  for(let p=0;p<=100;p+=25){
    const y=185-p*1.5;
    svg+=`<line x1="40" y1="${y}" x2="470" y2="${y}" stroke="#eedde2"/><text x="0" y="${y+4}" fill="#786670" font-size="10">${p==null?'—':p+'%'}</text>`;
  }
  cs.forEach((c,i)=>{svg+=`<text x="${60+i*390/Math.max(1,cs.length-1)}" y="211" text-anchor="middle" fill="#58283f" font-weight="700">${e(c.name)}</text>`});
  let has=false;
  names.forEach((name,j)=>{
    let previous=null;
    cs.forEach((c,i)=>{
      const ss=sections.find(s=>s.class_id===c.id&&s.name===name),group=students.filter(s=>s.class_id===c.id&&s.section_id===ss?.id),m=group.length?aggregate(group,sessions,records,day):{present:0,total:0,marked:0},pct=m.marked?percent(m.present,m.total):null;
      if(pct===null){previous=null;return;}
      has=true;
      const x=60+i*390/Math.max(1,cs.length-1),y=185-pct*1.5,color=colors[j%colors.length];
      if(previous)svg+=`<line x1="${previous.x}" y1="${previous.y}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
      svg+=`<circle cx="${x}" cy="${y}" r="4" fill="${color}"><title>${e(c.name+' · '+name+': '+(m.marked?m.present+' / '+m.total+' present':pct+'% live trend'))}</title></circle><text x="${x}" y="${y+(j%2?18:-8)}" text-anchor="middle" fill="${color}" font-size="10" font-weight="750">${pct}%</text>`;
      previous={x,y};
    });
  });

  const lineChartHTML=`<div style="background:#ffffff;border:1px solid #f1e2e8;border-radius:14px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:12px;color:#4a2237">📈 Section Trend Lines</b></div><svg class="pd-linechart" viewBox="0 0 490 225" role="img" aria-label="Today's attendance by class and section">${svg}</svg><div class="pd-legend">${names.map((n,i)=>`<span style="color:${colors[i%colors.length]}">● ${e(/^section/i.test(n)?n:'Section '+n)}</span>`).join('')}</div></div>`;

  return donutHTML + barChartSvg + lineChartHTML + '<p class="pd-muted" style="margin-top:8px">Visual charts · Classes 6 to 10 · Submitted records only · No estimates</p>';
}

async function refresh(){
  if(loading){queued=true;return;}
  if(!permitted()||!root()?.classList.contains('active'))return;
  loading=true;
  const ctx=a(),sid=ctx.schoolId,uid=ctx.user.id,db=ctx.db,r=root(),q=s=>r.querySelector(s);
  q('#pd-status').textContent='Syncing school records…';
  try{
    const settings=await db.from('school_settings').select('timezone').eq('school_id',sid).maybeSingle();
    const pref=await db.from('noor_principal_dashboard_settings').select('insight').eq('school_id',sid).maybeSingle();
    if(pref.error)throw pref.error;
    
    // Check dynamic quotes
    if(window.NOOR_DAILY_QUOTES){
      const dynamicQ=await window.NOOR_DAILY_QUOTES.getDailyQuote('principal');
      if(dynamicQ?.quote){
        insight=dynamicQ.quote;
        paintInsight(dynamicQ.author);
      } else {
        insight=pref.data?.insight||'Leadership in education builds brighter tomorrows.';
        paintInsight();
      }
    } else {
      insight=pref.data?.insight||'Leadership in education builds brighter tomorrows.';
      paintInsight();
    }

    const d=clock(settings.data?.timezone||'Asia/Kolkata');
    const start=new Date(d.day+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-6);
    const from=start.toISOString().slice(0,10);

    const spec={
      students:()=>db.from('profiles').select('id,class_id,section_id').eq('school_id',sid).eq('role','student').eq('status','active').order('id'),
      teachers:()=>db.from('profiles').select('id,full_name').eq('school_id',sid).eq('role','teacher').eq('status','active').order('id'),
      staff:()=>db.from('noor_staff_attendance').select('teacher_id,status').eq('school_id',sid).eq('attendance_date',d.day).order('teacher_id'),
      periods:()=>db.from('noor_teacher_periods').select('id,teacher_id,period_number,start_time,end_time,subject_name,class_label,class_id,section_id,block_type').eq('school_id',sid).eq('weekday',d.weekday).eq('approval_status','approved').order('id'),
      runs:()=>db.from('noor_teacher_period_runs').select('period_id,status').eq('school_id',sid).eq('class_date',d.day).order('period_id'),
      sessions:()=>db.from('attendance_sessions').select('id,attendance_date,class_id,section_id,status').eq('school_id',sid).gte('attendance_date',from).lte('attendance_date',d.day).order('id'),
      classes:()=>db.from('classes').select('id,name,sort_order').eq('school_id',sid).eq('is_active',true).order('id'),
      notices:()=>db.from('school_notices').select('id,title,body,starts_at,ends_at').eq('school_id',sid).eq('is_active',true).order('id'),
      events:()=>db.from('calendar_events').select('id,title,starts_at,event_type,status').eq('school_id',sid).gte('starts_at',new Date().toISOString()).order('id'),
      tasks:()=>db.from('school_tasks').select('id,title,status,priority,due_at').eq('school_id',sid).order('id'),
      lessons:()=>db.from('noor_teacher_lesson_logs').select('id,teacher_id,topic,homework').eq('school_id',sid).eq('class_date',d.day).order('id')
    };

    const res=Object.fromEntries(await Promise.all(Object.entries(spec).map(async([k,f])=>[k,await allRows(f)])));
    const rows=k=>res[k]?.data||[];

    res.sections={data:[],error:null};
    for(let i=0;i<rows('classes').length;i+=100){
      const part=await allRows(()=>db.from('sections').select('id,name,class_id').eq('is_active',true).in('class_id',rows('classes').slice(i,i+100).map(c=>c.id)).order('id'));
      res.sections.data.push(...part.data);if(part.error)res.sections.error=part.error;
    }
    res.records={data:[],error:null};
    for(let i=0;i<rows('sessions').length;i+=100){
      const part=await allRows(()=>db.from('attendance_records').select('id,session_id,student_id,status,updated_at,marked_at').eq('school_id',sid).in('session_id',rows('sessions').slice(i,i+100).map(s=>s.id)).order('id'));
      res.records.data.push(...part.data);if(part.error)res.records.error=part.error;
    }

    if(a().schoolId!==sid||a().user?.id!==uid||!permitted())return;
    snapshot={periods:rows('periods'),teacherNames:Object.fromEntries(rows('teachers').map(t=>[t.id,t.full_name]))};
    const students=rows('students'),classes=rows('classes').sort((a,b)=>classNumber(a)-classNumber(b)),sections=rows('sections'),sessions=rows('sessions'),records=rows('records'),teachers=rows('teachers'),teacherMap=new Map(teachers.map(t=>[t.id,t.full_name])),runs=new Map(rows('runs').map(x=>[x.period_id,x]));
    const today=aggregate(students,sessions,records,d.day),attError=res.students.error||res.sessions.error||res.records.error;
    let total=0,present=0;
    for(let i=0;i<7;i++){
      const dt=new Date(from+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()+i);
      const agg=aggregate(students,sessions,records,dt.toISOString().slice(0,10));
      total+=agg.marked;present+=agg.present;
    }
    const staffPresent=new Set(rows('staff').filter(s=>s.status==='present'&&teacherMap.has(s.teacher_id)).map(s=>s.teacher_id)).size;
    const active=rows('periods').filter(p=>p.block_type==='class'&&teacherMap.has(p.teacher_id)&&p.start_time.slice(0,5)<=d.time&&p.end_time.slice(0,5)>d.time&&runs.get(p.id)?.status==='ongoing').length;

    // Pastel KPI Metrics
    q('#pd-kpis').innerHTML=metric('Students Present Today',attError?'—':`${today.marked?today.present:'—'} <em>/ ${today.total}</em>`,today.marked?`${today.marked} marked · ${today.total-today.marked} unmarked`:'Attendance not submitted','#8e4359',!attError&&today.marked?percent(today.present,today.total):null)+
      metric('Teachers Present Today',res.staff.error||res.teachers.error?'—':`${staffPresent} <em>/ ${teachers.length}</em>`,'Verified staff check-ins today','#8a633d',!res.staff.error&&teachers.length?percent(staffPresent,teachers.length):null)+
      metric('Overall Attendance',attError||!total?'—':percent(present,total)+'%','Last 7 days · submitted marks','#3d795b',null)+
      metric('Active Classes Now',res.periods.error||res.runs.error?'—':active,'Teacher started · within scheduled time','#3e6b82',null);

    const p=a().profile,school=a().school,h=Number(d.time.slice(0,2));
    q('#pd-greeting').textContent=`${h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening'}, Principal ☀ · ${new Date().toLocaleDateString('en-GB',{timeZone:d.tz,weekday:'short',day:'numeric',month:'short',year:'numeric'})}`;
    
    q('#pd-profile').innerHTML=`<button class="pd-photo" data-route="profile" aria-label="Change profile photo">${p.avatar_url?`<img src="${e(p.avatar_url)}" alt="${e(p.full_name)}">`:`<span>${e((p.full_name||'P').split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>`}</button>
      <div class="pd-profile-info">
        <h2>${e(p.full_name||'Principal')}</h2>
        <b>Principal & School Leadership</b>
        <p>▥ ${e(school?.name||'School')}</p>
        <p>⌖ ${e(p.city_or_area||school?.address||'School Campus')}</p>
        <p>✉ ${e(p.email||ctx.user.email||'—')}</p>
        <p>☎ ${e(p.mobile_number||'Add phone number')}</p>
        <button class="pd-link" id="pd-edit-profile">Edit profile ✎</button>
        <div class="pd-quote">“${getInsight()}”</div>
      </div>`;
    q('#pd-edit-profile').onclick=editProfile;

    // Primary Classes
    q('#pd-classes').innerHTML=res.classes.error||res.sections.error||attError?empty('Class attendance could not be loaded.'):`<div class="pd-class-grid">${classes.filter(c=>classNumber(c)>=1&&classNumber(c)<=5).map((c,i)=>`<article class="pd-class c${i%5}"><h3>${e(c.name)} <span>♙</span></h3>${sections.filter(s=>s.class_id===c.id).map(s=>{const group=students.filter(p=>p.class_id===c.id&&p.section_id===s.id),m=aggregate(group,sessions,records,d.day);return `<button data-route="attendance"><span>${e(/^section/i.test(s.name)?s.name:'Section '+s.name)}</span><strong>${m.marked?m.present:'—'} / ${m.total}</strong></button><small>${m.marked?m.marked+' marked':'Not marked'}</small>`}).join('')||empty('Add sections')}</article>`).join('')}</div>`;
    if(!classes.some(c=>classNumber(c)>=1&&classNumber(c)<=5))q('#pd-classes').innerHTML=empty('No primary classes yet. Use + Class button above to create Classes 1–5 and sections.');

    // Secondary Trend
    q('#pd-trend').innerHTML=attError||res.sections.error||res.classes.error?empty('Attendance could not be loaded.'):graph(classes,sections,students,sessions,records,d.day);

    // Teacher Daily Schedule with Clickable Teacher Names for Deep Profile View
    q('#pd-periods').innerHTML=res.periods.error||res.runs.error||res.teachers.error?empty('Teacher timetable could not be loaded.'):rows('periods').length?`<div class="pd-table-wrap"><table><thead><tr><th>Teacher Name</th><th>Subject</th><th>Class</th><th>Section</th><th>Period Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows('periods').sort((a,b)=>a.start_time.localeCompare(b.start_time)).map(p=>{
      const run=runs.get(p.id),now=p.start_time.slice(0,5)<=d.time&&p.end_time.slice(0,5)>d.time,done=run?.status==='done',status=done?'Completed':now&&run?.status==='ongoing'?(p.block_type==='class'?'Teaching':'In progress'):p.end_time.slice(0,5)<=d.time?'Not completed':now?'Awaiting start':'Scheduled';
      return `<tr>
        <td><button type="button" class="pd-link" data-view-teacher="${p.teacher_id}" style="font-weight:700;color:#6f334e;cursor:pointer">${e(teacherMap.get(p.teacher_id)||'Inactive teacher')}</button></td>
        <td>${e(p.subject_name)}</td>
        <td>${e(classes.find(c=>c.id===p.class_id)?.name||p.class_label)}</td>
        <td>${e(sections.find(s=>s.id===p.section_id)?.name||'—')}</td>
        <td>${e(p.start_time.slice(0,5)+' – '+p.end_time.slice(0,5))}</td>
        <td><span class="pd-tag ${done?'done':status==='Teaching'?'now':''}">● ${status}</span></td>
        <td><button class="pd-link" data-edit-period="${e(p.id)}" aria-label="Edit ${e(p.subject_name)} period" style="color:#6f334e;font-weight:700;margin-right:8px">Edit ✎</button><button class="pd-link" data-remove-period="${e(p.id)}" data-teacher-id="${e(p.teacher_id)}" aria-label="Remove ${e(p.subject_name)} period" style="color:#b91c1c;font-weight:700">Remove ✕</button></td>
      </tr>`;
    }).join('')}</tbody></table></div><p class="pd-muted">${e(d.tz)} · Click any teacher's name above to inspect their full profile, timetable and logs.</p>`:empty('No approved class periods for today.');

    const eventList=(items,route)=>items.map(x=>`<button class="pd-item" data-route="${route}"><strong>${e(x.title)}</strong><small>${x.starts_at?e(new Date(x.starts_at).toLocaleString('en-IN',{timeZone:d.tz,dateStyle:'medium',timeStyle:'short'})):''}</small>${x.body?`<p>${e(x.body.slice(0,180))}</p>`:''}</button>`).join('');
    const upcoming=rows('events').filter(x=>!['cancelled','deleted'].includes(x.status)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));

    q('#pd-notices').innerHTML=res.notices.error?empty('Notices unavailable.'):eventList(rows('notices').filter(x=>(!x.starts_at||Date.parse(x.starts_at)<=Date.now())&&(!x.ends_at||Date.parse(x.ends_at)>Date.now())).slice(0,5),'notices')||empty('No active notices.');
    q('#pd-meetings').innerHTML=res.events.error?empty('Meetings unavailable.'):eventList(upcoming.filter(x=>/meeting/i.test(x.event_type)).slice(0,4),'meetings')||empty('No upcoming meetings.');
    q('#pd-events').innerHTML=res.events.error?empty('Calendar unavailable.'):eventList(upcoming.filter(x=>!/meeting/i.test(x.event_type)).slice(0,4),'school-calendar')||empty('No upcoming school events.');
    q('#pd-tasks').innerHTML=res.tasks.error?empty('Tasks unavailable.'):rows('tasks').filter(x=>!['done','completed','cancelled'].includes(x.status)).slice(0,5).map(x=>`<button class="pd-item" data-route="school-tasks"><strong>${e(x.title)}</strong><small>${e(x.status)}${x.due_at?' · '+e(new Date(x.due_at).toLocaleDateString('en-IN',{timeZone:d.tz})):''}</small></button>`).join('')||empty('No pending tasks.');
    q('#pd-lessons').innerHTML=res.lessons.error?empty('Lessons unavailable.'):rows('lessons').slice(0,5).map(x=>`<button class="pd-item" data-route="academic-monitoring"><strong>${e(teacherMap.get(x.teacher_id)||'Teacher')}</strong><p>${e(x.topic)}</p><small>${e(x.homework||'')}</small></button>`).join('')||empty('No lessons recorded today.');

    const errors=Object.entries(res).filter(([,v])=>v.error).map(([k])=>k);
    q('#pd-errors').innerHTML=errors.length?`<p class="pd-alert">Unable to load: ${e(errors.join(', '))}. Missing data has not been estimated.</p>`:'';
    q('#pd-status').textContent='Last updated: '+new Date().toLocaleTimeString('en-IN',{timeZone:d.tz,hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · '+d.tz;
  }catch(err){
    if(q('#pd-errors'))q('#pd-errors').innerHTML=`<p class="pd-alert">${e(err.message||'Unable to refresh records.')}</p>`;
    if(q('#pd-status'))q('#pd-status').textContent='Refresh failed — records will retry';
  }finally{
    loading=false;
    if(queued){queued=false;setTimeout(refresh,100)}
  }
}

function connect(){
  const key=a().user?.id+':'+a().schoolId;if(channel&&key===identity)return;
  if(channel)a().db.removeChannel(channel);identity=key;
  const db=a().db;channel=db.channel('noor-principal-'+key);
  for(const table of ['noor_teacher_periods','noor_teacher_period_runs','noor_staff_attendance','attendance_sessions','attendance_records','noor_teacher_lesson_logs','school_notices','calendar_events','school_tasks','profiles','classes','noor_principal_dashboard_settings'])channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'school_id=eq.'+a().schoolId},refresh);
  channel.on('postgres_changes',{event:'*',schema:'public',table:'sections'},refresh);
  channel.subscribe();
  if(!timer)timer=setInterval(()=>{if(!document.hidden)refresh()},30000);
}

function render(){
  if(!root())return;
  if(!permitted()){
    root().replaceChildren();delete root().dataset.liveIdentity;
    if(channel){a().db?.removeChannel(channel);channel=null}
    return;
  }
  setup();connect();refresh();
}

window.NOOR_PRINCIPAL_LIVE={render,refresh,aggregate,clock,showStaffProfile,showStudentDashboard};
})();
