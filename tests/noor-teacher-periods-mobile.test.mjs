import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('teacher can type freeform subject with automatic icon, no subject suggestions, and edit weekly periods',async()=>{
 const s=await read('teacher-reference.js');
 assert.doesNotThrow(()=>new Script(s));
 for(const icon of ['🧮','📘','⚗️','🌍','🔬','💻','🎨'])assert.ok(s.includes(icon),'Missing subject icon '+icon);
 assert.match(s,/subjectInput\.addEventListener\('input',updateIcon\)/);
 assert.match(s,/function weeklyTimetableHTML\(periods\)/);
 assert.match(s,/data-edit-period/);
 assert.match(s,/db\.from\('noor_teacher_periods'\)\.insert/);
 assert.match(s,/\.select\('id,approval_status'\)/);
 assert.doesNotMatch(s.slice(s.indexOf('async function showPeriodEditor'),s.indexOf('function openPaper')),/teacher_assignments/);
 assert.doesNotMatch(s,/option value="Maths"|suggestedSubjects|datalist/);
});

test('teacher optional tools and diary/report icons are at scroll end, not inside profile hero',async()=>{
 const s=await read('teacher-reference.js'),css=await read('noor-mobile-teacher-principal.css');
 const index=s.indexOf("dash.append(quickCard)"),advanced=s.indexOf("dash.append(advance)"),end=s.indexOf("dash.append(toolkit)");
 assert.ok(index>0&&advanced>index&&end>advanced);
 for(const name of ['Teaching Diary','Daily School Report','Weekly Planner','Learning Insights'])assert.ok(s.includes(name));
 assert.match(css,/nt-toolkit-grid/);
 assert.match(css,/nt-toolkit-glyph/);
 assert.match(css,/nt-bottom-actions/);
 assert.doesNotMatch(s,/profileQuote\.append\(quickCard\)/);
});

test('principal/manager phone content uses single column and restores real bottom navigation',async()=>{
 const html=await read('index.html'),css=await read('noor-mobile-teacher-principal.css'),principal=await read('principal-live.js');
 assert.match(html,/noor-mobile-teacher-principal\.css/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/body:has\(#view-principal-studio\.active\) #workspace #noorMobileNav/);
 assert.match(css,/pd-layout[^{]*\{display:grid;grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(css,/pd-chart-pair/);
 assert.match(css,/pd-schedule .pd-table-wrap/);
 assert.match(principal,/\['owner','principal','manager'\]/);
});

test('legacy database migration owns periods, checks school tenant, but never grants another teacher access',async()=>{
 const sql=await read('supabase/migrations/20261028161500_teacher_self_service_periods_legacy.sql');
 assert.match(sql,/Wrong NOOR database: legacy school_id timetable tables are missing/);
 for(const needle of ["NEW.teacher_id IS DISTINCT FROM OLD.teacher_id","NEW.school_id IS DISTINCT FROM OLD.school_id","NEW.class_id","NEW.section_id","school_memberships","sch.verification_status='verified'","NEW.approval_status:='approved'","teacher_id=(SELECT auth.uid())","private.noor_active_school_access","CREATE POLICY noor_teacher_self_timetable_insert","CREATE POLICY noor_teacher_self_timetable_update"])assert.ok(sql.includes(needle), 'Missing tenant or identity safety check '+needle);
 assert.doesNotMatch(sql,/CREATE POLICY[^;]+?USING \(true\)/i);
 assert.doesNotMatch(sql,/SECURITY DEFINER/i);
});
