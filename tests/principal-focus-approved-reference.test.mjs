import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function visual(){
 const window={NOOR_UI_POLISH:{icon:()=>''}};
 runInNewContext(read('noor-principal-reference-ui.js'),{window,Intl,Date});
 return window.NOOR_PRINCIPAL_REFERENCE;
}
const periods=[
 {id:'period1',teacher_id:'teacher1',class_id:'class6',section_id:'sectionA',class_label:'Class 6 · A',subject_name:'Mathematics',period_number:1,start_time:'10:15:00',end_time:'11:15:00'},
 {id:'period2',teacher_id:'teacher2',class_id:'class7',section_id:'sectionB',class_label:'Class 7 · B',subject_name:'Science',period_number:3,start_time:'10:15:00',end_time:'11:15:00'}
];
const teachers=[{id:'teacher1',full_name:'Teacher Alpha'},{id:'teacher2',full_name:'Teacher Beta'}];
const classes=[{id:'class6',name:'Class 6'},{id:'class7',name:'Class 7'}];
const sections=[{id:'sectionA',name:'A',class_id:'class6'},{id:'sectionB',name:'B',class_id:'class7'}];
test('approved Running now card renders real teachers, large portraits, sections, subjects, periods and times',()=>{
 const actual=visual().running(periods,teachers,classes,sections,new Map(),{
  teacher1:'https://abc.supabase.co/storage/v1/object/sign/noor-profile-photos/a.jpg?token=secure'
 });
 assert.match(actual,/Teacher Alpha/);
 assert.match(actual,/Teacher Beta/);
 assert.match(actual,/Mathematics/);
 assert.match(actual,/Science/);
 assert.match(actual,/Class 6 A/);
 assert.match(actual,/Class 7 B/);
 assert.match(actual,/Period 1/);
 assert.match(actual,/Period 3/);
 assert.match(actual,/10:15 – 11:15/);
 assert.match(actual,/class="pd-running-photo"/);
 assert.match(actual,/src="https:\/\/abc\.supabase\.co\/storage\/v1\/object\/sign\//);
 assert.match(actual,/data-view-teacher="teacher1"/);
 assert.match(actual,/data-pd-period="period1"/);
 assert.match(actual,/Scheduled now/);
 assert.doesNotMatch(actual,/Priya Sharma|Neha Reddy|Rahul Mehta/);
});
test('teacher photo must be a signed storage URL, otherwise show escaped initials without fake images',()=>{
 const value=visual().running([{...periods[0],subject_name:'<svg onload=alert(1)>'}],teachers,classes,sections,new Map(),{
  teacher1:'javascript:alert(1)'
 });
 assert.doesNotMatch(value,/<svg onload|javascript:alert|<img /);
 assert.match(value,/&lt;svg onload=alert\(1\)&gt;/);
 assert.match(value,/pd-running-initials/);
 assert.equal(visual().running([],teachers,classes,sections,new Map()),'<p class="pd-empty pd-running-empty">No periods are running right now. Only current school-time periods appear here.</p>');
});
test('ongoing status is shown only when the saved period run says ongoing',()=>{
 const html=visual().running(periods,teachers,classes,sections,new Map([['period1',{status:'ongoing'}]]));
 assert.match(html,/In progress/);
 assert.match(html,/Scheduled now/);
});
test('secondary attendance uses true A/B labels, actual submitted records and theme variables',()=>{
 const html=visual().secondary(
  classes,sections,
  [{id:'student1',class_id:'class6',section_id:'sectionA'},{id:'student2',class_id:'class7',section_id:'sectionB'}],
  [{id:'session1',attendance_date:'2026-11-18',status:'submitted'}],
  [{session_id:'session1',student_id:'student1',status:'present'}],
  '2026-11-18'
 );
 assert.match(html,/>6A<\/text>/);
 assert.match(html,/>7B<\/text>/);
 assert.match(html,/Class 6/);
 assert.match(html,/Present: 1 \/ 2/);
 assert.match(html,/Attendance: 50%/);
 assert.match(html,/1 marked · 1 unmarked/);
 assert.match(html,/var\(--pd-ref-accent/);
 assert.match(html,/var\(--pd-ref-gold/);
 assert.doesNotMatch(html,/234 \/ 250|93\.6%/);
});
test('principal focus uses actual live data, all colours follow selected NOOR theme and mobile stacks cards',()=>{
 const source=read('principal-live.js'),css=read('noor-principal-focus.css'),index=read('index.html');
 assert.match(source,/NOOR_PRINCIPAL_REFERENCE\.secondary/);
 assert.match(source,/NOOR_PRINCIPAL_REFERENCE\.running/);
 assert.match(source,/NOOR_AVATAR_SAFE\?\.signedUrl/);
 assert.match(source,/runningPeriods\.slice\(0,6\)/);
 assert.match(source,/periodPortraits\(displayed,teachers,db,canonical,sid,uid\)/);
 assert.match(source,/pd-running-live/);
 assert.match(source,/id="pd-trend"/);
 assert.match(source,/id="pd-periods"/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.55fr\) minmax\(335px,\.95fr\)/);
 assert.match(css,/@media\(max-width:1080px\)/);
 assert.match(css,/var\(--action-fill/);
 assert.match(css,/var\(--pd-ref-soft/);
 assert.match(index,/noor-principal-focus\.css/);
});
