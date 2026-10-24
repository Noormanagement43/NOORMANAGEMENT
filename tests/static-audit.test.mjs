import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const authPage = await readFile(new URL('../auth.html', import.meta.url), 'utf8');
const registrationMigration = await readFile(new URL('../supabase/migrations/20261024040000_register_institution_for_current_user.sql', import.meta.url), 'utf8');
const askNoorSource = await readFile(new URL('../supabase/functions/ask-noor/index.ts', import.meta.url), 'utf8');
const emailFunctionSource = await readFile(new URL('../supabase/functions/send-notice-email/index.ts', import.meta.url), 'utf8');

test('dashboard starts with empty, non-demo metrics and attendance', () => {
  assert.match(html, /id="student-count">—/);
  assert.match(html, /id="class-count">—/);
  assert.doesNotMatch(html, /Aarav Reddy|Sana Khan|Mihir Iyer|Fatima Ali|sample figures|94\.6%/);
  assert.match(html, /Sign in to view authorized attendance records/);
  assert.match(html, /Sign in to load scheduled sessions from your institution/);
});

test('role display comes from authenticated membership, not a client role switcher', () => {
  assert.match(html, /id="role-label"/);
  assert.match(html, /roleNode\.textContent=roleLabel/);
  assert.doesNotMatch(html, /role-select|Principal workspace \(preview\)|Student workspace \(preview\)/);
});

test('frontend only contains a publishable key and no privileged secret', () => {
  assert.match(html, /sb_publishable_[A-Za-z0-9_]+/);
  assert.doesNotMatch(html, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|AIza[0-9A-Za-z_-]{20,}/);
});

test('class reads and writes are scoped to the signed-in institution', () => {
  assert.match(html, /from\('academic_groups'\)[\s\S]{0,300}eq\('institution_id',membership\.institution_id\)/);
  assert.match(html, /update\(payload\)\.eq\('id',id\)\.eq\('institution_id',membership\.institution_id\)/);
  assert.match(html, /delete\(\)\.eq\('id',c\.id\)\.eq\('institution_id',membership\.institution_id\)/);
  assert.match(html, /if\(!canEdit\(\)\)/);
});

test('institution registration validates auth and does not grant anonymous execution', () => {
  assert.match(registrationMigration, /security definer/i);
  assert.match(registrationMigration, /set search_path = ''/i);
  assert.match(registrationMigration, /if v_user_id is null then/i);
  assert.match(registrationMigration, /v_type not in \('school', 'university'\)/i);
  assert.match(registrationMigration, /revoke all on function public\.register_institution_for_current_user\(text, text, text\) from anon/i);
  assert.match(registrationMigration, /grant execute on function public\.register_institution_for_current_user\(text, text, text\) to authenticated/i);
});

test('dashboard invokes the protected server-side metrics function', () => {
  assert.match(html, /functions\.invoke\('principal-dashboard-data'/);
  assert.match(html, /emailRedirectTo:window\.location\.origin\+window\.location\.pathname/);
  assert.match(html, /redirectTo:window\.location\.origin\+window\.location\.pathname/);
});

test('legacy auth URL forwards to the single active auth gate', () => {
  assert.match(authPage, /window\.location\.replace\('\.\/index\.html'/);
  assert.doesNotMatch(authPage, /Authentication is not connected yet|Nothing was submitted/);
});

test('all inline JavaScript blocks parse without syntax errors', async () => {
  const { Script } = await import('node:vm');
  for (const file of ['index.html', 'principal.html', 'auth.html']) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    let scriptIndex = 0;
    for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      scriptIndex += 1;
      if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
      assert.doesNotThrow(() => new Script(match[2], { filename: file + '#script-' + scriptIndex }), file + ' inline script ' + scriptIndex);
    }
  }
});

