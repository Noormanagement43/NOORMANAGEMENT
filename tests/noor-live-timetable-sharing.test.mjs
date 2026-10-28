import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('only the original NOOR login remains publicly accessible',async()=>{
 const [oldLink,workspace,home]=await Promise.all([read('noor-v2.html'),read('noor-v2.js'),read('index.html')]);
 assert.match(oldLink, /window\.location\.replace\(new URL\('\.\/', window\.location\.href\)\.toString\(\)\)/);
 assert.match(oldLink,/http-equiv="refresh" content="0;url=\.\//);
 assert.match(oldLink,/href="\.\/">NOOR School Management/);
 assert.doesNotMatch(oldLink,/id="v2AuthForm"|noor-v2\.js|Inspire learning/);
 assert.doesNotMatch(home,/href="\.\/noor-v2\.html"|NOOR School Portal →/);
 assert.match(home,/noor-official-logo\.svg/);
 assert.match(home,/id="loginForm"/);
 assert.doesNotMatch(workspace,/NEW SUPABASE · VERIFIED ROLE ACCESS|Sign in to the new NOOR Management Supabase project/);
 assert.doesNotThrow(()=>new Script(workspace));
});

test('teacher creates, edits and removes own class period; Principal can only view it',async()=>{
 const source=await read('noor-v2.js');
 assert.match(source,/function canSchedule\(\)\{return teacherRoles\.includes/);
 assert.match(source,/if\(!canSchedule\(\)\)return say/);
 assert.match(source,/row\.teacher_membership_id!==state\.membership\.id/);
 assert.match(source,/if\(!form\.get\('academic_group_id'\)\)throw Error/);
 assert.match(source,/db\.from\('teacher_timetable_periods'\)\.insert\(payload\)/);
 assert.match(source,/db\.from\('teacher_timetable_periods'\)\.update/);
 assert.match(source,/db\.from\('teacher_timetable_periods'\)\.delete\(\)/);
 assert.match(source,/\.eq\('teacher_membership_id',state\.membership\.id\)/);
 assert.match(source,/window\.confirm\('Remove this period/);
 assert.match(source,/Save changes/);
 assert.match(source,/No Principal approval step is required/);
 assert.match(source,/Read-only live schedule/);
});

test('students see real class and section periods and own attendance, never fake marks',async()=>{
 const source=await read('noor-v2.js');
 assert.match(source,/function isStudent\(\)/);
 assert.match(source,/function viewGroups\(\)/);
 assert.match(source,/state\.enrollments/);
 assert.match(source,/function renderStudentHome\(\)/);
 assert.match(source,/function renderProgress\(\)/);
 assert.match(source,/\.eq\('student_membership_id',m\.id\)/);
 assert.match(source,/Verified subject marks are not available/);
 assert.match(source,/No percentages are invented/);
 assert.match(source,/case'progress':if\(isStudent\(\)\)renderProgress\(\)/);
});

test('all roles use one institution-scoped live timetable data source',async()=>{
 const [source,ddl,css]=await Promise.all([
  read('noor-v2.js'),
  read('supabase/new-project/migrations/20261028124212_noor_timetable_student_scoped_live_sharing.sql'),
  read('noor-live-timetable.css')
 ]);
 assert.match(source,/function fetchSchoolPeriods\(institutionId\)/);
 assert.match(source,/\.eq\('institution_id',institutionId\)/);
 assert.match(source,/staffNames=Object\.fromEntries/);
 assert.match(source,/Scheduled now/);
 for(const table of ['teacher_timetable_periods','academic_groups','academic_group_memberships','attendance_records']){
  assert.match(source,new RegExp("table:'"+table+"'"));
  assert.match(ddl,new RegExp("'"+table+"'"));
 }
 assert.match(source,/setInterval\(\(\)=>\{if\(state\.membership&&!document\.hidden\)refreshLive\(\)\},30000\)/);
 assert.match(ddl,/private\.is_my_membership\(my_group\.membership_id\)/);
 assert.match(ddl,/my_group\.group_id=teacher_timetable_periods\.academic_group_id/);
 assert.match(ddl,/enrolled_group\.parent_group_id=teacher_timetable_periods\.academic_group_id/);
 assert.match(ddl,/DROP POLICY IF EXISTS noor_v2_period_read_active_institution/);
 assert.match(css,/v2-period-current/);
 assert.match(css,/v2-student-progress/);
 assert.match(css,/repeat\(5,minmax\(0,1fr\)\)/);
});
