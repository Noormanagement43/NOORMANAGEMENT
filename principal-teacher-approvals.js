/* Principal review of Teacher timetable change requests: scoped database records. */
(()=>{'use strict';
const a=()=>window.NOOR_AI_APP;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let pending=false,loadedAt=0;
const css=document.createElement('style');css.textContent=[
'#ntPrincipalApprovals{background:#fff;border:1px solid #eadce5;border-radius:20px;padding:20px;margin-top:17px;box-shadow:0 9px 24px #502c4710}',
'#ntPrincipalApprovals h2{margin:0;color:#54243b;font-size:19px}',
'#ntPrincipalApprovals .nt-pa-row{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;border-top:1px solid #f2e8ee;padding:12px 0;font-size:12px}',
'#ntPrincipalApprovals .nt-pa-row small{display:block;color:#806a79;margin:4px 0}',
'#ntPrincipalApprovals button{border:1px solid #e5cfd9;border-radius:12px;padding:9px 12px;background:#f8e9ef;color:#682d4a;font-weight:800;cursor:pointer}',
'#ntPrincipalApprovals button.nt-pa-approve{background:#e4f5e9;color:#226b49;border-color:#c7e6d3}',
'#ntPrincipalApprovals button:disabled{opacity:.5}',
'#ntPrincipalApprovals .nt-pa-sub{font-size:12px;color:#866e7d}'
].join('');document.head.append(css);
async function load(){
 const app=a(),root=document.getElementById('view-principal-studio');
 if(!root||!root.classList.contains('active')||!root.querySelector('#noor-principal')||!['owner','principal'].includes(app?.profile?.role)||!app.schoolId||pending)return;
 if(root.querySelector('#ntPrincipalApprovals'))return;
 pending=true;loadedAt=Date.now();
 const box=document.createElement('section');box.id='ntPrincipalApprovals';box.innerHTML='<h2>Teacher timetable requests</h2><p class="nt-pa-sub">Review new periods and timing changes before they become the official teacher schedule.</p><div id="ntPaList">Loading requests…</div><h2 style="margin-top:16px">Today’s teaching activity</h2><div id="ntPaDaily" class="nt-pa-sub">Loading approved class progress…</div>';
 root.append(box);
 try{
 const db=app.db,school=app.schoolId;
 const [periods,staff,runs,checkins]=await Promise.all([
 db.from('noor_teacher_periods').select('id,teacher_id,weekday,period_number,subject_name,class_label,start_time,end_time,block_type').eq('school_id',school).eq('approval_status','pending').order('weekday').order('start_time').limit(100),
 db.from('profiles').select('id,full_name').eq('school_id',school).eq('role','teacher').eq('status','active').limit(300),
 db.from('noor_teacher_period_runs').select('teacher_id,status').eq('school_id',school).eq('class_date',new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')).limit(1000),
 db.from('noor_staff_attendance').select('teacher_id,status').eq('school_id',school).eq('attendance_date',new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')).limit(1000)
 ]);
 if(periods.error||staff.error||runs.error||checkins.error)throw periods.error||staff.error||runs.error||checkins.error;
 const names=new Map((staff.data||[]).map(x=>[x.id,x.full_name]));
 const countDone=(runs.data||[]).filter(x=>x.status==='done').length,countOngoing=(runs.data||[]).filter(x=>x.status==='ongoing').length,checkedIn=(checkins.data||[]).filter(x=>x.status==='present').length;
 box.querySelector('#ntPaDaily').innerHTML='<p><b>Staff checked in:</b> '+checkedIn+' / '+(staff.data||[]).length+' &nbsp; <b>Classes ongoing:</b> '+countOngoing+' &nbsp; <b>Classes finished today:</b> '+countDone+'</p>'+((runs.data||[]).map(x=>'<div class="nt-pa-row"><b>'+esc(names.get(x.teacher_id)||'Teacher')+'</b><span>'+esc(x.status)+'</span></div>').join('')||'<p>No classes started today yet.</p>');
 const list=box.querySelector('#ntPaList');
 list.innerHTML=(periods.data||[]).length?(periods.data||[]).map(p=>'<div class="nt-pa-row" data-period="'+esc(p.id)+'"><div><b>'+esc(names.get(p.teacher_id)||'Assigned teacher')+'</b><small>'+esc(days[p.weekday]||'Day')+' · P'+esc(p.period_number)+' · '+esc(p.subject_name)+' · '+esc(p.class_label)+'</small><small>'+esc(String(p.start_time).slice(0,5))+'–'+esc(String(p.end_time).slice(0,5))+' · '+esc(p.block_type||'class')+'</small></div><div><button type="button" class="nt-pa-approve" data-decision="approved">✓ Approve</button> <button type="button" data-decision="rejected">Decline</button></div></div>').join(''):'<p class="nt-pa-sub">No pending timetable requests.</p>';
 list.addEventListener('click',async e=>{
  const btn=e.target.closest('button[data-decision]');if(!btn)return;
  const row=btn.closest('[data-period]');if(!row)return;
  row.querySelectorAll('button').forEach(b=>b.disabled=true);
  const decision=btn.dataset.decision;
  const update=await db.from('noor_teacher_periods').update({approval_status:decision}).eq('id',row.dataset.period).eq('school_id',school).eq('approval_status','pending').select('id,approval_status').maybeSingle();
  if(update.error||!update.data){app.toast?.(update.error?.message||'Request no longer pending, or access denied.','error');row.querySelectorAll('button').forEach(b=>b.disabled=false);return;}
  app.toast?.('Timetable request '+(decision==='approved'?'approved':'declined')+'.','success');row.remove();
  if(!list.querySelector('[data-period]'))list.innerHTML='<p class="nt-pa-sub">No pending timetable requests.</p>';
 });
 }catch(e){box.querySelector('#ntPaList').textContent='Cannot load timetable requests: '+(e?.message||'Check access policy.');}
 finally{pending=false}
}
let channel=null,activeSchool='';
function connectPrincipalLive(){
 const app=a(),school=app?.schoolId;
 if(!school||!['owner','principal'].includes(app.profile?.role)||!app.db)return;
 if(channel&&activeSchool!==school){app.db.removeChannel(channel);channel=null}
 if(channel)return;
 activeSchool=school;
 const changed=()=>{
  const view=document.getElementById('view-principal-studio');
  if(!view?.classList.contains('active'))return;
  view.querySelector('#ntPrincipalApprovals')?.remove();
  if(!pending)load();
 };
 channel=app.db.channel('noor-principal-teacher-live-'+school)
 .on('postgres_changes',{event:'*',schema:'public',table:'noor_teacher_period_runs',filter:'school_id=eq.'+school},changed)
 .on('postgres_changes',{event:'*',schema:'public',table:'noor_staff_attendance',filter:'school_id=eq.'+school},changed)
 .on('postgres_changes',{event:'*',schema:'public',table:'noor_teacher_periods',filter:'school_id=eq.'+school},changed)
 .subscribe(status=>{
  const label=document.querySelector('#ntPrincipalApprovals .nt-pa-sub');
  if(label&&status==='SUBSCRIBED')label.textContent='Live Teacher/Principal sync connected · school-scoped class activity.';
 });
}
const observer=new MutationObserver(()=>{const view=document.getElementById('view-principal-studio');if(view?.classList.contains('active')&&view.querySelector('#noor-principal')){connectPrincipalLive();if(!view.querySelector('#ntPrincipalApprovals'))load()}});

observer.observe(document.body,{subtree:true,childList:true});
setInterval(()=>{const view=document.getElementById('view-principal-studio');if(view?.classList.contains('active')&&Date.now()-loadedAt>60000&&!pending){view.querySelector('#ntPrincipalApprovals')?.remove();load()}},60000);
})();