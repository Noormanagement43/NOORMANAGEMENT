import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('dark-mode action contrast and keyboard focus rules are present',async()=>{
 const css=await read('noor-palettes.css');
 assert.match(css,/data-noor-mode="dark"\]\s+#workspace\s+:is\(\.btn\.light/);
 assert.match(css,/focus-visible\s*\{outline:3px solid #f3d294/i);
 assert.match(css,/data-noor-mode="dark"\].*noor-tt-form button/);
});
test('teacher profile dialog follows light/dark design tokens and is loaded',async()=>{
 const [html,js]=await Promise.all([read('index.html'),read('teacher-profile-editor.js')]);
 assert.match(html,/teacher-profile-editor\.js\?v=20261104-dark-profile-1/);
 assert.match(js,/var\(--paper,#fff\)/);
 assert.match(js,/var\(--ink,#302950\)/);
 assert.match(js,/\.eq\('id',app\.user\.id\)\.eq\('school_id',app\.schoolId\)/);
});
test('navigation recovery and teacher-owned periods remain wired',async()=>{
 const [html,setup]=await Promise.all([read('index.html'),read('noor-teacher-setup.js')]);
 for(const marker of ['forgot-password.html','PASSWORD_RECOVERY','mobileBackBtn','noorGoBack'])assert.ok(html.includes(marker),marker);
 assert.match(setup,/Period and subject allocation belongs to the signed-in Teacher/);
});

test('recovery callback cannot enter dashboard before a password reset',async()=>{
 const html=await read('index.html');
 assert.match(html,/noorRecoveryActive\s*=\s*\/(?:.|\n)+?type=recovery/);
 assert.match(html,/if\(session\?\.user&&!noorRecoveryActive\)await enterWorkspace/);
 assert.match(html,/if\(event==='PASSWORD_RECOVERY'\)\{noorRecoveryActive=true/);
 assert.match(html,/await supabaseClient\.auth\.signOut\(\);noorRecoveryActive=false/);
});
test('principal quick actions open distinct notices, meetings and command-centre routes',async()=>{
 const html=await read('index.html');
 assert.match(html,/onclick="openView\('notices'\)">Notices<\/button>/);
 assert.match(html,/onclick="openView\('meetings'\)">Meetings<\/button>/);
 assert.match(html,/\['command-centre','email-automation','school-tasks','school-calendar'/);
});

test('free AI Manager uses Groq for both planning and drafting',async()=>{
 const source=await read('supabase/functions/noor-v2-ai/index.ts');
 assert.match(source,/const manager=config\('groq'\)/);
 assert.match(source,/const plan=await generate\('groq'/);
 assert.match(source,/const response=await generate\('groq'/);
 assert.doesNotMatch(source,/const plan=await generate\('openai'/);
 assert.doesNotMatch(source,/OPENAI_MANAGER_MODEL in Supabase Secrets to enable the manager/);
});
test('canonical student reports and calendar are bound to scoped real records',async()=>{
 const source=await read('noor-v2.js');
 for(const route of ['noor_calendar_events','noor_assessment_results','attendance_records']){
  assert.ok(source.includes("db.from('"+route+"')"),route);
 }
 assert.match(source,/eq\('student_membership_id',m\.id\)/);
 assert.match(source,/function studentAttendanceChart\(\)/);
 assert.match(source,/function studentMarksChart\(\)/);
 assert.match(source,/function renderCalendar\(\)/);
 assert.match(source,/state\.calendarEvents=calendarEvents\.data\|\|\[\]/);
});
