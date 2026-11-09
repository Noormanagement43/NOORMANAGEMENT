/* Annual reports from actual school records. Never synthesize student marks or attendance. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=v=>/^[0-9a-f-]{36}$/i.test(String(v||''));
const date=(value,tz)=>{const a=new Intl.DateTimeFormat('en-GB',{timeZone:tz||'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)),f=k=>a.find(x=>x.type===k)?.value;return f('year')+'-'+f('month')+'-'+f('day');};
const plus=(d,n)=>{let x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const per=(x,y)=>y>0?Math.round(x/y*1000)/10:null;
const grade=v=>v==null?'—':v>=90?'A+':v>=80?'A':v>=70?'B':v>=60?'C':v>=50?'D':'Needs support';
const defaults={subject_names:[],exam_labels:{weekly:'Weekly Tests',monthly:'Monthly Tests',term1:'Term 1 Exam',term2:'Term 2 Exam',term3:'Term 3 (Final)'},exam_aliases:{weekly:['weekly','quiz'],monthly:['monthly'],term1:['term 1','first term'],term2:['term 2','second term'],term3:['term 3','third term','final exam']},non_working_weekdays:[0]};
const active=c=>A().user?.id===c.user&&A().schoolId===c.school;
async function access(group){
 const a=A(),user=a.user?.id,school=a.schoolId;if(!user||!school||!id(group))throw Error('Select a class or section.');
 const auth=await a.db.auth.getUser();if(auth.error||auth.data?.user?.id!==user)throw Error('Sign in again.');
 const r=await a.db.from('institution_memberships').select('id,role').eq('institution_id',school).eq('user_id',user).eq('status','active').single();
 if(r.error||!r.data)throw Error('An active school membership is required.');
 const principal=['principal','school_admin','university_admin','academic_admin'].includes(r.data.role),teacher=['teacher','faculty'].includes(r.data.role);
 if(!principal&&!teacher)throw Error('Only the principal or assigned class teacher may access this report.');
 const g=await a.db.from('academic_groups').select('id,name,group_type,parent_group_id,homeroom_teacher_membership_id').eq('institution_id',school).eq('is_active',true).eq('id',group).single();
 if(g.error)throw Error('Class or section not found in your school.');
 if(teacher){const x=await a.db.from('academic_group_memberships').select('id').eq('institution_id',school).eq('membership_id',r.data.id).eq('group_id',group).eq('status','active').in('group_role',['teacher','faculty']).limit(1);if(x.error||!x.data?.length)throw Error('Choose your assigned class/section to open the annual report.');if(g.data.homeroom_teacher_membership_id&&g.data.homeroom_teacher_membership_id!==r.data.id)throw Error('Only the designated class teacher may open this report.');}
 const c={db:a.db,user,school,principal,teacher,group:g.data,schoolInfo:a.school||{}};
 if(!active(c))throw Error('Account changed.');return c;
}
async function paged(build){const all=[];for(let start=0;start<15000;start+=450){const q=await build().range(start,start+449);if(q.error)throw q.error;all.push(...(q.data||[]));if((q.data||[]).length<450)break;}return all;}
async function load(c,s){
 if(!id(s.membership_id))throw Error('Choose a valid student from the school performance table.');
 const tz=c.schoolInfo.timezone||'Asia/Kolkata',today=window.NOOR_SHARED_TIMETABLE?.schoolDay(tz)||date(new Date(),tz);
 const [yearRes,settingsRes,memberRes,groupsRes]=await Promise.all([
  c.db.from('academic_years').select('label,start_date,end_date,is_current').eq('institution_id',c.school).order('is_current',{ascending:false}).order('start_date',{ascending:false}).limit(1),
  c.db.from('noor_report_settings').select('subject_names,exam_labels,exam_aliases,non_working_weekdays').eq('institution_id',c.school).maybeSingle(),
  c.db.from('academic_group_memberships').select('group_id').eq('institution_id',c.school).eq('membership_id',s.membership_id).eq('group_role','student').eq('status','active'),
  c.db.from('academic_groups').select('id,parent_group_id,group_type').eq('institution_id',c.school).eq('is_active',true)]);
 for(const x of [yearRes,settingsRes,memberRes,groupsRes])if(x.error)throw x.error;
 const yr=Number(today.slice(0,4))-(Number(today.slice(5,7))<4?1:0);
 const year=yearRes.data?.[0]||{label:yr+'-'+String((yr+1)%100).padStart(2,'0'),start_date:yr+'-04-01',end_date:(yr+1)+'-03-31',provisional:true};
 const cfg={...defaults,...(settingsRes.data||{}),exam_labels:{...defaults.exam_labels,...(settingsRes.data?.exam_labels||{})},exam_aliases:{...defaults.exam_aliases,...(settingsRes.data?.exam_aliases||{})}};
 const to=year.end_date<today?year.end_date:today;
 if(to<year.start_date)throw Error('This academic year has not started yet.');
 const enrolled=new Set((memberRes.data||[]).map(x=>x.group_id)),classId=c.group.group_type==='section'?c.group.parent_group_id:c.group.id;
 const sections=(groupsRes.data||[]).filter(g=>g.parent_group_id===classId&&enrolled.has(g.id)).map(g=>g.id);
 if(!enrolled.has(classId)&&!sections.length)throw Error('This student is not enrolled in the chosen class.');
 if(c.group.group_type==='section'&&!enrolled.has(c.group.id))throw Error('This student is not enrolled in the selected section.');
 const ids=[...new Set([classId,...(c.group.group_type==='section'?[c.group.id]:sections)])];
 const [holidays,sessions,marks]=await Promise.all([
  paged(()=>c.db.from('noor_calendar_events').select('academic_group_id,starts_at,ends_at').eq('institution_id',c.school).eq('kind','holiday').gte('ends_at',year.start_date+'T00:00:00Z').lte('starts_at',plus(to,1)+'T23:59:59Z').order('starts_at')),
  paged(()=>c.db.from('class_sessions').select('id,starts_at,academic_group_id').eq('institution_id',c.school).in('academic_group_id',ids).eq('title','Daily class attendance').neq('session_status','cancelled').gte('starts_at',year.start_date+'T00:00:00Z').lte('starts_at',plus(to,1)+'T23:59:59Z').order('starts_at')),
  paged(()=>c.db.from('noor_assessment_results').select('assessment_title,subject_name,assessed_on,marks,max_marks,feedback').eq('institution_id',c.school).eq('student_membership_id',s.membership_id).in('academic_group_id',ids).gte('assessed_on',year.start_date).lte('assessed_on',to).order('assessed_on'))]);
 if(!active(c))throw Error('Account changed.');
 const off=new Set();
 for(const h of holidays){if(h.academic_group_id&&!ids.includes(h.academic_group_id))continue;const first=date(h.starts_at,tz),last=date(h.ends_at||h.starts_at,tz);for(let d=first;d<=last&&off.size<600;d=plus(d,1))off.add(d);}
 const days=new Map();
 for(const x of sessions){const d=date(x.starts_at,tz);if(d<year.start_date||d>to||off.has(d)||(cfg.non_working_weekdays||[0]).includes(new Date(d+'T12:00:00Z').getUTCDay()))continue;if(!days.has(d))days.set(d,[]);days.get(d).push(x.id);}
 const allIDs=[...new Set([...days.values()].flat())],records=[];
 for(let i=0;i<allIDs.length;i+=70){const batch=await paged(()=>c.db.from('attendance_records').select('session_id,attendance_status,marked_at').eq('institution_id',c.school).eq('student_membership_id',s.membership_id).in('session_id',allIDs.slice(i,i+70)).order('marked_at',{ascending:false}));records.push(...batch);}
 if(!active(c))throw Error('Account changed.');
 const saved=new Map();for(const rec of records){const old=saved.get(rec.session_id);if(!old||String(rec.marked_at)>String(old.marked_at))saved.set(rec.session_id,rec);}
 const months=new Map();
 for(const [d,list] of [...days.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){const key=d.slice(0,7),row=months.get(key)||{key,working:0,present:0,absent:0,late:0,leave:0,unmarked:0};row.working++;
 const record=list.map(x=>saved.get(x)).filter(Boolean).sort((a,b)=>String(b.marked_at).localeCompare(String(a.marked_at)))[0],status=record?.attendance_status;
 if(status==='present'||status==='late'){row.present++;if(status==='late')row.late++;}else if(status==='absent')row.absent++;else if(status==='leave')row.leave++;else row.unmarked++;months.set(key,row);}
 const monthly=[...months.values()],working=monthly.reduce((n,x)=>n+x.working,0),present=monthly.reduce((n,x)=>n+x.present,0),unmarked=monthly.reduce((n,x)=>n+x.unmarked,0),absent=monthly.reduce((n,x)=>n+x.absent,0),late=monthly.reduce((n,x)=>n+x.late,0);
 const subjectMap=new Map(),kinds=['term3','term2','term1','weekly','monthly'];
 for(const m of marks){const key=String(m.subject_name||'').trim();if(!key)continue;if(!subjectMap.has(key))subjectMap.set(key,{name:key,weekly:[],monthly:[],term1:[],term2:[],term3:[],other:[]});const title=String(m.assessment_title||'').toLowerCase();const kind=kinds.find(k=>(cfg.exam_aliases?.[k]||[]).some(word=>word&&title.includes(String(word).toLowerCase())))||'other';subjectMap.get(key)[kind].push(m);}
 for(const n of cfg.subject_names||[]){const key=String(n).trim();if(key&&!subjectMap.has(key))subjectMap.set(key,{name:key,weekly:[],monthly:[],term1:[],term2:[],term3:[],other:[]});}
 const score=arr=>{const got=arr.reduce((n,x)=>n+Number(x.marks||0),0),max=arr.reduce((n,x)=>n+Number(x.max_marks||0),0);return max?{got,max,pct:per(got,max)}:null;};
 const subjects=[...subjectMap.values()].map(row=>({name:row.name,...Object.fromEntries(['weekly','monthly','term1','term2','term3','other'].map(k=>[k,score(row[k])]))}));
 const got=subjects.reduce((n,x)=>n+(x.term3?.got||0),0),max=subjects.reduce((n,x)=>n+(x.term3?.max||0),0);
 const ranking=await c.db.rpc('noor_class_performance',{p_institution:c.school,p_group:c.group.id,p_from:year.start_date,p_to:to});
 if(ranking.error)throw ranking.error;
 const annualRank=(ranking.data?.students||[]).find(x=>x.membership_id===s.membership_id)?.rank??null;
 if(!active(c))throw Error('Account changed.');
 return {c,s,year,cfg,monthly,holidays:off.size,summary:{working,present,absent,late,unmarked,pct:per(present,working-unmarked)},subjects,final:{got,max,pct:per(got,max)},annualRank,remarks:marks.filter(x=>x.feedback).at(-1)?.feedback||'',marksCount:marks.length};
}
function monthRows(d){const out=[],start=Number(d.year.start_date.slice(0,4)),m=Number(d.year.start_date.slice(5,7))-1;for(let i=0;i<12;i++){const x=new Date(Date.UTC(start,m+i,1)),key=x.toISOString().slice(0,7);if(key>d.year.end_date.slice(0,7))break;out.push({name:x.toLocaleString('en-IN',{month:'long',timeZone:'UTC'}),...(d.monthly.find(q=>q.key===key)||{working:0,present:0,absent:0,late:0,leave:0,unmarked:0})});}return out;}
const value=x=>x==null?'—':E(x);
function reportHTML(d,type){
 const attendance=type==='attendance',logo=d.c.schoolInfo.logo_url||'',avatar=d.s.photo||'',school=d.c.schoolInfo.name||'School',className=d.s.class_label||d.c.group.name||'Class';
 const picture=avatar.startsWith('https://')?'<img src="'+E(avatar)+'" alt="Student photograph">':'<span>'+E((d.s.name||'S')[0])+'</span>';
 const title=attendance?'ANNUAL ATTENDANCE REPORT':'ANNUAL MARKS REPORT CARD';
 const header='<div class="nar-brand"><span>'+(logo.startsWith('https://')?'<img src="'+E(logo)+'" alt="School logo">':'◆')+' '+E(school)+'</span><b>PRIMARY SCHOOL REPORT</b></div><div class="nar-head"><div class="nar-student">'+picture+'<div><small>STUDENT:</small><h2>'+E(d.s.name||'Student')+'</h2><small>CLASS & SEC:</small><strong>'+E(className)+'</strong><small>ROLL: '+E(d.s.roll_number||'—')+'</small></div></div><div><h1>'+E(title)+'</h1><p>Academic Year: '+E(d.year.label)+(d.year.provisional?' · Provisional':'')+'</p></div></div>';
 const columns=attendance?['Month','Working Days','Days Present','Attendance']:['Subjects',...['weekly','monthly','term1','term2','term3'].map(k=>d.cfg.exam_labels[k]||k),'Grade'];
 const rows=attendance?monthRows(d).map(x=>[x.name,x.working||'—',x.working?x.present:'—',x.working!==x.unmarked?per(x.present,x.working-x.unmarked)+'%'+(x.unmarked?' *':''):'—']):d.subjects.map(x=>[x.name,...['weekly','monthly','term1','term2','term3'].map(k=>x[k]?(k==='weekly'||k==='monthly'?x[k].pct+'%':x[k].got+'/'+x[k].max):'—'),grade(x.term3?.pct??null)]);
 const table='<table class="nar-table"><thead><tr>'+columns.map(x=>'<th>'+E(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(x=>'<tr>'+x.map(y=>'<td>'+E(y)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 const aside=attendance?'<h3>TERM BRIEF</h3><p>Present: '+d.summary.present+'</p><p>Absent: '+d.summary.absent+'</p><p>Late: '+d.summary.late+'</p><p>Unmarked: '+d.summary.unmarked+'</p><p>School holidays excluded: '+d.holidays+'</p><small>Rates count marked days only; missing registers are not absences.</small>':'<h3>ACADEMIC BRIEF</h3><p>Assessments: '+d.marksCount+'</p><p>Term 3 subjects graded: '+d.subjects.filter(x=>x.term3).length+'</p><h3>Teacher’s Remark</h3><p>'+E(d.remarks||'No remarks recorded.')+'</p><small>Grades are indicative until school policy is configured.</small>';
 const summary=attendance?'Total Working Days: '+d.summary.working+' | Days Present: '+d.summary.present+' | Recorded Attendance: '+(d.summary.pct==null?'—':d.summary.pct+'%'):'Final Term Marks: '+(d.final.max?d.final.got+'/'+d.final.max:'Not recorded')+' | Final Term Percentage: '+(d.final.pct==null?'—':d.final.pct+'%')+' | Class Rank: '+(d.annualRank==null?'—':d.annualRank);
 return '<article class="nar-paper"><div class="nar-report-content">'+header+'<h3 class="nar-section-title">'+(attendance?'YEARLY ATTENDANCE SUMMARY':'TERM-WISE & PERIODIC ACADEMIC PERFORMANCE')+'</h3><div class="nar-layout"><main>'+table+(!rows.length?'<p>No marks have been recorded yet.</p>':'')+'</main><aside>'+aside+'</aside></div><div class="nar-summary"><b>'+(attendance?'ATTENDANCE SUMMARY':'PROGRESS SUMMARY')+'</b><p>'+E(summary)+'</p></div><footer>Generated from recorded school data · '+E(d.year.start_date)+' to '+E(d.year.end_date)+'<span>Class Teacher Signature: ______________</span></footer></div></article>';
}
function download(text,name,mime){const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
function excel(d,type){const attendance=type==='attendance',cols=attendance?['Month','Working Days','Present','Absent','Late','Leave','Unmarked','Attendance %']:['Subject',...['weekly','monthly','term1','term2','term3'].map(k=>d.cfg.exam_labels[k]||k),'Grade'];
 const data=attendance?monthRows(d).map(x=>[x.name,x.working,x.present,x.absent,x.late,x.leave,x.unmarked,x.working===x.unmarked?'':per(x.present,x.working-x.unmarked)]):d.subjects.map(x=>[x.name,...['weekly','monthly','term1','term2','term3'].map(k=>x[k]?(k==='weekly'||k==='monthly'?x[k].pct+'%':x[k].got+'/'+x[k].max):''),grade(x.term3?.pct??null)]);
 const escape=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
 const row=(items,head=false)=>'<Row>'+items.map((v,i)=>'<Cell ss:StyleID="'+(head?'head':i===0?'label':'body')+'"><Data ss:Type="'+(typeof v==='number'?'Number':'String')+'">'+escape(v)+'</Data></Cell>').join('')+'</Row>';
 return '<?xml version="1.0" encoding="utf-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="head"><Font ss:Bold="1"/><Interior ss:Color="#FFE0A0" ss:Pattern="Solid"/></Style><Style ss:ID="label"><Font ss:Bold="1"/></Style><Style ss:ID="body"/></Styles><Worksheet ss:Name="'+(attendance?'Attendance':'Marks')+'"><Table>'+row([d.c.schoolInfo.name||'School',d.s.name||'Student','Academic Year',d.year.label],true)+row(cols,true)+data.map(x=>row(x)).join('')+'</Table></Worksheet></Workbook>';
}
function exportReport(d,type,format){
 if(!active(d.c))throw Error('Account changed. Sign in again.');
 const basename='NOOR-'+type+'-'+String(d.s.name||'student').replace(/[^a-z0-9]+/gi,'-')+'-'+d.year.label;
 if(format==='excel')return download(excel(d,type),basename+'.xls','application/vnd.ms-excel;charset=utf-8');
 if(format==='word')return download('<html><head><meta charset="utf-8"><style>body{font:13pt Calibri;color:#342824}.nar-paper{padding:15pt}.nar-head{margin:20pt 0}h1{font-size:23pt;color:#58734b}.nar-table{border-collapse:collapse;width:100%}.nar-table th,.nar-table td{padding:7pt;border:1pt solid #dfd1bd}.nar-table th{background:#ffe6b4}.nar-summary{background:#ffd16d;padding:12pt}.nar-brand img,.nar-student img{height:70pt}.nar-layout aside{background:#f7edd9;padding:12pt}</style></head><body>'+reportHTML(d,type)+'</body></html>',basename+'.doc','application/msword;charset=utf-8');
 if(format==='pdf'){const w=window.open('','_blank');if(!w)throw Error('Enable popups to print the PDF.');const css=new URL('./noor-annual-reports.css?v=20261109-1',document.baseURI).href;w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+E(basename)+'</title><link rel="stylesheet" href="'+E(css)+'"></head><body class="nar-print">'+reportHTML(d,type)+'</body></html>');w.document.close();w.addEventListener('load',()=>w.print(),{once:true});return;}
}
async function open(s,group){
 const c=await access(group);
 document.getElementById('noor-annual-report-dialog')?.remove();
 const dlg=document.createElement('dialog');dlg.id='noor-annual-report-dialog';dlg.className='nar-dialog';dlg.innerHTML='<header class="nar-modal-top"><b>Annual Student Reports</b><button type="button" data-close aria-label="Close">✕</button></header><div data-report role="status">Loading saved attendance and marks…</div>';
 document.body.append(dlg);dlg.querySelector('[data-close]').onclick=()=>dlg.close();dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
 try{const d=await load(c,s);if(!active(c)||!dlg.isConnected)return;let type='attendance';const render=()=>{
 const target=dlg.querySelector('[data-report]');
 target.innerHTML='<nav class="nar-tabs"><button data-type="attendance" aria-pressed="'+(type==='attendance')+'">Annual Attendance Report</button><button data-type="marks" aria-pressed="'+(type==='marks')+'">Annual Marks Report</button></nav>'+reportHTML(d,type)+
 '<div class="nar-actions"><strong>Open report:</strong><button data-export="pdf">PDF</button><button data-export="word">Word</button><button data-export="excel">Excel</button>'+(type==='marks'?'<button data-add-marks>Add / Upload Marks</button>':'')+(c.principal?'<button data-settings>Principal Settings</button>':'')+'</div><p class="nar-note">PDF opens browser print / Save as PDF. Word and Excel download editable files. Only recorded school data appears; holidays marked by school leadership are excluded.</p><p role="status" data-status></p>';
 target.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{type=b.dataset.type;render();});
 target.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{try{exportReport(d,type,b.dataset.export);target.querySelector('[data-status]').textContent=b.dataset.export==='pdf'?'Choose Save as PDF in print preview.':'File created.';}catch(e){target.querySelector('[data-status]').textContent=e.message;}});
 target.querySelector('[data-settings]')?.addEventListener('click',()=>editSettings(c));target.querySelector('[data-add-marks]')?.addEventListener('click',()=>markEntry(d));};render();
 }catch(err){if(dlg.isConnected)dlg.querySelector('[data-report]').textContent='Report unavailable: '+err.message;}
}
async function markEntry(d){
 const c=d.c;if(!active(c)||(!c.principal&&!c.teacher))throw Error('Class teacher or principal access required.');
 document.getElementById('nar-marks-editor')?.remove();
 const dlg=document.createElement('dialog');dlg.id='nar-marks-editor';dlg.className='nar-config-dialog';
 const subjects=[...new Set([...(d.cfg.subject_names||[]),...d.subjects.map(x=>x.name)].filter(Boolean))];
 const today=window.NOOR_SHARED_TIMETABLE?.schoolDay(c.schoolInfo.timezone)||date(new Date(),c.schoolInfo.timezone);
 dlg.innerHTML='<form><h2>Upload Student Marks</h2><p>Student: '+E(d.s.name)+' · '+E(d.s.class_label||c.group.name)+' · '+E(d.year.label)+'</p>'+
 '<label>Subject<input name="subject" required maxlength="140" list="nar-subject-options"><datalist id="nar-subject-options">'+subjects.map(x=>'<option value="'+E(x)+'"></option>').join('')+'</datalist></label>'+
 '<label>Assessment category<select name="kind">'+['weekly','monthly','term1','term2','term3'].map(k=>'<option value="'+k+'">'+E(d.cfg.exam_labels[k]||k)+'</option>').join('')+'</select></label>'+
 '<label>Assessment date<input name="date" type="date" required min="'+E(d.year.start_date)+'" max="'+E(today<d.year.end_date?today:d.year.end_date)+'" value="'+E(today)+'"></label>'+
 '<label>Marks obtained<input name="marks" type="number" step="0.01" min="0" required></label><label>Maximum marks<input name="max" type="number" step="0.01" min="0.01" required></label>'+
 '<label>Teacher feedback (optional)<textarea name="feedback" rows="3" maxlength="1000"></textarea></label>'+
 '<button type="submit">Save Marks</button><button type="button" data-close>Cancel</button><p role="status"></p></form>';
 document.body.append(dlg);dlg.querySelector('[data-close]').onclick=()=>dlg.close();dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
 const form=dlg.querySelector('form');form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('[type=submit]'),msg=form.querySelector('[role=status]');submit.disabled=true;
 try{
  if(!active(c))throw Error('Account changed.');
  const subject=form.elements.subject.value.trim(),kind=form.elements.kind.value,marks=Number(form.elements.marks.value),max=Number(form.elements.max.value),assessed_on=form.elements.date.value;
  if(!subject||!['weekly','monthly','term1','term2','term3'].includes(kind)||!(max>0)||marks<0||marks>max||!Number.isFinite(marks)||!Number.isFinite(max)||assessed_on<d.year.start_date||assessed_on>d.year.end_date||assessed_on>today)throw Error('Enter valid subject, date and marks (0 to maximum).');
  const payload={institution_id:c.school,academic_group_id:c.group.id,student_membership_id:d.s.membership_id,assessment_title:d.cfg.exam_labels[kind]||kind,subject_name:subject,assessed_on,marks,max_marks:max,feedback:form.elements.feedback.value.trim()||null,graded_by:c.user};
  const saved=await c.db.from('noor_assessment_results').insert(payload).select('id').single();if(saved.error)throw saved.error;
  msg.textContent='Saved to the school database.';dlg.close();await open(d.s,c.group.id);
 }catch(err){msg.textContent='Not saved: '+err.message;}finally{submit.disabled=false;}};
}
async function editSettings(c){
 if(!c.principal)throw Error('Principal permission required.');
 const row=await c.db.from('noor_report_settings').select('*').eq('institution_id',c.school).maybeSingle();if(row.error)throw row.error;
 const academic=await c.db.from('academic_years').select('id,label,start_date,end_date,is_current').eq('institution_id',c.school).order('is_current',{ascending:false}).order('start_date',{ascending:false}).limit(1);if(academic.error)throw academic.error;
 const prior=academic.data?.[0]||null,now=window.NOOR_SHARED_TIMETABLE?.schoolDay(c.schoolInfo.timezone)||date(new Date(),c.schoolInfo.timezone),y=Number(now.slice(0,4))-(Number(now.slice(5,7))<4?1:0),year=prior||{label:y+'-'+String((y+1)%100).padStart(2,'0'),start_date:y+'-04-01',end_date:(y+1)+'-03-31'};
 const cfg={...defaults,...(row.data||{}),exam_labels:{...defaults.exam_labels,...(row.data?.exam_labels||{})},exam_aliases:{...defaults.exam_aliases,...(row.data?.exam_aliases||{})}};
 const old=document.getElementById('nar-config-dialog');if(old)old.remove();const dlg=document.createElement('dialog');dlg.id='nar-config-dialog';dlg.className='nar-config-dialog';
 dlg.innerHTML='<form><h2>Principal · Report Settings</h2><fieldset><legend>Academic Year</legend><label>Year label<input name="year_label" required maxlength="50" value="'+E(year.label)+'"></label><label>Start date<input name="year_start" type="date" required value="'+E(year.start_date)+'"></label><label>End date<input name="year_end" type="date" required value="'+E(year.end_date)+'"></label></fieldset><label>Subjects (one per line)<textarea name="subjects" rows="7">'+E((cfg.subject_names||[]).join('\n'))+'</textarea></label>'+
 ['weekly','monthly','term1','term2','term3'].map(k=>'<label>'+E(k)+' display name<input name="label_'+k+'" value="'+E(cfg.exam_labels[k])+'" maxlength="90"></label><label>'+E(k)+' title keywords (comma separated)<input name="alias_'+k+'" value="'+E((cfg.exam_aliases?.[k]||[]).join(', '))+'"></label>').join('')+
 '<fieldset><legend>Non-working days</legend><label><input type="checkbox" name="sunday" '+((cfg.non_working_weekdays||[]).includes(0)?'checked':'')+'> Sunday</label><label><input type="checkbox" name="saturday" '+((cfg.non_working_weekdays||[]).includes(6)?'checked':'')+'> Saturday</label></fieldset><label>School logo (up to 3 MB)<input type="file" name="logo" accept="image/png,image/jpeg,image/webp"></label><button type="submit">Save Settings</button><button type="button" data-close>Cancel</button><p role="status"></p></form>';
 document.body.append(dlg);dlg.querySelector('[data-close]').onclick=()=>dlg.close();dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
 dlg.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('[type=submit]'),status=f.querySelector('[role=status]');b.disabled=true;try{
  if(!active(c))throw Error('Account changed.');
  const names=f.elements.subjects.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,30);
  const labels={},aliases={};for(const k of ['weekly','monthly','term1','term2','term3']){labels[k]=f.elements['label_'+k].value.trim().slice(0,90)||defaults.exam_labels[k];aliases[k]=f.elements['alias_'+k].value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,30);}
  const days=[...(f.elements.sunday.checked?[0]:[]),...(f.elements.saturday.checked?[6]:[])];
  const r=await c.db.from('noor_report_settings').upsert({institution_id:c.school,subject_names:names,exam_labels:labels,exam_aliases:aliases,non_working_weekdays:days,updated_at:new Date().toISOString()},{onConflict:'institution_id'}).select('institution_id').single();if(r.error)throw r.error;
  const start=f.elements.year_start.value,end=f.elements.year_end.value,yearLabel=f.elements.year_label.value.trim();
  if(!start||!end||start>=end||!yearLabel||yearLabel.length>50)throw Error('Enter a valid academic year and label.');
  const savedYear=prior?
   await c.db.from('academic_years').update({label:yearLabel,start_date:start,end_date:end,is_current:true}).eq('id',prior.id).eq('institution_id',c.school).select('id').single():
   await c.db.from('academic_years').insert({institution_id:c.school,label:yearLabel,start_date:start,end_date:end,is_current:true}).select('id').single();
  if(savedYear.error)throw savedYear.error;
  if(f.elements.logo.files.length){if(!window.NOOR_SCHOOL_BRANDING?.upload)throw Error('Logo upload is unavailable.');await window.NOOR_SCHOOL_BRANDING.upload(f.elements.logo.files[0]);}
  status.textContent='Settings saved. Reopen report to reload updated labels.';b.disabled=false;
 }catch(error){status.textContent='Not saved: '+error.message;b.disabled=false;}};
}
window.NOOR_ANNUAL_REPORTS=Object.freeze({open,load,monthRows,reportHTML});
})();