test('the legacy auth URL redirects to the integrated secure sign-in flow', async () => {
  const auth = await readFile(new URL('../auth.html', import.meta.url), 'utf8');
  assert.match(auth, /http-equiv="refresh" content="0;url=\.\/index\.html"/);
  assert.match(auth, /location\.replace\(['"]\.\/index\.html['"]\)/);
  assert.doesNotMatch(auth, /Authentication is not connected yet|No sign-in was attempted/);
});

test('unverified users cannot see preview data behind the auth gate', () => {
  assert.match(html, /\.app\{visibility:hidden\}/);
  assert.match(html, /adminRoles\.indexOf\(membership\.role\)<0/);
  assert.match(html, /activeMemberships\.length>1/);
  assert.match(html, /gate\.classList\.remove\('open'\);document\.querySelector\('\.app'\)\.style\.visibility='visible'/);
  assert.match(html, /resetPasswordForEmail/);
  assert.match(html, /client\.auth\.resend/);
});

test('non-admin refresh does not call principal-only metrics and admin labels are defined', () => {
  const start = html.indexOf('async function refreshData(){');
  const end = html.indexOf('async function startSession(user){', start);
  assert.ok(start >= 0 && end > start, 'refreshData function exists');
  const refresh = html.slice(start, end);
  assert.match(refresh, /if\(!canEdit\(\)\)\{[\s\S]*?return;\s*\}\s*const dashboard=await client\.functions\.invoke\('principal-dashboard-data'/);
  assert.match(refresh, /const nonAdminLabels=document\.querySelectorAll\('\.stats \.stat small'\)/);
  assert.doesNotMatch(refresh, /\blabels\[\d\]/);
});

test('timetable reads upcoming sessions within the authenticated institution', () => {
  assert.match(html, /from\('class_sessions'\)/);
  assert.match(html, /from\('class_sessions'\)[\s\S]{0,300}eq\('institution_id',membership\.institution_id\)/);
  assert.match(html, /gte\('starts_at',now\.toISOString\(\)\)/);
  assert.match(html, /lte\('starts_at',horizon\.toISOString\(\)\)/);
  assert.match(html, /timeZone:timezone/);
  assert.doesNotMatch(html, /<time>09:00 AM<|<strong>Mathematics<|<small>Grade 8 · Room 204/);
});


test('principal setup-health metrics derive from active institution groups', () => {
  assert.match(html, /id="health-title"/);
  assert.match(html, /function renderInstitutionHealth\(\)[\s\S]{0,800}liveGroups\.length/);
  assert.match(html, /liveGroups\.filter\(function\(group\)\{return group\.room/);
  assert.match(html, /liveGroups\.filter\(function\(group\)\{return !!\(group\.subject/);
  assert.match(html, /No active academic groups are available yet/);
});

test('teacher and student roles enter safe shells before principal-only refresh', () => {
  assert.match(html, /const teacherRoles=\[['"]teacher['"],['"]faculty['"]\]/);
  assert.match(html, /const studentRoles=\[['"]student['"],['"]university_student['"]\]/);
  assert.match(html, /if\(teacherRoles\.indexOf\(role\)>=0\)\{showTeacherWorkspace\(\);return;\}/);
  assert.match(html, /if\(studentRoles\.indexOf\(role\)>=0\)\{showStudentWorkspace\(\);return;\}/);
  for (const name of ['showTeacherWorkspace','showStudentWorkspace']) {
    const match = html.match(new RegExp('function '+name+'\\(\\)\\{([\\s\\S]*?)\\n \\}'));
    assert.ok(match, name+' exists');
    assert.doesNotMatch(match[1], /from\(['"]academic_groups['"]\)|functions\.invoke/);
  }
  assert.match(html, /activeMemberships\.length>1/);
});

test('password recovery flow validates matching passwords and updates Supabase Auth', () => {
  assert.match(html, /id="noor-password-reset-form"/);
  assert.match(html, /event===['"]PASSWORD_RECOVERY['"]/);
  assert.match(html, /client\.auth\.updateUser\(\{password:password\}\)/);
  assert.match(html, /password!==resetPasswordConfirm\.value/);
  assert.match(html, /Use at least 8 characters for your new password/);
});

test('principal attendance reads are institution-scoped and safely rendered', () => {
  assert.match(html, /function loadRecentAttendance\(\)[\s\S]{0,700}from\(['"]attendance_records['"]\)[\s\S]{0,300}eq\(['"]institution_id['"],\s*membership\.institution_id\)/);
  assert.match(html, /from\(['"]class_sessions['"]\)\.select\(['"]id,title,academic_group_id['"]\)\.eq\(['"]institution_id['"],\s*membership\.institution_id\)/);
  assert.match(html, /statusCell\.appendChild\(status\)/);
  assert.match(html, /No attendance has been marked yet for this institution/);
});

test('keyboard focus and reduced-motion preferences are supported', () => {
  assert.match(html, /:focus-visible/);
  assert.match(html, /prefers-reduced-motion\s*:\s*reduce/);
});

test('Ask Noor requires authenticated institution membership and server-side Gemini secret', () => {
  assert.match(askNoorSource, /Deno\.env\.get\(["']GEMINI_API_KEY["']\)/);
  assert.match(askNoorSource, /supabase\.auth\.getUser\(\)/);
  assert.match(askNoorSource, /\.eq\(["']institution_id["'],\s*institutionId\)/);
  assert.match(askNoorSource, /x-goog-api-key/);
  assert.match(askNoorSource, /prompt\.length > 4000/);
  assert.match(askNoorSource, /AbortController/);
  assert.doesNotMatch(askNoorSource, /AIza[0-9A-Za-z_-]{20,}/);
});

test('Brevo mail is administrator-gated and limited to institution membership addresses', () => {
  assert.match(emailFunctionSource, /Deno\.env\.get\(["']BREVO_API_KEY["']\)/);
  assert.match(emailFunctionSource, /adminRoles\.has\(membership\.role\)/);
  assert.match(emailFunctionSource, /\.eq\(["']institution_id["'],\s*institutionId\)/);
  assert.match(emailFunctionSource, /\.eq\(["']invited_email["'],\s*recipientEmail\)/);
  assert.match(emailFunctionSource, /https:\/\/api\.brevo\.com\/v3\/smtp\/email/);
  assert.match(emailFunctionSource, /textContent:\s*message/);
  assert.doesNotMatch(emailFunctionSource, /xkeysib-[A-Za-z0-9_-]{20,}/);
});
