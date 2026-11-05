import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../student-portal.js',import.meta.url),'utf8');
const context=vm.createContext({Intl,Date,app:()=>({school:{timezone:'Asia/Kolkata'}})});
vm.runInContext(source.slice(source.indexOf('function attendanceSchoolDay'),source.indexOf('async function readAll')),context);
test('today shows absent only from actual marks for today, not missing or yesterday',()=>{
 const today='2026-11-05';assert.equal(context.todayAttendance([{day:today,status:'absent'}],today),'Absent');assert.equal(context.todayAttendance([{day:'2026-11-04',status:'absent'}],today),'Not marked');assert.equal(context.todayAttendance([],today),'Not marked');assert.equal(context.todayAttendance([],today,true),'Unavailable');
});
test('present, late, leave and mixed sessions retain their real meanings',()=>{
 for(const [status,label] of [['present','Present'],['late','Late'],['leave','On leave']])assert.equal(context.todayAttendance([{day:'today',status}], 'today'),label);
 assert.equal(context.todayAttendance([{day:'today',status:'absent'},{day:'today',status:'present'}],'today'),'Mixed attendance');
});
test('school day respects midnight in the institution timezone',()=>{assert.equal(context.attendanceSchoolDay('2026-11-04T19:00:00Z'),'2026-11-05');assert.equal(context.attendanceSchoolDay('2026-11-04T18:00:00Z'),'2026-11-04');});
test('canonical records remain scoped to own membership; attendance day comes from session date',()=>{assert.match(source,/eq\('student_membership_id',me.membership_id\)/);assert.match(source,/from\('class_sessions'\).*eq\('institution_id',school\)/);assert.match(source,/attendance_date:attendanceSchoolDay\(x.starts_at\)/);assert.match(source,/Today: /);});
