/* NOOR Calendar: verified public holidays, school-specific events, mobile grid. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(q,r=document)=>r?.querySelector(q);
const zone='Asia/Kolkata',months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const dateParts=d=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),g=k=>p.find(x=>x.type===k).value;return g('year')+'-'+g('month')+'-'+g('day')};
const pad=x=>String(x).padStart(2,'0');
const now=dateParts(new Date()),st={year:Number(now.slice(0,4)),month:Number(now.slice(5,7))-1,selected:now,school:null,events:[],holidays:[],source:'',version:0};
const root=()=>document.getElementById('view-school-calendar');
const leader=()=>['owner','principal'].includes(A().profile?.role);
const btn='type="button"';
function open(){
 const app=A(),r=root();if(!r||!app.user?.id||!app.schoolId)return;
 if(st.school!==app.schoolId){st.school=app.schoolId;st.selected=now;st.year=Number(now.slice(0,4));st.month=Number(now.slice(5,7))-1}
 r.innerHTML='<div class="nsc"><header class="nsc-head"><div><small>NOOR · School year planner</small><h1>School Calendar</h1><p>School events, public holidays and festival references</p></div><button '+btn+' id="nscToday">Today</button></header>'+
 '<section class="nsc-card"><div class="nsc-month"><button '+btn+' id="nscPrev" aria-label="Previous month">‹</button><h2 id="nscMonth"></h2><button '+btn+' id="nscNext" aria-label="Next month">›</button></div>'+
 '<div class="nsc-legend"><span>● School events</span><span>● India holiday references</span></div>'+
 '<div class="nsc-weekdays">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>'<b>'+x+'</b>').join('')+'</div><div id="nscGrid" class="nsc-grid"></div><p id="nscSource" class="nsc-hint">Checking current school data…</p></section>'+
 '<section class="nsc-card"><div class="nsc-row"><h2 id="nscDayTitle">Selected day</h2>'+(leader()?'<button '+btn+' id="nscAdd">+ School Event</button>':'')+'</div><div id="nscDayEvents"></div></section>'+
 '<section class="nsc-card"><h2>Indian, Hindu & Muslim festival references</h2><p class="nsc-hint">Open the public Indian and Islamic holiday calendars for a broader festival view. Eid and other moon-sighting dates are subject to local confirmation. School holidays become official only when the school adds them as events.</p>'+
 '<button '+btn+' id="nscReference">View festival calendars</button><div id="nscReferenceBox" hidden></div></section><p id="nscMessage" role="status"></p></div>';
 $('#nscToday',r).onclick=()=>{const s=dateParts(new Date());st.year=Number(s.slice(0,4));st.month=Number(s.slice(5,7))-1;st.selected=s;load()};
 $('#nscPrev',r).onclick=()=>move(-1);$('#nscNext',r).onclick=()=>move(1);
 if(leader())$('#nscAdd',r).onclick=addEvent;
 $('#nscReference',r).onclick=()=>{const el=$('#nscReferenceBox',r);el.hidden=!el.hidden;if(!el.hidden&&!el.firstChild){
 const iframe=document.createElement('iframe');iframe.title='Google public Indian and Islamic holiday calendars';iframe.loading='lazy';iframe.src='https://calendar.google.com/calendar/embed?src=en.indian%23holiday%40group.v.calendar.google.com&src=en.islamic%23holiday%40group.v.calendar.google.com&ctz=Asia%2FKolkata';
 iframe.style.cssText='display:block;width:100%;min-height:440px;height:65vh;border:0;border-radius:12px;margin-top:12px';el.appendChild(iframe)}};
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
 const query=a.db.from('calendar_events').select('id,title,description,starts_at,event_type,status,teacher_id,target_roles').eq('school_id',a.schoolId)
 .gte('starts_at',new Date(first+'T00:00:00+05:30').toISOString()).lt('starts_at',new Date(last+'T00:00:00+05:30').toISOString()).neq('status','cancelled').order('starts_at').limit(450);
 const [events,holidays]=await Promise.allSettled([query,fetch('https://date.nager.at/api/v3/PublicHolidays/'+y+'/IN').then(async r=>{if(!r.ok)throw Error('Holiday feed unavailable');return r.json()})]);
 if(id!==st.version||!r.isConnected||a.schoolId!==st.school)return;
 const ev=events.status==='fulfilled'?events.value:{data:[],error:events.reason};
 st.events=(ev.data||[]).filter(x=>leader()||(!x.teacher_id||x.teacher_id===a.user.id)&&(!x.target_roles?.length||x.target_roles.includes(a.profile.role)||x.target_roles.includes('all')));
 st.holidays=holidays.status==='fulfilled'&&Array.isArray(holidays.value)?holidays.value.filter(x=>x.date&&x.name).map(x=>({date:x.date,title:x.localName||x.name})):[];
 st.source=(ev.error?'School events could not be loaded: '+ev.error.message+'. ':'')+
  (holidays.status==='fulfilled'?'Public holiday data: Nager.Date · national/regional observances may differ.':'Public holiday feed unavailable. School events remain available.');
 draw();
}
function draw(){
 const r=root();if(!r)return;
 const y=st.year,m=st.month,offset=(new Date(y,m,1).getDay()+6)%7,total=new Date(y,m+1,0).getDate();
 const items=new Map();function add(key,x){if(!items.has(key))items.set(key,[]);items.get(key).push(x)}
 for(const h of st.holidays)add(h.date,{label:h.title,type:'holiday'});
 for(const e of st.events)add(dateParts(new Date(e.starts_at)),{label:e.title,type:'school'});
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
 const ev=st.events.filter(x=>dateParts(new Date(x.starts_at))===st.selected),hol=st.holidays.filter(x=>x.date===st.selected);
 $('#nscDayEvents',r).innerHTML=ev.map(x=>'<div class="nsc-entry"><i></i><span><b>'+E(x.title)+'</b><small>'+E(x.event_type)+' · '+E(new Date(x.starts_at).toLocaleTimeString('en-IN',{timeZone:zone,hour:'numeric',minute:'2-digit'}))+(x.description?' · '+E(x.description):'')+'</small></span></div>').join('')+
 hol.map(x=>'<div class="nsc-entry festival"><i></i><span><b>'+E(x.title)+'</b><small>Public holiday reference · confirm school policy locally</small></span></div>').join('')||'<p class="nsc-hint">No recorded events for this date.</p>';
}
function addEvent(){
 if(!leader())return;
 const a=A(),old=document.getElementById('nscModal');old?.remove(),dialog=document.createElement('dialog');dialog.id='nscModal';
 dialog.innerHTML='<form method="dialog"><h2>Create School Event</h2><label>Title<input name="title" required minlength="2" maxlength="180" placeholder="School meeting or holiday"></label>'+
 '<label>Date<input name="date" type="date" value="'+E(st.selected)+'" required></label><label>Start time<input name="time" type="time" value="09:00" required></label>'+
 '<label>Event type<select name="type"><option value="school">School event</option><option value="holiday">School holiday</option><option value="exam">Exam</option><option value="meeting">Meeting</option><option value="reminder">Reminder</option></select></label>'+
 '<label>Details<textarea name="description" maxlength="1200"></textarea></label><p id="nscModalMsg" role="status"></p>'+
 '<div class="nsc-modal-actions"><button type="submit" value="cancel">Cancel</button><button type="button" id="nscSave">Save event</button></div></form>';
 document.body.append(dialog);dialog.showModal?.();if(!dialog.open)dialog.setAttribute('open','');dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 $('#nscSave',dialog).onclick=async()=>{
  const f=$('form',dialog),val=x=>String(f.elements[x]?.value||'').trim(),title=val('title');if(title.length<2||!val('date')||!val('time'))return $('#nscModalMsg',dialog).textContent='Title, date and time required.';
  const when=new Date(val('date')+'T'+val('time')+':00+05:30');
  if(!Number.isFinite(when.getTime()))return $('#nscModalMsg',dialog).textContent='Invalid event time.';
  const b=$('#nscSave',dialog);b.disabled=true;$('#nscModalMsg',dialog).textContent='Saving school event…';
  const result=await a.db.from('calendar_events').insert({school_id:a.schoolId,created_by:a.user.id,title,event_type:val('type'),
  description:val('description')||null,starts_at:when.toISOString(),status:'scheduled',target_roles:['owner','principal','manager','teacher','student','parent']});
  if(result.error){$('#nscModalMsg',dialog).textContent=result.error.message;b.disabled=false;return;}
  const selected=val('date');dialog.close();a.toast?.('School event added.','success');st.selected=selected;st.year=Number(selected.slice(0,4));st.month=Number(selected.slice(5,7))-1;await load();
 };
}
window.NOOR_SCHOOL_CALENDAR={open};
})();