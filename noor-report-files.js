/* NOOR report downloads: real XLSX, DOCX and PDF files; no external CDNs or invented data. */
(()=>{
'use strict';
const enc=new TextEncoder();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const grade=v=>v==null?'—':v>=90?'A+':v>=80?'A':v>=70?'B':v>=60?'C':v>=50?'D':'Needs support';
const pct=(x,y)=>y>0?Math.round(x/y*1000)/10:null;
const monthRows=d=>{
 const rows=[],y=Number(d.year.start_date.slice(0,4)),m=Number(d.year.start_date.slice(5,7))-1;
 for(let i=0;i<12;i++){const dt=new Date(Date.UTC(y,m+i,1)),key=dt.toISOString().slice(0,7);if(key>d.year.end_date.slice(0,7))break;rows.push({name:dt.toLocaleString('en-IN',{month:'long',timeZone:'UTC'}),...(d.monthly.find(x=>x.key===key)||{working:0,present:0,absent:0,late:0,leave:0,unmarked:0})});}
 return rows;
};
function contents(d,type){
 if(type==='register'){
  const school=d.c.schoolInfo.name||'School',student='Class attendance register',group=d.s.class_label||'Class',year=d.year.label||'';
  const rows=(d.registerRows||[]).map(x=>[x.name,x.roll,x.group,x.status]);
  const totals={present:0,absent:0,late:0,leave:0,unmarked:0};
  for(const x of d.registerRows||[]){const status=x.status==='Not marked'?'unmarked':x.status;if(Object.hasOwn(totals,status))totals[status]++;}
  return {attendance:false,register:true,school,student,group,year,title:'Daily Attendance Register',period:d.year.start_date,
   headers:['Student','Roll No.','Class / Section','Attendance'],rows,
   summary:[['Total students',rows.length],['Present',totals.present],['Absent',totals.absent],['Late',totals.late],['Leave',totals.leave],['Not marked',totals.unmarked]],
   note:'Only submitted attendance records are included. Unmarked students are not counted absent.'};
 }
 const attendance=type==='attendance',school=d.c.schoolInfo.name||'School',student=d.s.name||'Student',group=d.s.class_label||d.c.group.name||'Class',year=d.year.label||'Academic year';
 const keys=Object.keys(d.cfg.exam_labels||{}),last=keys.includes('term3')?'term3':keys[keys.length-1];
 const headers=attendance?['Month','Working Days','Present','Absent','Late','Leave','Unmarked','Attendance %']:['Subject',...keys.map(x=>d.cfg.exam_labels[x]),'Grade'];
 const rows=attendance?monthRows(d).map(x=>[x.name,x.working,x.present,x.absent,x.late,x.leave,x.unmarked,x.working===x.unmarked?'':pct(x.present,x.working-x.unmarked)]):d.subjects.map(s=>[s.name,...keys.map(k=>s[k]?(k==='weekly'||k==='monthly'?s[k].pct+'%':s[k].got+'/'+s[k].max):''),grade(s[last]?.pct??null)]);
 const summary=attendance?[
   ['Total working days',d.summary.working],['Present',d.summary.present],['Absent',d.summary.absent],['Late',d.summary.late],['Unmarked (not absent)',d.summary.unmarked],['Recorded attendance %',d.summary.pct??'Not available'],['School holidays excluded',d.holidays]
 ]:[['Final term marks',d.final.max?d.final.got+'/'+d.final.max:'Not recorded'],['Final percentage',d.final.pct??'Not available'],['Class rank',d.annualRank??'Not recorded'],['Recorded assessments',d.marksCount],['Teacher remark',d.remarks||'No remark recorded']];
 return {attendance,school,student,group,year,title:attendance?'Annual Attendance Report':'Annual Marks Report',period:d.year.start_date+' to '+d.year.end_date,headers,rows,summary,note:attendance?'Working days exclude school closures and configured non-working weekdays. Unmarked registers are not absences.':'Only recorded marks are included. Empty scores are not estimated.'};
}
const cat=parts=>{const len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len);let off=0;for(const p of parts){out.set(p,off);off+=p.length;}return out;};
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=b=>{let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
function zip(entries){
 const locals=[],centrals=[];let offset=0;
 const u16=(view,off,n)=>view.setUint16(off,n,true),u32=(view,off,n)=>view.setUint32(off,n>>>0,true);
 for(const [name,value] of Object.entries(entries)){
  const nameBytes=enc.encode(name),data=typeof value==='string'?enc.encode(value):value,crc=crc32(data);
  const local=new Uint8Array(30+nameBytes.length),lv=new DataView(local.buffer);
  u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x800);u16(lv,8,0);u32(lv,14,crc);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,nameBytes.length);local.set(nameBytes,30);
  const central=new Uint8Array(46+nameBytes.length),cv=new DataView(central.buffer);
  u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x800);u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,nameBytes.length);u32(cv,42,offset);central.set(nameBytes,46);
  locals.push(local,data);centrals.push(central);offset+=local.length+data.length;
 }
 const centralData=cat(centrals),end=new Uint8Array(22),v=new DataView(end.buffer);
 u32(v,0,0x06054b50);u16(v,8,centrals.length);u16(v,10,centrals.length);u32(v,12,centralData.length);u32(v,16,offset);
 return cat([...locals,centralData,end]);
}
function xlsx(d,type){
 const x=contents(d,type),alpha=i=>{let result='';for(let n=i+1;n;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
 let rows=[],rowIndex=0;
 const add=(cells,style=0)=>{
  rowIndex++;rows.push('<row r="'+rowIndex+'">'+cells.map((value,i)=>{
   const label=alpha(i)+rowIndex,number=typeof value==='number'&&Number.isFinite(value);
   return '<c r="'+label+'" s="'+style+'"'+(number?'':' t="inlineStr"')+'>'+(number?'<v>'+value+'</v>':'<is><t xml:space="preserve">'+esc(value)+'</t></is>')+'</c>';
  }).join('')+'</row>');
 };
 add([x.school],1);add([x.title+' · '+x.year],1);
 add(['Student',x.student,'Class / Section',x.group,'Roll',d.s.roll_number||'—']);add(['Academic period',x.period]);add(x.headers,2);
 x.rows.forEach(r=>add(r));add([],0);add(['Summary'],1);x.summary.forEach(r=>add(r));
 add([],0);add([x.note]);
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="20" width="18" customWidth="1"/></cols><sheetData>'+rows.join('')+'</sheetData><pageMargins left=".35" right=".35" top=".5" bottom=".5" header=".2" footer=".2"/></worksheet>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="12"/><color rgb="FF5A233C"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4DDE6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"/></cellXfs></styleSheet>';
 return zip({
  '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+(x.register?'Daily Attendance':x.attendance?'Annual Attendance':'Annual Marks')+'" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':styles,'xl/worksheets/sheet1.xml':sheet
 });
}
function docx(d,type){
 const x=contents(d,type);
 const p=(v,style='Normal')=>'<w:p><w:pPr><w:pStyle w:val="'+style+'"/></w:pPr><w:r><w:t xml:space="preserve">'+esc(v)+'</w:t></w:r></w:p>';
 const tr=(values,head=false)=>'<w:tr>'+values.map(v=>'<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:shd w:fill="'+(head?'F4DDE6':'FFFFFF')+'"/></w:tcPr><w:p><w:r>'+(head?'<w:rPr><w:b/></w:rPr>':'')+'<w:t xml:space="preserve">'+esc(v)+'</w:t></w:r></w:p></w:tc>').join('')+'</w:tr>';
 const body=p(x.school,'Title')+p(x.title,'Heading1')+p('Student: '+x.student+'  |  Class / Section: '+x.group+'  |  Roll: '+(d.s.roll_number||'—'))+p('Academic year: '+x.year+'  |  '+x.period)+
 '<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D8B5C5"/><w:bottom w:val="single" w:sz="4" w:color="D8B5C5"/><w:insideH w:val="single" w:sz="4" w:color="E2CFD8"/></w:tblBorders></w:tblPr>'+tr(x.headers,true)+x.rows.map(r=>tr(r)).join('')+'</w:tbl>'+
 p('Summary','Heading2')+x.summary.map(([k,v])=>p(k+': '+v)).join('')+p(x.note)+p('Generated from saved school records · '+x.period);
 const document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="800" w:right="650" w:bottom="800" w:left="650"/></w:sectPr></w:body></w:document>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:color w:val="5A233C"/><w:sz w:val="34"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:color w:val="7E4360"/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:color w:val="7E4360"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>';
 return zip({
 '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
 'word/document.xml':document,'word/styles.xml':styles
 });
}
function pdf(d,type){
 const x=contents(d,type);
 const printable=s=>String(s??'').normalize('NFKD').replace(/[^\x20-\x7e]/g,'?').replace(/[()\\]/g,'\\$&');
 const pages=[],W=842,H=595,LM=38,RM=38;
 const ps=(t,size=10)=>'BT /F1 '+size+' Tf '+printable(t)+' Tj ET\n';
 const command=(t,X,Y,size=10)=>'BT /F1 '+size+' Tf 1 0 0 1 '+X+' '+Y+' Tm ('+printable(t)+') Tj ET\n';
 const rect=(X,Y,w,h,r,g,b)=>r+' '+g+' '+b+' rg '+X+' '+Y+' '+w+' '+h+' re f\n';
 const width=(W-LM-RM)/x.headers.length;
 let y=H-43,commands='';
 const nextPage=()=>{if(commands)pages.push(commands);commands=rect(0,0,W,H,1,1,1);y=H-43;};
 const line=(v,size=10,step=19)=>{commands+=command(v,LM,y,size);y-=step;};
 const cell=(text,width)=>{const len=Math.max(4,Math.floor((width-9)/5.1));return String(text??'').length>len?String(text).slice(0,len-1)+'…':String(text??'');};
 const row=(values,head=false)=>{
  if(y<67){nextPage();row(x.headers,true);}
  if(head)commands+=rect(LM,y-7,W-LM-RM,18,.96,.87,.92);
  values.forEach((v,i)=>{commands+=command(cell(v,width),LM+i*width+4,y,head?8:9);});
  y-=20;commands+='0.87 0.77 0.82 RG '+LM+' '+(y+13)+' m '+(W-RM)+' '+(y+13)+' l S\n';
 };
 nextPage();line(x.school,17,28);line(x.title+' · '+x.year,13,24);line('Student: '+x.student+' | '+x.group+' | Roll: '+(d.s.roll_number||'—'),10,20);line(x.period,9,28);row(x.headers,true);x.rows.forEach(r=>row(r));
 if(y<165)nextPage();y-=20;line('SUMMARY',12,23);x.summary.forEach(([k,v])=>{if(y<55)nextPage();line(k+': '+v,10,17)});
 if(y<65)nextPage();line(x.note,8,16);pages.push(commands);
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];let n=4,kids=[];
 for(const page of pages){const pageId=n++,contentId=n++;kids.push(pageId+' 0 R');objects[pageId]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents '+contentId+' 0 R >>';objects[contentId]='<< /Length '+enc.encode(page).length+' >>\nstream\n'+page+'endstream';}
 objects[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+pages.length+' >>';
 const parts=[enc.encode('%PDF-1.4\n')],offsets=[0];let off=parts[0].length;
 for(let i=1;i<objects.length;i++){const b=enc.encode(i+' 0 obj\n'+objects[i]+'\nendobj\n');offsets.push(off);parts.push(b);off+=b.length;}
 const xref=off;let end='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
 for(let i=1;i<objects.length;i++)end+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 end+='trailer\n<< /Root 1 0 R /Size '+objects.length+' >>\nstartxref\n'+xref+'\n%%EOF';
 parts.push(enc.encode(end));return cat(parts);
}
function download(bytes,filename,mime){
 const url=URL.createObjectURL(new Blob([bytes],{type:mime})),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function exportFile(d,type,format){
 const basename='NOOR-'+type+'-'+String(d.s.name||'student').replace(/[^a-z0-9]+/gi,'-')+'-'+String(d.year.label).replace(/[^a-z0-9-]+/gi,'');
 const formats={
  excel:()=>[xlsx(d,type),'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  word:()=>[docx(d,type),'.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pdf:()=>[pdf(d,type),'.pdf','application/pdf']
 };
 if(!formats[format])throw Error('Unknown report format.');
 const [bytes,ext,mime]=formats[format]();download(bytes,basename+ext,mime);
}
function exportRegister({school,group,date,students,marks}){
 if(!Array.isArray(students)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose a valid date and class.');
 const seen=new Map();
 for(const record of marks||[]){if(record.student_membership_id&&!seen.has(record.student_membership_id))seen.set(record.student_membership_id,record.attendance_status);}
 const d={c:{schoolInfo:{name:school||'School'},group:{name:group||'Class'}},
 s:{name:'Attendance-Register',class_label:group||'Class'},year:{start_date:date,end_date:date,label:date},
 registerRows:students.map(s=>({name:s.name||'Student',roll:s.roll_number||'—',group:group||'Class',status:seen.get(s.membership_id)||'Not marked'}))};
 return d;
}
window.NOOR_REPORT_FILES=Object.freeze({exportFile,exportRegister,xlsx,docx,pdf,contents});
})();