import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const get=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('original NOOR branding and login are preserved',async()=>{
 const html=await get('index.html');
 assert.match(html,/id="loginTab"/);
 assert.match(html,/id="ownerTab"/);
 assert.match(html,/noor-official-logo\.svg/);
 assert.match(html,/noor-school-timetable\.js/);
 assert.match(html,/noor-school-timetable\.css/);
 assert.doesNotMatch(html,/href="\.\/noor-v2\.html"/);
});

test('principal alone sets shared school period times; no teacher period assignment or delete',async()=>{
 const [ui,mod]=await Promise.all([get('principal-live.js'),get('noor-school-timetable.js')]);
 assert.doesNotThrow(()=>new Script(ui));
 assert.doesNotThrow(()=>new Script(mod));
 assert.match(ui,/School Bell Times/);
 assert.match(ui,/NOOR_SCHOOL_TIMETABLE\?\.openSchoolTimes/);
 assert.match(ui,/NOOR_SCHOOL_TIMETABLE\?\.mountPrincipal/);
 assert.doesNotMatch(ui,/function editPeriod\(id\)/);
 assert.doesNotMatch(ui,/async function removePeriod\(id, teacherId\)/);
 assert.doesNotMatch(ui,/db\.from\('noor_teacher_periods'\)\.insert/);
 assert.match(mod,/canSetBells\(\)/);
 assert.match(mod,/\.from\('noor_school_bell_slots'\)\.upsert\(saved/);
 assert.match(mod,/start_time:start,end_time:end/);
});

test('teacher can pick weekdays, class, section, subject, school slot once and change topic daily',async()=>{
 const mod=await get('noor-school-timetable.js');
 assert.match(mod,/function weekdayBoxes/);
 assert.match(mod,/school bell times are fixed/i);
 assert.match(mod,/class_id:cls,section_id:sec/);
 assert.match(mod,/db\(\)\.from\('noor_class_timetable'\)\.insert\(records\)/);
 assert.match(mod,/db\(\)\.from\('noor_class_timetable'\)\.update\(values\)/);
 assert.match(mod,/Remove My Period/);
 assert.match(mod,/data-nsto-topic/);
 assert.match(mod,/noor_daily_lesson_topics'\)\.upsert\(data/);
 assert.match(mod,/timetable_id,lesson_date/);
 assert.match(mod,/lesson_date/);
 assert.doesNotMatch(mod,/\.from\('teacher_assignments'\)/);
 assert.doesNotMatch(mod,/\.from\('noor_teacher_periods'\)/);
});

test('Principal and each student show real teacher timetable and topic, student is read-only',async()=>{
 const [principal,student,mod]=await Promise.all([get('principal-live.js'),get('student-portal.js'),get('noor-school-timetable.js')]);
 assert.match(principal,/NOOR_SCHOOL_TIMETABLE\?\.mountPrincipal/);
 assert.match(mod,/function principalTable\(\)/);
 assert.match(mod,/Today.s Topic/);
 assert.match(mod,/async function studentPeriods\(classId,sectionId\)/);
 assert.match(mod,/x\.section_id===sectionId/);
 assert.match(student,/NOOR_SCHOOL_TIMETABLE\?\.studentPeriods/);
 assert.match(student,/x\.lesson_topic/);
 assert.match(student,/noor_daily_lesson_topics/);
 assert.doesNotMatch(student,/\.from\('noor_teacher_periods'\)\.select\('id,weekday,period_number/);
});

test('new legacy project schema is safe, scoped and not a replacement login/project',async()=>{
 const sql=await get('supabase/migrations/20261028203000_school_bell_teacher_owned_timetable.sql');
 for(const t of ['noor_school_bell_slots','noor_class_timetable','noor_daily_lesson_topics'])assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS public\\.'+t));
 assert.match(sql,/NOOR original-school schema ONLY/);
 assert.match(sql,/teacher_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/me\.class_id=noor_class_timetable\.class_id/);
 assert.match(sql,/me\.section_id=noor_class_timetable\.section_id/);
 assert.match(sql,/private\.has_school_role\(school_id,ARRAY\['owner','principal'\]\)/);
 assert.match(sql,/CREATE POLICY noor_bells_principal_update/);
 assert.match(sql,/CREATE POLICY noor_timetable_teacher_update/);
 assert.match(sql,/CREATE POLICY noor_lesson_teacher_insert/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM public|SECURITY DEFINER/);
 assert.match(sql,/ALTER PUBLICATION supabase_realtime ADD TABLE/);
});
