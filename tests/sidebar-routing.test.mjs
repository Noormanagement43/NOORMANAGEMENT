import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function setup(role='teacher'){
 const calls=[],views=new Map(),buttons=[],sidebar={classList:{remove(){calls.push('drawer:close')}}};let active='view-overview';
 const make=id=>({id,className:'view',innerHTML:'',querySelector:()=>({}),querySelectorAll:()=>[],classList:{remove(){if(active===id)active=null},add(){active=id}}});
 for(const id of ['overview','attendance','schedules','settings','notices','notifications','meetings'])views.set('view-'+id,make('view-'+id));
 const content={appendChild(el){views.set(el.id,el)},append(el){views.set(el.id,el)}};
 const el=id=>id==='sidebar'?sidebar:id==='breadcrumb'?{}:views.get(id)||null;
 const document={createElement:()=>{const node=make('');node.classList={add(){active=node.id},remove(){}};return node},querySelector(s){return s==='.view.active'?{id:active}:s==='#workspace .content'?content:null},querySelectorAll(s){return s==='.view'?[...views.values()]:s==='#mainNav button'?buttons:[]}};
 const module=name=>({title:()=>name,decorate(){},open(){calls.push(name)},mount(){calls.push(name);return Promise.resolve()},supports(){return false}});
 const window={history:{state:{noorAppView:'overview'},pushState(value){this.state=value},replaceState(value){this.state=value}},location:{href:'https://example.test'},NOOR_PLATFORM_ACCESS:{allowed:()=>true},NOOR_ACCOUNT_CONTEXT:{enabled:()=>true},NOOR_COMMUNICATIONS:module('messages'),NOOR_SHARED_TIMETABLE:{current:()=>true,open:()=>calls.push('timetable')},NOOR_TEACHER_DATA:{current:()=>role==='teacher',supports:id=>role==='teacher'&&['teaching','paper-generator','weekly-plan','teacher-classroom','today-note'].includes(id),attendance:()=>calls.push('attendance'),open:id=>calls.push('teacher:'+id)},NOOR_LIVE_ANALYTICS:module('analytics'),NOOR_CLASS_PERFORMANCE:module('performance'),NOOR_PRINCIPAL_WORKSPACE:module('principal'),NOOR_ACADEMIC:module('legacy-academic'),NOOR_STUDENT_PORTAL:module('student'),NOOR_TEACHER_CLASSROOM:module('legacy-classroom'),NOOR_SCHOOL_CALENDAR:module('calendar')};
 const context={window,document,$:el,currentProfile:{role},toast:m=>calls.push('toast:'+m),renderCurrentOverview:()=>calls.push('overview'),renderSettings:()=>calls.push('settings'),setTimeout(){}};
 const source=html.slice(html.indexOf('function openView('),html.indexOf('\n',html.indexOf('function openView(')));
 vm.createContext(context);vm.runInContext(source,context);
 return{open:context.openView,calls,views,get active(){return active},window};
}
test('every teacher sidebar destination selects a real view and invokes its current renderer',()=>{
 for(const [id,expected] of [['overview','overview'],['attendance','attendance'],['today-note','teacher:today-note'],['schedules','timetable'],['teacher-classroom','teacher:teacher-classroom'],['teacher-resources',null],['weekly-plan','teacher:weekly-plan'],['notifications','messages'],['school-calendar','calendar'],['settings','settings'],['live-analytics','analytics']]){
  const x=setup();x.open(id);assert.equal(x.active,'view-'+id,id);if(expected)assert(x.calls.includes(expected),id+' -> '+expected);assert(!x.calls.includes('legacy-academic')||['overview','settings'].includes(id),id+' fell into legacy data flow');
 }
});
test('school notification, notice and meeting links all use membership-scoped messages for each role',()=>{
 for(const role of ['teacher','student','parent','principal'])for(const id of ['notifications','notices','meetings']){const x=setup(role);x.open(id);assert(x.calls.includes('messages'),role+' '+id);assert(!x.calls.includes('legacy-academic'));}
});
test('disabled and missing destinations leave the current page intact',()=>{
 const x=setup();x.window.NOOR_PLATFORM_ACCESS.allowed=()=>false;x.open('attendance');assert.equal(x.active,'view-overview');x.window.NOOR_PLATFORM_ACCESS.allowed=()=>true;x.open('missing-route');assert.equal(x.active,'view-overview');assert(x.calls.some(c=>c.startsWith('toast:')));
});
