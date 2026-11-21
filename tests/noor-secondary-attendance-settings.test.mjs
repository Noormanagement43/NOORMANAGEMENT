import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('secondary attendance settings are institution-scoped and use leadership permissions',async()=>{
 const code=await read('noor-secondary-attendance-settings.js');
 assert.match(code,/institution_memberships/);
 assert.match(code,/user_id',uid/);
 assert.match(code,/institution_id',sid/);
 assert.match(code,/status','active/);
 assert.match(code,/principal','school_admin','university_admin','academic_admin/);
 assert.match(code,/institution_dashboard_preferences/);
 assert.match(code,/secondary_class_ids/);
 assert.match(code,/NOOR_SCHOOL_STRUCTURE\.fetchGroups/);
 assert.match(code,/academic_groups|group_type/);
 assert.match(code,/auth\.getUser\(\)/);
 assert.match(code,/A\(\)\.schoolId===sid/);
 assert.match(code,/noor:secondary-attendance-settings-saved/);
 assert.doesNotMatch(code,/\.from\(['"]profiles['"]\)\.update/);
});
test('secondary class preferences enforce same-school active class IDs in the database migration',async()=>{
 const sql=await read('supabase/migrations/20261121133957_secondary_attendance_class_group_preferences.sql');
 assert.match(sql,/institution_dashboard_preferences/);
 assert.match(sql,/secondary_class_ids/);
 assert.match(sql,/g\.institution_id = NEW\.institution_id/);
 assert.match(sql,/g\.group_type = 'class'/);
 assert.match(sql,/g\.is_active = true/);
 assert.match(sql,/BEFORE INSERT OR UPDATE/);
});
test('settings layout follows the selected NOOR palette and adapts to narrow screens',async()=>{
 const css=await read('noor-secondary-attendance-settings.css');
 assert.match(css,/var\(--paper\)/);
 assert.match(css,/var\(--berry\)/);
 assert.match(css,/@media\(max-width:620px\)/);
});
