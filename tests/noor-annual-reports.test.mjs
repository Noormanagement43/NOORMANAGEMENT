import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../noor-annual-reports.js',import.meta.url),'utf8');
const window={};
vm.runInNewContext(src,{window,Intl,Date,Number,Set,Map,Object,Error,Array});
const report=window.NOOR_ANNUAL_REPORTS;
const fake={c:{schoolInfo:{name:'Example School',logo_url:''},group:{name:'Class 8B'}},s:{name:'Test Student',class_label:'Class 8 · Section B',roll_number:'800'},year:{label:'2026-27',start_date:'2026-04-01',end_date:'2027-03-31',provisional:false},cfg:{exam_labels:{weekly:'Weekly Quiz',monthly:'Monthly',term1:'Term 1',term2:'Term 2',term3:'Term 3'}},monthly:[{key:'2026-04',working:20,present:18,absent:2,late:0,unmarked:0}],holidays:3,summary:{working:20,present:18,absent:2,late:0,unmarked:0,pct:90},subjects:[{name:'Mathematics',weekly:{got:18,max:20,pct:90},monthly:null,term1:null,term2:null,term3:{got:95,max:100,pct:95}}],final:{got:95,max:100,pct:95},remarks:'Recorded teacher comment.',marksCount:2};
test('annual attendance report shows saved daily totals and excluded holidays',()=>{
 const html=report.reportHTML(fake,'attendance');assert.match(html,/20/);assert.match(html,/Days Present/);assert.match(html,/18/);assert.match(html,/School holidays excluded: 3/);assert.match(html,/90%/);});
test('annual marks report separates period categories and never invents empty marks',()=>{
 const html=report.reportHTML(fake,'marks');assert.match(html,/Weekly Quiz/);assert.match(html,/95\/100/);assert.match(html,/Mathematics/);assert.match(html,/Recorded teacher comment/);assert.match(html,/>—<\/td>/);});
test('school custom year and empty months display missing values, not fabricated marks',()=>{
 const html=report.reportHTML({...fake,monthly:[],subjects:[],final:{got:0,max:0,pct:null},marksCount:0,remarks:''},'marks');assert.match(html,/No marks have been recorded/);assert.match(html,/Not recorded/);});
test('report launch rejects missing authenticated school context without opening content',async()=>{
 await assert.rejects(report.open({membership_id:'00000000-0000-0000-0000-000000000000'},'00000000-0000-0000-0000-000000000000'),/Select a class/);});
test('custom exam categories appear in annual marks reports without hardcoded term columns',()=>{
 const html=report.reportHTML({...fake,cfg:{exam_labels:{weekly:'Weekly Review',custom:'Midyear Assessment'}},subjects:[{name:'Science',weekly:{got:8,max:10,pct:80},custom:{got:72,max:80,pct:90}}],final:{got:72,max:80,pct:90}},'marks');assert.match(html,/Midyear Assessment/);assert.match(html,/72\/80/);assert.doesNotMatch(html,/<th>Term 3<\/th>/);
});
