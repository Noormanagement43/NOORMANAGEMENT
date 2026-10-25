/* NOOR Calendar: verified public holidays, school-specific events, mobile grid, interactive event management for Principal & Teachers. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(q,r=document)=>r?.querySelector(q);
const zone='Asia/Kolkata',months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const dateParts=d=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),g=k=>p.find(x=>x.type===k).value;return g('year')+'-'+g('month')+'-'+g('day')};
const pad=x=>String(x).padStart(2,'0');
const now=dateParts(new Date()),st={year:Number(now.slice(0,4)),month:Number(now.slice(5,7))-1,selected:now,school:null,events:[],holidays:[],source:'',version:0,filter:'all'};
const root=()=>document.getElementById('view-school-calendar');
const leader=()=>['owner','principal','manager','creator'].includes(A().profile?.role);
const canAddEvent=()=>['owner','principal','manager','creator','teacher'].includes(A().profile?.role);
const btn='type="button"';

function open(){
 const app=A(),r=root();if(!r||!app.user?.id||!app.schoolId)return;
 if(st.school!==app.schoolId){st.school=app.schoolId;st.selected=now;st.year=Number(now.slice(0,4));st.month=Number(now.slice(5,7))-1}
 r.innerHTML='<div class="nsc"><header class="nsc-head"><div><small>NOOR · School Year Planner</small><h1>School Calendar</h1><p>Interactive school events, exams, meetings, and public holiday references.</p></div>'+
 '<div class="row" style="gap:8px"><button '+btn+' class="btn light" id="nscToday">Today</button>'+(canAddEvent()?'<button '+btn+' class="btn" id="nscAdd">+ Add Event</button>':'')+'</div></header>'+
 '<section class="nsc-card"><div class="nsc-month"><button '+btn+' id="nscPrev" aria-label="Previous month">‹</button><h2 id="nscMonth"></h2><button '+btn+' id="nscNext" aria-label="Next month">›</button></div>'+
 '<div class="nsc-legend"><span style="color:#642740">● School events</span><span style="color:#256d50">● Meetings & exams</span><span style="color:#b27424">● India holiday references</span></div>'+
 '<div class="row" style="gap:6px;margin:10px 0" id="nscFilters">'+
 ['all','school','exam','meeting','holiday'].map(f=>'<button '+btn+' class="btn '+(st.filter===f?'soft':'light')+'" style="padding:5px 11px;font-size:10px" data-cal-filter="'+f+'">'+(f==='all'?'All Events':f[0].toUpperCase()+f.slice(1)+'s')+'</button>').join('')+
 '</div>'+
 '<div class="nsc-weekdays">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>'<b>'+x+'</b>').join('')+'</div><div id="nscGrid" class="nsc-grid"></div><p id="nscSource" class="nsc-hint">Checking current school data…</p></section>'+
 '<section class="nsc-card"><div class="nsc-row"><h2 id="nscDayTitle">Selected day</h2>'+(canAddEvent()?'<button '+btn+' class="btn light" id="nscAddDay">+ Event for this day</button>':'')+'</div><div id="nscDayEvents"></div></section>'+
 '<section class="nsc-card"><h2>Indian, Hindu & Muslim festival references</h2><p class="nsc-hint">Open the public Indian and Islamic holiday calendars for a broader festival view. School holidays become official only when the school adds them as events.</p>'+
 '<button '+btn+' class="btn light" id="nscReference">View festival calendars</button><div id="nscReferenceBox" hidden></div></section><p id="nscMessage" role="status"></p></div>';

 $('#nscToday',r).onclick=()=>{const s=dateParts(new Date());st.year=Number(s.slice(0,4));st.month=Number(s.slice(5,7))-1;st.selected=s;load()};
 $('#nscPrev',r).onclick=()=>move(-1);$('#nscNext',r).onclick=()=>move(1);
 if(canAddEvent()){
   const addBtn=$('#nscAdd',r);if(addBtn)addBtn.onclick=()=>showEventModal();
   const addDayBtn=$('#nscAddDay',r);if(addDayBtn)addDayBtn.onclick=()=>showEventModal(st.selected);
 }
 r.querySelectorAll('[data-cal-filter]').forEach(b=>b.onclick=()=>{
   st.filter=b.dataset.calFilter;
   r.querySelectorAll('[data-cal-filter]').forEach(x=>x.className='btn '+(x===b?'soft':'light'));
   draw();
 });
 $('#nscReference',r).onclick=()=>{const el=$('#nscReferenceBox',r);el.hidden=!el.hidden;if(!el.hidden&&!el.firstChild){
   const iframe=document.createElement('iframe');iframe.title='Google public Indian and Islamic holiday calendars';iframe.loading='lazy';iframe.src='https://calendar.google.com/calendar/embed?src=en.indian%23holiday%40group.v.calendar.google.com&src=en.islamic%23holiday%40group.v.calendar.google.com&ctz=Asia%2FKolkata';
   iframe.style.cssText='display:block;width:100%;min-height:440px;height:65vh;border:0;border-radius:12px;margin-top:12px';el.appendChild(iframe);
 }};
 load();
}

function move(n){
 const d=new Date(st.year,st.month+n,1);if(d.getFullYear()<2020||d.getFullYear()>2040)return;
 st.year=d.getFullYear();st.month=d.getMonth();st.selected=st.year+'-'+pad(st.month+1)+'-01';load();
}

async function load(){
 const a=A(),r=root();if(!r||st.school!==a.schoolId)return;
 const id=++st.version,y=st.year,m=st.month;
 $('#nscMonth',r).textContent=months[m]+' '+y;$('#nscGrid',r).innerHTML='<p class="nsc-hint">Loading month…</p>';
 const first=y+'-'+pad(m+1)+'-01',next=new Date(y,m+1,1),last=next.getFullYear()+'-'+pad(next.getMonth()+1)+'-01';
 const query=a.db.from('calendar_events').select('id,title,description,starts_at,event_type,status,teacher_id,target_roles,created_by').eq('school_id',a.schoolId)
  .gte('starts_at',new Date(first+'T00:00:00+05:30').toISOString()).lt('starts_at',new Date(last+'T00:00:00+05:30').toISOString()).neq('status','cancelled').order('starts_at').limit(450);

 let holidaysData=[];
 try{
   const hRes=await fetch('https://date.nager.at/api/v3/PublicHolidays/'+y+'/IN');
   if(hRes.ok)holidaysData=await hRes.json();
 }catch(e){}

 const ev=await query;
 if(id!==st.version||!r.isConnected||a.schoolId!==st.school)return;
 const userRole=a.profile?.role||'student',userId=a.user?.id;
 st.events=(ev.data||[]).filter(x=>leader()||(!x.teacher_id||x.teacher_id===userId||x.created_by===userId)&&(!x.target_roles?.length||x.target_roles.includes(userRole)||x.target_roles.includes('all')));
 st.holidays=Array.isArray(holidaysData)?holidaysData.filter(x=>x.date&&x.name).map(x=>({date:x.date,title:x.localName||x.name})):[];
 st.source=(ev.error?'School events could not be loaded: '+ev.error.message+'. ':'')+
  (st.holidays.length?'Public holiday data: India national & regional observances.':'National holiday reference active.');
 draw();
}

function draw(){
 const r=root();if(!r)return;
 const y=st.year,m=st.month,offset=(new Date(y,m,1).getDay()+6)%7,total=new Date(y,m+1,0).getDate();
 const items=new Map();function add(key,x){if(!items.has(key))items.set(key,[]);items.get(key).push(x)}

 if(st.filter==='all'||st.filter==='holiday'){
   for(const h of st.holidays)add(h.date,{label:h.title,type:'holiday'});
 }
 for(const e of st.events){
   if(st.filter!=='all'&&st.filter!=='holiday'&&e.event_type!==st.filter)continue;
   add(dateParts(new Date(e.starts_at)),{label:e.title,type:e.event_type||'school',id:e.id});
 }

 const cells=Array(offset).fill('<span class="nsc-blank"></span>');
 for(let day=1;day<=total;day++){
  const key=y+'-'+pad(m+1)+'-'+pad(day),entries=items.get(key)||[];
  cells.push('<button '+btn+' class="nsc-day '+(key===st.selected?'selected ':'')+(key===dateParts(new Date())?'today':'')+'" data-day="'+key+'" aria-label="'+key+' · '+entries.length+' events"><b>'+day+'</b>'+
  '<span class="nsc-mini">'+entries.slice(0,2).map(x=>'<small class="'+E(x.type)+'" title="'+E(x.label)+'">'+E(x.label)+'</small>').join('')+'</span></button>');
 }
 $('#nscGrid',r).innerHTML=cells.join('');
 $('#nscSource',r).textContent=st.source;
 r.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{st.selected=b.dataset.day;draw()});
 $('#nscDayTitle',r).textContent=new Date(st.selected+'T12:00:00+05:30').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:zone});

 const ev=st.events.filter(x=>dateParts(new Date(x.starts_at))===st.selected && (st.filter==='all'||st.filter===x.event_type)),
       hol=(st.filter==='all'||st.filter==='holiday')?st.holidays.filter(x=>x.date===st.selected):[];

 $('#nscDayEvents',r).innerHTML=ev.map(x=>{
   const canDelete=leader()||x.created_by===A().user?.id;
   return '<div class="nsc-entry" style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid #ead8e2;border-radius:12px;background:#fff;margin-bottom:8px">'+
   '<div style="display:flex;gap:12px;align-items:center"><i></i><span><b>'+E(x.title)+'</b><small style="display:block;color:#786671">'+E(x.event_type)+' · '+E(new Date(x.starts_at).toLocaleTimeString('en-IN',{timeZone:zone,hour:'numeric',minute:'2-digit'}))+(x.description?' · '+E(x.description):'')+'</small></span></div>'+
   (canDelete?'<button type="button" class="btn danger" style="padding:5px 9px;font-size:10px" data-del-event="'+x.id+'">Delete</button>':'')+
   '</div>';
 }).join('')+
 hol.map(x=>'<div class="nsc-entry festival" style="padding:12px;border:1px solid #efdfbc;border-radius:12px;background:#fffdf6;margin-bottom:8px"><i></i><span><b>'+E(x.title)+'</b><small style="display:block;color:#875f22">Public holiday reference · School holiday policy applies</small></span></div>').join('')||
 '<p class="nsc-hint">No recorded events for this date.</p>';

 r.querySelectorAll('[data-del-event]').forEach(b=>b.onclick=async()=>{
   if(!confirm('Remove this event from the calendar?'))return;
   const {error}=await A().db.from('calendar_events').delete().eq('id',b.dataset.delEvent).eq('school_id',A().schoolId);
   if(error)A().toast?.('Could not delete event: '+error.message,'error');
   else { A().toast?.('Event removed.','success'); await load(); }
 });
}

function showEventModal(presetDate=''){
 if(!canAddEvent())return;
 const a=A(),old=document.getElementById('nscModal');old?.remove();
 const dialog=document.createElement('dialog');dialog.id='nscModal';
 const isLeader=leader();
 dialog.innerHTML='<form method="dialog" style="min-width:min(440px,90vw);padding:20px"><h2 style="font:800 18px Manrope;margin:0 0 14px;color:#54243b">Add School Event</h2>'+
 '<div class="field"><label>Title *</label><input name="title" required minlength="2" maxlength="180" placeholder="e.g. Science Fair or Class Test" style="width:100%;padding:9px;border:1px solid #d9c0cb;border-radius:9px"></div>'+
 '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0">'+
 '<div class="field"><label>Date *</label><input name="date" type="date" value="'+E(presetDate||st.selected)+'" required style="width:100%;padding:9px;border:1px solid #d9c0cb;border-radius:9px"></div>'+
 '<div class="field"><label>Start time *</label><input name="time" type="time" value="09:00" required style="width:100%;padding:9px;border:1px solid #d9c0cb;border-radius:9px"></div>'+
 '</div>'+
 '<div class="field" style="margin-bottom:10px"><label>Event category</label><select name="type" style="width:100%;padding:9px;border:1px solid #d9c0cb;border-radius:9px">'+
 '<option value="school">School Event</option>'+
 (isLeader?'<option value="holiday">School Holiday</option>':'')+
 '<option value="exam">Examination / Test</option>'+
 '<option value="meeting">Meeting / Parent Connect</option>'+
 '<option value="reminder">Reminder</option></select></div>'+
 '<div class="field" style="margin-bottom:10px"><label>Target audience</label><select name="target" style="width:100%;padding:9px;border:1px solid #d9c0cb;border-radius:9px">'+
 '<option value="all">Everyone (All School)</option>'+
 '<option value="students">Students only</option>'+
 '<option value="teachers">Teachers only</option>'+
 '<option value="parents">Parents / Guardians</option></select></div>'+
 '<div class="field" style="margin-bottom:14px"><label>Details / notes</label><textarea name="description" maxlength="1200" placeholder="Agenda or notes..." style="width:100%;padding:9px;border:1px solid #d9c0cb;border-radius:9px;min-height:75px"></textarea></div>'+
 '<p id="nscModalMsg" role="status" style="font-size:11px;color:#a33e49;margin:6px 0"></p>'+
 '<div style="display:flex;justify-content:flex-end;gap:8px">'+
 '<button type="submit" value="cancel" class="btn light">Cancel</button>'+
 '<button type="button" id="nscSave" class="btn">Save Event</button></div></form>';

 document.body.append(dialog);
 if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});

 $('#nscSave',dialog).onclick=async()=>{
  const f=$('form',dialog),val=x=>String(f.elements[x]?.value||'').trim(),title=val('title');
  if(title.length<2||!val('date')||!val('time'))return $('#nscModalMsg',dialog).textContent='Title, date and time are required.';
  const when=new Date(val('date')+'T'+val('time')+':00+05:30');
  if(!Number.isFinite(when.getTime()))return $('#nscModalMsg',dialog).textContent='Invalid event time.';
  const b=$('#nscSave',dialog);b.disabled=true;$('#nscModalMsg',dialog).textContent='Saving event…';

  const audienceMap={all:['owner','principal','manager','teacher','student','parent'],students:['student','parent'],teachers:['teacher','principal'],parents:['parent']};
  const targetRoles=audienceMap[val('target')]||audienceMap.all;

  const result=await a.db.from('calendar_events').insert({
    school_id:a.schoolId,
    created_by:a.user.id,
    teacher_id:a.profile?.role==='teacher'?a.user.id:null,
    title,
    event_type:val('type'),
    description:val('description')||null,
    starts_at:when.toISOString(),
    status:'scheduled',
    target_roles:targetRoles
  });

  if(result.error){
    $('#nscModalMsg',dialog).textContent=result.error.message;
    b.disabled=false;
    return;
  }
  const selected=val('date');
  dialog.close();
  a.toast?.('Calendar event saved.','success');
  st.selected=selected;
  st.year=Number(selected.slice(0,4));
  st.month=Number(selected.slice(5,7))-1;
  await load();
 };
}

window.NOOR_SCHOOL_CALENDAR={open,showEventModal};
})();
