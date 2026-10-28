import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('profile photos are isolated to the signed-in identity and storage session per browser tab',async()=>{
 const html=await read('index.html');
 assert.match(html,/storage:window\.sessionStorage/);
 assert.match(html,/auth\.getUser\(\)/);
 assert.match(html,/authData\?\.user\?\.id!==userId/);
 assert.match(html,/\$\{userId\}\/profile-\$\{Date\.now\(\)\}-\$\{crypto\.randomUUID\(\)\}/);
 assert.match(html,/\.update\(\{avatar_path:path\}\)\.eq\('id',userId\)\.select\('id'\)/);
 assert.doesNotMatch(html,/!file&&\$\('studentPhoto'\)\.files/);
 assert.match(html,/\.nt-photo,\.sp-avatar,\.pd-photo\{width:140px!important;height:185px!important/);
});

test('manager has same verified school principal layout without overriding the manager profile',async()=>{
 const [html,studio,principal]=await Promise.all([read('index.html'),read('principal-studio.js'),read('principal-live.js')]);
 assert.match(studio,/\['owner','principal','manager'\]/);
 assert.match(html,/\['owner','principal','manager'\]\.includes\(role\)/);
 assert.match(principal,/p\.role==='manager'\?'Manager'/);
 assert.match(principal,/p\.full_name\|\|leadershipLabel/);
 assert.doesNotMatch(html,/schoolHubSwitcher" class="school-hub-switcher"/);
 assert.match(html,/Manager access must be granted by the School Owner using a secure invitation/);
});

test('principal classes 6–10 show only attendance percentage ring and class bars',async()=>{
 const principal=await read('principal-live.js');
 assert.match(principal,/const donutHTML/);
 assert.match(principal,/const barChartSvg/);
 assert.match(principal,/return '<div class="pd-chart-pair">'\+donutHTML\+barChartSvg/);
 assert.doesNotMatch(principal,/Multi-section Line Trend Chart|Section Trend Lines|lineChartHTML/);
 assert.doesNotThrow(()=>new Script(principal));
});

test('teacher attendance is actual authorised database workflow, never a fake demo roster',async()=>{
 const [html,teacher,attendance]=await Promise.all([read('index.html'),read('teacher-reference.js'),read('teacher-attendance.js')]);
 assert.doesNotMatch(html,/script src="\.\/teacher-reference-attendance\.js/);
 assert.doesNotMatch(teacher,/NOOR_TEACHER_EMBED/);
 assert.match(teacher,/nt-quote-actions/);
 assert.match(teacher,/Open Register/);
 const module=await read('noor-school-timetable.js');
 assert.match(module,/Class<select name="class_id"/);
 assert.match(module,/Section<select name="section_id"/);
 assert.match(attendance,/\.from\('noor_teacher_periods'\)/);
 assert.match(attendance,/\.from\('teacher_assignments'\)/);
 assert.match(attendance,/\.from\('attendance_sessions'\)/);
 assert.doesNotThrow(()=>new Script(teacher));
});

test('four light theme references plus safe legacy colours apply to login and all dashboards',async()=>{
 const [theme,styles,html]=await Promise.all([read('theme-system.js'),read('noor-palettes.css'),read('index.html')]);
 for(const id of ['pastel-aurora','linen-pearl','porcelain-blue','rose-whisper','rose-gold','ocean-blue','sage-garden']){
  assert.match(theme,new RegExp(id));
  assert.match(styles,new RegExp('data-noor-theme="'+id+'"'));
 }
 for(const hex of ['#1B2A44','#4B6B8B','#A7C4D9','#E7C8D6','#F6C89F','#C97B7B','#071739','#A4B5C4','#CDD5DB','#A68868','#E3C39D']) assert.match(styles,new RegExp(hex,'i'));
 assert.match(styles,/#authApp/);
 assert.match(styles,/#noor-principal/);
 assert.match(styles,/#workspace\.noor-teacher-activated/);
 assert.match(styles,/\.sp-reference-dashboard/);
 assert.match(html,/noor-palettes\.css/);
});
