import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('targeted teacher and student module changes remain parseable',()=>{
 for(const name of ['noor-communications.js','noor-class-visuals.js','noor-teacher-data.js','teacher-reference.js','noor-learning-studio.js','noor-shared-timetable.js','student-portal.js']){
  assert.doesNotThrow(()=>new vm.Script(file(name),{filename:name}),name);
 }
});
test('school notices show exactly targeted recipients and do not claim Brevo email delivery',()=>{
 const s=file('noor-communications.js');
 for(const role of ['teacher','student','parent','all'])assert.match(s,new RegExp('name="audience" value="'+role+'"'));
 assert.match(s,/External email requires a separately verified Brevo delivery connection/);
 assert.match(s,/noor_school_messages/);
});
test('teacher attendance keeps one main register without duplicate calendars',()=>{
 const s=file('noor-teacher-data.js');
 assert.doesNotMatch(s,/data-attendance-history/);
 assert.match(s,/input data-date type="date"/);
 assert.match(s,/input type="radio" name="attendance-/);
 assert.doesNotMatch(s,/NOOR_TEACHER_ATTENDANCE_VIEW\.mount\(register\)/);
});
test('weekly planner connects dated plan subject to owned periods and preserves completed classes',()=>{
 const planner=file('noor-learning-studio.js');
 assert.match(planner,/syncPlanPeriods/);
 assert.match(planner,/planned_subject_name/);
 assert.match(planner,/if\(previous\.data\?\.completed\)\{completed\+\+;continue;\}/);
 assert.match(planner,/institution_period_slots/);
 const timetable=file('noor-shared-timetable.js');
 assert.match(timetable,/planned_subject_name/);
});
test('class section labels no longer load fruit photographs',()=>{
 const s=file('noor-class-visuals.js');
 assert.doesNotMatch(s,/sections\/mango\.jpg|sections\/apple\.jpg|<img class="noor-section-photo"/);
});
test('student schedule is one direct daily period list and notes remain teacher-published',()=>{
 const s=file('student-portal.js');
 const start=s.indexOf('function schedule(){'),end=s.indexOf('function studentNotices()',start);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(s.slice(start,end),/days\.map|Repeating period schedule/);
 assert.match(s,/Teacher-Published Notes/);
 assert.match(s,/sp-welcome-date/);
});
