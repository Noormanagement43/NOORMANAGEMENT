/* NOOR Teacher Dashboard — real, institution-scoped data through teacher-academic-data Edge Function. */
(function () {
  'use strict';

  const api = () => window.noorApp;
  const state = { view: 'Dashboard', root: null, data: null, groups: [], sessions: [], students: [], attendance: [], busy: false, timezone: 'UTC' };
  const statuses = ['present', 'absent', 'late', 'leave'];
  const statusLabels = { present: 'Present', absent: 'Absent', late: 'Late', leave: 'Leave' };
  const $ = (selector, scope) => (scope || state.root || document).querySelector(selector);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const dateInputValue = timezone => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = key => parts.find(item => item.type === key)?.value || '';
    return part('year') + '-' + part('month') + '-' + part('day');
  };
  const addDays = (value, amount) => {
    const parts = value.split('-').map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + amount));
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  };
  const formatDate = value => {
    if (!value) return 'Not recorded';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: state.timezone }).format(d);
  };
  const formatTime = value => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: state.timezone }).format(d);
  };
  const formatDateTime = value => value ? formatDate(value) + ' · ' + formatTime(value) : '—';
  const currentContext = () => {
    const a = api();
    const member = a?.getMembership?.();
    const user = a?.getCurrentUser?.();
    return a && a.client && member && user && ['teacher', 'faculty'].includes(member.role) && member.status === 'active'
      ? { app: a, client: a.client, member, user } : null;
  };
  const showToast = (message, type) => api()?.toast?.(message, type || 'success');

  function installStyles() {
    if (document.getElementById('noor-teacher-dashboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'noor-teacher-dashboard-styles';
    style.textContent =
      '#noor-teacher-workspace{--td-wine:#641c35;--td-wine2:#842b49;--td-cream:#fbf8f3;--td-paper:#fff;--td-rose:#f4e7eb;--td-ink:#29242a;--td-muted:#827982;--td-line:#eee5e7;--td-green:#247a59;--td-gold:#bd8a35;color:var(--td-ink);background:var(--td-cream);border:1px solid var(--td-line);border-radius:20px;padding:clamp(15px,2.3vw,27px);margin:4px 0 24px;min-width:0}' +
      '#noor-teacher-workspace[hidden]{display:none!important}#noor-teacher-workspace *{box-sizing:border-box}#noor-teacher-workspace button,#noor-teacher-workspace input,#noor-teacher-workspace select,#noor-teacher-workspace textarea{font:inherit}#noor-teacher-workspace button{cursor:pointer}#noor-teacher-workspace button:disabled{opacity:.55;cursor:not-allowed}#noor-teacher-workspace :focus-visible{outline:3px solid var(--td-gold);outline-offset:3px}' +
      '#noor-teacher-workspace[data-theme=dark]{--td-cream:#1b1519;--td-paper:#251d23;--td-rose:#3c2932;--td-ink:#f5edf0;--td-muted:#c2adb6;--td-line:#493540;--td-green:#8ed4af;--td-gold:#e7bf73;color:var(--td-ink)}' +
      '#noor-teacher-workspace .td-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:19px}#noor-teacher-workspace .td-kicker{font-size:10px;letter-spacing:1.7px;text-transform:uppercase;font-weight:850;color:var(--td-wine2)}#noor-teacher-workspace[data-theme=dark] .td-kicker{color:#e2aebe}#noor-teacher-workspace .td-title{margin:5px 0;font-size:clamp(22px,3vw,30px);letter-spacing:-.9px;color:var(--td-wine);line-height:1.2}#noor-teacher-workspace[data-theme=dark] .td-title{color:#f1c4d2}#noor-teacher-workspace .td-muted{color:var(--td-muted);font-size:12px;line-height:1.65;margin:4px 0}#noor-teacher-workspace .td-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#noor-teacher-workspace .td-btn{border:1px solid var(--td-line);background:var(--td-paper);color:var(--td-wine);border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800}#noor-teacher-workspace[data-theme=dark] .td-btn{color:#f0ccd8}#noor-teacher-workspace .td-btn.primary{background:var(--td-wine);color:#fff;border-color:var(--td-wine)}#noor-teacher-workspace .td-btn.soft{background:var(--td-rose);border-color:transparent}#noor-teacher-workspace .td-btn:focus-visible{outline-offset:2px}' +
      '#noor-teacher-workspace .td-profile{display:grid;grid-template-columns:86px minmax(0,1fr);gap:17px;align-items:center;background:linear-gradient(115deg,var(--td-paper),var(--td-rose));border:1px solid var(--td-line);border-radius:16px;padding:18px;margin-bottom:16px}#noor-teacher-workspace .td-avatar{width:78px;height:78px;border:2px solid var(--td-paper);border-radius:22px;background:var(--td-rose);color:var(--td-wine);font-size:23px;font-weight:900;display:grid;place-items:center;overflow:hidden}#noor-teacher-workspace .td-avatar img{width:100%;height:100%;object-fit:cover}#noor-teacher-workspace .td-profile h2{margin:3px 0;font-size:20px;color:var(--td-wine)}#noor-teacher-workspace[data-theme=dark] .td-profile h2{color:#f1c4d2}#noor-teacher-workspace .td-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}#noor-teacher-workspace .td-tag{display:inline-flex;border:1px solid var(--td-line);background:var(--td-paper);border-radius:20px;padding:5px 9px;font-size:10px;color:var(--td-muted)}' +
      '#noor-teacher-workspace .td-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin:15px 0}#noor-teacher-workspace .td-stat{padding:15px;border:1px solid var(--td-line);border-radius:14px;background:var(--td-paper);min-width:0}#noor-teacher-workspace .td-stat span{display:block;font-size:11px;color:var(--td-muted)}#noor-teacher-workspace .td-stat strong{display:block;font-size:27px;line-height:1.3;color:var(--td-wine);margin-top:8px;overflow-wrap:anywhere}#noor-teacher-workspace[data-theme=dark] .td-stat strong{color:#f1c4d2}#noor-teacher-workspace .td-stat small{font-size:10px;color:var(--td-muted)}' +
      '#noor-teacher-workspace .td-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.9fr);gap:14px;margin-top:14px}#noor-teacher-workspace .td-card{min-width:0;border:1px solid var(--td-line);border-radius:15px;background:var(--td-paper);padding:17px}#noor-teacher-workspace .td-card h2{font-size:15px;margin:0 0 6px;color:var(--td-wine)}#noor-teacher-workspace[data-theme=dark] .td-card h2{color:#f1c4d2}#noor-teacher-workspace .td-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:13px}#noor-teacher-workspace .td-list{display:grid;gap:8px}#noor-teacher-workspace .td-row{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid var(--td-line);border-radius:11px;padding:11px;min-width:0}#noor-teacher-workspace .td-row strong{display:block;font-size:12px;overflow-wrap:anywhere}#noor-teacher-workspace .td-row small{display:block;color:var(--td-muted);font-size:10px;margin-top:4px;line-height:1.5}#noor-teacher-workspace .td-row .td-row-side{color:var(--td-wine);font-size:11px;text-align:right;white-space:nowrap}#noor-teacher-workspace[data-theme=dark] .td-row .td-row-side{color:#e2aebe}' +
      '#noor-teacher-workspace .td-empty{padding:16px;border:1px dashed var(--td-line);border-radius:11px;color:var(--td-muted);font-size:12px;line-height:1.7}#noor-teacher-workspace .td-message{padding:10px 12px;margin:10px 0;border-radius:10px;font-size:12px;line-height:1.6}#noor-teacher-workspace .td-message[hidden]{display:none}#noor-teacher-workspace .td-message.error{background:#fae8eb;color:#94283e;border:1px solid #eec5ce}#noor-teacher-workspace .td-message.success{background:#e7f5ed;color:#226847;border:1px solid #c3e6d1}#noor-teacher-workspace .td-message.info{background:var(--td-rose);color:var(--td-ink);border:1px solid var(--td-line)}#noor-teacher-workspace .td-bar{display:grid;grid-template-columns:72px minmax(0,1fr) 28px;gap:9px;align-items:center;margin:11px 0;font-size:11px}#noor-teacher-workspace .td-track{height:9px;border-radius:10px;background:var(--td-rose);overflow:hidden}#noor-teacher-workspace .td-fill{height:100%;border-radius:10px;background:var(--td-wine);min-width:0}#noor-teacher-workspace .td-fill.absent{background:#b33d4c}#noor-teacher-workspace .td-fill.late{background:#bd8a35}#noor-teacher-workspace .td-fill.leave{background:#8b7a84}' +
      '#noor-teacher-workspace .td-toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:13px 0}#noor-teacher-workspace .td-field{display:grid;gap:5px;min-width:145px;flex:1}#noor-teacher-workspace .td-field label{font-size:11px;font-weight:800;color:var(--td-ink)}#noor-teacher-workspace .td-field select,#noor-teacher-workspace .td-field input,#noor-teacher-workspace .td-field textarea{width:100%;min-width:0;background:var(--td-paper);color:var(--td-ink);border:1px solid var(--td-line);border-radius:9px;padding:10px;font-size:12px}#noor-teacher-workspace .td-field textarea{min-height:64px;resize:vertical}#noor-teacher-workspace .td-table-wrap{width:100%;overflow:auto;border:1px solid var(--td-line);border-radius:11px}#noor-teacher-workspace .td-table{width:100%;border-collapse:collapse;font-size:12px;min-width:540px}#noor-teacher-workspace .td-table th,#noor-teacher-workspace .td-table td{padding:10px;text-align:left;border-bottom:1px solid var(--td-line);vertical-align:middle}#noor-teacher-workspace .td-table th{font-size:10px;color:var(--td-muted);text-transform:uppercase;letter-spacing:.6px;background:var(--td-rose)}#noor-teacher-workspace .td-table tr:last-child td{border-bottom:0}#noor-teacher-workspace .td-table select,#noor-teacher-workspace .td-table input{max-width:190px;width:100%;padding:8px;border:1px solid var(--td-line);border-radius:8px;background:var(--td-paper);color:var(--td-ink)}#noor-teacher-workspace .td-inline-note{font-size:11px;color:var(--td-muted);line-height:1.6;margin:9px 0}#noor-teacher-workspace .td-page-title{margin:6px 0 14px;font-size:22px;color:var(--td-wine)}#noor-teacher-workspace[data-theme=dark] .td-page-title{color:#f1c4d2}#noor-teacher-workspace .td-capability{border:1px solid var(--td-line);border-left:4px solid var(--td-gold);padding:12px;border-radius:10px;background:var(--td-paper);margin-top:10px;font-size:12px;color:var(--td-muted);line-height:1.7}#noor-teacher-workspace .td-nav-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}' +
      '@media(max-width:900px){#noor-teacher-workspace .td-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#noor-teacher-workspace .td-grid{grid-template-columns:1fr}}@media(max-width:540px){#noor-teacher-workspace{padding:12px;border-radius:14px}#noor-teacher-workspace .td-profile{grid-template-columns:1fr;justify-items:start;padding:14px}#noor-teacher-workspace .td-avatar{width:65px;height:65px;border-radius:17px}#noor-teacher-workspace .td-stats{gap:8px}#noor-teacher-workspace .td-stat{padding:12px}#noor-teacher-workspace .td-stat strong{font-size:22px}#noor-teacher-workspace .td-card{padding:13px}#noor-teacher-workspace .td-toolbar{display:grid;grid-template-columns:1fr;width:100%}#noor-teacher-workspace .td-field{min-width:0}}@media(prefers-reduced-motion:reduce){#noor-teacher-workspace *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}';
    document.head.appendChild(style);
  }

  function ensureRoot() {
    installStyles();
    if (state.root && state.root.isConnected) {
      state.root.hidden = false;
      return state.root;
    }
    const heading = document.querySelector('.heading');
    if (!heading) return null;
    const root = document.createElement('section');
    root.id = 'noor-teacher-workspace';
    root.className = 'td-root';
    root.setAttribute('aria-label', 'Live teacher dashboard');
    root.setAttribute('aria-live', 'polite');
    let theme = 'light';
    try { theme = localStorage.getItem('noor.teacher.dashboard.theme') || 'light'; } catch (_) {}
    root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    heading.insertAdjacentElement('afterend', root);
    state.root = root;
    const hideSelectors = ['.stats', '.health-panel', '.content-grid', '.lower'];
    hideSelectors.forEach(selector => document.querySelectorAll(selector).forEach(node => { node.hidden = true; }));
    const addClass = $('#add-class', document);
    const manageClasses = $('#manage-classes', document);
    if (addClass) addClass.hidden = true;
    if (manageClasses) manageClasses.hidden = true;
    const eyebrow = $('.heading .eyebrow', document);
    const title = $('.heading h1', document);
    const intro = $('.heading p', document);
    if (eyebrow) eyebrow.textContent = 'NOOR · TEACHER WORKSPACE';
    if (title) title.textContent = 'Teacher Dashboard';
    if (intro) intro.textContent = 'Your assigned classes, timetable and attendance — loaded from your institution records.';
    return root;
  }

  async function call(action, extra) {
    const context = currentContext();
    if (!context) throw new Error('An active teacher or faculty session is required.');
    const result = await context.client.functions.invoke('teacher-academic-data', {
      body: Object.assign({
        action,
        institution_id: context.member.institution_id,
        membership_id: context.member.id,
      }, extra || {}),
    });
    if (result.error) {
      let message = result.error.message || 'Teacher data service could not be reached.';
      try {
        const response = result.error.context;
        if (response && typeof response.json === 'function') {
          const details = await response.json();
          if (details && details.error) message = details.error;
        }
      } catch (_) {}
      if (/404|not found|failed to send|fetch/i.test(message)) {
        throw new Error('Secure teacher data service is not deployed or is unreachable. No mock data was shown.');
      }
      throw new Error(message);
    }
    if (result.data && result.data.error) throw new Error(result.data.error);
    if (!result.data) throw new Error('The teacher data service returned an empty response.');
    return result.data;
  }

  function setMessage(message, type) {
    const node = $('.td-message');
    if (!node) return;
    node.hidden = !message;
    node.className = 'td-message ' + (type || 'info');
    node.textContent = message || '';
  }
  function setNav(view) {
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === view || (view === 'Dashboard' && button.dataset.view === 'Dashboard');
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    const crumb = $('#crumb-view', document);
    if (crumb) crumb.textContent = view;
  }
  function loadShell(view, extraHeader) {
    const root = ensureRoot();
    if (!root) return false;
    state.view = view;
    setNav(view);
    root.innerHTML = '<div class="td-top"><div><span class="td-kicker">NOOR · LIVE TEACHER DATA</span><h2 class="td-title">' + esc(view) + '</h2><p class="td-muted">' + esc(extraHeader || 'Institution-scoped records from your authenticated teacher membership.') + '</p></div><div class="td-actions"><button type="button" class="td-btn soft" id="td-refresh">↻ Refresh data</button><button type="button" class="td-btn" id="td-theme" aria-pressed="' + (root.dataset.theme === 'dark') + '">' + (root.dataset.theme === 'dark' ? '☀ Light mode' : '☾ Dark mode') + '</button></div></div><div class="td-message" role="status" aria-live="polite" hidden></div><div id="td-content"><div class="td-empty">Loading authorized records from Supabase…</div></div>';
    $('#td-refresh').addEventListener('click', () => show(view));
    $('#td-theme').addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('noor.teacher.dashboard.theme', next); } catch (_) {}
      $('#td-theme').textContent = next === 'dark' ? '☀ Light mode' : '☾ Dark mode';
      $('#td-theme').setAttribute('aria-pressed', String(next === 'dark'));
    });
    return true;
  }

  function initials(name) {
    return String(name || 'Teacher').trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase() || 'T';
  }
  function safeImage(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '';
  }
  function statusCounts(records) {
    const result = { present: 0, absent: 0, late: 0, leave: 0 };
    (records || []).forEach(record => { if (Object.prototype.hasOwnProperty.call(result, record.attendance_status)) result[record.attendance_status] += 1; });
    return result;
  }
  function statusBars(counts) {
    const max = Math.max(1, ...statuses.map(status => counts[status] || 0));
    return statuses.map(status => {
      const value = counts[status] || 0;
      return '<div class="td-bar"><span>' + statusLabels[status] + '</span><div class="td-track"><div class="td-fill ' + status + '" style="width:' + Math.round(value / max * 100) + '%"></div></div><strong>' + value + '</strong></div>';
    }).join('');
  }
  function emptyBox(message) { return '<div class="td-empty">' + esc(message) + '</div>'; }
  function loadError(message) {
    const target = $('#td-content');
    if (target) target.innerHTML = emptyBox(message);
    setMessage(message, 'error');
  }
  function normalizeSession(session) {
    return {
      id: session.id,
      groupId: session.academic_group_id,
      title: session.subject_name || session.title || 'Scheduled session',
      className: session.class_name || state.groups.find(group => group.id === session.academic_group_id)?.name || 'Class',
      room: session.room_label || 'Room not assigned',
      start: session.starts_at,
      end: session.ends_at,
      status: session.session_status || 'scheduled',
    };
  }
  function profileCard(data) {
    const profile = data.profile || {};
    const member = data.membership || {};
    const inst = data.institution || {};
    const image = safeImage(profile.avatar_url);
    const joined = member.joined_at ? formatDate(member.joined_at) : 'Not recorded';
    const email = api()?.getCurrentUser?.()?.email || 'Email not available';
    return '<section class="td-profile"><div class="td-avatar">' + (image ? '<img alt="Teacher profile" src="' + esc(image) + '">' : esc(initials(profile.full_name))) + '</div><div><span class="td-kicker">' + esc(inst.name || 'NOOR institution') + '</span><h2>' + esc(profile.full_name || 'Teacher') + '</h2><p class="td-muted">' + esc(email) + '</p><div class="td-tags"><span class="td-tag">' + esc(member.role || 'teacher') + '</span><span class="td-tag">Joined ' + esc(joined) + '</span><span class="td-tag">Timezone ' + esc(inst.timezone || state.timezone) + '</span></div><p class="td-muted">Employee ID and qualification are not stored in the connected profile/membership schema.</p></div></section>';
  }
  function sessionRows(sessions, limit) {
    const now = Date.now();
    const rows = (sessions || []).map(normalizeSession).filter(session => new Date(session.end).getTime() > now || session.status === 'completed')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).slice(0, limit || 8);
    if (!rows.length) return emptyBox('No assigned timetable sessions were found for this period.');
    return '<div class="td-list">' + rows.map(session => {
      const start = new Date(session.start).getTime(), end = new Date(session.end).getTime();
      const stateLabel = session.status === 'completed' ? 'Completed' : start <= now && end > now ? 'Ongoing' : 'Upcoming';
      return '<article class="td-row"><div><strong>' + esc(session.title) + '</strong><small>' + esc(session.className) + ' · ' + esc(session.room) + '</small><small>' + esc(formatDate(session.start)) + ' · ' + esc(formatTime(session.start)) + '–' + esc(formatTime(session.end)) + '</small></div><span class="td-row-side">' + esc(stateLabel) + '</span></article>';
    }).join('') + '</div>';
  }
  function activities(data) {
    const sessionMap = new Map((data.sessions || []).map(session => [session.id, session]));
    const rows = (data.attendance || []).slice().sort((a, b) => new Date(b.marked_at || b.updated_at).getTime() - new Date(a.marked_at || a.updated_at).getTime()).slice(0, 5);
    if (!rows.length) return emptyBox('No attendance activity has been saved yet.');
    return '<div class="td-list">' + rows.map(row => {
      const session = sessionMap.get(row.session_id);
      return '<div class="td-row"><div><strong>Attendance · ' + esc(session?.title || 'Class session') + '</strong><small>' + esc(session?.class_name || 'Assigned class') + '</small></div><span class="td-row-side">' + esc(formatDateTime(row.marked_at || row.updated_at)) + '</span></div>';
    }).join('') + '</div>';
  }
  function capabilityCard(title, capability, message) {
    return '<article class="td-card"><h2>' + esc(title) + '</h2><p class="td-muted">' + esc(message) + '</p><div class="td-capability">' + (capability ? 'Supported by the connected backend schema.' : 'Not available in the connected database schema. No placeholder records are displayed.') + '</div></article>';
  }

  async function show(view) {
    if (!currentContext()) return;
    if (!loadShell(view)) return;
    setMessage('', 'info');
    const target = $('#td-content');
    try {
      if (view === 'Dashboard') return await renderDashboard(target);
      if (view === 'My Classes') return await renderClasses(target);
      if (view === 'Timetable') return await renderTimetable(target);
      if (view === 'Attendance') return await renderAttendance(target);
      if (view === 'Students') return await renderStudents(target);
      if (view === 'Assignments') return renderUnsupported(target, 'Assignments and resources', 'The connected public schema has no assignment, submission, or resource tables. The interface does not create fake assignments.');
      if (view === 'Announcements') return renderUnsupported(target, 'Notices and notifications', 'The connected public schema has no institution notice or notification table. No demo announcements are shown.');
      if (view === 'Settings') return await renderSettings(target);
      return renderUnsupported(target, view, 'This feature is not connected to a verified backend workflow.');
    } catch (error) {
      loadError(error?.message || 'Unable to load records for this page.');
    }
  }

  async function getDashboardData() {
    const data = await call('dashboard');
    state.data = data;
    state.groups = data.groups || [];
    state.sessions = data.sessions || [];
    state.attendance = data.attendance || [];
    state.timezone = data.institution?.timezone || 'UTC';
    return data;
  }

  async function renderDashboard(target) {
    const data = await getDashboardData();
    const profile = data.profile || {};
    const metrics = data.metrics || {};
    const counts = statusCounts(data.attendance || []);
    const attendanceTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const attendanceRate = attendanceTotal ? Math.round(((counts.present + counts.late) / attendanceTotal) * 100) + '%' : '—';
    const nextSessions = (data.sessions || []).filter(item => new Date(item.ends_at).getTime() > Date.now()).slice(0, 6);
    const groupRows = (data.groups || []).slice(0, 5);
    target.innerHTML = profileCard(data) +
      '<section class="td-stats" aria-label="Teacher summary"><article class="td-stat"><span>Assigned students</span><strong>' + Number(metrics.student_count || 0) + '</strong><small>Unique active student memberships</small></article>' +
      '<article class="td-stat"><span>Assigned classes / groups</span><strong>' + Number(metrics.group_count || 0) + '</strong><small>Active groups assigned to you</small></article>' +
      '<article class="td-stat"><span>Timetable sessions</span><strong>' + Number(metrics.session_count || 0) + '</strong><small>Last 30 days and next 14 days</small></article>' +
      '<article class="td-stat"><span>Attendance rate</span><strong>' + attendanceRate + '</strong><small>Present plus Late / saved records</small></article></section>' +
      '<div class="td-grid"><section class="td-card"><div class="td-card-head"><div><h2>Today and upcoming timetable</h2><p class="td-muted">Sessions assigned to your membership</p></div><button class="td-btn" type="button" data-td-go="Timetable">View week →</button></div>' +
      sessionRows(nextSessions, 5) + '</section><section class="td-card"><div class="td-card-head"><div><h2>Attendance overview</h2><p class="td-muted">Saved records, not estimates</p></div><button class="td-btn" type="button" data-td-go="Attendance">Take attendance →</button></div>' +
      (attendanceTotal ? statusBars(counts) : emptyBox('No attendance records have been saved for your assigned sessions.')) + '</section></div>' +
      '<div class="td-grid"><section class="td-card"><div class="td-card-head"><div><h2>My classes and sections</h2><p class="td-muted">Only assigned groups are displayed</p></div><button class="td-btn" type="button" data-td-go="My Classes">All classes →</button></div>' +
      (groupRows.length ? '<div class="td-list">' + groupRows.map(group => '<div class="td-row"><div><strong>' + esc(group.name) + '</strong><small>' + esc(group.group_type || 'class') + (group.room_label ? ' · ' + esc(group.room_label) : '') + '</small></div><span class="td-row-side">' + Number(group.student_count || 0) + ' students</span></div>').join('') + '</div>' : emptyBox('No active classes are assigned to this teacher membership. Ask the Principal or academic administrator to assign a group.')) +
      '</section><section class="td-card"><div class="td-card-head"><div><h2>Recent attendance activity</h2><p class="td-muted">Last saved marks in your assigned sessions</p></div></div>' + activities(data) + '</section></div>' +
      '<div class="td-grid"><section class="td-card"><h2>Assignments and resources</h2><p class="td-muted">Create, edit, share, and review student work.</p><div class="td-capability">Not available: the connected schema does not contain assignment/submission/resource tables. This feature remains disabled until the data model is added and secured.</div><div class="td-nav-actions"><button class="td-btn" type="button" data-td-go="Assignments">Open assignments</button></div></section>' +
      '<section class="td-card"><h2>School notices and notifications</h2><p class="td-muted">Institution-level announcements and reminders.</p><div class="td-capability">Not available: no notice/notification table is present in the connected schema. No mock notices are shown.</div><div class="td-nav-actions"><button class="td-btn" type="button" data-td-go="Announcements">View availability</button></div></section></div>';
    bindInPageNavigation();
  }

  async function renderClasses(target) {
    const data = await getDashboardData();
    target.innerHTML = '<h3 class="td-page-title">Assigned classes and sections</h3><p class="td-muted">Class/section details are read from active institution groups. Changes to group setup are restricted to authorized Principal/academic admin roles.</p>' +
      (state.groups.length ? '<div class="td-grid">' + state.groups.map(group => '<article class="td-card"><div class="td-card-head"><div><h2>' + esc(group.name) + '</h2><p class="td-muted">' + esc(group.group_type || 'class') + (group.code ? ' · ' + esc(group.code) : '') + '</p></div><span class="td-tag">' + Number(group.student_count || 0) + ' students</span></div>' +
        '<p class="td-muted">' + esc(group.description || 'No description recorded.') + '</p><div class="td-list"><div class="td-row"><div><strong>Room</strong><small>' + esc(group.room_label || 'Not assigned') + '</small></div></div><div class="td-row"><div><strong>Capacity</strong><small>' + (group.capacity == null ? 'Not configured' : Number(group.capacity)) + '</small></div></div></div></article>').join('') + '</div>' : emptyBox('No assigned classes / sections were returned by the database. Ask your Principal or academic administrator to assign a group.')) +
      '<div class="td-capability">Teacher accounts are read-only for class/section setup in the current permission model. Requests to change rooms, capacity, academic year, or group configuration belong in the Principal/admin workflow.</div>';
    state.data = data;
  }

  async function renderTimetable(target) {
    const data = await getDashboardData();
    const now = Date.now();
    const sessions = (data.sessions || []).filter(session => new Date(session.starts_at).getTime() > now - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    target.innerHTML = '<h3 class="td-page-title">My timetable</h3><p class="td-muted">Timetable times are displayed in the institution timezone: ' + esc(state.timezone) + '.</p>' +
      (sessions.length ? '<div class="td-table-wrap"><table class="td-table"><thead><tr><th>Subject / session</th><th>Class / section</th><th>Start</th><th>End</th><th>Room</th><th>Status</th></tr></thead><tbody>' +
        sessions.map(session => '<tr><td>' + esc(session.subject_name || session.title) + '</td><td>' + esc(session.class_name || 'Class') + '</td><td>' + esc(formatDateTime(session.starts_at)) + '</td><td>' + esc(formatTime(session.ends_at)) + '</td><td>' + esc(session.room_label || 'Not assigned') + '</td><td>' + esc(session.session_status) + '</td></tr>').join('') +
        '</tbody></table></div>' : emptyBox('No assigned sessions are scheduled in the loaded timetable window. Ask an administrator to create/assign timetable sessions.')) +
      '<p class="td-inline-note">The current schema stores scheduled sessions with timezone-aware timestamps. The teacher can view assigned sessions but cannot create or reassign them.</p>';
  }

  function renderRosterTable(students, records, options) {
    const existingMap = new Map((records || []).map(record => [record.student_membership_id, record]));
    return '<div class="td-table-wrap"><table class="td-table"><thead><tr><th>Student</th><th>Attendance</th><th>Note</th><th>Saved state</th></tr></thead><tbody>' +
      students.map(student => {
        const prior = existingMap.get(student.membership_id);
        const selected = prior?.attendance_status || '';
        return '<tr data-student-id="' + esc(student.membership_id) + '" data-existing-id="' + esc(prior?.id || '') + '" data-existing-status="' + esc(prior?.attendance_status || '') + '" data-existing-updated="' + esc(prior?.updated_at || '') + '" data-existing-notes="' + esc(prior?.notes || '') + '">' +
          '<td><strong>' + esc(student.full_name || 'Student') + '</strong></td><td><select class="td-status" aria-label="Attendance status for ' + esc(student.full_name || 'student') + '">' +
          '<option value="">Choose status</option>' + statuses.map(status => '<option value="' + status + '"' + (selected === status ? ' selected' : '') + '>' + statusLabels[status] + '</option>').join('') +
          '</select></td><td><input class="td-note" maxlength="700" aria-label="Note for ' + esc(student.full_name || 'student') + '" value="' + esc(prior?.notes || '') + '" placeholder="Optional note"></td><td>' + (prior ? 'Already saved' : 'Not yet saved') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  async function renderStudents(target) {
    const data = await getDashboardData();
    target.innerHTML = '<h3 class="td-page-title">Student roster</h3><p class="td-muted">Student names are returned by the secure server-side roster workflow only for your assigned groups.</p>' +
      '<div class="td-toolbar"><div class="td-field"><label for="td-student-group">Assigned class / section</label><select id="td-student-group"><option value="">Choose a group</option>' + state.groups.map(group => '<option value="' + esc(group.id) + '">' + esc(group.name) + '</option>').join('') + '</select></div><button type="button" class="td-btn primary" id="td-load-students">Load student roster</button></div>' +
      '<div id="td-student-results">' + emptyBox('Select one of your assigned groups to load its active students.') + '</div>';
    $('#td-load-students').addEventListener('click', async () => {
      const groupId = $('#td-student-group').value;
      if (!groupId) return setMessage('Choose a class or section first.', 'error');
      try {
        setMessage('', 'info');
        const result = await call('roster', { group_id: groupId });
        state.students = result.students || [];
        const area = $('#td-student-results');
        area.innerHTML = state.students.length
          ? '<div class="td-table-wrap"><table class="td-table"><thead><tr><th>Student name</th><th>Roster status</th></tr></thead><tbody>' + state.students.map(student => '<tr><td>' + esc(student.full_name) + '</td><td>Active</td></tr>').join('') + '</tbody></table></div>'
          : emptyBox('No active student memberships are enrolled in this assigned group.');
      } catch (error) {
        const area = $('#td-student-results');
        if (area) area.innerHTML = emptyBox(error.message || 'Student roster could not be loaded.');
      }
    });
    state.data = data;
  }

  async function renderAttendance(target) {
    const data = await getDashboardData();
    const today = dateInputValue(state.timezone);
    target.innerHTML = '<h3 class="td-page-title">Class attendance</h3><p class="td-muted">Choose an assigned class, local attendance date and scheduled session. Previously saved marks are loaded before editing.</p>' +
      '<div class="td-toolbar"><div class="td-field"><label for="td-att-group">Assigned class / section</label><select id="td-att-group"><option value="">Choose a class</option>' + state.groups.map(group => '<option value="' + esc(group.id) + '">' + esc(group.name) + '</option>').join('') + '</select></div>' +
      '<div class="td-field"><label for="td-att-date">Attendance date (' + esc(state.timezone) + ')</label><input id="td-att-date" type="date" max="' + esc(today) + '" value="' + esc(today) + '"></div>' +
      '<div class="td-field"><label for="td-att-session">Scheduled session / period</label><select id="td-att-session" disabled><option value="">Choose class and date first</option></select></div>' +
      '<button type="button" class="td-btn primary" id="td-load-attendance">Load roster</button></div>' +
      '<div class="td-message" id="td-att-message" role="status" aria-live="polite" hidden></div>' +
      '<div id="td-att-roster">' + emptyBox('Select an assigned class and date. Attendance can only be entered against a session assigned to you.') + '</div>';
    const loadSessions = async () => {
      const groupId = $('#td-att-group').value;
      const date = $('#td-att-date').value;
      const sessionSelect = $('#td-att-session');
      sessionSelect.innerHTML = '<option value="">Loading sessions…</option>';
      sessionSelect.disabled = true;
      $('#td-att-roster').innerHTML = emptyBox('Choose a scheduled session, then load the roster.');
      if (!groupId || !date) {
        sessionSelect.innerHTML = '<option value="">Choose class and date first</option>';
        return;
      }
      if (date > dateInputValue(state.timezone)) {
        sessionSelect.innerHTML = '<option value="">Future attendance is not allowed</option>';
        setAttMessage('Attendance cannot be marked for a future date.', 'error');
        return;
      }
      try {
        setAttMessage('', 'info');
        const result = await call('sessions_for_date', { group_id: groupId, attendance_date: date });
        const sessions = result.sessions || [];
        sessionSelect.innerHTML = '<option value="">Choose a scheduled session</option>' + sessions.map(session => '<option value="' + esc(session.id) + '">' + esc(session.subject_name || session.title) + ' · ' + esc(formatTime(session.starts_at)) + '–' + esc(formatTime(session.ends_at)) + '</option>').join('');
        sessionSelect.disabled = !sessions.length;
        if (!sessions.length) {
          $('#td-att-roster').innerHTML = emptyBox('No scheduled session exists for this class on the selected date. Ask the Principal or academic administrator to schedule it; teacher permissions do not allow creating sessions.');
        }
      } catch (error) {
        sessionSelect.innerHTML = '<option value="">Sessions unavailable</option>';
        $('#td-att-roster').innerHTML = emptyBox(error.message || 'Scheduled sessions could not be loaded.');
        setAttMessage(error.message || 'Scheduled sessions could not be loaded.', 'error');
      }
    };
    $('#td-att-group').addEventListener('change', loadSessions);
    $('#td-att-date').addEventListener('change', loadSessions);
    $('#td-load-attendance').addEventListener('click', loadRoster);
    if (state.groups.length === 1) {
      $('#td-att-group').value = state.groups[0].id;
      await loadSessions();
    }
    state.data = data;
  }

  function setAttMessage(message, type) {
    const node = $('#td-att-message');
    if (!node) return;
    node.hidden = !message;
    node.className = 'td-message ' + (type || 'info');
    node.textContent = message || '';
  }
  async function loadRoster() {
    const groupId = $('#td-att-group')?.value;
    const date = $('#td-att-date')?.value;
    const sessionId = $('#td-att-session')?.value;
    if (!groupId || !date || !sessionId) {
      setAttMessage('Choose an assigned class, date, and scheduled session before loading attendance.', 'error');
      return;
    }
    const area = $('#td-att-roster');
    state.attendance = null;
    area.innerHTML = emptyBox('Loading enrolled students and saved attendance…');
    try {
      setAttMessage('', 'info');
      const result = await call('roster', { group_id: groupId, session_id: sessionId, attendance_date: date });
      state.students = result.students || [];
      state.attendance = result.attendance || [];
      state.currentAttendance = { groupId, date, sessionId };
      if (!state.students.length) {
        area.innerHTML = emptyBox('No active students are enrolled in this assigned group. Nothing was saved.');
        setAttMessage('The roster is empty; attendance cannot be submitted.', 'error');
        return;
      }
      area.innerHTML = renderRosterTable(state.students, state.attendance) +
        '<div class="td-toolbar"><div class="td-field"><label for="td-correction-reason">Correction reason (required if changing saved marks)</label><textarea id="td-correction-reason" maxlength="500" placeholder="Explain why previously saved attendance needs correction"></textarea></div><button type="button" class="td-btn soft" id="td-all-present">Mark all Present</button><button type="button" class="td-btn primary" id="td-save-attendance">Save attendance</button></div>' +
        '<p class="td-inline-note">New records are checked for duplicates. Changing a saved status or note requires a reason and confirmation. Correction reasons are appended to the existing notes field; the current schema does not have an immutable audit table.</p>';
      $('#td-all-present').addEventListener('click', () => {
        area.querySelectorAll('.td-status').forEach(select => { select.value = 'present'; });
        setAttMessage('All students are marked Present in the form only. Review the roster before saving.', 'info');
      });
      $('#td-save-attendance').addEventListener('click', saveAttendance);
    } catch (error) {
      state.attendance = null;
      area.innerHTML = emptyBox(error.message || 'Student roster could not be loaded.');
      setAttMessage(error.message || 'Student roster could not be loaded.', 'error');
    }
  }

  async function saveAttendance() {
    if (state.busy) return;
    const context = state.currentAttendance;
    if (!context) return setAttMessage('Load the class roster before saving.', 'error');
    const rows = [...state.root.querySelectorAll('#td-att-roster tr[data-student-id]')];
    if (!rows.length) return setAttMessage('There are no student records to save.', 'error');
    const marks = [];
    for (const row of rows) {
      const status = row.querySelector('.td-status')?.value || '';
      const note = row.querySelector('.td-note')?.value || '';
      if (!statuses.includes(status)) return setAttMessage('Select Present, Absent, Late, or Leave for every student.', 'error');
      if (note.length > 1000) return setAttMessage('A student note is longer than 1000 characters.', 'error');
      marks.push({ student_membership_id: row.dataset.studentId, status, notes: note });
    }
    const changed = rows.filter(row => {
      const priorStatus = row.dataset.existingStatus || '';
      const priorNotes = row.dataset.existingNotes || '';
      const selectedStatus = row.querySelector('.td-status').value;
      const selectedNotes = row.querySelector('.td-note').value || '';
      return priorStatus && (priorStatus !== selectedStatus || priorNotes !== selectedNotes);
    });
    const reason = $('#td-correction-reason')?.value.trim() || '';
    if (changed.length && reason.length < 5) return setAttMessage('Enter a correction reason of at least five characters before changing saved attendance.', 'error');
    if (changed.length && !window.confirm('You are changing ' + changed.length + ' previously saved attendance record(s). Continue with this correction reason?')) return;
    state.busy = true;
    const button = $('#td-save-attendance');
    if (button) { button.disabled = true; button.textContent = 'Saving…'; }
    setAttMessage('Saving attendance to the institution database…', 'info');
    try {
      const result = await call('save_attendance', {
        group_id: context.groupId,
        session_id: context.sessionId,
        attendance_date: context.date,
        correction_reason: reason,
        marks,
      });
      const failures = Array.isArray(result.failures) ? result.failures : [];
      await loadRoster();
      if (!Array.isArray(state.attendance)) {
        setAttMessage('The write response was received, but saved records could not be reloaded. Do not assume attendance is verified; refresh and review the roster.', 'error');
        return;
      }
      const savedStatuses = new Map((state.attendance || []).map(record => [record.student_membership_id, record.attendance_status]));
      const verified = marks.filter(mark => savedStatuses.get(mark.student_membership_id) === mark.status).length;
      if (failures.length) {
        setAttMessage('Saved ' + Number(result.saved || 0) + ', unchanged ' + Number(result.unchanged || 0) + ', errors ' + failures.length + '. Reloaded from Supabase; check records that did not save.', 'error');
      } else if (verified !== marks.length) {
        setAttMessage('The server accepted the write, but read-back verification matched ' + verified + ' of ' + marks.length + ' student statuses. Review the reloaded roster before leaving.', 'error');
      } else {
        setAttMessage('Attendance saved and reloaded from Supabase. Verified ' + verified + ' student statuses for this session.', 'success');
        showToast('Attendance save and reload verified.', 'success');
      }
    } catch (error) {
      setAttMessage(error.message || 'Attendance was not confirmed. Reload records before retrying.', 'error');
    } finally {
      state.busy = false;
      const nextButton = $('#td-save-attendance');
      if (nextButton) { nextButton.disabled = false; nextButton.textContent = 'Save attendance'; }
    }
  }

  async function renderSettings(target) {
    const data = await getDashboardData();
    const membership = data.membership || {};
    const inst = data.institution || {};
    target.innerHTML = '<h3 class="td-page-title">Teacher access and data</h3><div class="td-grid"><section class="td-card"><h2>Workspace details</h2><div class="td-list">' +
      '<div class="td-row"><div><strong>Institution</strong><small>' + esc(inst.name || '—') + '</small></div></div>' +
      '<div class="td-row"><div><strong>Membership role</strong><small>' + esc(membership.role || '—') + '</small></div></div>' +
      '<div class="td-row"><div><strong>Institution timezone</strong><small>' + esc(inst.timezone || state.timezone) + '</small></div></div>' +
      '<div class="td-row"><div><strong>Joined</strong><small>' + esc(formatDate(membership.joined_at)) + '</small></div></div></div></section>' +
      '<section class="td-card"><h2>Connected schema limitations</h2><p class="td-muted">The current backend supports academic groups, assigned sessions, student group membership and attendance records.</p>' +
      '<div class="td-capability">Assignments, submissions, assessments, school notices and notifications are not present in the connected public schema. Employee ID and qualification fields are also absent from the profile/membership schema.</div>' +
      '<div class="td-capability">' + esc(data.capabilities?.correction_audit || 'Attendance correction audit is not available.') + '</div></section></div>';
  }

  function renderUnsupported(target, title, message) {
    target.innerHTML = '<h3 class="td-page-title">' + esc(title) + '</h3><div class="td-capability">' + esc(message) + '</div><div class="td-nav-actions"><button type="button" class="td-btn" data-td-go="Dashboard">Back to dashboard</button></div>';
    bindInPageNavigation();
  }
  function bindInPageNavigation() {
    state.root.querySelectorAll('[data-td-go]').forEach(button => {
      button.addEventListener('click', () => show(button.dataset.tdGo));
    });
  }

  // Capture-phase routing prevents the legacy preview click listeners from showing local-only mock UI to teachers.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-view],[data-nav]');
    if (!button || !currentContext()) return;
    const view = button.dataset.view || button.dataset.nav;
    if (!view) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    show(view);
  }, true);

  function restoreNonTeacherShell() {
    if (state.root) state.root.hidden = true;
    ['.stats', '.health-panel', '.content-grid', '.lower'].forEach(selector => {
      document.querySelectorAll(selector).forEach(node => { node.hidden = false; });
    });
    const addClass = $('#add-class', document);
    const manageClasses = $('#manage-classes', document);
    if (addClass) addClass.hidden = false;
    if (manageClasses) manageClasses.hidden = false;
    const eyebrow = $('.heading .eyebrow', document);
    const title = $('.heading h1', document);
    const intro = $('.heading p', document);
    if (eyebrow) eyebrow.textContent = 'CAMPUS OVERVIEW';
    if (title) title.textContent = 'Welcome to NOOR';
    if (intro) intro.textContent = 'Live institution records for your authenticated account.';
  }
  function onSessionReady() {
    if (!currentContext()) {
      restoreNonTeacherShell();
      return;
    }
    ensureRoot();
    show('Dashboard');
  }
  window.addEventListener('noor:session-ready', onSessionReady);
  window.addEventListener('noor:session-ended', () => {
    restoreNonTeacherShell();
    state.data = null;
    state.currentAttendance = null;
  });
  window.NOOR_TEACHER_DASHBOARD = {
    open: show,
    refresh: () => show(state.view),
    getState: () => ({ view: state.view, institution: state.data?.institution?.name || null }),
  };
  if (currentContext()) onSessionReady();
})();
