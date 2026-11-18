/* Principal reference visuals. Read-only projections of the authenticated school snapshot. */
(()=>{'use strict';
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>window.NOOR_UI_POLISH?.icon(name)||'';
function secondary(classes,sections,students,sessions,records,day){
 const number=c=>Number(String(c.name).match(/\d+/)?.[0]||0);
 const cs=classes.filter(c=>number(c)>=6&&number(c)<=10).sort((a,b)=>number(a)-number(b));
 if(!cs.length)return '<p class="pd-empty">No classes 6–10 have been created yet.</p>';
 const submitted=new Set(sessions.filter(x=>x.attendance_date===day&&x.status==='submitted').map(x=>x.id));
 const roster=new Set(students.map(s=>s.id)),latest=new Map();
 for(const record of records){
  if(!submitted.has(record.session_id)||!roster.has(record.student_id)||!['present','absent','late','leave','excused'].includes(record.status))continue;
  const old=latest.get(record.student_id);
  if(!old||String(record.updated_at||record.marked_at||'')>String(old.updated_at||old.marked_at||''))latest.set(record.student_id,record);
 }
 const groups=cs.map(c=>{
  const secs=sections.filter(s=>s.class_id===c.id).sort((a,b)=>String(a.name).localeCompare(String(b.name),undefined,{numeric:true}));
  const unassigned=students.filter(s=>s.class_id===c.id&&!secs.some(sec=>sec.id===s.section_id));
  const entries=secs.map(s=>({label:s.name,axisLabel:String(number(c))+String(s.name||'').replace(/^section\s*/i,'').trim(),students:students.filter(p=>p.class_id===c.id&&p.section_id===s.id)}));
  if(unassigned.length||!entries.length)entries.push({label:secs.length?'Unassigned':'All',students:unassigned});
  return {name:c.name,entries:entries.map(entry=>{
   const marks=entry.students.map(s=>latest.get(s.id)).filter(Boolean);
   return {label:entry.label,total:entry.students.length,marked:marks.length,present:marks.filter(r=>r.status==='present').length,absent:marks.filter(r=>r.status==='absent').length,late:marks.filter(r=>r.status==='late').length,leave:marks.filter(r=>['leave','excused'].includes(r.status)).length};
  })};
 });
 const entries=groups.flatMap(g=>g.entries),top=Math.max(1,...entries.map(x=>Math.max(x.total,x.present,x.absent,x.late)));
 const step=Math.max(1,Math.ceil(top/5)),max=step*5,left=44,plot=206,base=242;
 const widths=groups.map(g=>Math.max(96,g.entries.length*70+20)),width=Math.max(620,left+widths.reduce((a,b)=>a+b,0)+16),plotWidth=width-left-16;
 const scale=n=>plot*n/max;let svg=`<svg class="pd-secondary-svg" viewBox="0 0 ${width} 320" role="img" aria-label="Secondary attendance by class and section; numbers above bars show present students"><title>Classes 6–10: recorded present, absent and late student counts</title>`;
 for(let n=0;n<=5;n++){const value=n*step,y=base-scale(value);svg+=`<path d="M${left} ${y}H${width-16}" stroke="currentColor" opacity=".15"/><text x="${left-9}" y="${y+4}" text-anchor="end" fill="currentColor" font-size="12">${value}</text>`;}
 let offset=left;
 groups.forEach((g,i)=>{
  const groupWidth=widths[i]*plotWidth/widths.reduce((a,b)=>a+b,0),slot=groupWidth/g.entries.length;
  g.entries.forEach((s,j)=>{
   const x=offset+slot*(j+.5),barWidth=Math.min(27,slot*.4),mark=s.marked?String(s.present):'—';
   svg+=`<g><title>${E(g.name)} · ${E(s.label)}: ${s.marked?s.present+' present, '+s.absent+' absent, '+s.late+' late, '+s.leave+' on leave; '+s.marked+' marked of '+s.total:'Attendance not submitted; '+s.total+' enrolled'}</title>`;
   if(s.marked){
    svg+=`<rect x="${x-barWidth/2-5}" y="${base-scale(s.present)}" width="${barWidth}" height="${scale(s.present)}" fill="var(--pd-ref-accent,var(--berry))"/>`;
    svg+=`<rect x="${x+barWidth/2-4}" y="${base-scale(s.absent)}" width="8" height="${scale(s.absent)}" fill="var(--pd-ref-border,var(--rose-line))"/><rect x="${x+barWidth/2+5}" y="${base-scale(s.late)}" width="8" height="${scale(s.late)}" fill="var(--pd-ref-gold,var(--gold))"/>`;
   }
   svg+=`<text x="${x-5}" y="${base-scale(s.present)-9}" text-anchor="middle" fill="currentColor" font-size="17" font-weight="750">${mark}</text><text x="${x}" y="262" text-anchor="middle" fill="currentColor" font-size="12" font-weight="700">${E(s.axisLabel||s.label)}</text></g>`;
  });
  svg+=`<rect x="${offset+5}" y="276" width="${groupWidth-10}" height="27" rx="9" fill="var(--pd-ref-soft,var(--rose-soft))"/><text x="${offset+groupWidth/2}" y="295" text-anchor="middle" fill="var(--pd-ref-ink,var(--ink))" font-size="13" font-weight="700">${E(g.name)}</text>`;
  offset+=groupWidth;
 });
 const totals=entries.reduce((t,x)=>({present:t.present+x.present,total:t.total+x.total,marked:t.marked+x.marked}),{present:0,total:0,marked:0});
 return '<div class="pd-secondary-subhead"><span>Classes 6–10 · Section-wise</span><div class="pd-secondary-legend"><span><i class="present"></i>Present</span><span><i class="absent"></i>Absent</span><span><i class="late"></i>Late</span></div></div><div class="pd-secondary-scroll" tabindex="0" aria-label="Scroll class attendance chart">'+svg+'</svg></div><div class="pd-secondary-summary">'+(totals.marked?'Present: '+totals.present+' / '+totals.total+' · Attendance: '+Math.round(totals.present/Math.max(1,totals.total)*1000)/10+'%':'Attendance not submitted')+'</div><p class="pd-muted">'+totals.marked+' marked · '+(totals.total-totals.marked)+' unmarked · Numbers above bars show present students. Late and leave are separate.</p>';
}
function actions(items){return items.map(x=>{
 const staff=x.route==='staff-management',help=x.route==='help-support';
 return `<button type="button" class="pd-reference-row" data-route="${E(x.route)}"><span class="pd-reference-icon">${icon(staff?'staff':help?'question':'calendar')}</span><span class="pd-reference-copy"><strong>${E(x.title)}</strong><small>${E(x.sub)}</small></span><span class="pd-reference-cta">${staff?'View Staff':help?'Open Help':'Review'} <span aria-hidden="true">›</span></span></button>`;
}).join('');}
function messages(rows,kind,tz){
 const items=rows.filter(x=>x.kind===kind).sort((a,b)=>String(b.created_at||b.starts_at||'').localeCompare(String(a.created_at||a.starts_at||'')));
 const unique=[...new Map(items.map(x=>[String(x.id)+':'+x.kind,x])).values()];
 const html=unique.slice(0,3).map(x=>{
  const value=x.starts_at||x.created_at,date=value?new Date(value):null;
  const label=date&&Number.isFinite(date.getTime())?date.toLocaleString('en-IN',{timeZone:tz,day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';
  return `<button type="button" class="pd-reference-row pd-message-row" data-route="notices"><span class="pd-reference-icon">${icon(kind==='meeting'?'calendar':kind==='email'?'email':'notice')}</span><span class="pd-reference-copy"><strong>${E(x.title)}</strong><small>${E(label)}</small></span><span aria-hidden="true">›</span></button>`;
 }).join('')||`<p class="pd-empty">${rows.some(x=>x.unavailable)?'School messages could not load. Open Notices & Meetings to retry.':'No '+(kind==='meeting'?'meetings':kind==='email'?'emails':'notices')+' to display.'}</p>`;
 return html;
}
window.NOOR_PRINCIPAL_REFERENCE=Object.freeze({secondary,actions,messages});
})();
