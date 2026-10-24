/* NOOR Agent 7: institution-scoped academic workflows.
 * Uses only the authenticated Supabase client and existing RLS-protected tables.
 * No demo records, service-role credentials, or production schema changes.
 */
(function () {
  'use strict';
  const app = window.noorApp;
  if (!app || !app.client) return;
  const client = app.client;
  const host = document.createElement('section');
  host.id = 'noor-workflow-host';
  host.className = 'panel';
  host.hidden = true;
  host.style.marginBottom = '18px';
  const style = document.createElement('style');
  style.textContent = `
    #noor-workflow-host[hidden]{display:none}
    #noor-workflow-host .wf-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:14px 0}
    #noor-workflow-host .wf-field{display:grid;gap:5px;min-width:150px;flex:1}
    #noor-workflow-host .wf-field label{font-size:12px;font-weight:700}
    #noor-workflow-host input,#noor-workflow-host select,#noor-workflow-host textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink)}
    #noor-workflow-host .wf-table{width:100%;border-collapse:collapse;font-size:12px}
    #noor-workflow-host .wf-table th,#noor-workflow-host .wf-table td{text-align:left;padding:11px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
    #noor-workflow-host .wf-table th{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
    #noor-workflow-host .wf-actions{display:flex;gap:6px;flex-wrap:wrap}
    #noor-workflow-host .wf-error{padding:11px;border-radius:9px;background:#fff0f0;color:#9c2636;margin:10px 0}
    #noor-workflow-host .wf-success{padding:11px;border-radius:9px;background:#eaf6ef;color:#226847;margin:10px 0}
    #noor-workflow-host .wf-subtitle{color:var(--muted);font-size:12px}
    #noor-workflow-host .wf-title{font-size:18px;margin:0}
    #noor-workflow-host .wf-empty{padding:18px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:10px}
  `;
  document.head.appendChild(style);
  const main = document.querySelector('.main');
  const heading = document.querySelector('.heading');
  heading.insertAdjacentElement('afterend', host);
  let activeView = 'Dashboard';
  let sessionCache = [];
  let groupCache = [];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const empty = msg => '<div class="wf-empty">' + esc(msg) + '</div>';
  const fmt = v => v ? new Date(v).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : '—';
  const currentMembership = () => app.getMembership();
  const currentUser = () => app.getCurrentUser();
  const manager = () => app.canEdit();
  function setMessage(kind, message) {
    let node = host.querySelector('.wf-message');
    if (!node) { node = document.createElement('div'); node.className = 'wf-message'; host.prepend(node); }
    node.className = 'wf-message ' + (kind === 'error' ? 'wf-error' : 'wf-success');
    node.textContent = message;
  }
  function clearMessage() { const n = host.querySelector('.wf-message'); if (n) n.remove(); }
  function show(view) {
    activeView = view;
    document.querySelectorAll('.main > .stats,.main > .content-grid,.main > .lower').forEach(n => n.hidden = view !== 'Dashboard');
    host.hidden = view === 'Dashboard';
    document.getElementById('crumb-view').textContent = view;
    if (view === 'Dashboard') return;
    host.innerHTML = '<div class="panel-head"><div><h2 class="wf-title">' + esc(view) + '</h2><p class="wf-subtitle">Live records from your signed-in institution. Access is enforced by Supabase row-level security.</p></div><button class="secondary" id="wf-refresh" type="button">Refresh</button></div><div id="wf-content">' + empty('Loading…') + '</div>';
    document.getElementById('wf-refresh').onclick = () => loadView(view);
    loadView(view);
  }
  async function getGroups() {
    const m = currentMembership();
    if (!m) throw new Error('Sign in to view academic groups.');
    if (manager()) {
      const r = await client.from('academic_groups').select('id,name,code,group_type,room_label,is_active').eq('institution_id',m.institution_id).eq('is_active',true).order('name').limit(200);
      if (r.error) throw r.error;
      groupCache = r.data || [];
      return groupCache;
    }
    const gm = await client.from('academic_group_memberships').select('group_id').eq('membership_id',m.id).eq('status','active').limit(200);
    if (gm.error) throw gm.error;
    const ids = [...new Set((gm.data || []).map(x => x.group_id))];
    if (!ids.length) { groupCache = []; return groupCache; }
    const r = await client.from('academic_groups').select('id,name,code,group_type,room_label,is_active').eq('institution_id',m.institution_id).eq('is_active',true).in('id',ids).order('name').limit(200);
    if (r.error) throw r.error;
    groupCache = r.data || [];
    return groupCache;
  }
  async function getSessions() {
    const m = currentMembership();
    let q = client.from('class_sessions').select('id,institution_id,academic_group_id,teacher_membership_id,title,room_label,starts_at,ends_at,session_status').eq('institution_id',m.institution_id).order('starts_at',{ascending:true}).limit(200);
    if (!manager() && ['teacher','faculty'].includes(m.role)) q = q.eq('teacher_membership_id',m.id);
    const r = await q;
    if (r.error) throw r.error;
    sessionCache = r.data || [];
    return sessionCache;
  }
  async function loadView(view) {
    clearMessage();
    const content = document.getElementById('wf-content');
    if (!content) return;
    content.innerHTML = empty('Loading live records…');
    try {
      if (view === 'My Classes') return await renderClasses(content);
      if (view === 'Timetable') return await renderTimetable(content);
      if (view === 'Attendance') return await renderAttendance(content);
      if (view === 'Students') return await renderDirectory(content);
      if (view === 'Settings') return await renderAcademicYears(content);
      content.innerHTML = empty(view + ' is not connected to a verified live data workflow yet.');
    } catch (e) {
      content.innerHTML = '<div class="wf-error" role="alert">' + esc(e.message || 'Could not load records.') + '</div>';
    }
  }
  async function renderClasses(content) {
    const groups = await getGroups();
    const rows = groups.map(g=>'<tr><td>'+esc(g.name)+'</td><td>'+esc(g.code||'—')+'</td><td>'+esc(g.group_type||'class')+'</td><td>'+esc(g.room_label||'—')+'</td><td>'+esc(g.is_active?'Active':'Inactive')+'</td></tr>').join('');
    content.innerHTML = '<p class="wf-subtitle">'+(manager()?'Class creation and editing are available from the Add a class button above.':'Only classes linked to your own institution membership are shown.')+'</p>' + (rows?'<div class="table-wrap"><table class="wf-table"><thead><tr><th>Class / section</th><th>Code</th><th>Type</th><th>Room</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('No classes or sections are linked to this account yet.'));
  }
  async function renderTimetable(content) {
    const m = currentMembership();
    const [sessions, groups] = await Promise.all([getSessions(), getGroups()]);
    const groupMap = new Map(groups.map(g => [g.id,g.name]));
    const teacherResult = manager() ? await client.from('institution_memberships').select('id,user_id,invited_email,role').eq('institution_id',m.institution_id).eq('status','active').in('role',['teacher','faculty']).limit(200) : {data:[],error:null};
    if (teacherResult.error) throw teacherResult.error;
    const teacherUserIds = [...new Set((teacherResult.data||[]).map(t=>t.user_id).filter(Boolean))];
    const teacherProfiles = teacherUserIds.length ? await client.from('profiles').select('id,full_name').in('id',teacherUserIds).limit(200) : {data:[],error:null};
    if (teacherProfiles.error) throw teacherProfiles.error;
    const teacherNames = new Map((teacherProfiles.data||[]).map(p=>[p.id,p.full_name]));
    const teacherOptions = (teacherResult.data||[]).map(t=>'<option value="'+esc(t.id)+'">'+esc(teacherNames.get(t.user_id)||t.invited_email||('Teacher '+t.id.slice(0,8)))+'</option>').join('');
    const formHtml = manager() ? `
      <form id="wf-session-form" class="wf-toolbar">
        <div class="wf-field"><label for="wf-session-title">Lesson / session title</label><input id="wf-session-title" maxlength="140" required placeholder="e.g. Mathematics — Chapter 3"></div>
        <div class="wf-field"><label for="wf-session-group">Class / section</label><select id="wf-session-group" required><option value="">Choose group</option>${groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join('')}</select></div>
        <div class="wf-field"><label for="wf-session-teacher">Assigned teacher / faculty</label><select id="wf-session-teacher"><option value="">Unassigned</option>${teacherOptions}</select></div>
        <div class="wf-field"><label for="wf-session-room">Room</label><input id="wf-session-room" maxlength="80" placeholder="Room 12"></div>
        <div class="wf-field"><label for="wf-session-start">Starts</label><input id="wf-session-start" type="datetime-local" required></div>
        <div class="wf-field"><label for="wf-session-end">Ends</label><input id="wf-session-end" type="datetime-local" required></div>
        <button class="primary" type="submit">Add session</button>
      </form>` : '';
    const rows = sessions.map(s => '<tr><td>'+esc(s.title)+'</td><td>'+esc(groupMap.get(s.academic_group_id)||'Group not visible')+'</td><td>'+esc(fmt(s.starts_at))+'</td><td>'+esc(fmt(s.ends_at))+'</td><td>'+esc(s.room_label||'—')+'</td><td>'+esc(s.session_status)+'</td></tr>').join('');
    content.innerHTML = formHtml + (sessions.length ? '<div class="table-wrap"><table class="wf-table"><thead><tr><th>Session</th><th>Class</th><th>Starts</th><th>Ends</th><th>Room</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div>' : empty('No timetable sessions are available to this account yet.'));
    const form = document.getElementById('wf-session-form');
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault(); clearMessage();
      const title = document.getElementById('wf-session-title').value.trim();
      const groupId = document.getElementById('wf-session-group').value;
      const starts = new Date(document.getElementById('wf-session-start').value);
      const ends = new Date(document.getElementById('wf-session-end').value);
      if (!title || !groupId || Number.isNaN(+starts) || Number.isNaN(+ends) || ends <= starts) return setMessage('error','Enter a title, class, and valid end time after the start time.');
      const group = groups.find(g=>g.id===groupId);
      if (!group) return setMessage('error','Choose a class from this institution.');
      const teacherId = document.getElementById('wf-session-teacher').value || null;
      const result = await client.from('class_sessions').insert({institution_id:m.institution_id,academic_group_id:groupId,teacher_membership_id:teacherId,title,room_label:document.getElementById('wf-session-room').value.trim()||null,starts_at:starts.toISOString(),ends_at:ends.toISOString(),session_status:'scheduled',created_by:currentUser().id}).select('id').maybeSingle();
      if (result.error) return setMessage('error','Session was not saved: '+result.error.message);
      setMessage('success','Timetable session saved.');
      await renderTimetable(content);
    });
  }
  async function renderAttendance(content) {
    const m = currentMembership();
    if (['student','university_student'].includes(m.role)) {
      const r = await client.from('attendance_records').select('id,session_id,attendance_status,marked_at,notes').eq('institution_id',m.institution_id).eq('student_membership_id',m.id).order('marked_at',{ascending:false}).limit(100);
      if (r.error) throw r.error;
      const sessions = await client.from('class_sessions').select('id,title,starts_at,academic_group_id').eq('institution_id',m.institution_id).in('id',[...new Set((r.data||[]).map(a=>a.session_id))].length ? [...new Set((r.data||[]).map(a=>a.session_id))] : ['00000000-0000-0000-0000-000000000000']);
      if (sessions.error) throw sessions.error;
      const map = new Map((sessions.data||[]).map(s=>[s.id,s]));
      const rows = (r.data||[]).map(a=>{const s=map.get(a.session_id)||{};return '<tr><td>'+esc(s.title||'Class session')+'</td><td>'+esc(fmt(s.starts_at))+'</td><td>'+esc(a.attendance_status)+'</td><td>'+esc(fmt(a.marked_at))+'</td><td>'+esc(a.notes||'—')+'</td></tr>'}).join('');
      content.innerHTML = rows ? '<div class="table-wrap"><table class="wf-table"><thead><tr><th>Session</th><th>Scheduled</th><th>Status</th><th>Marked</th><th>Notes</th></tr></thead><tbody>'+rows+'</tbody></table></div>' : empty('No attendance records are available for your membership.');
      return;
    }
    const sessions = await getSessions();
    const groups = await getGroups();
    const groupMap = new Map(groups.map(g=>[g.id,g]));
    const eligible = sessions.filter(s=>s.academic_group_id && groupMap.has(s.academic_group_id));
    content.innerHTML = `
      <div class="wf-toolbar"><div class="wf-field"><label for="wf-attendance-session">Class session</label><select id="wf-attendance-session"><option value="">Choose a session</option>${eligible.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.title)+' — '+esc(fmt(s.starts_at))+'</option>').join('')}</select></div><button type="button" class="primary" id="wf-load-roster">Load roster</button></div>
      <div id="wf-roster">${eligible.length?empty('Choose a session to load its roster.'):empty('No assigned or accessible class sessions are available. Timetable sessions must have a class/section linked.')}</div>`;
    document.getElementById('wf-load-roster').onclick = async () => {
      clearMessage();
      const sessionId = document.getElementById('wf-attendance-session').value;
      const session = eligible.find(s=>s.id===sessionId);
      if (!session) return setMessage('error','Choose a valid session first.');
      const groupMembers = await client.from('academic_group_memberships').select('membership_id,group_role,status').eq('group_id',session.academic_group_id).eq('group_role','student').eq('status','active').limit(500);
      if (groupMembers.error) return setMessage('error','Could not load the class roster: '+groupMembers.error.message);
      const ids = [...new Set((groupMembers.data||[]).map(x=>x.membership_id))];
      if (!ids.length) { document.getElementById('wf-roster').innerHTML=empty('No active student memberships are enrolled in this class.'); return; }
      const [members, existing] = await Promise.all([
        client.from('institution_memberships').select('id,user_id,invited_email,role,status').eq('institution_id',m.institution_id).in('id',ids).limit(500),
        client.from('attendance_records').select('id,student_membership_id,attendance_status,notes').eq('institution_id',m.institution_id).eq('session_id',sessionId).limit(500)
      ]);
      if (members.error) return setMessage('error','Could not load membership details: '+members.error.message);
      if (existing.error) return setMessage('error','Could not load existing attendance: '+existing.error.message);
      const userIds = [...new Set((members.data||[]).map(x=>x.user_id).filter(Boolean))];
      const profiles = userIds.length ? await client.from('profiles').select('id,full_name').in('id',userIds).limit(500) : {data:[],error:null};
      if (profiles.error) return setMessage('error','Could not load student names: '+profiles.error.message);
      const names = new Map((profiles.data||[]).map(p=>[p.id,p.full_name]));
      const byMembership = new Map((existing.data||[]).map(a=>[a.student_membership_id,a]));
      const roster = (members.data||[]).map(st=>({id:st.id,name:names.get(st.user_id)||st.invited_email||'Student',attendance:byMembership.get(st.id)||null}));
      const rosterHtml = roster.map(st=>'<tr data-student="'+esc(st.id)+'"><td>'+esc(st.name)+'</td><td><select class="wf-status" aria-label="Attendance status for '+esc(st.name)+'"><option value="present" '+(st.attendance&&st.attendance.attendance_status==='present'?'selected':'')+'>Present</option><option value="absent" '+(st.attendance&&st.attendance.attendance_status==='absent'?'selected':'')+'>Absent</option><option value="late" '+(st.attendance&&st.attendance.attendance_status==='late'?'selected':'')+'>Late</option><option value="leave" '+(st.attendance&&st.attendance.attendance_status==='leave'?'selected':'')+'>Leave</option></select></td><td><input class="wf-note" maxlength="300" aria-label="Note for '+esc(st.name)+'" placeholder="Optional note" value="'+esc(st.attendance&&st.attendance.notes||'')+'"></td><td>'+(st.attendance?'Previously marked':'Not marked')+'</td></tr>').join('');
      document.getElementById('wf-roster').innerHTML='<div class="table-wrap"><table class="wf-table"><thead><tr><th>Student</th><th>Status</th><th>Note</th><th>Record</th></tr></thead><tbody>'+rosterHtml+'</tbody></table></div><div class="wf-toolbar"><button class="primary" id="wf-save-attendance" type="button">Save attendance</button><span class="wf-subtitle">Corrections update the existing record; the current user is stored as marker.</span></div>';
      document.getElementById('wf-save-attendance').onclick = async () => {
        const button = document.getElementById('wf-save-attendance'); button.disabled = true; button.textContent='Saving…';
        try {
          const rows = [...document.querySelectorAll('#wf-roster tr[data-student]')];
          for (const row of rows) {
            const studentId = row.dataset.student;
            const status = row.querySelector('.wf-status').value;
            const notes = row.querySelector('.wf-note').value.trim() || null;
            const prior = byMembership.get(studentId);
            const payload = {institution_id:m.institution_id,session_id:sessionId,student_membership_id:studentId,attendance_status:status,marked_by:currentUser().id,marked_at:new Date().toISOString(),notes};
            const result = prior
              ? await client.from('attendance_records').update({attendance_status:status,marked_by:currentUser().id,marked_at:new Date().toISOString(),notes}).eq('id',prior.id).eq('institution_id',m.institution_id).select('id').maybeSingle()
              : await client.from('attendance_records').insert(payload).select('id').maybeSingle();
            if (result.error) throw new Error(result.error.message);
          }
          setMessage('success','Attendance saved. Existing records were corrected in place; the schema does not currently provide a separate immutable correction log.');
          await renderAttendance(content);
        } catch (err) { setMessage('error','Attendance save stopped: '+(err.message||'unknown error')+'. Review the roster before retrying.'); }
        finally { const b=document.getElementById('wf-save-attendance'); if(b){b.disabled=false;b.textContent='Save attendance';} }
      };
    };
  }
  async function renderDirectory(content) {
    if (!manager()) { content.innerHTML = empty('Student and staff directory access is reserved for institution administrators.'); return; }
    const m = currentMembership();
    const r = await client.from('institution_memberships').select('id,user_id,invited_email,role,status,joined_at,created_at').eq('institution_id',m.institution_id).order('created_at',{ascending:false}).limit(200);
    if (r.error) throw r.error;
    const userIds = [...new Set((r.data||[]).map(x=>x.user_id).filter(Boolean))];
    const p = userIds.length ? await client.from('profiles').select('id,full_name').in('id',userIds).limit(200) : {data:[],error:null};
    if (p.error) throw p.error;
    const names = new Map((p.data||[]).map(x=>[x.id,x.full_name]));
    const rows = (r.data||[]).map(x=>'<tr><td>'+esc(names.get(x.user_id)||x.invited_email||'Pending member')+'</td><td>'+esc(x.role)+'</td><td>'+esc(x.status)+'</td><td>'+esc(fmt(x.joined_at))+'</td></tr>').join('');
    content.innerHTML = '<p class="wf-subtitle">Read-only directory. Secure invitations and role changes are not enabled in this release; do not change roles through client-side shortcuts.</p>' + (rows?'<div class="table-wrap"><table class="wf-table"><thead><tr><th>Name / email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('No membership records found.'));
  }
  async function renderAcademicYears(content) {
    if (!manager()) { content.innerHTML = empty('Academic-year setup is reserved for institution administrators.'); return; }
    const m = currentMembership();
    const r = await client.from('academic_years').select('id,label,start_date,end_date,is_current').eq('institution_id',m.institution_id).order('start_date',{ascending:false}).limit(100);
    if (r.error) throw r.error;
    const formHtml = `<form id="wf-year-form" class="wf-toolbar"><div class="wf-field"><label for="wf-year-label">Academic year label</label><input id="wf-year-label" required maxlength="80" placeholder="2026–2027"></div><div class="wf-field"><label for="wf-year-start">Start date</label><input id="wf-year-start" type="date" required></div><div class="wf-field"><label for="wf-year-end">End date</label><input id="wf-year-end" type="date" required></div><label><input id="wf-year-current" type="checkbox" style="width:auto"> Current year</label><button class="primary" type="submit">Add academic year</button></form>`;
    const rows = (r.data||[]).map(y=>'<tr><td>'+esc(y.label)+'</td><td>'+esc(y.start_date)+'</td><td>'+esc(y.end_date)+'</td><td>'+ (y.is_current?'<span class="pill">Current</span>':'—')+'</td></tr>').join('');
    content.innerHTML = formHtml + (rows?'<div class="table-wrap"><table class="wf-table"><thead><tr><th>Academic year</th><th>Starts</th><th>Ends</th><th>State</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('No academic years configured yet.'));
    document.getElementById('wf-year-form').addEventListener('submit',async e=>{
      e.preventDefault(); clearMessage();
      const label=document.getElementById('wf-year-label').value.trim(),start=document.getElementById('wf-year-start').value,end=document.getElementById('wf-year-end').value,current=document.getElementById('wf-year-current').checked;
      if (!label || !start || !end || end <= start) return setMessage('error','Enter a label and a valid date range where the end date follows the start date.');
      if (current) {
        const u=await client.from('academic_years').update({is_current:false}).eq('institution_id',m.institution_id).eq('is_current',true);
        if (u.error) return setMessage('error','Could not clear the previous current year: '+u.error.message);
      }
      const result=await client.from('academic_years').insert({institution_id:m.institution_id,label,start_date:start,end_date:end,is_current:current}).select('id').maybeSingle();
      if(result.error) return setMessage('error','Academic year was not saved: '+result.error.message);
      setMessage('success','Academic year saved.');
      await renderAcademicYears(content);
    });
  }
  // Replace navigation buttons to remove preview-only listeners and route real workflows.
  document.querySelectorAll('[data-view]').forEach(old => {
    const button = old.cloneNode(true);
    old.replaceWith(button);
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===button.dataset.view));
      show(button.dataset.view);
    });
  });
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.addEventListener('click', () => show(button.dataset.nav));
  });
  window.addEventListener('noor:session-ready', () => { if(activeView!=='Dashboard') show(activeView); });
  if (currentUser()) window.dispatchEvent(new CustomEvent('noor:session-ready'));
  // Existing auth layer initializes before this module. Render a safe signed-out state until session is ready.
  document.addEventListener('DOMContentLoaded', () => {});
  window.noorAcademicWorkflows = { show, reload: () => loadView(activeView) };
})();
