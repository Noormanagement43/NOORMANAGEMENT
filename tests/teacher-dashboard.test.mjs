import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../teacher-dashboard.js', import.meta.url), 'utf8');
const endpoint = await readFile(new URL('../supabase/functions/teacher-academic-data/index.ts', import.meta.url), 'utf8');

test('teacher dashboard is wired after the authenticated membership resolves', () => {
  assert.match(html, /window\.noorApp=\{client:client,getCurrentUser:function\(\)\{return currentUser\},getMembership:function\(\)\{return membership\}/);
  assert.match(html, /window\.dispatchEvent\(new CustomEvent\('noor:session-ready'\)\)/);
  assert.match(html, /window\.noorApp=null;window\.dispatchEvent\(new CustomEvent\('noor:session-ended'\)\)/);
  assert.match(html, /teacher-dashboard\.js\?v=/);
});

test('teacher UI obtains records only through the protected Edge Function', () => {
  assert.match(dashboard, /functions\.invoke\('teacher-academic-data'/);
  assert.match(dashboard, /action,\s*institution_id:\s*context\.member\.institution_id,\s*membership_id:\s*context\.member\.id/);
  assert.doesNotMatch(dashboard, /localStorage\.setItem\(['"]noor-preview-classes/);
  assert.doesNotMatch(dashboard, /Aarav Reddy|Sana Khan|Mihir Iyer|Fatima Ali/);
});

test('teacher permissions and institution membership are validated on the server', () => {
  assert.match(endpoint, /authClient\.auth\.getUser\(\)/);
  assert.match(endpoint, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(endpoint, /eq\("id", membershipId\)\.eq\("institution_id", institutionId\)/);
  assert.match(endpoint, /eq\("user_id", userResult\.user\.id\)\.eq\("status", "active"\)/);
  assert.match(endpoint, /teacherRoles\.has\(membership\.role\)/);
  assert.match(endpoint, /validGroupIds\.has\(groupId\)/);
  assert.match(endpoint, /eq\("teacher_membership_id", membershipId\)/);
  assert.doesNotMatch(dashboard, /SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_/);
});

test('attendance accepts only the four server-enforced statuses and validates the complete roster', () => {
  for (const status of ['present', 'absent', 'late', 'leave']) {
    assert.ok(endpoint.includes('"' + status + '"'), 'missing status: ' + status);
  }
  assert.match(endpoint, /attendanceStatuses\.has\(entry\.status\)/);
  assert.match(endpoint, /Duplicate student entries were rejected/);
  assert.match(endpoint, /submitted marks do not match the current active roster/);
  assert.match(endpoint, /attendance_records"\)\.insert/);
  assert.match(endpoint, /updated_at", prior\.updated_at/);
  assert.match(endpoint, /23505/);
});

test('corrections require a reason and use optimistic concurrency protection', () => {
  assert.match(endpoint, /correction_reason/);
  assert.match(endpoint, /correction reason of at least five characters is required/);
  assert.match(endpoint, /updated_at", prior\.updated_at/);
  assert.match(dashboard, /Changing a saved status or note requires a reason and confirmation/);
  assert.match(dashboard, /immutable audit table/i);
});

test('attendance workflow reloads saved server records before reporting verification', () => {
  assert.match(dashboard, /await loadRoster\(\)/);
  assert.match(dashboard, /Verified ' \+ verified \+ ' student statuses/);
  assert.match(dashboard, /attendance cannot be marked for a future date/i);
  assert.match(endpoint, /dateKey\(session\.starts_at, timezone\) !== attendanceDate/);
  assert.match(endpoint, /localTimeToIso/);
});

test('unsupported assignments and notices are disclosed rather than fabricated', () => {
  assert.match(endpoint, /assignments: false/);
  assert.match(endpoint, /submissions: false/);
  assert.match(endpoint, /notices: false/);
  assert.match(dashboard, /no assignment, submission, or resource tables/i);
  assert.match(dashboard, /no notice\/notification table is present/i);
});

test('teacher dashboard contains responsive accessible and theme-aware styles', () => {
  assert.match(dashboard, /@media\(max-width:540px\)/);
  assert.match(dashboard, /:focus-visible/);
  assert.match(dashboard, /prefers-reduced-motion/);
  assert.match(dashboard, /noor\.teacher\.dashboard\.theme/);
  assert.match(dashboard, /aria-live/);
});
