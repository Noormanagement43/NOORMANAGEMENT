import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../noor-school-calendar.js',import.meta.url),'utf8');
test('shared calendar draws holidays and recurring periods in the school timezone without runtime errors',()=>{
 const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',insertAdjacentHTML(_,html){this.innerHTML+=html;}});return elements.get(id);};
 const root={querySelector:element,querySelectorAll:()=>[]},window={NOOR_AI_APP:{school:{timezone:'Asia/Kolkata'},profile:{role:'student'},user:{id:'me'}}};
 const ctx=vm.createContext({window,document:{getElementById:()=>root},Intl,Date});
 vm.runInContext(source.replace('window.NOOR_SCHOOL_CALENDAR={open,showEventModal};','window.NOOR_SCHOOL_CALENDAR={open,showEventModal};window.TEST={st,draw,getRegionalFestivals};'),ctx);
 const {st,draw,getRegionalFestivals}=window.TEST;Object.assign(st,{year:2026,month:10,selected:'2026-11-06',filter:'all',events:[],holidays:[],periods:[{weekday:5,period_number:1,subject_name:'Maths',start_time:'09:00',end_time:'10:00',class_label:'Class 1 · Mango'}]});
 draw();assert.match(element('#nscGrid').innerHTML,/Maths/);assert.match(element('#nscDayEvents').innerHTML,/09:00–10:00/);assert.match(element('#nscDayTitle').textContent,/2026/);
 assert.equal(getRegionalFestivals(2027).some(x=>/Eid|Diwali|Ugadi/.test(x.title)),false);
});
