import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const window={};vm.runInNewContext(fs.readFileSync(new URL('../noor-assistant-records.js',import.meta.url),'utf8'),{window});const api=window.NOOR_ASSISTANT_RECORDS;
const groups=[{id:'1m',class_name:'Class 1',section_name:'Mango'},{id:'1a',class_name:'Class 1',section_name:'Apple'},{id:'10m',class_name:'Class 10',section_name:'Mango'}];
test('class/section/roll search understands the actual phrases without confusing class 1 and 10',()=>{
 assert.deepEqual(Array.from(api.matchGroups('section 1 mango attendence',groups),x=>x.id),['1m']);
 assert.deepEqual(Array.from(api.matchGroups('class 10 mango attendance',groups),x=>x.id),['10m']);
 assert.equal(api.parse('section 1 mango 7 roll number').roll,'7');assert.equal(api.parse('Class 1 Mango roll no. 007').roll,'007');
 assert.deepEqual(Array.from(api.matchGroups('section 1 mango 7 roll number',groups),x=>x.id),['1m']);
});
test('ambiguous or unknown sections never silently choose the first class',()=>{
 assert.equal(api.matchGroups('class 1 attendance',groups).length,2);
 assert.equal(api.matchGroups('class 1 section banana attendance',groups).length,0);
 assert.equal(api.matchGroups('class 12 section mango attendance',groups).length,0);
 assert.equal(api.matchGroups('roll number 7',groups).length,3);
});
test('group matching cannot add records outside the supplied authorised groups',()=>{
 const allowed=[groups[1]];assert.equal(api.matchGroups('class 1 section mango roll 7',allowed).length,0);assert.equal(api.matchGroups('section 1 mango attendance',allowed).length,0);
});
test('student card escapes stored names and marks and distinguishes missing from zero',()=>{
 const html=api.studentHTML({name:'<script>bad</script>',roll_number:'<img>',marks_pct:0,attendance_pct:null,subjects:[{subject_name:'<Math>',marks:0,max_marks:100}]},'Class 1',null);
 assert.doesNotMatch(html,/<script>|<img>|<Math>/);assert.match(html,/0%/);assert.match(html,/Not recorded/);
});
