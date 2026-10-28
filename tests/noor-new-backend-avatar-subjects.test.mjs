import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,Script} from 'node:vm';
import {randomUUID} from 'node:crypto';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('auto subject icons cover Zoology, Anthropology and broad school-university subjects',async()=>{
 const sandbox={window:{}};
 runInNewContext(await read('noor-subject-icons.js'),sandbox);
 const api=sandbox.window.NOOR_SUBJECT_ICONS;
 assert.ok(api.knownCount>=60);
 const cases={
  'Zoology':'🐾','Anthropology':'🧑‍🔬','Botany':'🌿','Microbiology':'🦠',
  'Biochemistry':'🧫','Genetics':'🧬','Physics':'⚛️','Chemistry':'⚗️',
  'Environmental Science':'🌱','Mathematics':'🧮','English':'📘',
  'Social Studies':'🌍','Geography':'🗺️','Computer Science':'💻',
  'Economics':'📈','Accountancy':'🧾','Psychology':'🧠',
  'Laboratory':'🔬','Statistics':'📊','Political Science':'🏛️',
  'Commerce':'🛒','Architecture':'🏛️','History':'🏛️'
 };
 for(const [name,emoji] of Object.entries(cases))assert.equal(api.display(name).icon,emoji,name);
 const first=api.display('Ancient Mesopotamian Technology');
 assert.equal(first.matched,false);
 assert.equal(first.initials,'AM');
 assert.equal(api.display('Ancient Mesopotamian Technology').hue,first.hue);
 assert.ok(first.icon);
});

test('shared profile photo writer rejects account identity mismatches before uploading',async()=>{
 const sandbox={window:{},crypto:{randomUUID}};
 runInNewContext(await read('noor-avatar-isolation.js'),sandbox);
 const api=sandbox.window.NOOR_AVATAR_SAFE;
 let uploads=0;
 const client={auth:{getUser:async()=>({data:{user:{id:'student-user'}}})},
  storage:{from:()=>({upload:async()=>{uploads++;return {error:null}}})}};
 await assert.rejects(api.uploadOwn({client,userId:'principal-user',profile:{id:'principal-user'},
  schoolId:'school-1',file:{type:'image/png',size:1000}}),/another account/);
 assert.equal(uploads,0);
 await assert.rejects(api.uploadOwn({client,userId:'student-user',profile:{id:'principal-user'},
  schoolId:'school-1',file:{type:'image/png',size:1000}}),/visible profile/);
 assert.equal(uploads,0);
});

test('photo upload aborts if auth account switches mid-network request',async()=>{
 const sandbox={window:{},crypto:{randomUUID}};
 runInNewContext(await read('noor-avatar-isolation.js'),sandbox);
 const api=sandbox.window.NOOR_AVATAR_SAFE;
 let times=0,changes=0;
 const client={
  auth:{getUser:async()=>({data:{user:{id:++times===1?'teacher-a':'teacher-b'}}})},
  storage:{from:()=>({upload:async()=>({error:null})})},
  from:()=>{changes++;throw Error('Must not write another profile')}
 };
 await assert.rejects(api.uploadOwn({client,userId:'teacher-a',profile:{id:'teacher-a'},
  file:{type:'image/jpeg',size:1000}}),/another account/);
 assert.equal(changes,0);
});

test('two account photos cannot be accidentally shared by student/teacher legacy upload forms',async()=>{
 const [teacher,student,index]=await Promise.all([read('teacher-reference.js'),read('student-portal.js'),read('index.html')]);
 for(const src of [teacher,student,index])assert.doesNotThrow(()=>src.includes('NOOR_AVATAR_SAFE'));
 assert.match(teacher,/NOOR_AVATAR_SAFE\.uploadOwn/);
 assert.match(student,/NOOR_AVATAR_SAFE\.uploadOwn/);
 assert.match(student,/NOOR_AVATAR_SAFE\.ownUser/);
 assert.doesNotMatch(student,/student-profile\.'\+ext/);
 assert.doesNotMatch(teacher,/\/profile\.'\+ext/);
 assert.match(index,/workspaceEnterNonce/);
 assert.match(index,/sessionCheck\.data\?\.user\?\.id!==user\.id/);
 assert.match(index,/noor-avatar-isolation\.js/);
});

test('the connected NEW NOOR has its own verified schema, private bucket and RLS',async()=>{
 const [html,config,code,sql1,sql2]=await Promise.all([
  read('noor-v2.html'),read('noor-v2-config.js'),read('noor-v2.js'),
  read('supabase/new-project/migrations/20261028114439_noor_v2_teacher_self_timetable_and_private_avatars.sql'),
  read('supabase/new-project/migrations/20261028114814_noor_v2_school_class_section_parenting.sql')
 ]);
 assert.match(config,/ayrryemawwplguaauxij\.supabase\.co/);
 assert.doesNotMatch(config,/npzedchxfurcphvpjock/);
 assert.match(html,/noor-v2\.js/);
 assert.doesNotThrow(()=>new Script(code));
 assert.match(code,/register_institution_for_current_user/);
 assert.match(code,/teacher_timetable_periods/);
 assert.match(code,/NOOR_AVATAR_SAFE\.uploadOwn/);
 assert.match(code,/newGroup\(item\.group_type,item\)/);
 assert.match(sql1,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql1,/CREATE POLICY noor_v2_period_teacher_create/);
 assert.match(sql1,/CREATE POLICY noor_v2_period_teacher_edit/);
 assert.match(sql1,/teacher_membership_id.*institution_id/s);
 assert.match(sql1,/teacher_id|teacher_membership_id/);
 assert.match(sql1,/noor-profile-photos/);
 assert.match(sql1,/avatar_url IS NULL OR avatar_url LIKE/);
 assert.match(sql2,/parent_group_id/);
 assert.match(sql2,/same_institution/);
});
