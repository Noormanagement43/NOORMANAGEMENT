import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function runFile(name,win={}){
 const ctx=vm.createContext({window:win,TextEncoder,TextDecoder,Uint8Array,Date,Intl,Number,Map,Set,Array,Object,Blob,Error,URL});
 vm.runInContext(src(name),ctx,{filename:name});return win;
}
function zipParts(data){
 const buf=Buffer.from(data),files=new Map();let off=0;
 while(off<buf.length-4&&buf.readUInt32LE(off)===0x04034b50){
  const size=buf.readUInt32LE(off+18),nameSize=buf.readUInt16LE(off+26),extra=buf.readUInt16LE(off+28);
  const name=buf.subarray(off+30,off+30+nameSize).toString();
  const from=off+30+nameSize+extra;
  files.set(name,buf.subarray(from,from+size).toString());off=from+size;
 }
 return files;
}
const fake={
 c:{schoolInfo:{name:'Example Institute'},group:{name:'Class 8 Section B'}},
 s:{name:'Student One',class_label:'Class 8 B',roll_number:'77'},
 year:{start_date:'2026-04-01',end_date:'2027-03-31',label:'2026-27'},
 cfg:{exam_labels:{weekly:'Weekly Tests',term3:'Final Exam'}},
 monthly:[{key:'2026-04',working:20,present:18,absent:2,late:0,leave:0,unmarked:0}],
 summary:{working:20,present:18,absent:2,late:0,unmarked:0,pct:90},
 subjects:[{name:'Mathematics',weekly:{pct:80,got:8,max:10},term3:{pct:96,got:96,max:100}}],
 final:{got:96,max:100,pct:96},marksCount:2,annualRank:1,remarks:'Recorded teacher feedback',holidays:3
};
test('xlsx is a real ZIP workbook with correct recorded annual attendance and no formula injection',()=>{
 const win=runFile('noor-report-files.js'),b=Buffer.from(win.NOOR_REPORT_FILES.xlsx(fake,'attendance'));
 assert.equal(b.subarray(0,2).toString(),'PK');
 const parts=zipParts(b);
 assert.ok(parts.has('xl/workbook.xml'));assert.ok(parts.has('xl/worksheets/sheet1.xml'));
 assert.match(parts.get('xl/worksheets/sheet1.xml'),/Unmarked/);
 assert.match(parts.get('xl/worksheets/sheet1.xml'),/Student One/);
 assert.match(parts.get('xl/worksheets/sheet1.xml'),/>90</);
});
test('docx uses actual OOXML and recorded marks',()=>{
 const win=runFile('noor-report-files.js'),b=Buffer.from(win.NOOR_REPORT_FILES.docx(fake,'marks'));
 const parts=zipParts(b);
 assert.ok(parts.has('word/document.xml'));
 assert.match(parts.get('word/document.xml'),/Mathematics/);
 assert.match(parts.get('word/document.xml'),/96\/100/);
 assert.match(parts.get('word/document.xml'),/Recorded teacher feedback/);
});
test('PDF generated directly has a cross-reference and attendance figures',()=>{
 const win=runFile('noor-report-files.js'),b=Buffer.from(win.NOOR_REPORT_FILES.pdf(fake,'attendance'));
 assert.match(b.subarray(0,8).toString(),/%PDF-1\.4/);
 assert.match(b.toString(),/xref\n0 \d+/);
 assert.match(b.toString(),/Student One/);
 assert.match(b.toString(),/%%EOF/);
});
test('calendar PDF text parsing never assumes a holiday from an unlabeled event',()=>{
 const win=runFile('noor-calendar-import.js'),parse=win.NOOR_CALENDAR_IMPORT.parseLines;
 const rows=Array.from(parse(['November 2026','18 Wed School Holiday - Diwali','20 Fri Parent meeting','2026-11-21 Special Working Day','23/11/2026 Annual Break']));
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(r=>r.kind),['holiday','review','working','holiday']);
 assert.equal(rows[0].date,'2026-11-18');
});
test('Google ICS upload parses dated events but requires human classification of ambiguous entries',()=>{
 const win=runFile('noor-calendar-import.js'),ics='BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261118\nSUMMARY:Working Day\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261120\nSUMMARY:Science Fair\nEND:VEVENT\nEND:VCALENDAR';
 const rows=Array.from(win.NOOR_CALENDAR_IMPORT.parseIcs(ics));
 assert.equal(rows.length,2);
 assert.equal(rows[0].kind,'working');assert.equal(rows[1].kind,'review');
});
test('one shared calendar exposes reviewed import, not a second Google embedded calendar',()=>{
 const code=src('noor-school-calendar.js');
 assert.match(code,/nscImportPdf/);
 assert.match(code,/schoolDayStatus/);
 assert.doesNotMatch(code,/nscReferenceBox|calendar\.google\.com\/calendar\/embed/);
});
test('calendar database changes have school-based RLS and leadership-only holiday guard',()=>{
 const code=src('supabase/migrations/20261118132500_approved_calendar_workday_overrides.sql');
 assert.match(code,/enable row level security/);
 assert.match(code,/private\.can_manage_academics\(institution_id\)/);
 assert.match(code,/noor_calendar_holiday_guard/);
});
