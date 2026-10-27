import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('all three dashboards use reference design components without inventing school data',async()=>{
 const student=await read('student-portal.js');
 const teacher=await read('teacher-reference.js');
 const principal=await read('principal-live.js');
 for(const [name,source] of [['student',student],['teacher',teacher],['principal',principal]]){
  assert.doesNotThrow(()=>new Script(source,{filename:name+'.js'}));
 }
 for(const item of ['sp-ref-hero','sp-ref-grid-top','sp-ref-grid-middle','sp-ref-grid-bottom','sp-ref-subject-bars','sp-ref-att-ring','sp-ref-period','sp-ref-action']){
  assert.match(student,new RegExp(item));
 }
 assert.match(student,/No teacher-marked assessment results available yet/);
 assert.doesNotMatch(student,/demoMarks|activeVals = vals\.length/);
 for(const item of ['realTeachingAnalytics','Subject-Wise Teaching Progress','Teaching Period Timeline','Today’s Status Overview']){
  assert.ok(teacher.includes(item),'Teacher missing '+item);
 }
 assert.match(teacher,/runs\.get\(period\.id\)\?\.status==='done'/);
 assert.doesNotMatch(teacher,/Avg 86\.6%|85% Peak|100 \/ 85 ✓/);
 assert.doesNotMatch(principal,/mock-c|Classes 6 – 10 Benchmark/);
});

test('dashboard colors and profiles preserve existing portrait sizes',async()=>{
 const [html,reference,charts]=await Promise.all([read('index.html'),read('noor-dashboard-reference.css'),read('noor-dashboard-charts.css')]);
 assert.match(html,/\.nt-photo,\.sp-avatar,\.pd-photo\{width:140px!important;height:185px!important/);
 assert.match(html,/noor-dashboard-reference\.css/);
 assert.match(html,/noor-dashboard-charts\.css/);
 assert.match(reference,/#workspace\.noor-teacher-activated/);
 assert.match(reference,/#noor-principal/);
 assert.match(reference,/\.sp-reference-dashboard/);
 assert.match(reference,/#360817/);
 assert.match(charts,/\.sp-ref-subject-bars/);
 assert.match(charts,/\.nt-ref-analytics/);
 assert.doesNotMatch(reference,/(?:\.nt-photo|\.sp-avatar|\.pd-photo)\s*\{[^}]*\b(?:width|height)\s*:/);
});

test('search routes to actual authorised nav entries; demo hub cannot rewrite school membership',async()=>{
 const [html,script]=await Promise.all([read('index.html'),read('noor-dashboard-navigation.js')]);
 assert.match(html,/id="noorReferenceNavSearch"/);
 assert.match(html,/noor-dashboard-navigation\.js/);
 assert.match(html,/noor-dashboard-navigation\.css/);
 assert.match(html,/select\.disabled=true/);
 assert.doesNotMatch(html,/Switched to AL Noor Demo Hub|sch-alnoor-2026/);
 assert.doesNotThrow(()=>new Script(script));
 assert.match(script,/nav\.querySelectorAll\('button\[data-view\]'\)/);
 assert.match(script,/window\.NOOR_AI_APP\?\.openView\?\.\(id\)/);
});

test('student screenshot actions resolve to real accessible routes',async()=>{
 const [student,html]=await Promise.all([read('student-portal.js'),read('index.html')]);
 const ids=['student-schedule','student-learning','student-homework','student-questions','student-progress','student-attendance','student-calendar','notices','profile'];
 for(const id of ids){
  assert.ok(student.includes(id),'Missing student destination '+id);
  assert.ok(html.includes("id:'"+id+"'")||['profile','notices'].includes(id),'Missing nav route '+id);
 }
 assert.match(student,/data-sp-nav/);
 assert.match(student,/School Notices/);
 assert.match(student,/Today’s Schedule/);
});
