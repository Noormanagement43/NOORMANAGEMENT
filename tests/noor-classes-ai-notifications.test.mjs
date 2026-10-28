import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('School and University class editor has separate loader and editable 1–10 setup',async()=>{
 const html=await source('index.html');
 assert.equal((html.match(/async function fetchStructureClasses\(schoolId\)/g)||[]).length,1);
 assert.equal((html.match(/async function fetchClasses\(schoolId\)/g)||[]).length,1);
 assert.match(html,/tabSchoolMode/);
 assert.match(html,/tabUnivMode/);
 assert.match(html,/btnGenerateSchoolClasses/);
 assert.match(html,/data-edit-structure-sec/);
 assert.match(html,/data-edit-structure-class/);
 assert.match(html,/data-archive-structure-sec/);
 assert.match(html,/data-add-stream="BPC"/);
 assert.match(html,/data-add-stream="MTC"/);
 assert.match(html,/addStructureItem\('school'\)/);
 assert.match(html,/addStructureItem\('university'\)/);
 assert.doesNotMatch(html,/type="button" class="btn light" data-add-stream="College Science Labs"/);
 assert.match(html,/\/\/ Reading the page is read-only/);
});

test('animated Gemini assistant and fake attendance UI are not loaded',async()=>{
 const [principal,teacher,html]=await Promise.all([source('principal-live.js'),source('teacher-reference.js'),source('index.html')]);
 assert.doesNotMatch(principal,/id="pd-ai-assistant"/);
 assert.doesNotMatch(teacher,/id="ntOpenJinni"/);
 assert.doesNotMatch(html,/<script src="\.\/noor-secure-assistant\.js/);
 assert.doesNotMatch(html,/<script src="\.\/noor-cartoon-mascot\.js/);
 assert.doesNotMatch(html,/<script src="\.\/teacher-reference-attendance\.js/);
});

test('secrets never leave server-only configuration',async()=>{
 const [config,legacy,paper,command,edge]=await Promise.all([
  source('config.js'),source('noor-ai-copilot.js'),source('teacher-paper-generator.js'),source('command-centre.js'),source('supabase/functions/noor-ai/index.ts')
 ]);
 assert.doesNotMatch(config,/localStorage|GEMINI_API_KEY/);
 assert.doesNotMatch(legacy,/localStorage|fetch\(/);
 assert.doesNotMatch(paper,/generativelanguage\.googleapis\.com|noor_gemini_api_key/);
 assert.doesNotMatch(command,/localStorage\.getItem\('noor_brevo_api_key'\)|https:\/\/api\.brevo\.com/);
 assert.match(edge,/Deno\.env\.get\("GEMINI_API_KEY"\)/);
 assert.match(edge,/authClient\.auth\.getUser\(token\)/);
 assert.match(command,/functions\.invoke\('noor-school-automation'/);
});

test('teacher assignment button opens editor without needing AI',async()=>{
 const [teacher,paper]=await Promise.all([source('teacher-reference.js'),source('teacher-paper-generator.js')]);
 assert.match(teacher,/dataset\.action==='create-assignment'/);
 assert.match(paper,/Write the assignment questions first/);
 assert.match(paper,/Replace every template placeholder/);
 assert.match(paper,/is_template:true/);
 assert.match(paper,/window\.NOOR_ASSIGNMENT_PORTAL\.publish/);
});

test('staff and student notification screens include published targeted school notices',async()=>{
 const [teacherStudent,student,academic]=await Promise.all([source('academic-extras.js'),source('student-portal.js'),source('academic.js')]);
 assert.match(teacherStudent,/\.from\('school_notices'\)/);
 assert.match(teacherStudent,/contains\('target_roles',\[role\(\)\]\)/);
 assert.match(student,/function studentNotifications\(\)/);
 assert.match(student,/notices\(\)/);
 assert.match(academic,/\.from\(isNotice\?'school_notices':'calendar_events'\)\.insert\(payload\)/);
});

test('learning-gap visualisations use recorded aggregates, not invented percentages',async()=>{
 const [logic,css]=await Promise.all([source('noor-teacher-intelligence.js'),source('noor-school-interactions.css')]);
 assert.match(logic,/noor-gap-bar/);
 assert.match(logic,/Math\.min\(100,Math\.max\(0,x\.avg\)\)/);
 assert.match(css,/#ntiGaps/);
 assert.match(css,/\.noor-gap-bar/);
});
