/* Direct app search. Every group, roster and profile is resolved inside the
   authenticated school; no records or search text are sent to an AI provider. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{},E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const contains=(text,value)=>(' '+norm(text)+' ').includes(' '+norm(value)+' ');
function parse(text){const q=norm(text),cl=q.match(/\b(?:class|grade|standard|std)\s*(\d+|nursery|nursary|lkg|ukg)\b/)||q.match(/\bsection\s*(\d+)\b/),roll=q.match(/\broll(?:\s*(?:no|number))?\s*(\d+)\b/)||q.match(/\b(\d+)\s*roll(?:\s*(?:no|number))?\b/);return{className:cl?.[1]||null,roll:roll?.[1]||null};}
const shortClass=v=>norm(v).replace(/^(?:class|grade|standard|std)\s*/,'');
const shortSection=v=>norm(v).replace(/^section\s*/,'');
function matchGroups(text,groups){const q=parse(text);let result=groups;
 if(q.className)result=result.filter(g=>shortClass(g.class_name)===q.className);
 const names=[...new Set(groups.map(g=>shortSection(g.section_name)).filter(Boolean))],matched=names.filter(n=>contains(text,n));
 if(matched.length)result=result.filter(g=>matched.includes(shortSection(g.section_name)));
 else{const explicit=norm(text).match(/\bsection\s+([^\s]+)/)?.[1],afterClass=norm(text).match(/\b(?:class|section|grade|std)\s*(?:\d+|nursery|nursary|lkg|ukg)\s+([\p{L}\p{N}]+)/u)?.[1],commands=['attendance','attendence','roll','student','students','profile','marks','report','open','show','ki','ka','ke','mein','me','section'];if(explicit&&!/^\d+$/.test(explicit)&&!commands.includes(explicit))return[];if(afterClass&&!commands.includes(afterClass))return[];}
 return result;
}
const role=r=>({faculty:'teacher',school_admin:'manager',academic_admin:'principal',university_admin:'principal'})[r]||r;
const scope=()=>JSON.stringify([A().user?.id,A().schoolId,A().profile?.role,A().profile?.status]);
const same=c=>scope()===c.scope&&A().user?.id===c.userId&&A().schoolId===c.school.id;
async function context(){const snapshot=scope(),c=await window.NOOR_SHARED_TIMETABLE.context();if(!['teacher','principal','manager','owner'].includes(role(c.membership.role)))throw Error('Your role cannot search other students.');const data={...c,scope:snapshot};if(!same(data))throw Error('Account changed. Reopen search.');return data;}
async function permitted(c){
 if(role(c.membership.role)==='teacher')return(await window.NOOR_TEACHER_DATA.assignments(c)).map(g=>({...g,id:g.group_id}));
 const all=(await window.NOOR_SCHOOL_STRUCTURE.fetchGroups(c.db,c.school.id)).filter(g=>g.is_active),sections=all.filter(g=>g.group_type==='section');return all.filter(g=>['class','section'].includes(g.group_type)).filter(g=>g.group_type==='section'||!sections.some(s=>s.parent_group_id===g.id)).map(g=>{const parent=all.find(p=>p.id===g.parent_group_id);return{id:g.id,class_name:parent?.name||g.name,section_name:parent?g.name:'',class_label:parent?parent.name+' · '+g.name:g.name};});
}
function attachDialog(c,title){document.getElementById('noorRecordSearch')?.close();const d=document.createElement('dialog');d.id='noorRecordSearch';d.className='nh-record-dialog';d.setAttribute('aria-label',title);d.innerHTML='<header><div><h2>'+E(title)+'</h2><small>'+E(A().school?.name||'School')+'</small></div><button type="button" data-close aria-label="Close">×</button></header><p role="status"></p><div data-record-body></div>';document.body.append(d);d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();const tick=setInterval(()=>{if(!same(c))d.close();},400);d.addEventListener('close',()=>{clearInterval(tick);d.remove();});return d;}
function studentHTML(student,label,photo){const value=n=>n==null?'Not recorded':E(n)+'%';return '<section class="nh-student-profile"><div class="nh-student-identity">'+(photo?'<img src="'+E(photo)+'" alt="Student photo">':'<span class="nh-initials">'+E(String(student.name||'S')[0])+'</span>')+'<div><h2>'+E(student.name)+'</h2><p>'+E(label)+'</p><p>Roll number '+E(student.roll_number||'Not assigned')+'</p></div></div><dl><div><dt>Attendance</dt><dd>'+value(student.attendance_pct)+'</dd></div><div><dt>Marks</dt><dd>'+value(student.marks_pct)+'</dd></div><div><dt>Recorded assessments</dt><dd>'+E(student.assessments??0)+'</dd></div><div><dt>Marked attendance sessions</dt><dd>'+E(student.attendance_marks??0)+'</dd></div></dl><h3>Subject marks</h3><div class="nh-subjects">'+((student.subjects||[]).map(s=>'<article><b>'+E(s.subject_name)+'</b><span>'+E(s.marks)+' / '+E(s.max_marks)+'</span></article>').join('')||'<p>No subject marks recorded in this date range.</p>')+'</div><p class="nh-muted">Only recorded details available to your role are shown. Missing information is not inferred.</p><div class="nh-actions"><button type="button" data-annual>Open annual reports</button><button type="button" data-marks>Enter marks</button></div></section>';}
async function open({topic,text,beforeOpen=()=>{}}){
 const c=await context();await window.NOOR_PLATFORM_ACCESS?.requireFeature?.(topic==='attendance'?'attendance':'report_cards');const all=await permitted(c);if(!same(c))throw Error('Account changed.');const matches=matchGroups(text,all),parts=parse(text);
 beforeOpen();const d=attachDialog(c,topic==='attendance'?'Open class attendance':'Find student profile'),body=d.querySelector('[data-record-body]'),msg=d.querySelector('[role=status]');let request=0;
 const guard=()=>same(c)&&d.isConnected;
 async function studentProfile(student,group){const token=++request;msg.textContent='Opening student profile…';let photo=/^https:\/\//.test(student.avatar_url||'')?student.avatar_url:null;
 if(student.avatar_url?.startsWith('noor-profile-photos/')){try{photo=await window.NOOR_AVATAR_SAFE?.signedUrl({client:c.db,storedReference:student.avatar_url,userId:student.membership_id});}catch{photo=null;}}if(!guard()||token!==request)return;
 body.innerHTML=studentHTML(student,group.class_label,photo);msg.textContent='Saved school records · '+group.class_label+' · Current calendar year';
 for(const [selector,method] of [['[data-annual]','open'],['[data-marks]','openMarks']])body.querySelector(selector).onclick=async()=>{try{const fresh=await context();if(!guard()||!same(fresh))return;const api=window.NOOR_ANNUAL_REPORTS?.[method];if(!api)throw Error('Reports are unavailable. Refresh the app.');await api({...student,class_label:group.class_label},group.id);}catch(e){if(guard())msg.textContent=e.message;}};
 }
 async function choose(group){const token=++request;if(!guard()||!all.some(g=>g.id===group.id))return;
 try{await context();if(!guard()||token!==request)return;
 if(topic==='attendance'){
 if(role(c.membership.role)==='teacher'){A().openView('attendance');await window.NOOR_TEACHER_DATA.attendance(group.id);}else await window.NOOR_MANAGER_WORKSPACE.openAttendance(group.id);if(guard())d.close();return;
 }
 msg.textContent='Finding the student in '+group.class_label+'…';body.replaceChildren();const today=window.NOOR_SHARED_TIMETABLE.schoolDay(c.school.timezone),r=await c.db.rpc('noor_class_performance',{p_institution:c.school.id,p_group:group.id,p_from:today.slice(0,4)+'-01-01',p_to:today});if(r.error)throw r.error;if(!guard()||token!==request)return;
 const students=(r.data?.students||[]).filter(s=>!parts.roll||String(s.roll_number||'').trim().replace(/^0+(?=\d)/,'')===parts.roll.replace(/^0+(?=\d)/,''));
 if(students.length===1)return await studentProfile(students[0],group);
 msg.textContent=students.length?'Select the correct student in '+group.class_label+'.':'No matching student found in '+group.class_label+(parts.roll?' with roll number '+parts.roll:'')+'.';body.innerHTML=students.map((s,i)=>'<button type="button" class="nh-record-choice" data-student-index="'+i+'"><b>'+E(s.name)+'</b><small>Roll '+E(s.roll_number||'Not assigned')+'</small></button>').join('');body.querySelectorAll('[data-student-index]').forEach(b=>b.onclick=()=>studentProfile(students[Number(b.dataset.studentIndex)],group).catch(e=>{if(guard())msg.textContent=e.message;}));
 }catch(e){if(guard()&&token===request)msg.textContent=e.message;}}
 if(matches.length===1)await choose(matches[0]);else{msg.textContent=matches.length?'Choose the class and section to continue.':'No exact class/section match. Choose from your permitted classes.';const choices=matches.length?matches:all;body.innerHTML=choices.map((g,i)=>'<button type="button" class="nh-record-choice" data-group-index="'+i+'">'+E(g.class_label)+'</button>').join('');body.querySelectorAll('[data-group-index]').forEach(b=>b.onclick=()=>choose(choices[Number(b.dataset.groupIndex)]));if(!choices.length)msg.textContent='No permitted class or section is linked to your account.';}
}
window.NOOR_ASSISTANT_RECORDS=Object.freeze({parse,matchGroups,studentHTML,open});
})();
