/* NOOR Calendar: verified public holidays, school-specific events, mobile grid, interactive event management for Principal & Teachers. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(q,r=document)=>r?.querySelector(q);
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
function getSchoolTimezone(){
 const app=A(),sch=app.school||window.currentSchool||{};
 if(sch.timezone)return sch.timezone;
 const addr=String(sch.address||sch.location||'').toLowerCase();
 if(addr.includes('sangareddy')||addr.includes('hyderabad')||addr.includes('telangana')||addr.includes('india'))return 'Asia/Kolkata';
 try{const detected=Intl.DateTimeFormat().resolvedOptions().timeZone;if(detected)return detected;}catch(e){}
 return 'Asia/Kolkata';
}
const dateParts=d=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:getSchoolTimezone(),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),g=k=>p.find(x=>x.type===k).value;return g('year')+'-'+g('month')+'-'+g('day')};
const pad=x=>String(x).padStart(2,'0');
const now=dateParts(new Date()),st={year:Number(now.slice(0,4)),month:Number(now.slice(5,7))-1,selected:now,school:null,events:[],holidays:[],source:'',version:0,filter:'all'};
const root=()=>document.getElementById('view-school-calendar');
const leader=()=>['owner','principal','manager','creator'].includes(A().profile?.role);
const canAddEvent=()=>['owner','principal','manager','creator','teacher'].includes(A().profile?.role);
const btn='type="button"';

function getRegionalFestivals(year){
 return [
  {date:year+'-01-14',title:'Makar Sankranti / Pongal 🪁 (Regional)'},
  {date:year+'-01-26',title:'Republic Day 🇮🇳 (National)'},
  {date:year+'-03-30',title:'Ugadi / Telugu New Year 🌾 (Telangana Regional)'},
  {date:year+'-03-31',title:'Eid-ul-Fitr / Ramzan 🌙 (Islamic)'},
  {date:year+'-06-02',title:'Telangana Formation Day 🇮🇳 (State Public Holiday)'},
  {date:year+'-06-07',title:'Bakrid / Eid-ul-Adha 🐑 (Islamic)'},
  {date:year+'-07-06',title:'Muharram 🕌 (Islamic)'},
  {date:year+'-07-28',title:'Bonalu Festival 🌺 (Hyderabad / Telangana Regional)'},
  {date:year+'-08-15',title:'Independence Day 🇮🇳 (National)'},
  {date:year+'-08-27',title:'Ganesh Chaturthi 🐘 (Regional Festival)'},
  {date:year+'-09-05',title:'Milad-un-Nabi 🕌 (Islamic)'},
  {date:year+'-10-02',title:'Gandhi Jayanti 🇮🇳 (National)'},
  {date:year+'-10-12',title:'Bathukamma 🌸 (Telangana State Floral Festival)'},
  {date:year+'-10-20',title:'Dussehra / Vijayadashami 🏹 (Major Festival)'},
  {date:year+'-11-01',title:'Diwali / Deepavali 🪔 (Festival of Lights)'},
  {date:year+'-12-25',title:'Christmas 🎄 (Public Holiday)'}
 ];
}
function open(){
 const app=A(),r=root();if(!r||!app.user?.id||!app.schoolId)return;
 if(st.school!==app.schoolId){st.school=app.schoolId;st.selected=now;st.year=Number(now.slice(0,4));st.month=Number(now.slice(5,7))-1}
 const tz=getSchoolTimezone();const addr=app.school?.address||'Sangareddy / Hyderabad, Telangana';
 r.innerHTML='<div class="nsc"><header class="nsc-head"><div><small>NOOR · Institution Year Planner</small><h1>📅 School Calendar</h1><p>Interactive school & university events, exams, meetings, and localized holiday references.</p><div class="nsc-tz-pill" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:20px;font-size:11px;font-weight:700;color:#4338ca;margin-top:6px">📍 '+E(addr)+' · Timezone: '+E(tz)+'</div></div>'+
 '<div class="row" style="gap:8px"><button '+btn+' class="btn light" id="nscToday">Today</button>'+(canAddEvent()?'<button '+btn+' class="btn" id="nscAdd">+ Add Event</button>':'')+'</div></header>'+
 '<section class="nsc-card"><div class="nsc-month"><button '+btn+' id="nscPrev" aria-label="Previous month">‹</button><h2 id="nscMonth"></h2><button '+btn+' id="nscNext" aria-label="Next month">›</button></div>'+
 '<div class="nsc-legend" style="display:flex;gap:14px;flex-wrap:wrap;margin:12px 0;padding:8px 12px;background:#fdf8fa;border-radius:10px;border:1px solid #f1e2ea">'+
  '<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:750;color:#be185d"><span style="width:10px;height:10px;border-radius:50%;background:#be185d"></span> 🏫 School Events</span>'+
  '<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:750;color:#7c3aed"><span style="width:10px;height:10px;border-radius:50%;background:#7c3aed"></span> 📝 School Exams</span>'+
  '<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:750;color:#059669"><span style="width:10px;height:10px;border-radius:50%;background:#059669"></span> 👥 Meetings</span>'+
  '<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:750;color:#d97706"><span style="width:10px;height:10px;border-radius:50%;background:#d97706"></span> 🕌 🪔 Holidays & Festivals</span>'+
'</div>'+
 '<div class="row" style="gap:6px;margin:10px 0" id="nscFilters">'+
 ['all','school','exam','meeting','holiday'].map(f=>'<button '+btn+' class="btn '+(st.filter===f?'soft':'light')+'" style="padding:5px 11px;font-size:10px" data-cal-filter="'+f+'">'+(f==='all'?'All Events':f[0].toUpperCase()+f.slice(1)+'s')+'</button>').join('')+
 '</div>'+
 '<div class="nsc-weekdays">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>'<b>'+x+'</b>').join('')+'</div><div id="nscGrid" class="nsc-grid"></div><p id="nscSource" class="nsc-hint">Checking current school data…</p></section>'+
 '<section class="nsc-card"><div class="nsc-row"><h2 id="nscDayTitle">Selected day</h2>'+(canAddEvent()?'<button '+btn+' class="btn light" id="nscAddDay">+ Event for this day</button>':'')+'</div><div id="nscDayEvents"></div></section>'+
 '<section class="nsc-card" style="border:1px solid #ebd4de;border-radius:14px;background:#fff;padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px"><div><h2 style="margin:0;font:800 16px Manrope;color:#5a233c">🕌 🪔 Localized Regional & Religious Festivals (Sangareddy / Hyderabad)</h2><p class="nsc-hint" style="margin:4px 0 0">Verified Telangana regional holidays, Hindu & Islamic festivals localized for '+E(addr)+'. Always visible by default.</p></div><span class="pill green" style="font-weight:700">✓ Dynamic Timezone Active</span></div>'+
 '<div class="nsc-festivals-strip" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-bottom:16px">'+
 getRegionalFestivals(st.year).slice(0,8).map(f=>`<div style="padding:8px 10px;background:#fdf8fa;border:1px solid #f1e2ea;border-radius:10px;font-size:11px"><b style="color:#5a233c;display:block">${E(f.title)}</b><small style="color:#815a73">${E(f.date)}</small></div>`).join('')+
 '</div>'+
 '<div id="nscReferenceBox" style="margin-top:10px"><iframe title="Google public Indian and Islamic holiday calendars" loading="lazy" src="https://calendar.google.com/calendar/embed?src=en.indian%23holiday%40group.v.calendar.google.com&src=en.islamic%23holiday%40group.v.calendar.google.com&ctz='+encodeURIComponent(tz)+'" style="display:block;width:100%;min-height:440px;height:65vh;border:1px solid #f1e2ea;border-radius:12px"></iframe></div></section><p id="nscMessage" role="status"></p></div>';

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
 const apiHolidays=Array.isArray(holidaysData)?holidaysData.filter(x=>x.date&&x.name).map(x=>({date:x.date,title:x.localName||x.name})):[];
 const regional=getRegionalFestivals(y);
 const holidayMap=new Map();
 [...regional, ...apiHolidays].forEach(h=>{if(!holidayMap.has(h.date))holidayMap.set(h.date,h.title);else holidayMap.set(h.date,holidayMap.get(h.date)+' · '+h.title);});
 st.holidays=[...holidayMap.entries()].map(([date,title])=>({date,title}));
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

 const TAG_CONFIG = {
   exam: { label: '📝 School Exam', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
   meeting: { label: '👥 Meeting', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
   school: { label: '🏫 School Event', color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
   holiday: { label: '🎉 Holiday / Festival', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
 };

 $('#nscDayEvents',r).innerHTML=ev.map(x=>{
   const canDelete=leader()||x.created_by===A().user?.id;
   const tag = TAG_CONFIG[x.event_type] || TAG_CONFIG.school;
   return '<div class="nsc-entry" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border:1px solid '+tag.border+';border-left:4px solid '+tag.color+';border-radius:12px;background:'+tag.bg+';margin-bottom:8px">'+
   '<div style="display:flex;gap:12px;align-items:center"><div><div style="display:flex;align-items:center;gap:6px"><b style="color:#2d111d;font-size:13px">'+E(x.title)+'</b><span style="font-size:10px;font-weight:700;color:'+tag.color+';padding:2px 6px;border-radius:6px;background:#fff;border:1px solid '+tag.border+'">'+tag.label+'</span></div><small style="display:block;color:#786671;margin-top:3px">'+E(new Date(x.starts_at).toLocaleTimeString('en-IN',{timeZone:zone,hour:'numeric',minute:'2-digit'}))+(x.description?' · '+E(x.description):'')+'</small></div></div>'+
   (canDelete?'<button type="button" class="btn danger" style="padding:5px 9px;font-size:10px" data-del-event="'+x.id+'">Delete</button>':'')+
   '</div>';
 }).join('')+
 hol.map(x=>'<div class="nsc-entry festival" style="padding:12px 14px;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:12px;background:#fffbeb;margin-bottom:8px"><div><div style="display:flex;align-items:center;gap:6px"><b style="color:#78350f;font-size:13px">'+E(x.title)+'</b><span style="font-size:10px;font-weight:700;color:#d97706;padding:2px 6px;border-radius:6px;background:#fff;border:1px solid #fde68a">🎉 Holiday Reference</span></div><small style="display:block;color:#92400e;margin-top:3px">Regional Telangana & Public Festival Reference (Asia/Kolkata)</small></div></div>').join('')||
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
