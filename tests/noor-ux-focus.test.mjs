import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('teacher has one concise navigation list with twelve relevant destinations',async()=>{
  const page=await read('index.html');
  const menu=page.split("if(role==='teacher')return ")[1]?.split("if(role==='parent')return ")[0];
  assert.ok(menu,'Teacher navigation must exist');
  const ids=[...menu.matchAll(/\{id:'([^']+)'/g)].map(m=>m[1]);
  assert.equal(ids.length,12);
  assert.equal(new Set(ids).size,12);
  assert.deepEqual(ids.slice(0,5),['overview','attendance','schedules','teacher-classroom','paper-generator']);
  assert.ok(!ids.includes('rubric-assistant')&&!ids.includes('teaching-diary')&&!ids.includes('student-gaps'),'Specialist tools should stay inside the advanced studio, not duplicate sidebar entries');
  assert.ok(page.includes('noor-role-focus.css'));
  assert.doesNotMatch(page,/id="creatorGeminiKey"|id="creatorBrevoKey"|btnSaveCreatorKeys|https:\/\/api\.brevo\.com\/v3\/smtp\/email/);
});

test('teacher first viewport has exactly four high-value quick actions and attendance after profile',async()=>{
  const code=await read('teacher-reference.js');
  assert.doesNotThrow(()=>new Script(code));
  const actions=code.slice(code.indexOf('const tiles')-200); // source tiles are built as HTML, not a JS constant
  void actions;
  const section=code.slice(code.indexOf('nt-3d-quick-grid nt-refined-actions'),code.indexOf('nt-jinni-card'));
  assert.equal((section.match(/class="nt-3d-quick-btn"/g)||[]).length,4);
  assert.match(section,/Take Attendance/);
  assert.match(section,/Create Assignment/);
  assert.match(section,/Share Smart Notes/);
  assert.match(section,/Marks & Results/);
  assert.match(code,/profileNode\?\.insertAdjacentElement\('afterend',priority\)/);
  assert.match(code,/priorityGrid\.append\(attendance\)/);
  assert.match(code,/const advance=document\.createElement\('details'\)/);
  assert.equal((code.match(/id="ntTeacherIntelligence"/g)||[]).length,1);
  assert.ok(!code.includes('nt-reference-panels'),'No duplicate legacy dashboard panels');
});

test('advanced teaching tools have focused presentation, not duplicate top-level modules',async()=>{
  const code=await read('noor-teacher-intelligence.js');
  const start=code.indexOf('const FEATURE_TILES=[');
  const end=code.indexOf('];',start);
  assert.ok(start>=0 && end>start);
  const tiles=code.slice(start,end);
  assert.equal((tiles.match(/\['/g)||[]).length,4);
  for(const label of ['Learning Gap Detector','Syllabus Progress','Deadline Planner','Rubric & Grading'])assert.ok(tiles.includes(label));
  const style=await read('noor-role-focus.css');
  assert.match(style,/nt-priority-grid/);
  assert.match(style,/nt-advanced-details/);
  assert.match(style,/nt-refined-actions/);
  assert.doesNotMatch(style,/\.nt-photo\s*\{|\.sp-avatar\s*\{|\.pd-photo\s*\{/);
});

test('new Supabase AI endpoint respects institution membership and holds secrets server-side',async()=>{
  const code=await read('supabase/functions/noor-v2-ai/index.ts');
  assert.match(code,/institution_memberships/);
  assert.match(code,/\.eq\("user_id",uid\)\.eq\("status","active"\)/);
  assert.match(code,/GEMINI_API_KEY/);
  assert.match(code,/auth\.getUser\(bearer\)/);
  assert.match(code,/verify|institution/);
  assert.doesNotMatch(code,/SUPABASE_SERVICE_ROLE_KEY/);
  const config=await read('config.js');
  assert.match(config,/npzedchxfurcphvpjock/);
  assert.doesNotMatch(config,/ayrryemawwplguaauxij/);
});
