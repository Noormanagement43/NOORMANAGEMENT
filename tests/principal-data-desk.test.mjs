import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../principal-data-desk.js', import.meta.url), 'utf8');

test('principal data desk is loaded by the existing application shell', () => {
  assert.match(html, /principal-data-desk\.js\?v=20261024/);
  assert.match(html, /principal-studio\.js[\s\S]{0,180}principal-live\.js[\s\S]{0,150}principal-data-desk\.js/);
  assert.doesNotThrow(() => new Script(source, { filename: 'principal-data-desk.js' }));
});

test('data desk is restricted to the existing verified active principal workspace', () => {
  assert.match(source, /\['owner', 'principal'\]\.includes\(p\?\.role\)/);
  assert.match(source, /p\?\.status === 'active'/);
  assert.match(source, /p\?\.school_id === schoolId\(\)/);
  assert.match(source, /verification_status === 'verified'/);
  assert.match(source, /account_status === 'active'/);
  assert.match(source, /is_active === true/);
  assert.match(source, /if \(!v \|\| !h \|\| !v\.classList\.contains\('active'\) \|\| !allowed\(\)\) return/);
});

test('directory reads are school-scoped, searchable, and paginated', () => {
  assert.match(source, /from\('profiles'\)\.select\('id,full_name,class_id,section_id,role,status', \{count:'exact'\}\)/);
  assert.match(source, /\.eq\('school_id', sid\)\.eq\('status', 'active'\)/);
  assert.match(source, /\.in\('role', \['teacher', 'staff'\]\)/);
  assert.match(source, /\.ilike\('full_name', '%' \+ term \+ '%'\)/);
  assert.match(source, /\.range\(pageNumber \* PAGE_SIZE, pageNumber \* PAGE_SIZE \+ PAGE_SIZE - 1\)/);
});

test('class and section directory derives related rows from school-scoped classes', () => {
  assert.match(source, /from\('classes'\)\.select\('id,name,sort_order', \{count:'exact'\}\)/);
  assert.match(source, /\.eq\('school_id', sid\)\.eq\('is_active', true\)/);
  assert.match(source, /from\('sections'\)\.select\('id,name,class_id'\)/);
  assert.match(source, /\.in\('class_id', ids\)/);
  assert.match(source, /No active classes\/groups match this search/);
});

test('attendance register filters institution, date, status, and uses the supported attendance values', () => {
  assert.match(source, /from\('attendance_sessions'\)/);
  assert.match(source, /\.eq\('school_id', sid\)/);
  assert.match(source, /\.eq\('attendance_date', day\)/);
  assert.match(source, /\.eq\('status', 'submitted'\)/);
  assert.match(source, /from\('attendance_records'\)/);
  assert.match(source, /\.eq\('school_id', sid\)\.in\('session_id', sessionIds\)/);
  for (const state of ['present', 'absent', 'late', 'leave']) {
    assert.match(source, new RegExp('value="' + state + '"'));
  }
});

test('dynamic database output is inserted as text, not executable HTML', () => {
  assert.match(source, /cell\.textContent = String\(value \?\? '—'\)/);
  assert.match(source, /badge\.textContent = String\(value\.text \?\? ''\)/);
  assert.match(source, /cell\.textContent = message/);
  assert.doesNotMatch(source, /innerHTML\s*=\s*[^;]*(result\.data|item\.full_name|record\.student|item\.name)/);
});

test('loading, empty, permission, network, and generic error states are explicit', () => {
  assert.match(source, /Loading live school records/);
  assert.match(source, /No active student records match this search/);
  assert.match(source, /No attendance records match these filters/);
  assert.match(source, /Access was denied by the database policy/);
  assert.match(source, /data service could not be reached/);
  assert.match(source, /Records could not be loaded/);
});

test('data desk does not introduce database mutations or privileged credentials', () => {
  assert.doesNotMatch(source, /\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(source, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|AIza[0-9A-Za-z_-]{20,}/);
  assert.match(source, /Row-Level Security remains the security boundary/);
});
