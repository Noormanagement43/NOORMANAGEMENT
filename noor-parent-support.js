/* NOOR Parent Follow-ups: protected internal records, no external message delivery. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{},esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const authorized=()=>['owner','principal'].includes(A().profile?.role)&&A().profile?.status==='active'&&A().school?.verification_status==='verified'&&A().school?.account_status==='active'&&A().school?.is_active===true;
const $=id=>document.getElementById(id);
let students=[],alerts=[],contacts=[],assessments=[],busy=false;
const css=[
'#view-parent-support{max-width:1200px;margin:auto;color:var(--ink)}#view-parent-support .np-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}#view-parent-support .np-card{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:19px;margin-bottom:15px}',
'#view-parent-support h1{font-size:clamp(25px,3vw,35px);color:var(--berry)}#view-parent-support h2{font-size:19px}#view-parent-support .np-muted{color:var(--muted);font-size:13px;line-height:1.6}',
'#view-parent-support label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:700;margin:12px 0}#view-parent-support input,#view-parent-support select,#view-parent-support textarea{width:100%;border:1px solid var(--rose-line);border-radius:11px;padding:11px 12px;background:var(--paper);color:var(--ink);font:15px "DM Sans",sans-serif}#view-parent-support textarea{min-height:100px;resize:vertical}',
'#view-parent-support button{border:1px solid var(--rose-line);border-radius:11px;background:var(--rose-soft);color:var(--berry);padding:10px 14px;min-height:44px;cursor:pointer;font-weight:800}#view-parent-support button.primary{background:var(--berry);color:white}#view-parent-support button:disabled{opacity:.5;cursor:not-allowed}',
'#view-parent-support .np-row{border-top:1px solid var(--line);padding:12px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}#view-parent-support .np-row:first-child{border-top:0}#view-parent-support .np-row p{font-size:13px;margin:4px 0}#view-parent-support .np-actions{display:flex;gap:8px;flex-wrap:wrap}#view-parent-support .np-callout{background:var(--gold-soft);border-radius:13px;padding:14px;font-size:13px}',
'@media(max-width:760px){#view-parent-support .np-grid{grid-template-columns:1fr}#view-parent-support .np-card{padding:15px}#view-parent-support .np-row{align-items:flex-start;flex-wrap:wrap}}'
].join('');
if(!document.getElementById('noor-parent-support-style')){const s=document.createElement('style');s.id='noor-parent-support-style';s.textContent=css;document.head.appendChild(s)}
const detail=(student)=>student?student.full_name+' · '+(student.roll_number||'Roll not set'):'Student record unavailable';
const notify=(message,kind='info')=>{if($('npState'))$('npState').textContent=message;A().toast?.(message,kind)};
function open(){
 const host=$('view-parent-support');if(!host)return;
 if(!authorized()){host.innerHTML='<div class="panel">Only verified school leadership can open private parent follow-ups.</div>';return}
 host.innerHTML='<div class="headrow"><div><div class="eyebrow">NOOR · SCHOOL COMMUNICATION</div><h1>Parent Follow-ups & Academic Alerts</h1><p>Private school records. A saved draft is NOT a sent SMS, email or WhatsApp message.</p></div></div><p id="npState" class="np-muted" role="status">Loading authorised school records…</p><div class="np-grid"><section class="np-card"><h2>Record parent communication</h2><div class="np-callout">Verify the guardian before contacting them. This tool records internal communication only.</div><form id="npForm"><label>Student <select id="npStudent" required></select></label><p class="np-muted" id="npGuardian">Choose a student to see registered guardian details.</p><label>Subject<input id="npSubject" required maxlength="180" placeholder="e.g. Attendance follow-up"></label><label>Message / conversation summary<textarea id="npMessage" required maxlength="4000" placeholder="Write an accurate, respectful summary. Avoid unnecessary personal details."></textarea></label><label>Contact method<select id="npMethod"><option value="draft">Draft only — not sent</option><option value="phone">Phone call documented</option><option value="in_person">In-person meeting documented</option><option value="in_app">In-app conversation documented</option></select></label><label>Follow-up date (optional)<input id="npDue" type="date"></label><button class="primary" id="npSave">Save private follow-up</button></form></section><section class="np-card"><h2>Academic support settings</h2><p class="np-muted">Only after opting in: marked assessment results below your chosen percentage create a private review alert. This never contacts guardians automatically.</p><label><input id="npEnabled" type="checkbox" style="width:20px;margin-right:8px"> Enable future academic review alerts</label><label>Review threshold (%)<input id="npThreshold" type="number" min="1" max="100" step="1" value="40"></label><button id="npSettingsSave">Save academic alerts settings</button><h2 style="margin-top:24px">Academic alerts</h2><div id="npAlerts"></div></section></div><section class="np-card"><h2>Saved parent follow-ups</h2><div id="npContacts"></div></section>';
 $('npStudent').onchange=guardian;
 $('npForm').onsubmit=saveContact;
 $('npSettingsSave').onclick=saveSettings;
 load();
}
function guardian(){
 const student=students.find(x=>x.id===$('npStudent').value);
 $('npGuardian').textContent=student?('Guardian: '+(student.parent_name||'not entered')+' · Phone: '+(student.parent_phone||'not recorded')+' · Confirm recipient before contacting'):'Choose a student.';
}
async function load(){
 if(busy||!authorized())return;busy=true;
 const db=A().db,sid=A().schoolId;
 try{
  const [people,cases,notices,assess,settings]=await Promise.all([
   db.from('profiles').select('id,full_name,roll_number,parent_name,parent_phone').eq('school_id',sid).eq('role','student').eq('status','active').order('full_name').limit(800),
   db.from('noor_parent_contact_logs').select('id,student_id,subject,message,contact_method,status,follow_up_due,created_at').eq('school_id',sid).order('created_at',{ascending:false}).limit(100),
   db.from('noor_academic_support_alerts').select('id,student_id,assessment_id,score_percentage,status,created_at').eq('school_id',sid).order('created_at',{ascending:false}).limit(100),
   db.from('school_assessments').select('id,title').eq('school_id',sid).limit(200),
   db.from('school_settings').select('academic_alerts_enabled,academic_alert_threshold_pct').eq('school_id',sid).maybeSingle()
  ]);
  const err=[people,cases,notices,assess,settings].find(x=>x.error);if(err)throw err.error;
  if(A().schoolId!==sid||!authorized())return;
  students=people.data||[];contacts=cases.data||[];alerts=notices.data||[];assessments=assess.data||[];
  const selected=$('npStudent').value;
  $('npStudent').innerHTML='<option value="">Choose a student</option>'+students.map(s=>'<option value="'+esc(s.id)+'">'+esc(detail(s))+'</option>').join('');
  if(students.some(s=>s.id===selected))$('npStudent').value=selected;guardian();
  $('npEnabled').checked=settings.data?.academic_alerts_enabled===true;
  $('npThreshold').value=settings.data?.academic_alert_threshold_pct??40;
  $('npContacts').innerHTML=contacts.length?contacts.map(c=>'<article class="np-row"><div><strong>'+esc(c.subject)+'</strong><p class="np-muted">'+esc(detail(students.find(x=>x.id===c.student_id)))+' · '+esc(c.contact_method)+' · '+esc(c.status)+'</p><p>'+esc(c.message)+'</p><p class="np-muted">'+(c.follow_up_due?'Follow-up '+esc(c.follow_up_due):'No due date')+'</p></div><div class="np-actions">'+(c.status==='draft'?'<button data-closed="'+esc(c.id)+'">Close draft</button>':'')+'</div></article>').join(''):'<p class="np-muted">No parent follow-up logs saved yet.</p>';
  $('npAlerts').innerHTML=alerts.length?alerts.map(x=>'<article class="np-row"><div><strong>'+esc(detail(students.find(s=>s.id===x.student_id)))+'</strong><p class="np-muted">'+esc(assessments.find(y=>y.id===x.assessment_id)?.title||'Assessment')+' · Recorded score '+esc(x.score_percentage)+'% · '+esc(x.status)+'</p></div><div>'+ (x.status==='open'?'<button data-review="'+esc(x.id)+'">Mark reviewed</button>':'')+'</div></article>').join(''):'<p class="np-muted">No academic alerts. This may mean alerts are disabled or no relevant assessment results were recorded.</p>';
  $('npContacts').onclick=ev=>{const btn=ev.target.closest('[data-closed]');if(btn)update('noor_parent_contact_logs',btn.dataset.closed,{status:'closed'})};
  $('npAlerts').onclick=ev=>{const btn=ev.target.closest('[data-review]');if(btn)update('noor_academic_support_alerts',btn.dataset.review,{status:'reviewed'})};
  notify('School-scoped records loaded. Nothing is sent automatically.','success');
 }catch(err){notify('Unable to load parent follow-ups: '+(err?.message||'Unknown error'),'error')}
 finally{busy=false}
}
async function saveContact(event){
 event.preventDefault();if(!authorized())return;
 const sid=A().schoolId,student=students.find(x=>x.id===$('npStudent').value),subject=$('npSubject').value.trim(),message=$('npMessage').value.trim(),method=$('npMethod').value;
 if(!student||subject.length<2||message.length<2)return notify('Complete student, subject and summary.','error');
 const row={school_id:sid,student_id:student.id,created_by:A().user.id,subject,message,contact_method:method,status:method==='draft'?'draft':'contacted',contacted_at:method==='draft'?null:new Date().toISOString(),follow_up_due:$('npDue').value||null};
 const button=$('npSave');button.disabled=true;
 try{const res=await A().db.from('noor_parent_contact_logs').insert(row);if(res.error)throw res.error;notify('Private follow-up saved. No external message was sent.','success');$('npForm').reset();await load()}
 catch(err){notify('Could not save follow-up: '+err.message,'error')}finally{button.disabled=false}
}
async function saveSettings(){
 if(!authorized())return;
 const pct=Number($('npThreshold').value),enabled=$('npEnabled').checked;
 if(!Number.isFinite(pct)||pct<1||pct>100)return notify('Choose a threshold from 1 to 100.','error');
 const button=$('npSettingsSave');button.disabled=true;
 try{const r=await A().db.from('school_settings').update({academic_alerts_enabled:enabled,academic_alert_threshold_pct:pct,updated_by:A().user.id}).eq('school_id',A().schoolId).select('school_id');if(r.error)throw r.error;if(!r.data?.length)throw Error('School settings record unavailable. Contact school management.');notify('Academic alerts settings saved. Only future assessment results trigger new reviews.','success')}
 catch(err){notify('Settings not saved: '+err.message,'error')}finally{button.disabled=false}
}
async function update(table,id,payload){
 try{const r=await A().db.from(table).update(payload).eq('id',id).eq('school_id',A().schoolId);if(r.error)throw r.error;notify('Record updated in school database.','success');await load()}
 catch(err){notify('Unable to update: '+err.message,'error')}
}
window.NOOR_PARENT_SUPPORT={open};
})();