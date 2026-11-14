import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../noor-manager-workspace.js',import.meta.url),'utf8');
function setup(role='school_admin'){
 const user={id:'user'},school={id:'school',timezone:'Asia/Kolkata'},member={id:'member',role};
 const q={select(){return q},eq(){return q},single:async()=>({data:member})};
 const app={user,school,schoolId:school.id,profile:{role:'manager'},db:{auth:{getUser:async()=>({data:{user}})},from:()=>q}};
 const window={NOOR_AI_APP:app};runInNewContext(source,{window,Intl,Date});return{api:window.NOOR_MANAGER_WORKSPACE,app,member,window};
}
test('manager access comes from current authenticated school membership, not profile role',async()=>{
 const x=setup();assert.equal((await x.api.context()).role,'school_admin');
 x.member.role='student';await assert.rejects(x.api.context(),/leadership/);
});
test('a changed authenticated account is rejected before reading manager data',async()=>{
 const x=setup();x.app.db.auth.getUser=async()=>({data:{user:{id:'different'}}});await assert.rejects(x.api.context(),/Sign in again/);
});
test('manual mark collection preserves zero and leaves blank rows unchanged',()=>{
 const {api}=setup();const form={elements:{maximum:{value:'100'},mark_a:{value:'0'},feedback_a:{value:' Good '},mark_b:{value:''},feedback_b:{value:''}}};
 const rows=api.collectMarks(form,[{id:'a'},{id:'b'}]);assert.equal(rows.length,1);assert.equal(rows[0].marks,0);assert.equal(rows[0].feedback,'Good');
 form.elements.mark_a.value='101';assert.throws(()=>api.collectMarks(form,[{id:'a'}]),/maximum/);
});
test('attendance requires a status for every roster member',()=>{
 const {api}=setup();const form={querySelector:query=>query.includes('att_a')?{value:'leave'}:null};
 assert.throws(()=>api.attendanceRecords(form,[{id:'a'},{id:'b'}]),/every student/);
 assert.equal(api.attendanceRecords(form,[{id:'a'}])[0].status,'leave');
});
test('manager history escapes names and feedback and shows exact before/after values',()=>{
 const {api}=setup();const html=api.activityHTML([{actor_name:'<img src=x>',created_at:'2026-11-14T10:00:00Z',entity_table:'noor_assessment_results',action:'UPDATE',before_data:{marks:0},after_data:{marks:15,feedback:'<script>bad</script>'},class_label:'Class 5 A',student_name:'Student'}]);
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('<td>0</td><td>15</td>'));
});

test('Manager OFF blocks direct workspace context before any membership lookup',async()=>{
 const x=setup();let reads=0;x.app.db.from=()=>{reads++;throw Error('Unexpected read');};x.window.NOOR_PLATFORM_ACCESS={async requireFeature(key){assert.equal(key,'manager_tools');throw Error('Manager workspace is disabled by NOOR');}};
 await assert.rejects(x.api.context(),/disabled by NOOR/);assert.equal(reads,0);
});
