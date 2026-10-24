import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const authPage = await readFile(new URL('../auth.html', import.meta.url), 'utf8');
const registrationMigration = await readFile(new URL('../supabase/migrations/20261024040000_register_institution_for_current_user.sql', import.meta.url), 'utf8');

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
  assert.match(html, /emailRedirectTo:'https:\/\/noormanagement43\.github\.io\/NOORMANAGEMENT\//);
});

test('legacy auth URL forwards to the single active auth gate', () => {
  assert.match(authPage, /window\.location\.replace\('\.\/index\.html'/);
  assert.doesNotMatch(authPage, /Authentication is not connected yet|Nothing was submitted/);
});
