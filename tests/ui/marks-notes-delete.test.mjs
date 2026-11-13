import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read=name=>fs.readFile(new URL('../../'+name,import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(){
 const dom=new JSDOM('<main></main>',{url:'https://noor.example',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const calls=[],toasts=[],school={id:'school',timezone:'Asia/Kolkata'},membership={id:'teacher-membership'},userId='teacher';
 const groups=[{group_id:'class',class_id:'class',class_label:'Class 4',class_name:'Class 4',section_name:'All sections'},{group_id:'section',class_id:'class',parent_group_id:'class',class_name:'Class 4',section_name:'Section A',class_label:'Class 4 · A'}];
 const state={roster:[{student:'s1',name:'Ayesha <Khan>',marks:24,max_marks:35,editable:true},{student:'s2',name:'Arjun',marks:null,max_marks:null,editable:true},{student:'s3',name:'Sara',marks:30,max_marks:35,editable:false}],notes:[],quizzes:[],wait:null};
 const db={rpc:async(name,args)=>{calls.push({name,args});if(state.wait&&name==='noor_subject_marks_roster')return state.wait;return{data:name==='noor_subject_marks_roster'?state.roster:name==='noor_delete_test'?{deleted:true,pending_review:false}:{count:args?.p_records?.length||0}};},from(table){const filters={};const query={select(){return this;},eq(k,v){filters[k]=v;return this;},in(k,v){filters[k]=v;return this;},order(){return this;},limit(){return this;},maybeSingle(){return Promise.resolve({data:null});},then(resolve,reject){calls.push({table,filters:{...filters}});return Promise.resolve({data:table==='noor_learning_items'?state.notes.filter(n=>n.homework_date===filters.homework_date):table==='noor_weekly_quizzes'?state.quizzes:[]}).then(resolve,reject);}};return query;},storage:{from(){return{createSignedUrl:async path=>({data:{signedUrl:'https://private.example/'+path}})};}}};
 w.NOOR_AI_APP={user:{id:userId},schoolId:school.id,school,db,toast:(...x)=>toasts.push(x)};
 w.NOOR_TEACHER_DATA={context:async()=>({db,school,membership,userId}),teachingGroups:async()=>groups,assignments:async()=>[{group_id:'class'}]};
 w.NOOR_SHARED_TIMETABLE={schoolDay:()=> '2026-11-13',load:async()=>({data:[{teacher_membership_id:membership.id,academic_group_id:'class',subject_name:'English'}]})};
 return{dom,w,calls,toasts,state,host:w.document.querySelector('main')};
}
const submit=(w,form)=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
test('marks sheet keeps original max, blanks, readonly rows and saves monthly/annual subject payloads',async()=>{
 const x=setup(),{w}=x;w.eval(await read('noor-marks-entry.js'));await w.NOOR_MARKS_ENTRY.open({groupId:'section'});
 const criteria=w.document.querySelector('[data-criteria]');assert.equal(criteria.elements.group.value,'section');submit(w,criteria);await tick();
 assert.equal(criteria.elements.max.value,'35');assert.equal(w.document.querySelector('[data-score="1"]').value,'');assert(w.document.querySelector('[data-score="2"]').disabled);
 assert.equal(w.document.querySelector('tbody td').textContent,'Ayesha <Khan>');assert.equal(w.document.querySelector('khan'),null);
 w.document.querySelector('[data-score="0"]').value='28';submit(w,w.document.querySelector('[data-mark-sheet]'));await tick();
 let saved=x.calls.find(c=>c.name==='noor_save_subject_marks').args;assert.equal(saved.p_max,35);assert.equal(saved.p_kind,'monthly_test');assert.equal(saved.p_group,'section');assert.equal(saved.p_records.length,1);assert.equal(saved.p_records[0].marks,28);
 criteria.elements.kind.value='term3';criteria.elements.kind.dispatchEvent(new w.Event('input',{bubbles:true}));assert(w.document.querySelector('[data-mark-sheet]').hidden);criteria.elements.max.value='50';criteria.elements.max.dispatchEvent(new w.Event('input',{bubbles:true}));submit(w,criteria);await tick();assert.equal(criteria.elements.max.value,'50');submit(w,w.document.querySelector('[data-mark-sheet]'));await tick();saved=x.calls.filter(c=>c.name==='noor_save_subject_marks').at(-1).args;assert.equal(saved.p_kind,'term3');assert.equal(saved.p_max,50);x.dom.window.close();
});
test('marks response for outdated criteria cannot populate or save the current sheet',async()=>{
 const x=setup();let release;x.state.wait=new Promise(r=>release=r);x.w.eval(await read('noor-marks-entry.js'));await x.w.NOOR_MARKS_ENTRY.open();const f=x.w.document.querySelector('[data-criteria]');submit(x.w,f);await tick();f.elements.subject.value='Maths';f.elements.subject.dispatchEvent(new x.w.Event('input',{bubbles:true}));release({data:x.state.roster});await tick();assert(x.w.document.querySelector('[data-mark-sheet]').hidden);assert.equal(x.calls.filter(c=>c.name==='noor_save_subject_marks').length,0);x.dom.window.close();
});
test('Today Notes calendar selects that date, signs photo and keeps expired photo instructions',async()=>{
 const x=setup();x.state.notes=[{title:'Old homework',subject_name:'English',body:'Read chapter 2',homework_date:'2026-11-10',attachment_removed_at:'2026-11-13'},{title:'Today work',subject_name:'Maths',body:'Exercise 3',homework_date:'2026-11-13',attachment_path:'teacher/photo.jpg'}];x.w.eval(await read('noor-classroom-connect.js'));await x.w.NOOR_CLASSROOM_CONNECT.todayNote(x.host);assert.match(x.host.querySelector('[data-note-list]').textContent,/Today work/);assert.match(x.host.querySelector('[data-note-list] img').src,/private.example/);
 const input=x.host.querySelector('[data-note-day]');let opened=false;input.showPicker=()=>{opened=true;};x.host.querySelector('[data-note-calendar]').click();assert(opened);input.value='2026-11-10';await input.onchange();assert.match(x.host.querySelector('[data-note-list]').textContent,/Read chapter 2/);assert.match(x.host.querySelector('[data-note-list]').textContent,/removed after 30 days/);assert.doesNotMatch(x.host.querySelector('[data-note-list]').textContent,/Today work/);assert.equal(x.calls.filter(c=>c.table==='noor_learning_items').at(-1).filters.created_by,'teacher');x.dom.window.close();
});
test('Delete Test cancel does not call backend; confirm sends only selected test id',async()=>{
 const x=setup();x.state.quizzes=[{id:'quiz-1',title:'Weekly Test',subject_name:'English',academic_group_id:'section',quiz_date:'2026-11-13',max_marks:35}];x.w.NOOR_WEEKLY_QUIZ={saturday:d=>d,review:async()=>{}};x.w.eval(await read('noor-assessment-studio.js'));await x.w.NOOR_WEEKLY_QUIZ.teacher(x.host);await tick();
 x.host.querySelector('[data-delete-test]').click();x.w.document.querySelector('[data-cancel]').click();await tick();assert(!x.calls.some(c=>c.name==='noor_delete_test'));
 x.host.querySelector('[data-delete-test]').click();x.w.document.querySelector('[data-delete]').click();await tick();const call=x.calls.find(c=>c.name==='noor_delete_test');assert.deepEqual(Object.keys(call.args),['p_quiz']);assert.equal(call.args.p_quiz,'quiz-1');assert.match(x.toasts.at(-1)[0],/marks are preserved/);assert.equal(x.w.document.querySelector('dialog'),null);x.dom.window.close();
});

test('Student homework calendar reads only the enrolled class and selected date',async()=>{
 const x=setup();x.w.NOOR_AI_APP.profile={class_id:'class',section_id:'section'};x.state.notes=[{title:'Selected homework',subject_name:'English',body:'Revise chapter 1',homework_date:'2026-11-09'}];x.w.eval(await read('noor-classroom-connect.js'));await x.w.NOOR_CLASSROOM_CONNECT.homeworkCalendar();const input=x.w.document.querySelector('[data-homework-date]');input.value='2026-11-09';await input.onchange();const query=x.calls.filter(c=>c.table==='noor_learning_items').at(-1);assert.deepEqual(Array.from(query.filters.academic_group_id),['class','section']);assert.equal(query.filters.institution_id,'school');assert.equal(query.filters.status,'published');assert.equal(query.filters.homework_date,'2026-11-09');assert.match(x.w.document.querySelector('[data-homework-list]').textContent,/Revise chapter 1/);x.dom.window.close();
});
