import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Script } from 'node:vm';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const authPage = await readFile(new URL('../auth.html', import.meta.url), 'utf8');
const principalPage = await readFile(new URL('../principal.html', import.meta.url), 'utf8');
const configJs = await readFile(new URL('../config.js', import.meta.url), 'utf8');
const registrationMigration = await readFile(new URL('../supabase/migrations/20261024040000_register_institution_for_current_user.sql', import.meta.url), 'utf8');

test('authentication system contains all required role portals and registration tabs', () => {
  // Tabs: Login, Student sign-up, Create a school, Join school staff
  assert.match(html, /id="loginTab"/);
  assert.match(html, /id="registerTab"/);
  assert.match(html, /id="ownerTab"/);
  assert.match(html, /id="joinTab"/);

  // Portal selection: Student, Teacher, Management, Platform Creator
  assert.match(html, /data-portal="student"/);
  assert.match(html, /data-portal="teacher"/);
  assert.match(html, /data-portal="management"/);
  assert.match(html, /data-portal="creator"/);

  // Leadership selection: Principal, School Admin, Manager
  assert.match(html, /data-leadership-role="principal"/);
  assert.match(html, /data-leadership-role="owner"/);
  assert.match(html, /data-leadership-role="manager"/);

  // Password utilities
  assert.match(html, /id="toggleLoginPassword"/);
  assert.match(html, /id="forgotBtn"/);
  assert.match(html, /id="resendConfirmBtn"/);
});

test('frontend code only contains publishable keys and no privileged secrets', () => {
  const combinedFrontend = html + authPage + principalPage + configJs;
  assert.match(combinedFrontend, /sb_publishable_[A-Za-z0-9_]+/);
  assert.doesNotMatch(combinedFrontend, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|AIza[0-9A-Za-z_-]{20,}/);
});

test('institution registration validates auth and does not grant anonymous execution', () => {
  assert.match(registrationMigration, /security definer/i);
  assert.match(registrationMigration, /set search_path = ''/i);
  assert.match(registrationMigration, /if v_user_id is null then/i);
  assert.match(registrationMigration, /v_type not in \('school', 'university'\)/i);
  assert.match(registrationMigration, /revoke all on function public\.register_institution_for_current_user\(text, text, text\) from public/i);
  assert.match(registrationMigration, /revoke all on function public\.register_institution_for_current_user\(text, text, text\) from anon/i);
  assert.match(registrationMigration, /grant execute on function public\.register_institution_for_current_user\(text, text, text\) to authenticated/i);
});

test('institution registration cannot self-assign Creator/platform privileges', () => {
  assert.match(registrationMigration, /role, status, invited_by, joined_at/);
  assert.match(registrationMigration, /'principal', 'active'/);
  assert.doesNotMatch(registrationMigration, /insert\s+into\s+public\.platform_roles/i);
  assert.match(registrationMigration, /m\.user_id = v_user_id and m\.status = 'active'/);
  assert.match(registrationMigration, /v_slug !~ '\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$'|v_slug !~/);
  assert.match(registrationMigration, /length\(v_slug\) > 80/i);
});

test('legacy auth URL forwards to the integrated secure sign-in flow', () => {
  assert.match(authPage, /http-equiv="refresh" content="0;url=\.\/index\.html"/);
  assert.match(authPage, /location\.replace\(['"]\.\/index\.html['"]\)/);
  assert.doesNotMatch(authPage, /Authentication is not connected yet|No sign-in was attempted/);
});

test('principal dashboard provides dedicated institution view', () => {
  assert.match(principalPage, /id="dashboard"/);
  assert.match(principalPage, /id="authbox"/);
  assert.match(principalPage, /functions\.invoke\('principal-dashboard-data'/);
});

test('all inline JavaScript blocks across HTML files parse without syntax errors', async () => {
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

test('all root JavaScript modules parse without syntax errors', async () => {
  const rootDir = new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      const code = await readFile(join(rootDir, entry.name), 'utf8');
      assert.doesNotThrow(() => new Script(code, { filename: entry.name }), `Module ${entry.name} has syntax error`);
    }
  }
});

test('all sound scripts parse without syntax errors', async () => {
  const soundDir = new URL('../sounds/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const entries = await readdir(soundDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      const code = await readFile(join(soundDir, entry.name), 'utf8');
      assert.doesNotThrow(() => new Script(code, { filename: entry.name }), `Sound script ${entry.name} has syntax error`);
    }
  }
});

test('all smoke scripts parse without syntax errors', async () => {
  const scriptDir = new URL('../scripts/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const entries = await readdir(scriptDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.mjs')) {
      const filePath = join(scriptDir, entry.name);
      assert.doesNotThrow(() => {
        execFileSync(process.execPath, ['--check', filePath], { stdio: 'pipe' });
      }, `Smoke script ${entry.name} has syntax error`);
    }
  }
});

test('core application assets and stylesheet references exist', () => {
  assert.match(html, /academic\.js/);
  assert.match(html, /command-centre\.js/);
  assert.match(html, /student-portal\.js/);
  assert.match(html, /teacher-reference\.js/);
  assert.match(html, /theme-system\.js/);
  assert.match(html, /sounds\/sound-manager\.js/);
  assert.match(html, /noor-official-logo\.svg/);
});
