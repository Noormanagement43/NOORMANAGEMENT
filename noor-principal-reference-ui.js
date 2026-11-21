/* Principal reference visuals. Read-only projections of the authenticated school snapshot. */
(()=>{'use strict';
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>window.NOOR_UI_POLISH?.icon(name)||'';
function secondary(classes,sections,students,sessions,records,day){
 const ordinal={first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10};
 const classNumber=c=>{const name=String(c.name||'').trim().toLowerCase(),numeric=name.match(/\d+/);if(numeric)return Number(numeric[0]);const word=name.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/);return word?ordinal[word[1]]:Number(c.sort_order)||0;};
 const ordinalNames={6:'Sixth',7:'Seventh',8:'Eighth',9:'Ninth',10:'Tenth'};
 const classLabel=c=>ordinalNames[classNumber(c)]||String(c.name||'').trim().replace(/^class\s*/i,'');
 const sectionLabel=s=>String(s.name||'').trim().replace(/^section\s*/i,'');
 const chosen=classes.filter(c=>classNumber(c)>=6&&classNumber(c)<=10).sort((a,b)=>classNumber(a)-classNumber(b)||String(a.name).localeCompare(String(b.name),undefined,{numeric:true}));
 if(!chosen.length)return '<p class="pd-empty">No secondary classes 6–10 have been created yet.</p>';
 const submitted=new Set(sessions.filter(x=>x.attendance_date===day&&x.status==='submitted').map(x=>x.id));
 const enrolled=new Set(students.map(s=>s.id)),latest=new Map();
 for(const record of records){
  if(!submitted.has(record.session_id)||!enrolled.has(record.student_id)||!['present','absent','late','leave','excused'].includes(record.status))continue;
  const old=latest.get(record.student_id);
  if(!old||String(record.updated_at||record.marked_at||'')>String(old.updated_at||old.marked_at||''))latest.set(record.student_id,record);
 }
 const groups=chosen.map(c=>{
  const secs=sections.filter(s=>s.class_id===c.id).sort((a,b)=>String(sectionLabel(a)).localeCompare(String(sectionLabel(b)),undefined,{numeric:true}));
  return{name:c.name,entries:secs.map(sec=>{
   const roster=students.filter(s=>s.class_id===c.id&&s.section_id===sec.id),marked=roster.map(s=>latest.get(s.id)).filter(Boolean);
   return{label:sectionLabel(sec),axisLabel:classLabel(c)+' '+sectionLabel(sec),total:roster.length,marked:marked.length,present:marked.filter(x=>x.status==='present').length,absent:marked.filter(x=>x.status==='absent').length,late:marked.filter(x=>x.status==='late').length,leave:marked.filter(x=>['leave','excused'].includes(x.status)).length};
  })};
 }).filter(group=>group.entries.length);
 if(!groups.length)return '<p class="pd-empty">No sections have been created for secondary classes yet. Create sections to view attendance by section.</p>';
 const entries=groups.flatMap(g=>g.entries),highest=Math.max(1,...entries.map(x=>Math.max(x.total,x.present,x.absent,x.late)));
 const step=Math.max(1,Math.ceil(highest/25)),maximum=5*step,left=44,base=244,plot=190;
 const widths=groups.map(g=>Math.max(140,g.entries.length*92+18)),width=Math.max(650,left+widths.reduce((sum,v)=>sum+v,0)+18);
 const scale=n=>plot*n/maximum;
 let svg='<svg class="pd-secondary-svg" viewBox="0 0 '+width+' 320" role="img" aria-label="Secondary attendance by class and section, in class and section order"><title>Actual submitted attendance by secondary class and section</title>';
 for(let i=0;i<=5;i++){
  const count=i*step,y=base-scale(count);
  svg+='<path d="M'+left+' '+y+'H'+(width-12)+'" stroke="currentColor" opacity=".16"/><text x="'+(left-10)+'" y="'+(y+4)+'" text-anchor="end" fill="currentColor" font-size="12">'+count+'</text>';
 }
 let start=left;
 for(const group of groups){
  const groupWidth=widths[groups.indexOf(group)],slot=groupWidth/group.entries.length;
  for(let j=0;j<group.entries.length;j++){
   const section=group.entries[j],x=start+slot*(j+.5),num=section.marked?String(section.present):'—';
   svg+='<g><title>'+E(section.axisLabel)+': '+(section.marked?section.present+' present, '+section.absent+' absent, '+section.late+' late, '+section.leave+' on leave; '+section.marked+' marked of '+section.total:'Attendance not submitted; '+section.total+' enrolled')+'</title>';
   if(section.marked){
    svg+='<rect x="'+(x-20)+'" y="'+(base-scale(section.present))+'" width="23" height="'+scale(section.present)+'" rx="2" fill="var(--pd-ref-accent,var(--berry))"/>';
    svg+='<rect x="'+(x+5)+'" y="'+(base-scale(section.absent))+'" width="8" height="'+scale(section.absent)+'" rx="1" fill="var(--pd-ref-border,var(--rose-line))"/>';
    svg+='<rect x="'+(x+15)+'" y="'+(base-scale(section.late))+'" width="8" height="'+scale(section.late)+'" rx="1" fill="var(--pd-ref-gold,var(--gold))"/>';
   }
   svg+='<text x="'+(x-9)+'" y="'+(base-scale(section.present)-8)+'" text-anchor="middle" fill="var(--pd-ref-ink,var(--ink))" font-size="15" font-weight="750">'+num+'</text>';
   svg+='<text x="'+x+'" y="266" text-anchor="middle" fill="var(--pd-ref-ink,var(--ink))" font-size="12" font-weight="700">'+E(section.axisLabel)+'</text></g>';
  }
  svg+='<rect x="'+(start+8)+'" y="279" width="'+(groupWidth-16)+'" height="29" rx="11" fill="var(--pd-ref-soft,var(--rose-soft))"/>';
  svg+='<text x="'+(start+groupWidth/2)+'" y="298" text-anchor="middle" fill="var(--pd-ref-ink,var(--ink))" font-size="13" font-weight="750">'+E(group.name)+'</text>';
  start+=groupWidth;
 }
 svg+='</svg>';
 const totals=entries.reduce((all,r)=>({total:all.total+r.total,present:all.present+r.present,marked:all.marked+r.marked,leave:all.leave+r.leave}),{total:0,present:0,marked:0,leave:0});
 const percent=totals.total?Math.round(1000*totals.present/totals.total)/10:0;
 return '<div class="pd-secondary-subhead"><span>Classes 6–10 · Section-wise</span><div class="pd-secondary-legend"><span><i class="present"></i>Present</span><span><i class="absent"></i>Absent</span><span><i class="late"></i>Late</span></div></div>'+
 '<div class="pd-secondary-scroll" tabindex="0" aria-label="Scroll to see all class and section attendance groups">'+svg+'</div>'+
 '<div class="pd-secondary-summary">'+(totals.marked?'Present: '+totals.present+' / '+totals.total+' <span aria-hidden="true">•</span> Attendance: '+percent+'%':'Attendance not submitted today')+'</div>'+
 '<p class="pd-muted">'+totals.marked+' marked · '+(totals.total-totals.marked)+' unmarked'+(totals.leave?' · '+totals.leave+' on leave':'')+' · Counts reflect real submitted records; unmarked is not absent.</p>';
}
function running(periods,teachers,classes,sections,runs,photos={}){
 if(!periods.length)return '<p class="pd-empty pd-running-empty">No periods are running right now. Only current school-time periods appear here.</p>';
 const teacherMap=new Map(teachers.map(t=>[t.id,t]));
 const classMap=new Map(classes.map(c=>[c.id,c.name])),sectionMap=new Map(sections.map(s=>[s.id,s.name]));
 const cleanTime=value=>/^\d{2}:\d{2}/.test(String(value||''))?String(value).slice(0,5):'—';
 return '<div class="pd-running-list" role="list" aria-label="Current periods">'+periods.map(p=>{
  const teacher=teacherMap.get(p.teacher_id),name=String(teacher?.full_name||p.teacher_name||'School teacher');
  const rawParts=String(p.class_label||'').split(' · '),cl=classMap.get(p.class_id)||rawParts[0]||'Class not set';
  const sec=sectionMap.get(p.section_id)||rawParts[1]||'';
  const assigned=cl+(sec?' '+sec.replace(/^section\s+/i,''):'');
  const period=Number.isInteger(Number(p.period_number))&&Number(p.period_number)>0?'Period '+Number(p.period_number):'Period not set';
  const started=runs.get(p.id)?.status==='ongoing'||p.progress_status==='ongoing';
  const status=started?'In progress':'Scheduled now';
  const image=String(photos[p.teacher_id]||''),safePhoto=/^https:\/\/[^?#]+\/storage\/v1\/object\/sign\//i.test(image)?image:'';
  const initials=name.trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
  const avatar=safePhoto?'<img src="'+E(safePhoto)+'" alt="'+E(name)+' photo" loading="lazy" referrerpolicy="no-referrer">':'<span class="pd-running-initials" aria-label="No teacher photo uploaded">'+E(initials)+'</span>';
  return '<article class="pd-running-person" role="listitem"><button type="button" class="pd-running-photo" data-view-teacher="'+E(p.teacher_id||'')+'" aria-label="View '+E(name)+' profile">'+avatar+'</button>'+
  '<div class="pd-running-copy"><button type="button" class="pd-running-name" data-view-teacher="'+E(p.teacher_id||'')+'">'+E(name)+'</button>'+
  '<div class="pd-running-subject">'+E(p.subject_name||'Subject not set')+'</div>'+
  '<div class="pd-running-meta"><span>'+E(assigned)+'</span><span>'+E(period)+'</span></div>'+
  '<div class="pd-running-time"><span>'+E(cleanTime(p.start_time))+' – '+E(cleanTime(p.end_time))+'</span><span class="pd-running-state">'+status+'</span></div></div>'+
  '<button type="button" class="pd-running-open" data-pd-period="'+E(p.id)+'" aria-label="View '+E(period)+' details">›</button></article>';
 }).join('')+'</div>';
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
window.NOOR_PRINCIPAL_REFERENCE=Object.freeze({secondary,running,actions,messages});
})();
