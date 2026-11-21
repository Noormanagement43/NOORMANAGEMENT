import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{runInNewContext}from'node:vm';
const code=await readFile(new URL('../noor-shared-timetable.js',import.meta.url),'utf8');
function setup(role='teacher',access=null){
 const writes=[],user={id:'user-a'},membership={id:'member-a',user_id:user.id,institution_id:'school-a',role,status:'active'};
 let memberships=[membership];
 const db={auth:{getUser:async()=>({data:{user}})},from(table){let mutation=null;const q={select(){return q},eq(){return q},order(){return q},update(value){mutation=value;writes.push({table,value});return q},insert(value){mutation=value;writes.push({table,value});return q},upsert(value){mutation=value;writes.push({table,value});return q},delete(){writes.push({table,remove:true});return q},single:async()=>table==='institution_period_slots'?{data:{period_number:1,start_time:'09:00',end_time:'09:45'}}:table==='institutions'?{data:{id:'school-a',status:'active',timezone:'Asia/Kolkata'}}:{data:{id:'period-a'}},then(resolve){resolve({data:table==='institution_memberships'?memberships:[]})}};return q;}};
 const app={db,user,schoolId:'school-a',profile:{institution_id:'school-a'}};
 const window={NOOR_PLATFORM_ACCESS:access,NOOR_AI_APP:app,NOOR_CONFIG:{SUPABASE_URL:'https://ayrryemawwplguaauxij.supabase.co'},dispatchEvent(){}};
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

test('teachers and students cannot set school period timings',async()=>{for(const role of ['teacher','student']){const x=setup(role);await assert.rejects(()=>x.api.saveSlot(values),/leadership/);assert.equal(x.writes.length,0);}});
test('principal saves the school timing without creating or assigning teacher periods',async()=>{const x=setup('principal');await x.api.saveSlot(values);assert.equal(x.writes.length,1);assert.equal(x.writes[0].table,'institution_period_slots');assert.equal(x.writes[0].value.institution_id,'school-a');});
test('daily topic saves separately without rewriting weekly timetable',async()=>{const x=setup();await x.api.saveLesson({id:'period-a',teacher_membership_id:'member-a',institution_id:'school-a'},{lesson_date:'2026-11-05',lesson:'Fractions',topic:'Equivalent fractions',completed:'on'});assert.equal(x.writes.length,1);assert.equal(x.writes[0].table,'noor_daily_period_lessons');assert.equal(x.writes[0].value.topic,'Equivalent fractions');assert.equal(x.writes[0].value.completed,true);});
test('another teacher daily topic cannot be modified or period removed',async()=>{const x=setup(),other={id:'other',teacher_membership_id:'other-teacher',institution_id:'school-a'};await assert.rejects(()=>x.api.saveLesson(other,{lesson_date:'2026-11-05'}));await assert.rejects(()=>x.api.removePeriod(other));assert.equal(x.writes.length,0);});

test('teacher chooses custom times without school-slot dependency',async()=>{const x=setup();await x.api.save({...values,start_time:'10:15',end_time:'11:00'});assert.equal(x.writes[0].value.start_time,'10:15');assert.equal(x.writes[0].value.end_time,'11:00');});
test('teacher timetable editor offers editable start/end times and repeating subject with separate daily topics',()=>{assert.match(code,/name="start_time" type="time" required/);assert.match(code,/name="end_time" type="time" required/);assert.doesNotMatch(code,/Period timings are managed by your principal|Your principal must set period timings first/);assert.match(code,/Your weekly timetable repeats/);});
test('one daily template repeats all seven days with the same stored identity, subject and class',()=>{const x=setup();const list=x.api.expandPeriods([{id:'same',repeats_daily:true,weekday:1,period_number:2,subject_name:'Science',academic_group_id:'section',start_time:'10:00',end_time:'11:00'}],'Asia/Kolkata');assert.equal(list.length,7);assert.deepEqual(Array.from(list,p=>p.weekday),[0,1,2,3,4,5,6]);assert.ok(list.every(p=>p.id==='same'&&p.subject_name==='Science'&&p.academic_group_id==='section'));assert.equal(x.api.uniquePeriods(list).length,1);});
test('weekday-only periods keep their selected day and daily notes do not spill into other days',()=>{const x=setup();assert.equal(x.api.expandPeriods([{id:'single',repeats_daily:false,weekday:3}],'Asia/Kolkata').length,1);const rows=x.api.expandPeriods([{id:'repeat',repeats_daily:true,lesson:'Chapter 2',topic:'Cells'}],'Asia/Kolkata');assert.equal(rows.filter(p=>p.topic==='Cells').length,1);});
test('new saved periods default to daily recurrence while single weekday remains editable',async()=>{const x=setup();await x.api.save(values);assert.equal(x.writes[0].value.repeats_daily,true);const y=setup();await y.api.save({...values,repeats_daily:'false'});assert.equal(y.writes[0].value.repeats_daily,false);});


test('shared authenticated context stays usable for student searches when Timetable is OFF',async()=>{
 const checked=[],x=setup('teacher',{requireFeature:async key=>{checked.push(key);throw Error('Timetable is OFF');}});
 const c=await x.api.context();assert.equal(c.school.id,'school-a');assert.equal(c.membership.id,'member-a');assert.deepEqual(checked,[]);
 const loaded=await x.api.load();assert.match(loaded.error.message,/Timetable is OFF/);assert.deepEqual(checked,['timetable']);assert.equal(x.writes.length,0);
});
test('Timetable OFF blocks every public timetable writer independently of shared context',async()=>{
 const own={id:'period-a',teacher_membership_id:'member-a',institution_id:'school-a'};
 for(const [method,args] of [['save',[values]],['saveSlot',[values]],['saveLesson',[own,{lesson_date:'2026-11-14'}]],['setProgress',[own,'completed']],['removePeriod',[own]]]){
  const checked=[],x=setup('teacher',{requireFeature:async key=>{checked.push(key);throw Error('Timetable is OFF');}});
  await assert.rejects(()=>x.api[method](...args),/Timetable is OFF/);assert.deepEqual(checked,['timetable']);assert.equal(x.writes.length,0,method);
 }
});
