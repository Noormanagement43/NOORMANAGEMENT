import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../noor-secure-assistant.js',import.meta.url),'utf8');
function setup(role='student',school='school-a',user='student-one'){
 const window={NOOR_AI_APP:{user:{id:user},schoolId:school,profile:{role,status:'active'}}};
 vm.runInNewContext(source,{window});return{api:window.NOOR_SECURE_AI,app:window.NOOR_AI_APP};
}
test('natural app requests lead to role-specific pages, never a user supplied route',()=>{
 const {api}=setup();
 for(const [question,topic] of [['My weekly periods kese bana sakthy hu?','periods'],['Mujhe annual marks report fill karni hai Class 5 Section A','marks'],['My attendance','attendance'],['change my profile photo','settings']])assert.equal(api.resolveRequest(question,'teacher'),topic);
 assert.equal(api.routeFor('marks','student'),'student-progress');
 assert.equal(api.routeFor('marks','teacher'),'teacher-classroom');
 assert.equal(api.routeFor('marks','principal'),'class-performance');
 assert.equal(api.routeFor('staff','student'),null);
 assert.equal(api.routeFor('schools','teacher'),null);
 assert.equal(api.routeFor('javascript:alert(1)','principal'),null);
 assert.equal(api.resolveRequest('Write a poem about the moon','student'),null);
});
test('school, account and role changes never share a history key',()=>{
 const {api,app}=setup();const keys=[api.scopeKey()];app.schoolId='school-b';keys.push(api.scopeKey());app.user.id='student-two';keys.push(api.scopeKey());app.profile.role='teacher';keys.push(api.scopeKey());assert.equal(new Set(keys).size,4);
 app.profile.status='inactive';assert.equal(api.scopeKey(),null);app.profile.status='active';app.user=null;assert.equal(api.scopeKey(),null);
});
test('students are guided to their own published records and cannot edit periods or inspect staff',()=>{
 const {api}=setup();assert.match(api.guidance('marks','student'),/own published/);assert.match(api.guidance('periods','student'),/cannot edit/);assert.equal(api.routeFor('staff','student'),null);assert.equal(api.routeFor('marks','parent'),null);
 assert.equal(api.routeFor('marks','faculty'),'teacher-classroom');assert.equal(api.routeFor('students','school_admin'),'student-directory');
});
