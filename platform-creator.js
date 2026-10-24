/* NOOR Platform Creator console. All privileged reads/writes rely on Supabase RLS. */
(() => {
  'use strict';

  const CONFIG = window.NOOR_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const PAGE_SIZE = 25;
  const STATUSES = ['active', 'pending', 'suspended', 'archived'];
  const PLATFORM_ROLES = {
    platform_owner: 'Platform Creator / Owner',
    platform_admin: 'Platform Administrator',
    support: 'Support (limited access)'
  };
  const INSTITUTION_FIELDS = 'id,name,slug,institution_type,country_code,default_language,timezone,status,created_at,updated_at';
  let supabase = null;
  let currentUser = null;
  let currentRole = null;
  let currentPage = 0;
  let totalInstitutions = 0;
  let institutionCache = new Map();
  let loading = false;

  function setNotice(target, message, kind = '') {
    if (!target) return;
    target.textContent = message || '';
    target.className = message ? 'notice' + (kind ? ' ' + kind : '') : 'notice hidden';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function configuredProjectHost() {
    try { return new URL(CONFIG.SUPABASE_URL).hostname; } catch { return 'not configured'; }
  }

  function showAuth(message, kind = '') {
    $('authGate').classList.remove('hidden');
    $('dashboard').classList.add('hidden');
    setNotice($('authMessage'), message, kind);
  }

  function showDashboard() {
    $('authGate').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
  }

  function normaliseError(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    if (code === '42501' || /row-level security|permission denied|not allowed/i.test(message)) {
      return 'Supabase rejected this request under its database security policies. Your current role may not be authorised for this action.';
    }
    if (code === 'PGRST205' || code === '42P01' || /could not find the table|relation .* does not exist|schema cache/i.test(message)) {
      return 'The configured Supabase project does not expose the required platform schema (platform_roles and institutions). Check the project configuration and migrations; no fallback or sample data was loaded.';
    }
    if (code === 'PGRST116') return 'The record changed or is no longer visible. Refresh the list and try again.';
    return 'The request could not be completed. Check the connection and database policies, then try again.';
  }

  function setSync(message, kind = '') {
    $('syncState').textContent = message;
    const dot = document.querySelector('.live-chip .secure-dot');
    if (dot) dot.style.background = kind === 'error' ? '#c75166' : kind === 'ok' ? '#2f9c6d' : '#d5a04d';
  }

  async function checkPlatformRole(session) {
    currentUser = session?.user || null;
    currentRole = null;
    if (!currentUser) {
      showAuth('Sign in to continue. Platform access is checked against the database on every session.');
      return false;
    }

    // The role read is permitted for the caller's own row by platform_roles_select_self.
    // This UI never inserts or updates platform_roles and never trusts user metadata.
    const { data, error } = await supabase
      .from('platform_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) {
      showAuth(normaliseError(error), 'error');
      $('footerProject').textContent = 'Configured project host: ' + configuredProjectHost();
      return false;
    }
    if (!data || !PLATFORM_ROLES[data.role]) {
      showAuth('This signed-in account has no authorised platform role. Roles cannot be granted from this screen. Ask the platform owner to use an approved out-of-band role-assignment process.', 'error');
      return false;
    }
    if (data.role === 'support') {
      showAuth('The support role is recognised, but the inspected RLS policies do not grant support staff platform-wide institution access. This console will not bypass those policies. Use the approved support workflow once it is implemented.', 'warning');
      return false;
    }
    if (!['platform_owner', 'platform_admin'].includes(data.role)) {
      showAuth('This role does not have permission to open platform operations.', 'error');
      return false;
    }

    currentRole = data.role;
    showDashboard();
    $('roleLabel').textContent = PLATFORM_ROLES[currentRole];
    $('userEmail').textContent = currentUser.email || 'Authenticated account';
    $('footerProject').textContent = 'Supabase host: ' + configuredProjectHost() + ' · Live, RLS-filtered data';
    return true;
  }

  function switchSection(section) {
    const allowed = ['overview', 'institutions', 'onboarding'];
    if (!allowed.includes(section)) return;
    for (const key of allowed) {
      $(key + 'Section').classList.toggle('hidden', key !== section);
      const nav = document.querySelector('[data-nav="' + key + '"]');
      if (nav) {
        nav.classList.toggle('active', key === section);
        if (key === section) nav.setAttribute('aria-current', 'page');
        else nav.removeAttribute('aria-current');
      }
    }
    $('pageTitle').textContent = section === 'overview' ? 'Platform overview' : section === 'institutions' ? 'Institution management' : 'Institution onboarding';
    $('sidebar').classList.remove('open');
    if (section === 'institutions') $('searchInput').focus({ preventScroll: true });
  }

  async function countInstitutions({ status = '', type = '' } = {}) {
    let query = supabase.from('institutions').select('id', { count: 'exact', head: true });
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('institution_type', type);
    const { count, error } = await query;
    if (error) throw error;
    return Number(count || 0);
  }

  async function loadMetrics() {
    const [total, active, pending, suspended, schools, universities] = await Promise.all([
      countInstitutions(),
      countInstitutions({ status: 'active' }),
      countInstitutions({ status: 'pending' }),
      countInstitutions({ status: 'suspended' }),
      countInstitutions({ type: 'school' }),
      countInstitutions({ type: 'university' })
    ]);
    $('metricTotal').textContent = total.toLocaleString();
    $('metricActive').textContent = active.toLocaleString();
    $('metricPending').textContent = pending.toLocaleString();
    $('metricSuspended').textContent = suspended.toLocaleString();
    $('schoolCount').textContent = schools.toLocaleString();
    $('universityCount').textContent = universities.toLocaleString();
    $('queueCount').textContent = pending.toLocaleString();
    $('pendingNavCount').textContent = pending > 99 ? '99+' : String(pending);
    const scale = Math.max(1, schools, universities);
    $('schoolBar').style.width = Math.round(schools / scale * 100) + '%';
    $('universityBar').style.width = Math.round(universities / scale * 100) + '%';
  }

  function escapedLike(value) {
    return String(value || '').trim().replace(/[\\%_]/g, '\\$&');
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
  }

  function statusBadge(status) {
    const known = STATUSES.includes(status) ? status : 'pending';
    return '<span class="state-badge state-' + known + '">' + escapeHtml(known) + '</span>';
  }

  function institutionRow(institution) {
    const initial = String(institution.name || 'I').trim().charAt(0).toUpperCase() || 'I';
    const countryLanguage = [institution.country_code, institution.default_language?.toUpperCase()].filter(Boolean).join(' · ') || '—';
    return '<tr>' +
      '<td><div class="institution-name"><span class="institution-avatar" aria-hidden="true">' + escapeHtml(initial) + '</span><div><strong>' + escapeHtml(institution.name) + '</strong><small>' + escapeHtml(institution.slug) + '</small></div></div></td>' +
      '<td><span class="type-badge">' + escapeHtml(institution.institution_type) + '</span></td>' +
      '<td>' + escapeHtml(countryLanguage) + '<small style="display:block;color:var(--muted);margin-top:3px">' + escapeHtml(institution.timezone || 'Timezone not set') + '</small></td>' +
      '<td>' + statusBadge(institution.status) + '</td>' +
      '<td>' + escapeHtml(formatDate(institution.created_at)) + '</td>' +
      '<td><button class="button button-quiet row-action" type="button" data-open-institution="' + escapeHtml(institution.id) + '">View details</button></td>' +
      '</tr>';
  }

  async function loadInstitutions() {
    const body = $('institutionRows');
    body.innerHTML = '<tr><td colspan="6" class="table-empty">Loading institution records…</td></tr>';
    const search = escapedLike($('searchInput').value);
    const status = $('statusFilter').value;
    const type = $('typeFilter').value;
    let query = supabase.from('institutions').select(INSTITUTION_FIELDS, { count: 'exact' });
    if (search) query = query.ilike('name', '%' + search + '%');
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('institution_type', type);
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">Institution records could not be loaded under the current database policy.</td></tr>';
      $('resultCount').textContent = 'Results unavailable';
      throw error;
    }

    const rows = data || [];
    totalInstitutions = Number(count || 0);
    rows.forEach((row) => institutionCache.set(row.id, row));
    body.innerHTML = rows.length ? rows.map(institutionRow).join('') : '<tr><td colspan="6" class="table-empty">No institutions matched these filters. Nothing has been added or changed.</td></tr>';
    $('resultCount').textContent = totalInstitutions.toLocaleString() + ' matching institution' + (totalInstitutions === 1 ? '' : 's');
    $('pageLabel').textContent = totalInstitutions ? 'Page ' + (currentPage + 1) + ' of ' + Math.max(1, Math.ceil(totalInstitutions / PAGE_SIZE)) : 'Page 1';
    $('previousPage').disabled = currentPage === 0;
    $('nextPage').disabled = (currentPage + 1) * PAGE_SIZE >= totalInstitutions;
  }

  async function loadOnboarding() {
    const target = $('onboardingList');
    target.innerHTML = '<p class="table-empty">Loading pending institutions…</p>';
    const { data, error } = await supabase.from('institutions')
      .select(INSTITUTION_FIELDS)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) {
      target.innerHTML = '<p class="table-empty">The onboarding queue could not be loaded under the current database policy.</p>';
      throw error;
    }
    const rows = data || [];
    rows.forEach((row) => institutionCache.set(row.id, row));
    target.innerHTML = rows.length ? rows.map((row) =>
      '<div class="onboarding-item"><div><strong>' + escapeHtml(row.name) + '</strong><small>' +
      escapeHtml(row.institution_type) + ' · ' + escapeHtml(row.country_code || 'Country not set') +
      ' · Submitted ' + escapeHtml(formatDate(row.created_at)) + '</small></div>' +
      '<button class="button button-quiet row-action" type="button" data-open-institution="' + escapeHtml(row.id) + '">Review</button></div>'
    ).join('') : '<p class="table-empty">No institutions are awaiting review.</p>';
  }

  async function refreshAll() {
    if (loading || !currentRole || !supabase) return;
    loading = true;
    $('refreshButton').disabled = true;
    $('refreshQueueButton').disabled = true;
    setSync('Syncing live data…');
    setNotice($('pageNotice'), '');
    institutionCache = new Map();
    try {
      await Promise.all([loadMetrics(), loadInstitutions(), loadOnboarding()]);
      setSync('Live data updated', 'ok');
    } catch (error) {
      setSync('Data unavailable', 'error');
      setNotice($('pageNotice'), normaliseError(error), 'error');
    } finally {
      loading = false;
      $('refreshButton').disabled = false;
      $('refreshQueueButton').disabled = false;
    }
  }

  function setDialogEditable(editable) {
    for (const id of ['institutionName', 'institutionCountry', 'institutionLocale', 'institutionTimezone', 'institutionStatus']) {
      $(id).disabled = !editable;
    }
    $('saveInstitutionButton').classList.toggle('hidden', !editable);
  }

  function openInstitution(id) {
    const institution = institutionCache.get(id);
    if (!institution) {
      setNotice($('pageNotice'), 'This institution is no longer in the current result set. Refresh and retry.', 'warning');
      return;
    }
    $('institutionId').value = institution.id;
    $('originalUpdatedAt').value = institution.updated_at || '';
    $('institutionName').value = institution.name || '';
    $('institutionSlug').value = institution.slug || '';
    $('institutionType').value = institution.institution_type || 'school';
    $('institutionCountry').value = institution.country_code || '';
    $('institutionLocale').value = institution.default_language || 'en';
    $('institutionTimezone').value = institution.timezone || '';
    $('institutionStatus').value = institution.status || 'pending';
    $('dialogTitle').textContent = institution.name || 'Institution details';
    $('dialogSubtitle').textContent = institution.slug + ' · Created ' + formatDate(institution.created_at);
    setNotice($('detailMessage'), '');
    setDialogEditable(['platform_owner', 'platform_admin'].includes(currentRole));
    $('institutionDialog').showModal();
  }

  async function saveInstitution(event) {
    event.preventDefault();
    if (!supabase || !currentUser || !['platform_owner', 'platform_admin'].includes(currentRole)) {
      setNotice($('detailMessage'), 'This action requires an authorised platform owner or administrator. The UI cannot grant this permission.', 'error');
      return;
    }
    const id = $('institutionId').value;
    const previous = institutionCache.get(id);
    if (!previous) {
      setNotice($('detailMessage'), 'The institution record is stale. Refresh and reopen it before saving.', 'error');
      return;
    }
    const name = $('institutionName').value.trim();
    const country = $('institutionCountry').value.trim().toUpperCase();
    const timezone = $('institutionTimezone').value.trim();
    const language = $('institutionLocale').value;
    const status = $('institutionStatus').value;

    if (!name || name.length > 160) {
      setNotice($('detailMessage'), 'Enter an institution name between 1 and 160 characters.', 'error');
      return;
    }
    if (!/^[A-Z]{2}$/.test(country)) {
      setNotice($('detailMessage'), 'Use a two-letter uppercase ISO country code, such as IN or GB.', 'error');
      return;
    }
    if (!['en', 'hi', 'te', 'ur'].includes(language)) {
      setNotice($('detailMessage'), 'Choose a supported default language.', 'error');
      return;
    }
    if (!timezone || timezone.length > 80) {
      setNotice($('detailMessage'), 'Enter a valid timezone identifier.', 'error');
      return;
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date());
    } catch {
      setNotice($('detailMessage'), 'Enter a valid IANA timezone, such as Asia/Kolkata or Europe/London.', 'error');
      return;
    }
    if (!STATUSES.includes(status)) {
      setNotice($('detailMessage'), 'Choose a supported institution status.', 'error');
      return;
    }

    const statusChanged = status !== previous.status;
    if (statusChanged) {
      const confirmed = window.confirm(
        'Change ' + previous.name + ' from "' + previous.status + '" to "' + status + '"?\n\nThis updates the institution status; it does not delete institutional records. The inspected schema has no immutable platform audit log, so this change cannot yet be recorded with an audit reason. Continue only if authorised.'
      );
      if (!confirmed) return;
    }

    const button = $('saveInstitutionButton');
    button.disabled = true;
    setNotice($('detailMessage'), 'Saving through Supabase…');
    try {
      let update = supabase.from('institutions').update({
        name,
        country_code: country,
        default_language: language,
        timezone,
        status
      }).eq('id', id);
      const version = $('originalUpdatedAt').value;
      if (version) update = update.eq('updated_at', version);
      const { data, error } = await update.select(INSTITUTION_FIELDS).maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error('The record changed or is no longer visible.'), { code: 'PGRST116' });
      institutionCache.set(data.id, data);
      $('institutionDialog').close();
      setNotice($('pageNotice'), 'Institution details saved. Supabase accepted the change under its current database policies.', 'success');
      await refreshAll();
    } catch (error) {
      setNotice($('detailMessage'), normaliseError(error), 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function signOut() {
    if (!supabase) return;
    $('signOutButton').disabled = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      currentUser = null;
      currentRole = null;
      showAuth('You have signed out.');
    } catch (error) {
      setNotice($('pageNotice'), normaliseError(error), 'error');
    } finally {
      $('signOutButton').disabled = false;
    }
  }

  function wireEvents() {
    $('loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!supabase) {
        setNotice($('authMessage'), 'Secure Supabase configuration is unavailable. Sign-in is paused.', 'error');
        return;
      }
      const button = $('loginButton');
      button.disabled = true;
      setNotice($('authMessage'), 'Signing in with Supabase…');
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: $('loginEmail').value.trim(),
          password: $('loginPassword').value
        });
        if (error) throw error;
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (await checkPlatformRole(session)) {
          await refreshAll();
        }
      } catch (error) {
        setNotice($('authMessage'), normaliseError(error), 'error');
      } finally {
        button.disabled = false;
        $('loginPassword').value = '';
      }
    });
    $('signOutButton').addEventListener('click', signOut);
    $('refreshButton').addEventListener('click', refreshAll);
    $('refreshQueueButton').addEventListener('click', refreshAll);
    $('reviewPendingButton').addEventListener('click', () => {
      $('statusFilter').value = 'pending';
      $('typeFilter').value = '';
      $('searchInput').value = '';
      currentPage = 0;
      switchSection('institutions');
      refreshAll();
    });
    $('filterForm').addEventListener('submit', (event) => {
      event.preventDefault();
      currentPage = 0;
      loadInstitutions().catch((error) => setNotice($('pageNotice'), normaliseError(error), 'error'));
    });
    $('previousPage').addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage -= 1;
        loadInstitutions().catch((error) => setNotice($('pageNotice'), normaliseError(error), 'error'));
      }
    });
    $('nextPage').addEventListener('click', () => {
      if ((currentPage + 1) * PAGE_SIZE < totalInstitutions) {
        currentPage += 1;
        loadInstitutions().catch((error) => setNotice($('pageNotice'), normaliseError(error), 'error'));
      }
    });
    $('institutionRows').addEventListener('click', (event) => {
      const button = event.target.closest('[data-open-institution]');
      if (button) openInstitution(button.dataset.openInstitution);
    });
    $('onboardingList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-open-institution]');
      if (button) openInstitution(button.dataset.openInstitution);
    });
    document.querySelectorAll('[data-nav]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      switchSection(link.dataset.nav);
    }));
    document.querySelectorAll('[data-go]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      switchSection(link.dataset.go);
    }));
    $('institutionForm').addEventListener('submit', saveInstitution);
    $('closeDialog').addEventListener('click', () => $('institutionDialog').close());
    $('cancelDialog').addEventListener('click', () => $('institutionDialog').close());
    $('themeButton').addEventListener('click', () => document.body.classList.toggle('dark'));
    $('menuButton').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') $('sidebar').classList.remove('open');
    });
  }

  async function init() {
    wireEvents();
    $('footerProject').textContent = 'Configured project host: ' + configuredProjectHost();
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY || !window.supabase?.createClient) {
      showAuth('Secure backend configuration is missing. No dashboard metrics or sample records will be shown.', 'error');
      return;
    }
    try {
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session) {
        if (await checkPlatformRole(session)) await refreshAll();
      } else {
        showAuth('Sign in with your existing NOOR account. Platform access is checked by Supabase.');
      }
      supabase.auth.onAuthStateChange((event, nextSession) => {
        // Avoid awaiting Supabase calls while its auth-state lock is held.
        if (event === 'SIGNED_OUT') {
          setTimeout(() => {
            currentUser = null;
            currentRole = null;
            showAuth('You have signed out.');
          }, 0);
        } else if (event === 'SIGNED_IN' && nextSession?.user) {
          setTimeout(async () => {
            if (await checkPlatformRole(nextSession)) await refreshAll();
          }, 0);
        }
      });
    } catch (error) {
      showAuth(normaliseError(error), 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
