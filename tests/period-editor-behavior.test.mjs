import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const code=await readFile(new URL('../teacher-reference.js',import.meta.url),'utf8');
const fn=code.slice(code.indexOf('async function showPeriodEditor(p){'),code.indexOf('\nfunction openPaper()'));
function editor(){
 let shown,callback,writes=0,denied=false;
 const p={id:'period-1',class_id:'archived-class',section_id:null,weekday:'2',subject_name:'Math',start_time:'09:00',end_time:'09:45'};
 const app={user:{id:'teacher-a'},schoolId:'school-a',db:{from(table){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},in(){return q},update(){writes++;return q},then(resolve){resolve(table==='classes'?{data:[{id:'active-class',name:'Class 1'}]}:table==='sections'?{data:[]}:{data:denied?null:[{id:p.id}],error:denied?{message:'policy denied'}:null});}};return q;}}};
 const input={value:'Math',addEventListener(){}},icon={style:{setProperty(){}},setAttribute(){}};
 const context={get:()=>app,isTeacher:()=>true,current:{periods:[p]},days:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],fmt:t=>String(t).slice(0,5),esc:String,field:()=>'',notify(){},modal(title,body,save){shown={title,body};callback=save;return{querySelector:sel=>sel.includes('subject_name')?input:icon}},subjectVisual:()=>({icon:'book',matched:true,tone:'general'}),window:{NOOR_AVATAR_SAFE:{ownUser:async()=>{}}},Error};
 runInNewContext(fn+';globalThis.open=showPeriodEditor;',context);
 const values={weekday:'2',period_number:'1',start_time:'09:00',end_time:'09:45',subject_name:'Math',block_type:'class',context_index:'0'};
 return{app,p,open:context.open,shown:()=>shown,save:()=>callback({elements:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))}),values,writes:()=>writes,deny:()=>denied=true};
}
test('an archived class no longer prevents opening and repairing an existing period',async()=>{
 const x=editor();await x.open(x.p);assert.equal(x.shown().title,'Edit my period');
 assert.match(x.shown().body,/Choose an active class and section/);
 assert.match(x.shown().body,/<option value="2" selected>Tuesday/);
 await x.save();assert.equal(x.writes(),1);
});
test('invalid period numbers and switched accounts cannot be submitted',async()=>{
 const x=editor();await x.open(x.p);x.values.period_number='1.5';
 await assert.rejects(x.save(),/whole number/);assert.equal(x.writes(),0);
 x.values.period_number='1';x.app.user={id:'teacher-b'};
 await assert.rejects(x.save(),/account changed/);assert.equal(x.writes(),0);
});
test('a denied timetable write remains an error instead of claiming success',async()=>{
 const x=editor();await x.open(x.p);x.deny();
 await assert.rejects(x.save(),/Period not saved: policy denied/);
});
