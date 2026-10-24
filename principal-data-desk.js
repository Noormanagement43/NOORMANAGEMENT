/* Principal Data Desk — live, school-scoped directory and attendance drill-down.
   Read-only by design. Mutations stay in existing authorized management screens. */
(() => {
  'use strict';
  const app = () => window.NOOR_AI_APP || {};
  const view = () => document.getElementById('view-principal-studio');
  const host = () => view() && view().querySelector('#noor-principal');
  const schoolId = () => app().schoolId || null;
  const PAGE_SIZE = 25;
  let mode = 'students', page = 0, search = '', date = '', attendanceStatus = 'all';
  let pending = false, queued = false, totalPages = 1, searchTimer = null;

  const allowed = () => {
    const p = app().profile;
    return !!app().db && !!app().user?.id && !!schoolId() &&
      ['owner', 'principal'].includes(p?.role) && p?.status === 'active' &&
      p?.school_id === schoolId() && app().school?.verification_status === 'verified' &&
      app().school?.account_status === 'active' && app().school?.is_active === true;
  };

  function localDay(timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(item => item.type === type)?.value || '';
    return get('year') + '-' + get('month') + '-' + get('day');
  }

  function addStyle() {
    if (document.getElementById('pd-data-desk-style')) return;
    const css = document.createElement('style');
    css.id = 'pd-data-desk-style';
    css.textContent = '#pd-data-desk{margin:16px 0 0;padding:18px;border:1px solid var(--p-line,#f0dfe6);border-radius:18px;background:var(--p-card,#fff);color:var(--p-ink,#34232d)}' +
      '#pd-data-desk *{box-sizing:border-box}#pd-data-desk .pdd-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}' +
      '#pd-data-desk h2{font:800 16px/1.25 Manrope,system-ui,sans-serif;margin:0 0 5px}#pd-data-desk p{margin:0;color:var(--p-muted,#897680);font-size:11px;line-height:1.5}' +
      '#pd-data-desk button,#pd-data-desk input,#pd-data-desk select{font:inherit}#pd-data-desk .pdd-btn{border:1px solid var(--p-line,#f0dfe6);border-radius:10px;padding:9px 12px;background:var(--p-card,#fff);color:var(--p-berry,#642b47);font-weight:750;cursor:pointer}' +
      '#pd-data-desk .pdd-btn:focus-visible,#pd-data-desk input:focus-visible,#pd-data-desk select:focus-visible{outline:3px solid #d7a2ba;outline-offset:2px}' +
      '#pd-data-desk .pdd-btn.primary,#pd-data-desk .pdd-tabs button[aria-pressed=true]{background:var(--p-berry,#642b47);color:#fff;border-color:var(--p-berry,#642b47)}' +
      '#pd-data-desk .pdd-tabs,#pd-data-desk .pdd-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:12px 0}' +
      '#pd-data-desk .pdd-toolbar input,#pd-data-desk .pdd-toolbar select{min-height:38px;max-width:100%;border:1px solid var(--p-line,#f0dfe6);border-radius:10px;padding:8px 10px;background:var(--p-card,#fff);color:inherit}' +
      '#pd-data-desk .pdd-toolbar input[type=search]{flex:1;min-width:180px}#pd-data-desk .pdd-status{min-height:20px;margin:7px 0 10px;font-size:11px}#pd-data-desk .pdd-status[data-kind=error]{color:#b42335}' +
      '#pd-data-desk .pdd-status[data-kind=success]{color:#18794e}#pd-data-desk .pdd-table-wrap{overflow:auto;border:1px solid var(--p-line,#f0dfe6);border-radius:12px}' +
      '#pd-data-desk table{border-collapse:collapse;width:100%;min-width:540px}#pd-data-desk th,#pd-data-desk td{padding:11px 10px;border-bottom:1px solid var(--p-line,#f0dfe6);font-size:11px;text-align:left;vertical-align:top}' +
      '#pd-data-desk th{background:color-mix(in srgb,var(--p-card,#fff) 94%,var(--p-berry,#642b47));font-size:9px;text-transform:uppercase;letter-spacing:.45px;color:var(--p-muted,#897680)}#pd-data-desk tr:last-child td{border-bottom:0}' +
      '#pd-data-desk .pdd-empty{padding:22px;text-align:center;color:var(--p-muted,#897680)}#pd-data-desk .pdd-paging{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}' +
      '#pd-data-desk .pdd-paging span,#pd-data-desk .pdd-note{font-size:10px;color:var(--p-muted,#897680)}#pd-data-desk .pdd-pill{display:inline-flex;padding:3px 7px;border-radius:20px;background:#f4edf1;color:#642b47;font-size:10px;text-transform:capitalize}' +
      '@media(max-width:560px){#pd-data-desk{padding:13px}#pd-data-desk .pdd-toolbar input[type=search]{min-width:100%}}@media(prefers-reduced-motion:reduce){#pd-data-desk *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}';
    document.head.appendChild(css);
  }

  function mount() {
    const v = view(), h = host();
    if (!v || !h || !v.classList.contains('active') || !allowed()) return;
    addStyle();
    const key = app().user.id + ':' + schoolId();
    let panel = h.querySelector('#pd-data-desk');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'pd-data-desk';
      panel.setAttribute('aria-labelledby', 'pdd-title');
      panel.innerHTML = '<header class="pdd-head"><div><h2 id="pdd-title">Institutional Records</h2><p>Live, school-scoped data. No demo records are inserted. Directory and attendance views are read-only.</p></div><div class="pdd-toolbar"><button class="pdd-btn" type="button" data-pdd-refresh>Refresh</button><button class="pdd-btn primary" type="button" data-pdd-manage>Open management</button></div></header>' +
        '<nav class="pdd-tabs" aria-label="Institutional records views"><button type="button" class="pdd-btn" data-pdd-mode="students" aria-pressed="true">Students</button><button type="button" class="pdd-btn" data-pdd-mode="staff" aria-pressed="false">Teachers &amp; Staff</button><button type="button" class="pdd-btn" data-pdd-mode="classes" aria-pressed="false">Classes &amp; Sections</button><button type="button" class="pdd-btn" data-pdd-mode="attendance" aria-pressed="false">Attendance Register</button></nav>' +
        '<form class="pdd-toolbar" id="pdd-filter-form"><input type="search" id="pdd-search" maxlength="120" autocomplete="off" placeholder="Search by name" aria-label="Search records"><input type="date" id="pdd-date" aria-label="Attendance date" hidden><select id="pdd-attendance-status" aria-label="Attendance status" hidden><option value="all">All statuses</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="leave">Leave</option></select><button class="pdd-btn primary" type="submit">Apply filters</button></form>' +
        '<p class="pdd-status" id="pdd-status" role="status" aria-live="polite">Choose a records view to load live data.</p><div class="pdd-table-wrap"><table><thead id="pdd-thead"></thead><tbody id="pdd-tbody"><tr><td class="pdd-empty" colspan="5">No records loaded yet.</td></tr></tbody></table></div>' +
        '<div class="pdd-paging"><span id="pdd-page-label">—</span><div><button type="button" class="pdd-btn" data-pdd-page="-1" disabled>Previous</button> <button type="button" class="pdd-btn" data-pdd-page="1" disabled>Next</button></div></div>' +
        '<p class="pdd-note">Row-Level Security remains the security boundary. A denied query is shown as an error; this panel never bypasses database permissions.</p>';
      h.appendChild(panel);
      panel.addEventListener('click', onClick);
      panel.querySelector('#pdd-filter-form').addEventListener('submit', onFilterSubmit);
      panel.querySelector('#pdd-search').addEventListener('input', () => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const field = host()?.querySelector('#pdd-search');
          if (!field) return;
          search = field.value.trim();
          page = 0;
          if (mode !== 'attendance') loadCurrent();
        }, 400);
      });
      panel.querySelector('#pdd-date').addEventListener('change', onFilterSubmit);
      panel.querySelector('#pdd-attendance-status').addEventListener('change', onFilterSubmit);
    }
    if (panel.dataset.identity !== key) {
      panel.dataset.identity = key;
      page = 0;
      search = '';
      panel.querySelector('#pdd-search').value = '';
      panel.querySelector('#pdd-date').value = localDay(app().school?.timezone);
      panel.querySelector('#pdd-attendance-status').value = 'all';
      date = panel.querySelector('#pdd-date').value;
      loadCurrent();
    }
  }

  function setStatus(message, kind) {
    const el = host()?.querySelector('#pdd-status');
    if (!el) return;
    el.textContent = message;
    el.dataset.kind = kind || '';
  }

  function explainError(error) {
    const code = error?.code || '';
    if (code === '42501' || code === 'PGRST301' || /permission|row-level|policy|not allowed|unauthor/i.test(error?.message || '')) {
      return 'Access was denied by the database policy for this account. No permissions were bypassed.';
    }
    if (/fetch|network|timeout|offline/i.test(error?.message || '')) return 'The data service could not be reached. Check the connection and try again.';
    return 'Records could not be loaded. Confirm that this account has access to the configured school data tables.';
  }

  function buildTable(headers) {
    const panel = host()?.querySelector('#pd-data-desk');
    if (!panel) return;
    const thead = panel.querySelector('#pdd-thead');
    thead.replaceChildren();
    const row = document.createElement('tr');
    headers.forEach(label => {
      const th = document.createElement('th');
      th.scope = 'col'; th.textContent = label; row.appendChild(th);
    });
    thead.appendChild(row);
    panel.querySelector('#pdd-tbody').replaceChildren();
  }

  function addRow(values) {
    const body = host()?.querySelector('#pd-data-desk #pdd-tbody');
    if (!body) return;
    const row = document.createElement('tr');
    values.forEach(value => {
      const cell = document.createElement('td');
      if (value && typeof value === 'object' && value.pill) {
        const badge = document.createElement('span');
        badge.className = 'pdd-pill'; badge.textContent = String(value.text ?? ''); cell.appendChild(badge);
      } else cell.textContent = String(value ?? '—');
      row.appendChild(cell);
    });
    body.appendChild(row);
  }

  function emptyRows(message, count) {
    const body = host()?.querySelector('#pd-data-desk #pdd-tbody');
    if (!body) return;
    const row = document.createElement('tr'), cell = document.createElement('td');
    cell.className = 'pdd-empty'; cell.colSpan = count; cell.textContent = message;
    row.appendChild(cell); body.replaceChildren(row);
  }

  function updatePager(total) {
    const panel = host()?.querySelector('#pd-data-desk');
    if (!panel) return;
    totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
    panel.querySelector('#pdd-page-label').textContent = total
      ? 'Page ' + (page + 1) + ' of ' + totalPages + ' · ' + Number(total).toLocaleString() + ' records'
      : '0 records';
    const previous = panel.querySelector('[data-pdd-page="-1"]');
    const next = panel.querySelector('[data-pdd-page="1"]');
    if (previous) previous.disabled = page <= 0 || pending;
    if (next) next.disabled = page + 1 >= totalPages || pending;
  }

  function updateControls() {
    const panel = host()?.querySelector('#pd-data-desk');
    if (!panel) return;
    const attendance = mode === 'attendance';
    panel.querySelector('#pdd-date').hidden = !attendance;
    panel.querySelector('#pdd-attendance-status').hidden = !attendance;
    panel.querySelector('#pdd-search').placeholder = attendance ? 'Search student name' : mode === 'classes' ? 'Search class name' : 'Search by name';
    panel.querySelectorAll('[data-pdd-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pddMode === mode)));
  }

  function onClick(event) {
    const panel = host()?.querySelector('#pd-data-desk');
    const target = event.target.closest('button');
    if (!panel || !target || !panel.contains(target)) return;
    if (target.matches('[data-pdd-mode]')) {
      mode = target.dataset.pddMode; page = 0; search = panel.querySelector('#pdd-search').value.trim();
      updateControls(); loadCurrent(); return;
    }
    if (target.matches('[data-pdd-page]')) { page = Math.max(0, page + Number(target.dataset.pddPage)); loadCurrent(); return; }
    if (target.matches('[data-pdd-refresh]')) { loadCurrent(); return; }
    if (target.matches('[data-pdd-manage]')) {
      const routes = {students:'student-directory',staff:'staff-management',classes:'classes',attendance:'attendance'};
      app().openView?.(routes[mode] || 'overview');
    }
  }

  function onFilterSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    const panel = host()?.querySelector('#pd-data-desk');
    if (!panel) return;
    search = panel.querySelector('#pdd-search').value.trim();
    date = panel.querySelector('#pdd-date').value || localDay(app().school?.timezone);
    attendanceStatus = panel.querySelector('#pdd-attendance-status').value || 'all';
    page = 0; loadCurrent();
  }

  async function selectDirectory(kind, sid, term, pageNumber) {
    let query = app().db.from('profiles').select('id,full_name,class_id,section_id,role,status', {count:'exact'})
      .eq('school_id', sid).eq('status', 'active');
    query = kind === 'students' ? query.eq('role', 'student') : query.in('role', ['teacher', 'staff']);
    if (term) query = query.ilike('full_name', '%' + term + '%');
    const result = await query.order('full_name', {ascending:true}).range(pageNumber * PAGE_SIZE, pageNumber * PAGE_SIZE + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    return {rows:result.data || [], total:result.count || 0};
  }

  async function selectClasses(sid, term, pageNumber) {
    let query = app().db.from('classes').select('id,name,sort_order', {count:'exact'})
      .eq('school_id', sid).eq('is_active', true);
    if (term) query = query.ilike('name', '%' + term + '%');
    const result = await query.order('sort_order', {ascending:true}).order('name', {ascending:true})
      .range(pageNumber * PAGE_SIZE, pageNumber * PAGE_SIZE + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const classes = result.data || [], ids = classes.map(item => item.id).filter(Boolean);
    let sections = [];
    if (ids.length) {
      const related = await app().db.from('sections').select('id,name,class_id').eq('is_active', true).in('class_id', ids).order('name');
      if (related.error) throw related.error;
      sections = related.data || [];
    }
    return {rows:classes.map(item => Object.assign({}, item, {sections:sections.filter(section => section.class_id === item.id)})), total:result.count || 0};
  }

  async function fetchAll(makeQuery, maxRows) {
    const batch = 500, limit = maxRows || 5000, data = [];
    for (let start = 0; start < limit; start += batch) {
      const result = await makeQuery().range(start, Math.min(start + batch - 1, limit - 1));
      if (result.error) return {data, error:result.error, truncated:false};
      const rows = result.data || [];
      data.push(...rows);
      if (rows.length < batch) return {data, error:null, truncated:false};
    }
    return {data, error:null, truncated:true};
  }

  async function selectAttendance(sid, day, state, term, pageNumber) {
    const sessionsResult = await fetchAll(() => app().db.from('attendance_sessions')
      .select('id,class_id,section_id,attendance_date,status').eq('school_id', sid)
      .eq('attendance_date', day).eq('status', 'submitted').order('id'), 5000);
    if (sessionsResult.error) throw sessionsResult.error;
    const sessions = sessionsResult.data || [], sessionIds = sessions.map(item => item.id).filter(Boolean);
    if (!sessionIds.length) return {rows:[], total:0, note:sessionsResult.truncated ? 'Session list exceeded the safe limit.' : 'No attendance sessions have been submitted for this date.'};

    let studentIds = null;
    if (term) {
      const matchingStudents = await fetchAll(() => app().db.from('profiles').select('id')
        .eq('school_id', sid).eq('role', 'student').ilike('full_name', '%' + term + '%').order('id'), 5000);
      if (matchingStudents.error) throw matchingStudents.error;
      studentIds = matchingStudents.data.map(student => student.id);
      if (!studentIds.length) return {rows:[], total:0};
      if (matchingStudents.truncated) return {rows:[], total:0, note:'The name search matched more than the safe query limit. Add more characters and retry.'};
    }

    let query = app().db.from('attendance_records').select('id,session_id,student_id,status,marked_at,updated_at', {count:'exact'})
      .eq('school_id', sid).in('session_id', sessionIds);
    if (state !== 'all') query = query.eq('status', state);
    if (studentIds) query = query.in('student_id', studentIds);
    const result = await query.order('marked_at', {ascending:false}).range(pageNumber * PAGE_SIZE, pageNumber * PAGE_SIZE + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const records = result.data || [];
    const profileIds = [...new Set(records.map(item => item.student_id).filter(Boolean))];
    const classIds = [...new Set(sessions.map(item => item.class_id).filter(Boolean))];
    const sectionIds = [...new Set(sessions.map(item => item.section_id).filter(Boolean))];
    let profiles = [], classes = [], sections = [];
    if (profileIds.length) {
      const r = await app().db.from('profiles').select('id,full_name,class_id,section_id').eq('school_id', sid).in('id', profileIds);
      if (r.error) throw r.error; profiles = r.data || [];
    }
    if (classIds.length) {
      const r = await app().db.from('classes').select('id,name').eq('school_id', sid).in('id', classIds);
      if (r.error) throw r.error; classes = r.data || [];
    }
    if (sectionIds.length) {
      const r = await app().db.from('sections').select('id,name').in('id', sectionIds);
      if (r.error) throw r.error; sections = r.data || [];
    }
    const profileById = new Map(profiles.map(item => [item.id, item]));
    const classById = new Map(classes.map(item => [item.id, item.name]));
    const sectionById = new Map(sections.map(item => [item.id, item.name]));
    const sessionById = new Map(sessions.map(item => [item.id, item]));
    return {rows:records.map(record => {
      const profile = profileById.get(record.student_id) || {}, session = sessionById.get(record.session_id) || {};
      return {student:profile.full_name || 'Student name unavailable', className:classById.get(session.class_id) || 'Class unavailable',
        sectionName:sectionById.get(session.section_id) || 'Section unavailable', status:record.status || 'unmarked',
        markedAt:record.marked_at || record.updated_at || ''};
    }), total:result.count || 0};
  }

  async function resolveClassLabels(sid, classIds, sectionIds) {
    const classes = new Map(), sections = new Map();
    if (classIds.length) {
      const result = await app().db.from('classes').select('id,name').eq('school_id', sid).in('id', classIds);
      if (result.error) throw result.error;
      (result.data || []).forEach(item => classes.set(item.id, item.name));
    }
    if (sectionIds.length) {
      const result = await app().db.from('sections').select('id,name,class_id').in('id', sectionIds);
      if (result.error) throw result.error;
      (result.data || []).forEach(item => sections.set(item.id, item.name));
    }
    return {classes, sections};
  }

  function formattedDate(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, {dateStyle:'medium', timeStyle:'short'}).format(parsed);
  }

  async function loadCurrent() {
    const panel = host()?.querySelector('#pd-data-desk');
    if (!panel || !allowed()) return;
    if (pending) {queued = true; return;}
    const key = app().user.id + ':' + schoolId();
    if (panel.dataset.identity !== key) return;
    pending = true;
    const sid = schoolId(), uid = app().user.id;
    panel.querySelector('[data-pdd-refresh]').disabled = true;
    panel.querySelectorAll('[data-pdd-page]').forEach(button => button.disabled = true);
    updateControls();
    setStatus('Loading live school records…');
    try {
      let result;
      if (mode === 'students' || mode === 'staff') {
        const data = await selectDirectory(mode, sid, search, page);
        if (app().user?.id !== uid || schoolId() !== sid || !allowed() || panel.dataset.identity !== key) return;
        result = {rows:data.rows, total:data.total};
        buildTable(mode === 'students' ? ['Student','Class','Section','Status'] : ['Name','Role','Status']);
        if (result.rows.length) {
          const classIds = [...new Set(result.rows.map(item => item.class_id).filter(Boolean))];
          const sectionIds = [...new Set(result.rows.map(item => item.section_id).filter(Boolean))];
          const labels = await resolveClassLabels(sid, classIds, sectionIds);
          if (app().user?.id !== uid || schoolId() !== sid || !allowed() || panel.dataset.identity !== key) return;
          result.rows.forEach(item => {
            if (item.role === 'student') addRow([item.full_name || 'Name not provided', labels.classes.get(item.class_id) || 'Not assigned', labels.sections.get(item.section_id) || 'Not assigned', {pill:true,text:item.status}]);
            else addRow([item.full_name || 'Name not provided', item.role, {pill:true,text:item.status}]);
          });
        } else emptyRows(mode === 'students' ? 'No active student records match this search.' : 'No active teacher or staff records match this search.', mode === 'students' ? 4 : 3);
        setStatus(Number(result.total).toLocaleString() + ' active ' + (mode === 'students' ? 'students' : 'teachers and staff') + (search ? ' match this search.' : '.'), 'success');
        updatePager(result.total);
      } else if (mode === 'classes') {
        result = await selectClasses(sid, search, page);
        if (app().user?.id !== uid || schoolId() !== sid || !allowed() || panel.dataset.identity !== key) return;
        buildTable(['Class / Group','Sections','Active section count','Status']);
        if (result.rows.length) result.rows.forEach(item => addRow([item.name || 'Unnamed class', item.sections.map(section => section.name).join(', ') || 'No active sections', item.sections.length, {pill:true,text:'active'}]));
        else emptyRows('No active classes or sections match this search.', 4);
        setStatus(Number(result.total).toLocaleString() + ' active classes/groups' + (search ? ' match this search.' : '.'), 'success');
        updatePager(result.total);
      } else {
        date = panel.querySelector('#pdd-date').value || localDay(app().school?.timezone);
        attendanceStatus = panel.querySelector('#pdd-attendance-status').value || 'all';
        result = await selectAttendance(sid, date, attendanceStatus, search, page);
        if (app().user?.id !== uid || schoolId() !== sid || !allowed() || panel.dataset.identity !== key) return;
        buildTable(['Student','Class','Section','Status','Marked at']);
        if (result.rows.length) result.rows.forEach(item => addRow([item.student, item.className, item.sectionName, {pill:true,text:item.status}, formattedDate(item.markedAt)]));
        else emptyRows(result.note || 'No attendance records match these filters.', 5);
        setStatus(Number(result.total).toLocaleString() + ' attendance records for ' + date + (attendanceStatus === 'all' ? '' : ' · ' + attendanceStatus) +
          (search ? ' · filtered by student name' : '') + (result.note ? ' · ' + result.note : '') + '.', result.note ? '' : 'success');
        updatePager(result.total);
      }
    } catch (error) {
      buildTable(['Records']); emptyRows(explainError(error), 1);
      setStatus(explainError(error), 'error'); updatePager(0);
    } finally {
      pending = false;
      if (panel.isConnected) {
        panel.querySelector('[data-pdd-refresh]').disabled = false;
        const previous = panel.querySelector('[data-pdd-page="-1"]'), next = panel.querySelector('[data-pdd-page="1"]');
        if (previous) previous.disabled = page <= 0;
        if (next) next.disabled = page + 1 >= totalPages;
      }
      if (queued) { queued = false; loadCurrent(); }
    }
  }

  function removeIfUnauthorized() {
    if (allowed()) return false;
    const panel = host()?.querySelector('#pd-data-desk');
    if (panel) panel.remove();
    return true;
  }

  function ensure() {
    if (removeIfUnauthorized()) return;
    if (!view()?.classList.contains('active')) return;
    mount();
  }

  const observer = new MutationObserver(ensure);
  function start() {
    if (document.body) observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
    ensure();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
  window.addEventListener('noor:workspace-ready', ensure);
  window.NOOR_PRINCIPAL_DATA_DESK = {refresh:loadCurrent, allowed};
})();
