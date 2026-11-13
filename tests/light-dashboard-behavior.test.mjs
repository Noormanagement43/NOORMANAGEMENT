import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function experience(){
 const window={NOOR_AI_APP:{school:{name:'School <one>',timezone:'Asia/Kolkata'},profile:{}},addEventListener(){}};
 runInNewContext(readFileSync(new URL('../noor-dashboard-experience.js',import.meta.url),'utf8'),{window,document:{addEventListener(){}},setInterval(){},Date,Intl});
 return window.NOOR_DASHBOARD_EXPERIENCE;
}
test('greeting follows school time at noon and evening, independently of device time',()=>{
 const api=experience();
 for(const [utc,expected] of [['2026-11-14T06:29:00Z','Good morning'],['2026-11-14T06:30:00Z','Good afternoon'],['2026-11-14T11:30:00Z','Good evening']])assert.equal(api.clock('Asia/Kolkata',new Date(utc)).greeting,expected);
 assert.equal(api.clock('America/New_York',new Date('2026-11-14T11:30:00Z')).greeting,'Good morning');
});
test('current period uses school-local day, exclusive end time, and recorded completion',()=>{
 const api=experience(),row={id:'one',weekday:6,start_time:'10:00:00',end_time:'11:00:00',subject_name:'Math',approval_status:'approved'};
 const later={...row,id:'two',start_time:'11:00:00',end_time:'12:00:00'};
 let selected=api.currentPeriod([later,row],new Map(),'Asia/Kolkata',new Date('2026-11-14T05:00:00Z'));
 assert.equal(selected.period.id,'one');assert.equal(selected.live,true);
 selected=api.currentPeriod([row,later],new Map(),'Asia/Kolkata',new Date('2026-11-14T05:30:00Z'));
 assert.equal(selected.period.id,'two');
 selected=api.currentPeriod([{...row,completed:true},later],new Map(),'Asia/Kolkata',new Date('2026-11-14T05:00:00Z'));
 assert.equal(selected.period.id,'two');assert.equal(selected.live,false);
 assert.equal(api.currentPeriod([row],new Map(),'Asia/Kolkata',new Date('2026-11-15T05:00:00Z')).period,null);
 assert.equal(api.currentPeriod([{...row,approval_status:'rejected'}],new Map(),'Asia/Kolkata',new Date('2026-11-14T05:00:00Z')).period,null);
});
test('identity names and school branding escape markup',()=>{
 const api=experience();
 assert.match(api.greeting('<img onerror=alert(1)>'),/&lt;img/);
 assert.ok(!api.brand().includes('<one>'));
 assert.match(api.brand(),/School &lt;one&gt;/);
});

function timetable(role){
 const writes=[],user={id:'user'},school={id:'school',name:'Example School',status:'active',timezone:'Asia/Kolkata'};
 const day=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(new Intl.DateTimeFormat('en-GB',{timeZone:school.timezone,weekday:'long'}).format(new Date()));
 const member={id:'member',user_id:user.id,institution_id:school.id,role,status:'active'};
 const base={institution_id:school.id,weekday:day,period_number:1,start_time:'09:00',end_time:'10:00',academic_group_id:'own-class',teacher_membership_id:'member'};
 const tables={institution_memberships:[member],institutions:[school],teacher_timetable_periods:[{...base,id:'own',subject_name:'Own class subject'},{...base,id:'other-teacher',teacher_membership_id:'another',subject_name:'Same class, another teacher'},{...base,id:'other-class',teacher_membership_id:'another',academic_group_id:'other-class',subject_name:'Private other class'}],academic_groups:[{institution_id:school.id,id:'own-class',name:'Class 5',group_type:'class',is_active:true},{institution_id:school.id,id:'other-class',name:'Class 6',group_type:'class',is_active:true}],institution_period_slots:[],noor_daily_period_lessons:[]};
 const app={user,school,schoolId:school.id,profile:{institution_id:school.id,class_id:'own-class'}};
 app.db={auth:{getUser:async()=>({data:{user}})},from(table){let selected=tables[table]||[];const q={select(){return q},eq(k,v){selected=selected.filter(x=>x[k]===v);return q},order(){return q},single:async()=>({data:selected[0]}),then(resolve){return Promise.resolve({data:selected}).then(resolve)},insert(){writes.push(table);return q},update(){writes.push(table);return q},upsert(){writes.push(table);return q}};return q;},rpc:async()=>({data:[]}),channel(){return{on(){return this},subscribe(){}}}};
 let dialog;
 const document={createElement(){const body={innerHTML:'',textContent:''};const close={};dialog={dataset:{},isConnected:true,innerHTML:'',remove(){this.isConnected=false},setAttribute(){},addEventListener(){},showModal(){},querySelector(selector){return selector==='[data-tt-close]'?close:body},querySelectorAll(){return[]},body};return dialog;},body:{append(){}}};
 const window={NOOR_AI_APP:app,NOOR_CONFIG:{SUPABASE_URL:'https://ayrryemawwplguaauxij.supabase.co'},dispatchEvent(){}};
 runInNewContext(readFileSync(new URL('../noor-shared-timetable.js',import.meta.url),'utf8'),{window,document,Intl,Date,CustomEvent:class{}});
 return{api:window.NOOR_SHARED_TIMETABLE,writes,html:()=>dialog.body.innerHTML};
}
test('full-day reader shows only own teacher periods and never writes records',async()=>{
 const x=timetable('teacher');await x.api.openDay();
 assert.match(x.html(),/Own class subject/);assert.doesNotMatch(x.html(),/Same class, another teacher|Private other class/);
 assert.match(x.html(),/Update lesson \/ topic/);assert.equal(x.writes.length,0);
});
test('student day reader keeps class isolation and provides no editing controls',async()=>{
 const x=timetable('student');await x.api.openDay();
 assert.match(x.html(),/Same class, another teacher/);assert.doesNotMatch(x.html(),/Private other class|data-day-edit/);assert.equal(x.writes.length,0);
});
test('principal period detail selects the requested period without creating write controls',async()=>{
 const x=timetable('principal');await x.api.openDay({periodId:'other-teacher'});
 assert.match(x.html(),/Same class, another teacher/);assert.doesNotMatch(x.html(),/Own class subject|Private other class|data-day-edit/);assert.equal(x.writes.length,0);
});
