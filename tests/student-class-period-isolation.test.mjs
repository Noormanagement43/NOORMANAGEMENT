import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../student-portal.js',import.meta.url),'utf8');
const ctx=vm.createContext({window:{},E:v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;'),classText:()=> 'Class 8',sectionText:()=> 'Section B',empty:v=>v});
vm.runInContext(source.slice(source.indexOf('function ownClassPeriods'),source.indexOf('async function studentPeriods')),ctx);
const me={class_id:'class8',section_id:'sectionB'};
const row={id:'mine',institution_id:'school',academic_group_id:'sectionB',weekday:2,period_number:1,start_time:'08:00',end_time:'08:45',subject_name:'English',teacher_name:'Teacher A',lesson:'Grammar',topic:'Tenses'};
test('only the enrolled section and whole-class periods survive the student display filter',()=>{
 const rows=[row,{...row,id:'classwide',academic_group_id:'class8'},{...row,id:'other-section',academic_group_id:'sectionA'},{...row,id:'other-class',academic_group_id:'class9'},{...row,id:'other-school',institution_id:'other'},{id:'unscoped'}];
 assert.deepEqual(Array.from(ctx.ownClassPeriods(rows,me,'school'),r=>r.id),['mine','classwide']);
});
test('missing verified enrollment fails closed and cannot reveal a different section',()=>{
 assert.equal(ctx.ownClassPeriods([row],{},'school').length,0);assert.equal(ctx.ownClassPeriods([row],me,'').length,0);
 assert.equal(ctx.ownClassPeriods([row],{class_id:'class8'},'school').length,0);
});
test('legacy period rows must also carry the correct school and class',()=>{
 const legacy={id:'old',school_id:'school',class_id:'class8',section_id:'sectionB'};
 assert.equal(ctx.ownClassPeriods([legacy],me,'school').length,1);
 assert.equal(ctx.ownClassPeriods([{...legacy,section_id:'sectionA'},{...legacy,class_id:'class9'},{...legacy,school_id:'other'},{...legacy,class_id:null}],me,'school').length,0);
});
test('today list remains sequential across all class teachers and excludes other days',()=>{
 const list=ctx.studentDayPeriods([{...row,id:'later',period_number:3,start_time:'10:00'},row,{...row,id:'next-day',weekday:3}],me,'school',2);
 assert.deepEqual(Array.from(list,r=>r.period_number),[1,3]);
});
test('elapsed time does not invent teacher completion',()=>{
 assert.equal(ctx.studentPeriodState({...row,schedule_status:'Finished'}).label,'Awaiting update');
 assert.equal(ctx.studentPeriodState({...row,completed:true}).label,'Completed');
 assert.equal(ctx.studentPeriodState({...row,progress_status:'ongoing'}).label,'In Progress');
 assert.equal(ctx.studentPeriodState({...row,schedule_status:'Scheduled now'}).label,'Scheduled now');
});
test('dashboard and full timetable share real teacher, time and lesson details with escaped text',()=>{
 for(const linked of [true,false]){const html=ctx.studentPeriodCards([row],linked);for(const text of ['08:00','08:45','Teacher A','Grammar','Tenses','Class 8','Section B'])assert.ok(html.includes(text));assert.equal(html.includes('data-sp-nav'),linked);}
 assert.doesNotMatch(ctx.studentPeriodCards([{...row,topic:'<script>bad()</script>'}]),/<script>/);
});
