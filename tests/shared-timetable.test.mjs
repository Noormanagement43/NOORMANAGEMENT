import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{runInNewContext}from'node:vm';
const code=await readFile(new URL('../noor-shared-timetable.js',import.meta.url),'utf8');
function setup(role='teacher'){
 const writes=[],user={id:'user-a'},membership={id:'member-a',user_id:user.id,institution_id:'school-a',role,status:'active'};
 let memberships=[membership];
 const db={auth:{getUser:async()=>({data:{user}})},from(table){let mutation=null;const q={select(){return q},eq(){return q},order(){return q},update(value){mutation=value;writes.push({table,value});return q},insert(value){mutation=value;writes.push({table,value});return q},single:async()=>table==='institutions'?{data:{id:'school-a',status:'active',timezone:'Asia/Kolkata'}}:{data:{id:'period-a'}},then(resolve){resolve({data:table==='institution_memberships'?memberships:[]})}};return q;}};
 const app={db,user,schoolId:'school-a',profile:{institution_id:'school-a'}};
 const window={NOOR_AI_APP:app,NOOR_CONFIG:{SUPABASE_URL:'https://ayrryemawwplguaauxij.supabase.co'},dispatchEvent(){}};
 runInNewContext(code,{window,Intl,Date,CustomEvent:class{}});
 return{api:window.NOOR_SHARED_TIMETABLE,writes,clearMemberships:()=>memberships=[],app};
}
const values={weekday:1,period_number:1,start_time:'09:00',end_time:'09:45',subject_name:'Mathematics',academic_group_id:'group-a'};
test('teacher saves only to the destination timetable with authenticated ownership',async()=>{const x=setup();await x.api.save(values);assert.equal(x.writes.length,1);assert.equal(x.writes[0].table,'teacher_timetable_periods');assert.equal(x.writes[0].value.created_by,'user-a');assert.equal(x.writes[0].value.teacher_membership_id,'member-a');assert.equal(x.writes[0].value.institution_id,'school-a');assert.equal(x.writes[0].value.approval_status,undefined);});
test('principal and student cannot use the timetable writer',async()=>{for(const role of['principal','student']){const x=setup(role);await assert.rejects(x.api.save(values),/Only teachers/);assert.equal(x.writes.length,0)}});
test('another teacher period cannot be updated',async()=>{const x=setup();await assert.rejects(x.api.save(values,{id:'period-other',teacher_membership_id:'member-other',institution_id:'school-a'}),/only edit your own/);assert.equal(x.writes.length,0)});
test('invalid times and decimals do not reach the database',async()=>{for(const patch of[{start_time:'99:00'},{end_time:'08:00'},{period_number:1.5},{weekday:7}]){const x=setup();await assert.rejects(x.api.save({...values,...patch}));assert.equal(x.writes.length,0)}});
test('missing real school membership produces an actionable error, never fabricated teacher rights',async()=>{const x=setup();x.clearMemberships();await assert.rejects(x.api.save(values),/membership has not been migrated/);assert.equal(x.writes.length,0)});
test('scheduled status uses school timezone and does not pretend a teacher actually started class',()=>{const x=setup(),row={weekday:1,start_time:'09:00',end_time:'09:45'};assert.equal(x.api.status(row,'Asia/Kolkata',new Date('2026-10-26T03:45:00Z')),'Scheduled now');assert.equal(x.api.status(row,'Asia/Kolkata',new Date('2026-10-26T03:00:00Z')),'Upcoming');assert.equal(x.api.status(row,'Asia/Kolkata',new Date('2026-10-26T05:00:00Z')),'Finished');});
