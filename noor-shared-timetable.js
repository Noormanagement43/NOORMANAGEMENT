/* Destination timetable: teacher owns writes; principal/student reads use RLS. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{},esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const current=()=>window.NOOR_CONFIG?.SUPABASE_URL==='https://ayrryemawwplguaauxij.supabase.co';
let channel=null,channelKey='',dialog=null;
async function context(){
 const a=A(),id=a.user?.id;if(!id||!a.db)throw Error('Sign in to open the timetable.');
 const auth=await a.db.auth.getUser();if(auth.error||auth.data?.user?.id!==id)throw Error('Your account changed. Sign in again.');
 let query=a.db.from('institution_memberships').select('id,user_id,institution_id,role,status').eq('user_id',id).eq('status','active');
 const sid=a.profile?.institution_id||a.schoolId;if(sid)query=query.eq('institution_id',sid);
 const result=await query;if(result.error)throw result.error;
 if(A().user?.id!==id)throw Error('Your account changed. Reopen the timetable.');
 if(result.data?.length!==1)throw Error('Your school membership has not been migrated to the Noor database. Timetable editing becomes available after your real school membership is restored.');
 const m=result.data[0];const school=await a.db.from('institutions').select('id,name,status,timezone').eq('id',m.institution_id).single();
 if(school.error)throw school.error;if(school.data.status!=='active')throw Error('Your school is not active.');
 return{db:a.db,userId:id,membership:m,school:school.data};
}
function state(row,tz='Asia/Kolkata',at=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at),find=k=>parts.find(p=>p.type===k)?.value;
 if(days.indexOf(find('weekday'))!==Number(row.weekday))return'Scheduled';
 const time=find('hour')+':'+find('minute');return time<String(row.start_time).slice(0,5)?'Upcoming':time<String(row.end_time).slice(0,5)?'Scheduled now':'Finished';
}
async function read(){
 const c=await context();
 const [periods,groups]=await Promise.all([
 c.db.from('teacher_timetable_periods').select('id,institution_id,teacher_membership_id,academic_group_id,weekday,period_number,start_time,end_time,subject_name,room_label,created_by').eq('institution_id',c.school.id).order('weekday').order('start_time'),
 c.db.from('academic_groups').select('id,name,group_type,parent_group_id,is_active').eq('institution_id',c.school.id).eq('is_active',true)
 ]);
 if(periods.error)throw periods.error;if(groups.error)throw groups.error;
 if(A().user?.id!==c.userId)throw Error('Your account changed. Reopen the timetable.');
 const gs=groups.data||[];
 const data=(periods.data||[]).map(p=>{const g=gs.find(x=>x.id===p.academic_group_id),parent=gs.find(x=>x.id===g?.parent_group_id);return{...p,weekday:Number(p.weekday),school_id:p.institution_id,teacher_id:p.teacher_membership_id,class_id:parent?.id||g?.id||null,section_id:g?.group_type==='section'?g.id:null,class_label:parent?parent.name+' · '+g.name:g?.name||'No class linked',block_type:'class',approval_status:'approved',schedule_status:state(p,c.school.timezone)};});
 return{...c,data,groups:gs};
}
async function load(){try{const r=await read();return{data:r.data,error:null}}catch(error){return{data:[],error}}}
async function save(values,existing=null){
 const c=await context(),m=c.membership;
 if(!['teacher','faculty'].includes(m.role))throw Error('Only teachers can edit their own periods.');
 const weekday=Number(values.weekday),period_number=Number(values.period_number),start_time=String(values.start_time||'').slice(0,5),end_time=String(values.end_time||'').slice(0,5),subject_name=String(values.subject_name||'').trim();
 if(!Number.isInteger(weekday)||weekday<0||weekday>6||!Number.isInteger(period_number)||period_number<1||period_number>20)throw Error('Choose a valid day and period number (1–20).');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end_time)||start_time>=end_time)throw Error('Enter valid times; end time must be after start time.');
 if(!subject_name||subject_name.length>140)throw Error('Enter a subject of 1–140 characters.');
 if(existing&&(existing.teacher_membership_id!==m.id||existing.institution_id!==m.institution_id))throw Error('You can only edit your own periods.');
 const patch={weekday,period_number,start_time,end_time,subject_name,academic_group_id:values.academic_group_id||null,room_label:String(values.room_label||'').trim()||null};
 let q=existing?c.db.from('teacher_timetable_periods').update(patch).eq('id',existing.id).eq('institution_id',m.institution_id).eq('teacher_membership_id',m.id):c.db.from('teacher_timetable_periods').insert({...patch,institution_id:m.institution_id,teacher_membership_id:m.id,created_by:c.userId});
 const r=await q.select('id').single();if(r.error)throw r.error;if(!r.data?.id)throw Error('No period was saved.');
 if(A().user?.id!==c.userId)throw Error('Your account changed. Reopen the timetable to see its saved state.');
 window.dispatchEvent(new CustomEvent('noor:timetable-saved'));return r.data;
}
function shell(title){
 dialog?.remove();dialog=document.createElement('dialog');dialog.className='noor-timetable-dialog';dialog.setAttribute('aria-label',title);
 dialog.innerHTML='<header><h2>'+esc(title)+'</h2><button type="button" data-tt-close aria-label="Close timetable">✕</button></header><div data-tt-body>Loading saved timetable…</div>';
 const opened=dialog;opened.querySelector('[data-tt-close]').onclick=()=>opened.close();opened.addEventListener('close',()=>{opened.remove();if(dialog===opened)dialog=null});document.body.append(opened);opened.showModal();return opened;
}
async function open(){
 const d=shell('Weekly Timetable');try{
 const r=await read();if(!d.isConnected)return;const teacher=['teacher','faculty'].includes(r.membership.role);
 d.querySelector('[data-tt-body]').innerHTML=(teacher?'<button type="button" data-tt-add>+ Add my period</button>':'<p>Read-only · Teachers manage their own periods.</p>')+
 (r.data.length?r.data.map(p=>'<article class="noor-tt-row"><div><strong>'+esc(p.subject_name)+'</strong><p>'+esc(days[p.weekday]+' · Period '+p.period_number+' · '+p.start_time.slice(0,5)+'–'+p.end_time.slice(0,5))+'</p><small>'+esc(p.class_label)+'</small></div><span class="noor-tt-status">'+esc(p.schedule_status)+'</span>'+(teacher&&p.teacher_membership_id===r.membership.id?'<button type="button" data-tt-edit="'+esc(p.id)+'">Edit period</button>':'')+'</article>').join(''):'<p>No saved periods yet.</p>');
 d.querySelector('[data-tt-add]')?.addEventListener('click',()=>openEditor());
 d.querySelectorAll('[data-tt-edit]').forEach(b=>b.onclick=()=>openEditor(r.data.find(p=>p.id===b.dataset.ttEdit)));
 }catch(e){if(d.isConnected)d.querySelector('[data-tt-body]').textContent=e.message;}
}
async function openEditor(p=null){
 const d=shell(p?'Edit my period':'Add my period');try{
 const r=await read();if(!d.isConnected)return;
 if(!['teacher','faculty'].includes(r.membership.role))throw Error('Only teachers can edit periods.');
 if(p){p=r.data.find(x=>x.id===p.id);if(!p||p.teacher_membership_id!==r.membership.id)throw Error('This period is not yours or is no longer available.');}
 const opts=r.groups.map(g=>{const parent=r.groups.find(x=>x.id===g.parent_group_id);return'<option value="'+esc(g.id)+'" '+(p?.academic_group_id===g.id?'selected':'')+'>'+esc(parent?parent.name+' · '+g.name:g.name)+'</option>'}).join('');
 d.querySelector('[data-tt-body]').innerHTML='<form class="noor-tt-form"><label>Day<select name="weekday">'+days.map((day,i)=>'<option value="'+i+'" '+(Number(p?.weekday??1)===i?'selected':'')+'>'+day+'</option>').join('')+'</select></label><label>Period number<input name="period_number" type="number" min="1" max="20" required value="'+esc(p?.period_number||1)+'"></label><label>Start time<input type="time" name="start_time" required value="'+esc((p?.start_time||'09:00').slice(0,5))+'"></label><label>End time<input type="time" name="end_time" required value="'+esc((p?.end_time||'09:45').slice(0,5))+'"></label><label>Subject<input name="subject_name" maxlength="140" required value="'+esc(p?.subject_name||'')+'"></label><label>Class / section<select name="academic_group_id" '+(r.groups.length?'required':'')+'><option value="">'+(r.groups.length?'Choose class / section':'No classes migrated yet')+'</option>'+opts+'</select></label><label>Room (optional)<input name="room_label" maxlength="100" value="'+esc(p?.room_label||'')+'"></label><p class="noor-tt-note">'+(r.groups.length?'Saved class-linked periods appear in the authorised student timetable.':'You can save your own period; students can see it once a real class/section is linked.')+'</p><p data-tt-feedback role="status"></p><footer><button type="button" data-tt-back>Back</button><button type="submit">Save period</button></footer></form>';
 d.querySelector('[data-tt-back]').onclick=open;
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('[type=submit]'),feedback=d.querySelector('[data-tt-feedback]');b.disabled=true;feedback.textContent='Saving…';try{if(A().user?.id!==r.userId||(A().profile?.institution_id||A().schoolId)!==r.school.id)throw Error('Your account changed. Reopen the timetable.');await save(Object.fromEntries(new FormData(e.target)),p);A().toast?.('Period saved.','success');await open();}catch(error){feedback.textContent=error.message;}finally{b.disabled=false;}};
 }catch(e){if(d.isConnected)d.querySelector('[data-tt-body]').textContent=e.message;}
}
function subscribe(){const a=A(),key=a.user?.id+':'+a.schoolId;if(!current()||!a.db||!a.user?.id)return;if(channelKey===key)return;if(channel)a.db.removeChannel(channel);channelKey=key;channel=a.db.channel('noor-destination-timetable-'+key).on('postgres_changes',{event:'*',schema:'public',table:'teacher_timetable_periods',filter:'institution_id=eq.'+a.schoolId},()=>{window.dispatchEvent(new CustomEvent('noor:timetable-saved'));if(dialog)open();}).subscribe();}
const weekday=()=>days.indexOf(new Intl.DateTimeFormat('en-GB',{timeZone:A().school?.timezone||'Asia/Kolkata',weekday:'long'}).format(new Date()));
window.NOOR_SHARED_TIMETABLE=Object.freeze({weekday,current,context,load,save,open,openEditor,subscribe,status:state});
})();
