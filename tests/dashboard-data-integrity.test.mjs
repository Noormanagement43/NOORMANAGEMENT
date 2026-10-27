import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const source=async name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('dashboard scripts remain parseable JavaScript',async()=>{
  for(const file of ['teacher-reference.js','student-portal.js','principal-live.js']){
    const js=await source(file);
    assert.doesNotThrow(()=>new Script(js,{filename:file}));
  }
});

test('student performance never falls back to fabricated report-card marks',async()=>{
  const code=await source('student-portal.js');
  assert.doesNotMatch(code,/demoMarks|activeVals = vals\.length/);
  assert.match(code,/No teacher-marked assessment results available yet/);
  assert.match(code,/return vals\.map/);
});

test('principal analytics use recorded submissions and no benchmark fallback',async()=>{
  const code=await source('principal-live.js');
  assert.doesNotMatch(code,/mock-c|Classes 6 – 10 Benchmark|Present \(Optimal\)|\[92, 88, 95, 85, 90\]/);
  assert.match(code,/attendance_date===day&&x\.status==='submitted'/);
  assert.match(code,/No classes 6–10 have been created yet/);
});

test('teacher dashboard metrics are drawn from real period records',async()=>{
  const code=await source('teacher-reference.js');
  assert.doesNotMatch(code,/Avg 86\.6%|85% Peak|100 \/ 85 ✓|Chat with NOOR AI Jinni/);
  assert.match(code,/Today’s periods/);
  assert.match(code,/dataset\.action==='take-attendance'/);
  assert.match(code,/dataset\.action==='upload-resource'/);
});

test('existing large profile portraits and photo editing remain untouched',async()=>{
  const [html,teacher,principal,student]=await Promise.all([
    source('index.html'),source('teacher-reference.js'),source('principal-live.js'),source('student-portal.js')
  ]);
  assert.match(html,/\.nt-photo,\.sp-avatar,\.pd-photo/);
  assert.match(teacher,/id="ntChangePhoto"/);
  assert.match(principal,/class="pd-photo"/);
  assert.match(student,/class="sp-avatar"/);
});
