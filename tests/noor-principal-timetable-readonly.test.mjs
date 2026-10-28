import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Principal dashboard does not assign or edit a teacher period; timetable remains visible',async()=>{
 const code=await read('principal-live.js');
 assert.doesNotThrow(()=>new Script(code));
 assert.match(code,/Teacher Daily Schedule & Active Periods/);
 assert.match(code,/id="pd-timetable"/);
 assert.match(code,/showTimetable/);
 assert.match(code,/id="pd-periods"/);
 assert.doesNotMatch(code,/id="pd-add-teacher"/);
 assert.doesNotMatch(code,/data-edit-period/);
 assert.doesNotMatch(code,/data-remove-period/);
 assert.doesNotMatch(code,/openAddTeacherModal/);
 assert.doesNotMatch(code,/editPeriod\(/);
 assert.doesNotMatch(code,/removePeriod\(/);
 assert.doesNotMatch(code,/\.from\('noor_teacher_periods'\)\.insert\(/);
 assert.doesNotMatch(code,/\.from\('noor_teacher_periods'\)\.delete\(/);
});

test('Principal sidebar has Staff & Access and classes, but no Assign Teacher page',async()=>{
 const html=await read('index.html');
 assert.match(html,/id:'staff-management',icon:'♧',label:'Staff & Access'/);
 assert.match(html,/id:'classes',icon:'▦',label:'Classes & Sections'/);
 assert.doesNotMatch(html,/label:'Teacher Assignments'/);
 assert.doesNotMatch(html,/label:'Timetables & Teachers'/);
 assert.doesNotMatch(html,/principal-teacher-approvals\.js\?v=/);
 assert.match(html,/id==='teacher-assignments'&&\['owner','principal','manager'\]\.includes/);
 assert.match(html,/principal-live\.js\?v=20261028-global-mode/);
 assert.match(html,/id="loginTab"/);
 assert.match(html,/noor-official-logo\.svg/);
});

test('retired Principal assignment module cannot write teacher-assignment data',async()=>{
 const retired=await read('noor-teacher-setup.js');
 assert.doesNotThrow(()=>new Script(retired));
 assert.doesNotMatch(retired,/\.from\('teacher_assignments'\)/);
 assert.doesNotMatch(retired,/\.from\('noor_teacher_periods'\)/);
 assert.doesNotMatch(retired,/Assign a teacher</);
 assert.match(retired,/Staff & Access/);
 assert.match(retired,/openView\?\.\('overview'\)/);
});

test('teacher and student login and dashboards remain present; school data untouched',async()=>{
 const [teacher,student,config]=await Promise.all([read('teacher-reference.js'),read('student-portal.js'),read('config.js')]);
 assert.match(teacher,/async function showPeriodEditor/);
 assert.match(teacher,/create-assignment/);
 assert.match(student,/View Timetable|My Academic Progress/);
 assert.match(config,/SUPABASE_URL/);
});
