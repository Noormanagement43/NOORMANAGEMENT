/* Teacher Dashboard: repeated-absence highlights from actual submitted school sessions. */
(()=>{'use strict';
const a=()=>window.NOOR_AI_APP;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let working=false;
async function mount(){
 const api=a(),screen=document.querySelector('#view-overview .ntv3');
 if(!screen||screen.querySelector('#ntAbsencePanel')||api?.profile?.role!=='teacher'||!api.user||!api.schoolId||working)return;
 const rail=screen.querySelector('.ntv3-cols>div:nth-child(2)');if(!rail)return;
 const card=document.createElement('section');card.id='ntAbsencePanel';card.className='ntv3-card';
 card.innerHTML='<h2>Attendance follow-up</h2><p class="ntv3-status" id="ntAbsenceStatus">Checking consecutive school-session absences…</p>';
 rail.prepend(card);working=true;
 try{
 const db=api.db,school=api.schoolId,uid=api.user.id;
 const assignments=await db.from('teacher_assignments').select('class_id,section_id').eq('school_id',school).eq('teacher_id',uid).eq('is_active',true);
 if(assignments.error)throw assignments.error;
 const classIds=[...new Set((assignments.data||[]).map(x=>x.class_id))];
 if(!classIds.length){card.querySelector('#ntAbsenceStatus').textContent='No class assigned. Contact your Principal.';return;}
 const sessions=await db.from('attendance_sessions').select('id,class_id,section_id,attendance_date')
 .eq('school_id',school).in('class_id',classIds).in('status',['submitted','corrected'])
 .order('attendance_date',{ascending:false}).limit(150);
 if(sessions.error)throw sessions.error;
 const grouped=new Map(),slots=[];
 for(const sess of sessions.data||[]){
  const key=sess.class_id+':'+(sess.section_id||'whole');
  if(!grouped.has(key))grouped.set(key,[]);
  if(grouped.get(key).length<3){grouped.get(key).push(sess);slots.push(sess)}
 }
 if(!slots.length){card.querySelector('#ntAbsenceStatus').textContent='Alerts appear after teachers submit attendance for at least three school sessions.';return;}
 const ids=slots.map(x=>x.id),records=[];
 for(let page=0;page<7;page++){
  const req=await db.from('attendance_records').select('id,student_id,session_id,status').eq('school_id',school).in('session_id',ids).order('id').range(page*1000,page*1000+999);
  if(req.error)throw req.error;
  records.push(...(req.data||[]));if((req.data||[]).length<1000)break;
 }
 const byDay=new Map(slots.map(x=>[x.id,new Map()]));
 records.forEach(x=>byDay.get(x.session_id)?.set(x.student_id,x.status));
 const riskIds=new Set();
 grouped.forEach(days=>{
  if(days.length<3)return;
  const [d1,d2,d3]=days;
  for(const [studentId,status] of byDay.get(d1.id)||[]){
   if(status==='absent'&&byDay.get(d2.id)?.get(studentId)==='absent'&&byDay.get(d3.id)?.get(studentId)==='absent')riskIds.add(studentId);
  }
 });
 if(!riskIds.size){card.querySelector('#ntAbsenceStatus').textContent='No students with 3 consecutive recorded absences in available sessions.';return;}
 const profiles=await db.from('profiles').select('id,full_name,roll_number,class_id,section_id').eq('school_id',school).eq('role','student').eq('status','active').in('id',[...riskIds]).limit(100);
 if(profiles.error)throw profiles.error;
 const rows=(profiles.data||[]).filter(x=>grouped.has(x.class_id+':'+(x.section_id||'whole'))||grouped.has(x.class_id+':whole'));
 card.querySelector('#ntAbsenceStatus').innerHTML=rows.length?'<p style="color:#a35e24;font-size:12px">⚠ '+rows.length+' student(s) need attendance follow-up</p>'+rows.map(x=>'<div class="ntv3-task"><b>'+esc(x.full_name)+'</b><small>Roll '+esc(x.roll_number||'—')+' · Absent for 3 consecutive recorded sessions</small></div>').join(''):'<p class="ntv3-status">No students in your active roster currently meet the alert criteria.</p>';
 if(rows.length){const b=document.createElement('button');b.className='ntv3-pill';b.textContent='Open attendance →';b.onclick=()=>api.openView('attendance');card.append(b);}
 }catch(err){if(card.isConnected)card.querySelector('#ntAbsenceStatus').textContent='Attendance alerts unavailable: '+(err?.message||'Check school permissions.');}
 finally{working=false;}
}
const observer=new MutationObserver(()=>{if(document.querySelector('#view-overview .ntv3:not(:has(#ntAbsencePanel))'))mount()});
observer.observe(document.body,{subtree:true,childList:true});
})();