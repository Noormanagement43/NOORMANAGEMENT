/* Principal-facing staff attendance and current periods, from real Supabase records. */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const date=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let loading=false;
async function refresh(){
const api=window.NOOR_AI_APP,root=document.getElementById('view-overview');
if(!api?.schoolId||!['owner','principal','manager'].includes(api.profile?.role)||!root||document.getElementById('workspace')?.classList.contains('hidden')||loading)return;
loading=true;
try{
const db=api.db,school=api.schoolId;
const [staff,attendance,periods]=await Promise.all([
db.from('profiles').select('id,full_name').eq('school_id',school).eq('role','teacher').eq('status','active'),
db.from('noor_staff_attendance').select('teacher_id,status,checked_in_at').eq('school_id',school).eq('attendance_date',date()),
db.from('noor_teacher_periods').select('teacher_id,subject_name,class_label,period_number,start_time,end_time,status,approval_status').eq('school_id',school).eq('weekday',new Date().getDay())
]);
const old=document.getElementById('noorPrincipalStaffLive');if(old)old.remove();
const section=document.createElement('section');section.id='noorPrincipalStaffLive';
section.style.cssText='background:#fff;border:1px solid #e9dce5;border-radius:20px;padding:20px;margin:18px 0;box-shadow:0 8px 24px #51273b0d';
const teachers=staff.data||[],present=(attendance.data||[]).filter(x=>x.status==='present').length,now=new Date().toTimeString().slice(0,5);
section.innerHTML='<h2 style="margin:0 0 9px;color:#54243b">Staff live overview</h2><p style="color:#745d6a">Present today: <strong>'+present+'</strong> / '+teachers.length+' active teachers · '+date()+'</p>'+
(teachers.map(t=>{const a=(attendance.data||[]).find(x=>x.teacher_id===t.id);const current=(periods.data||[]).find(p=>p.teacher_id===t.id&&p.approval_status==='approved'&&p.start_time?.slice(0,5)<=now&&p.end_time?.slice(0,5)>now);return '<div style="padding:11px 0;border-top:1px solid #eee3e9"><strong>'+esc(t.full_name)+'</strong><span style="float:right;color:'+(a?.status==='present'?'#227b53':'#956b29')+'">'+esc(a?.status||'Not checked in')+'</span><div style="font-size:12px;color:#76616f">'+(current?esc(current.subject_name)+' · '+esc(current.class_label)+' · Period '+esc(current.period_number):'No approved ongoing period')+'</div></div>'}).join('')||'<p>No active teacher records found.</p>')+
((staff.error||attendance.error||periods.error)?'<p style="color:#9a384b">Some staff data could not be loaded. Check access permissions.</p>':'');
root.prepend(section);
}catch(e){console.warn('Principal staff live panel:',e)}finally{loading=false}
}
const obs=new MutationObserver(()=>{if(!document.getElementById('noorPrincipalStaffLive'))refresh()});
obs.observe(document.body,{childList:true,subtree:true});
setInterval(()=>{if(!document.hidden)refresh()},30000);
})();