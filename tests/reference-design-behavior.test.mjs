import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function teacher(){
 const panel={hidden:true},calls=[],window={addEventListener(){},NOOR_SECURE_AI:{open:()=>calls.push('ai')}};
 const document={body:{},getElementById:()=>panel};
 const context=vm.createContext({window,document,MutationObserver:class{observe(){}},console});
 vm.runInContext(read('noor-ui-polish.js'),context);
 vm.runInContext(read('teacher-reference.js').replace('window.NOOR_TEACHER_REFERENCE=','window.testPeriod={statusHTML,periodSlotsHTML,onClick};window.NOOR_TEACHER_REFERENCE='),context);
 return{...window.testPeriod,panel,calls};
}
const period={id:'one',period_number:1,subject_name:'English',class_label:'Class 8 · Section B',start_time:'08:00',end_time:'08:45',topic:'Verb tenses',schedule_status:'Upcoming'};
test('period timeline displays one through eight, uses school default times and never invents lessons',()=>{
 const api=teacher(),html=api.periodSlotsHTML([period],new Map(),[{period_number:2,start_time:'08:50',end_time:'09:35'}]);
 assert.equal((html.match(/class="nt-period /g)||[]).length,8);
 for(let n=1;n<=8;n++)assert.ok(html.includes('Period '+n));
 assert.match(html,/8:50 AM/);assert.match(html,/Not set/);assert.equal((html.match(/Verb tenses/g)||[]).length,1);
});
test('recorded status stays visible while period editing controls are collapsed',()=>{
 const api=teacher(),html=api.statusHTML(period,{status:'ongoing'});
 assert.match(html,/nt-period-badge current">In Progress/);assert.match(html,/aria-expanded="false"/);
 assert.match(html,/class="nt-period-actions"[^>]+ hidden/);assert.match(html,/data-complete-period="one"/);
 assert.match(html,/data-edit-period="one"/);assert.match(html,/data-daily-period="one"/);
 const completed=api.statusHTML(period,{status:'done'});assert.match(completed,/Completed/);assert.doesNotMatch(completed,/data-start-period|data-complete-period/);
});
test('expanding and collapsing a period never writes progress or opens an editor',()=>{
 const api=teacher(),attrs={'aria-controls':'nt-period-actions-one'},button={dataset:{togglePeriod:'one'},closest:()=>true,getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v};
 const event={target:{closest:()=>button}};
 api.onClick(event);assert.equal(api.panel.hidden,false);assert.equal(attrs['aria-expanded'],'true');
 api.onClick(event);assert.equal(api.panel.hidden,true);assert.equal(attrs['aria-expanded'],'false');assert.deepEqual(api.calls,[]);
});
test('untrusted period text cannot inject markup through subject or topic',()=>{
 const html=teacher().statusHTML({...period,subject_name:'<img onerror=bad()>',topic:'<script>bad()</script>'},null);
 assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;script&gt;/);
});
test('retired role AI actions make no calls while timetable navigation remains available',async()=>{
 const api=teacher();api.onClick({target:{closest:()=>({dataset:{action:'open-ai'},closest:()=>true})}});assert.deepEqual(api.calls,[]);
 const listeners={},calls=[],window={addEventListener(){},NOOR_AI_APP:{profile:{role:'student',status:'active'},user:{id:'me'},schoolId:'school',db:{},openView:view=>calls.push(view)},NOOR_SECURE_AI:{open:()=>calls.push('ai')}};
 const document={addEventListener:(name,fn)=>listeners[name]=fn};
 vm.runInNewContext(read('student-portal.js'),{window,document,console});
 await listeners.click({target:{closest:()=>({hasAttribute:name=>name==='data-sp-ai'})}});assert.deepEqual(calls,[]);
 calls.length=0;await listeners.click({target:{closest:()=>({dataset:{spNav:'student-schedule'},hasAttribute:name=>name==='data-sp-nav',textContent:'View Timetable'})}});assert.deepEqual(calls,['student-schedule']);
});
