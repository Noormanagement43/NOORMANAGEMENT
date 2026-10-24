/* NOOR Teacher Workspace V3 — reference-inspired lavender layout; no fake statistics. */
(()=>{'use strict';
const app=()=>window.NOOR_AI_APP,root=()=>document.getElementById('view-overview');
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>String(t||'').slice(0,5)||'—';
const themeKey=id=>'noor.teacher.theme.'+id;
const css=document.createElement('style');css.textContent=[
'.app-shell[data-teacher-look]{--nt-accent:#6357a5;--nt-soft:#e8e2fa;--nt-ink:#332e55;--nt-page:#f2f1fb;--nt-sidebar:#6058a4;--nt-side2:#8173bd}',
'.app-shell[data-teacher-look=rose]{--nt-accent:#9b5371;--nt-soft:#f9e7ef;--nt-ink:#512b42;--nt-page:#fcf6f8;--nt-sidebar:#733d58;--nt-side2:#ad748c}',
'.app-shell[data-teacher-look=ivory]{--nt-accent:#8f7551;--nt-soft:#f4ebd9;--nt-ink:#52432f;--nt-page:#faf8f2;--nt-sidebar:#75644f;--nt-side2:#a99679}',
'.app-shell[data-teacher-look] .sidebar{background:linear-gradient(158deg,var(--nt-sidebar),var(--nt-side2));color:#fff;border-radius:0 24px 24px 0}',
'.app-shell[data-teacher-look] .sidebar .nav button{color:#f1edff;border-radius:14px}',
'.app-shell[data-teacher-look] .sidebar .nav button.active{background:var(--nt-soft);color:var(--nt-ink);box-shadow:0 5px 18px #19112f21;border-color:transparent}',
'.app-shell[data-teacher-look] .sidebar .nav button:hover:not(.active){background:#ffffff26}',
'.app-shell[data-teacher-look] .sidebar::after{content:"✿";display:block;align-self:center;margin:10px 0 4px;color:#dec7ee88;font-size:48px;line-height:1;pointer-events:none}',
'.app-shell[data-teacher-look] .main{background:var(--nt-page);min-height:100vh}',
'.app-shell[data-teacher-look] .topbar{background:#fffdfd!important;border-radius:0 0 20px 20px}',
'.ntv3{color:var(--nt-ink);font-family:"DM Sans",system-ui,sans-serif;--nt-border:#ebe7f4}',
'.ntv3 .ntv3-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:4px 0 16px}',
'.ntv3 h1{font-size:26px;letter-spacing:-.9px;color:var(--nt-ink);margin:0}',
'.ntv3 h2{font-size:18px;letter-spacing:-.3px;color:var(--nt-ink);margin:0 0 12px}',
'.ntv3 .ntv3-eyebrow{font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:900;color:var(--nt-accent)}',
'.ntv3 .ntv3-card{background:#fff;border:1px solid var(--nt-border);border-radius:23px;box-shadow:0 9px 27px #4b398a11;padding:clamp(16px,2.4vw,24px);margin-bottom:16px}',
'.ntv3 .ntv3-profile{display:grid;grid-template-columns:clamp(120px,17vw,190px) 1fr;gap:clamp(18px,3vw,32px);align-items:center}',
'.ntv3 .ntv3-photo{width:100%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#d6ccfb,#f5d4ef);color:var(--nt-accent);font-size:49px;font-weight:900;overflow:hidden}',
'.ntv3 .ntv3-photo img{width:100%;height:100%;object-fit:cover}',
'.ntv3 .ntv3-userhead{display:flex;justify-content:space-between;align-items:center;gap:12px}',
'.ntv3 .ntv3-userhead h2{font-size:clamp(19px,2.5vw,24px);margin:0}',
'.ntv3 .ntv3-info{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-top:16px}',
'.ntv3 .ntv3-info p{margin:0;min-width:0;color:#69617d;font-size:12px;overflow-wrap:anywhere}',
'.ntv3 button{cursor:pointer;font:inherit}',
'.ntv3 button.ntv3-pill{background:var(--nt-soft);color:var(--nt-ink);padding:9px 13px;border:0;border-radius:14px;font-size:11px;font-weight:900}',
'.ntv3 button.ntv3-pill:hover{filter:brightness(.97)}',
'.ntv3 .ntv3-cols{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(270px,1fr);gap:14px}',
'.ntv3 .ntv3-timeline{padding-left:25px;border-left:2px solid #d6c9ee;margin-left:11px}',
'.ntv3 .ntv3-period{position:relative;background:linear-gradient(120deg,#f4f4fd,#f4edfc);border-radius:18px;padding:15px;margin:0 0 13px 9px;border:1px solid #efebf8;display:flex;align-items:center;gap:15px;min-height:84px}',
'.ntv3 .ntv3-period:nth-child(3n+2){background:linear-gradient(110deg,#fcf2f8,#efeafa)}',
'.ntv3 .ntv3-period:before{content:"";position:absolute;left:-34px;top:31px;width:13px;height:13px;border-radius:50%;background:var(--nt-accent);border:3px solid #fff;box-shadow:0 0 0 2px var(--nt-accent)}',
'.ntv3 .ntv3-picon{width:56px;height:56px;border-radius:50%;background:#e1ddf8;display:grid;place-items:center;color:#6154a2;font-size:24px;flex:none}',
'.ntv3 .ntv3-pbody{flex:1;min-width:0}',
'.ntv3 .ntv3-pbody strong{display:block;font-size:13px;color:#332b56}',
'.ntv3 .ntv3-pbody small{font-size:11px;color:#786f8e}',
'.ntv3 .ntv3-period button{border:1px solid #cec4e7;background:#fff;border-radius:10px;padding:7px 10px;color:var(--nt-accent);font-weight:850;font-size:10px;margin:4px 4px 0 0}',
'.ntv3 .ntv3-period button:disabled{opacity:.45;cursor:not-allowed}',
'.ntv3 .ntv3-tag{padding:5px 9px;border-radius:22px;background:#ece6fa;color:#6a579b;font-size:10px;white-space:nowrap}',
'.ntv3 .ntv3-tag.live{background:#d7f6e5;color:#23794b}',
'.ntv3 .ntv3-tag.pending{background:#fff0d5;color:#916018}',
'.ntv3 .ntv3-progress{height:7px;border-radius:9px;background:#ede8f9;overflow:hidden;margin:14px 0 6px}',
'.ntv3 .ntv3-progress>div{height:100%;background:linear-gradient(90deg,#7567b4,#cd95d2);border-radius:9px}',
'.ntv3 .ntv3-block{display:grid;gap:9px}',
'.ntv3 .ntv3-task{padding:12px;border-radius:14px;background:#f5f3fa;font-size:12px}',
'.ntv3 .ntv3-task b{display:block;color:#40365f}',
'.ntv3 .ntv3-task small{display:block;color:#817890;margin-top:5px}',
'.ntv3 .ntv3-actionbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}',
'.ntv3 .ntv3-choice{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
'.ntv3 .ntv3-choice button{background:#faf9fd;border:1px solid #e3dff0;color:#6c6586;border-radius:13px;padding:11px 6px;font-size:10px;font-weight:800}',
'.ntv3 .ntv3-choice button[aria-pressed=true]{outline:2px solid var(--nt-accent);outline-offset:-2px;color:var(--nt-ink)}',
'.ntv3 .ntv3-swatch{display:block;border-radius:50%;width:26px;height:26px;margin:0 auto 7px;background:linear-gradient(130deg,#655aa9,#d5c5f6)}',
'.ntv3 .ntv3-choice [data-choice=rose] .ntv3-swatch{background:linear-gradient(130deg,#713950,#dca6bc)}',
'.ntv3 .ntv3-choice [data-choice=ivory] .ntv3-swatch{background:linear-gradient(130deg,#77634a,#ebd4a7)}',
'.ntv3 .ntv3-activity{display:grid;gap:0}',
'.ntv3 .ntv3-activity>div{display:flex;align-items:center;justify-content:space-between;padding:14px 4px;gap:10px;border-bottom:1px solid #f0ebf6}',
'.ntv3 .ntv3-activity>div:last-child{border:0}',
'.ntv3 .ntv3-activity strong{display:block;font-size:12px}',
'.ntv3 .ntv3-activity small{color:#847c91;font-size:11px}',
'.ntv3 .ntv3-status{color:#80788d;font-size:12px}',
'.ntv3 .ntv3-oldtools{margin-top:15px}',
'.ntv3 .ntv3-oldtools>summary{padding:14px;background:#fff;border:1px solid #e7e3f2;border-radius:13px;color:var(--nt-accent);font-weight:900;cursor:pointer}',
'.ntv3 .ntv3-oldtools .noor-teacher-studio{padding:12px 0}',
'@media(max-width:880px){.ntv3 .ntv3-cols{grid-template-columns:1fr}.ntv3 .ntv3-info{grid-template-columns:1fr 1fr}}',
'@media(max-width:590px){.ntv3 .ntv3-profile{grid-template-columns:1fr}.ntv3 .ntv3-photo{width:115px}.ntv3 .ntv3-info{grid-template-columns:1fr}.ntv3 .ntv3-period{gap:10px;padding:11px}.ntv3 .ntv3-picon{width:43px;height:43px;font-size:19px}.ntv3 .ntv3-choice{gap:5px}}',
'@media(prefers-reduced-motion:reduce){.ntv3 *{scroll-behavior:auto!important;transition:none!important}}'
].join('');document.head.append(css);
let busy=false;
const icons=(v)=>{const s=String(v||'').toLowerCase();return /math|algebra|calcul/.test(s)?'∑':/science|chem|phys|bio/.test(s)?'⚛':/language|english|urdu|hindi/.test(s)?'✎':/computer|tech/.test(s)?'⌘':'▣';};
const themeFor=id=>{try{return localStorage.getItem(themeKey(id))||'lavender'}catch{return 'lavender'}};
function applyTheme(choice){const el=document.querySelector('#workspace .app-shell'),a=app();if(!el||!a?.user)return;const theme=['lavender','rose','ivory'].includes(choice)?choice:'lavender';el.dataset.teacherLook=theme;try{localStorage.setItem(themeKey(a.user.id),theme)}catch{}
 document.querySelectorAll('.ntv3-choice [data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.choice===theme)));}
async function render(){
 const a=app(),r=root();if(!a?.user||a.profile?.role!=='teacher'||a.profile?.status!=='active'||!a.schoolId||!r||busy||r.querySelector('.ntv3'))return;
 if(document.getElementById('workspace')?.classList.contains('hidden'))return;
 busy=true;
 try{
 const db=a.db,id=a.user.id,school=a.schoolId,weekday=new Date().getDay();
 const [periods,attendance,assigned,notes,notices,runs]=await Promise.all([
 db.from('noor_teacher_periods').select('id,period_number,weekday,subject_name,class_label,start_time,end_time,status,approval_status,block_type').eq('school_id',school).eq('teacher_id',id).eq('weekday',weekday).order('start_time').limit(12),
 db.from('noor_staff_attendance').select('status,checked_in_at').eq('school_id',school).eq('teacher_id',id).order('attendance_date',{ascending:false}).limit(1),
 db.from('task_assignees').select('task_id,status').eq('school_id',school).eq('assignee_id',id).limit(15),
 db.from('noor_teacher_tasks').select('title,status,due_date').eq('school_id',school).eq('teacher_id',id).order('due_date').limit(5),
 db.from('school_notices').select('title,created_at,target_roles').eq('school_id',school).eq('is_active',true).order('created_at',{ascending:false}).limit(4),
 db.from('noor_teacher_period_runs').select('id,period_id,status').eq('school_id',school).eq('teacher_id',id).eq('class_date',new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0'))
 ]);
 let schoolTasks=[];
 if(assigned.data?.length){const lookup=await db.from('school_tasks').select('id,title,status,due_at,priority').eq('school_id',school).in('id',[...new Set(assigned.data.map(x=>x.task_id))]).limit(15);schoolTasks=lookup.data||[];}
 const noticeItems=(notices.data||[]).filter(n=>!n.target_roles?.length||n.target_roles.includes('teacher')||n.target_roles.includes('all'));
 const list=(periods.data||[]).filter(x=>x.approval_status==='approved'),pending=(periods.data||[]).filter(x=>x.approval_status!=='approved');
 const done=list.filter(x=>(runs.data||[]).some(r=>r.period_id===x.id&&r.status==='done')).length,now=new Date().toTimeString().slice(0,5);
 const profile=a.profile,avatar=profile.avatar_url?'<img src="'+safe(profile.avatar_url)+'" alt="Your profile photo">':safe((profile.full_name||'T').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase());
 const box=document.createElement('div');box.className='ntv3';box.innerHTML=
 '<div class="ntv3-header"><div><span class="ntv3-eyebrow">NOOR · TEACHER WORKSPACE</span><h1>My profile</h1></div><span class="ntv3-status">'+safe(new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</span></div>'+
 '<section class="ntv3-card ntv3-profile"><div class="ntv3-photo">'+avatar+'</div><div><div class="ntv3-userhead"><h2>'+safe(profile.full_name||'Teacher')+'</h2><button class="ntv3-pill" data-go="settings" aria-label="Edit profile photo">✎ Edit</button></div><div class="ntv3-info"><p>▣ <b>School:</b> '+safe(a.school?.name||'Your school')+'</p><p>♙ <b>Role:</b> Teacher</p><p>✉ <b>Email:</b> '+safe(profile.email||a.user.email||'')+'</p><p>☎ <b>Phone:</b> '+safe(profile.mobile_number||'Not added')+'</p><p>◷ <b>Joined:</b> '+safe(profile.created_at?new Date(profile.created_at).toLocaleDateString('en-IN'):'—')+'</p><p>✓ <b>Account:</b> '+safe(profile.status||'Active')+'</p></div><div class="ntv3-actionbar"><button class="ntv3-pill" data-go="attendance">✓ Student attendance</button><button class="ntv3-pill" data-go="teaching">✦ AI Smart Notes</button><button class="ntv3-pill" data-go="weekly-plan">Weekly assignments</button><button class="ntv3-pill" data-go="assessments">Weekly papers</button></div></div></section>'+
 '<div class="ntv3-cols"><div><section class="ntv3-card"><div class="ntv3-header"><h2>My timetable</h2><button class="ntv3-pill" data-go="schedules">View full schedule →</button></div><div class="ntv3-timeline">'+(list.length?list.map(x=>{const run=(runs.data||[]).find(r=>r.period_id===x.id),current=run?.status==='ongoing',label=run?.status==='done'?'Finished':current?'In progress':'Scheduled',tag=run?.status==='done'?'live':current?'live':'';return '<div class="ntv3-period"><div class="ntv3-picon">'+icons(x.subject_name)+'</div><div class="ntv3-pbody"><strong>'+safe(x.subject_name)+' · '+safe(x.class_label)+'</strong><small>Period '+safe(x.period_number)+' · '+safe(fmt(x.start_time))+'–'+safe(fmt(x.end_time))+'</small><div><button data-period-start="'+safe(x.id)+'" '+(run?'disabled':'')+'>Start class</button><button data-period-finish="'+safe(x.id)+'" '+(run?.status!=='ongoing'?'disabled':'')+'>Finish class</button></div></div><span class="ntv3-tag '+tag+'">'+label+'</span></div>'}).join(''):'<p class="ntv3-status">No approved periods scheduled today. Timetable requests need Principal approval.</p>')+'</div><div class="ntv3-progress"><div style="width:'+(list.length?Math.round(done/list.length*100):0)+'%"></div></div><small class="ntv3-status">'+done+' of '+list.length+' approved periods marked finished'+(pending.length?' · '+pending.length+' request(s) awaiting review':'')+'</small></section>'+
 '<section class="ntv3-card"><div class="ntv3-header"><h2>Recent activity</h2><button class="ntv3-pill" data-go="notifications">Messages →</button></div><div class="ntv3-activity">'+(attendance.data?.length?'<div><div><strong>Staff check-in</strong><small>'+safe(attendance.data[0].status)+' · '+safe(attendance.data[0].checked_in_at?new Date(attendance.data[0].checked_in_at).toLocaleString('en-IN'):'Record available')+'</small></div><span>✓</span></div>':'')+noticeItems.map(n=>'<div><div><strong>'+safe(n.title)+'</strong><small>School notice · '+safe(new Date(n.created_at).toLocaleDateString('en-IN'))+'</small></div><span>›</span></div>').join('')+(!attendance.data?.length&&!noticeItems.length?'<p class="ntv3-status">No recent records yet.</p>':'')+'</div></section></div>'+
 '<div><section class="ntv3-card"><div class="ntv3-header"><h2>Principal tasks</h2><button class="ntv3-pill" data-go="notifications">Details →</button></div><div class="ntv3-block">'+(schoolTasks.length?schoolTasks.map(t=>{const ass=assigned.data.find(x=>x.task_id===t.id);return '<div class="ntv3-task"><b>'+safe(t.title)+'</b><small>'+safe(ass?.status||t.status||'Assigned')+' · '+safe(t.due_at?new Date(t.due_at).toLocaleDateString('en-IN'):'No due date')+'</small></div>'}).join(''):'<p class="ntv3-status">No tasks delegated by Principal yet.</p>')+'</div></section>'+
 '<section class="ntv3-card"><h2>Weekly planning</h2><div class="ntv3-block">'+(notes.data?.length?notes.data.map(t=>'<div class="ntv3-task"><b>'+safe(t.title)+'</b><small>'+safe(t.status)+' · '+safe(t.due_date||'No due date')+'</small></div>').join(''):'<p class="ntv3-status">No personal tasks yet.</p>')+'</div><div class="ntv3-actionbar"><button class="ntv3-pill" data-go="weekly-plan">Assignments</button><button class="ntv3-pill" data-go="assessments">Test papers</button></div></section>'+
 '<section class="ntv3-card"><h2>Personal dashboard theme</h2><p class="ntv3-status">Choose a theme for your own teacher workspace.</p><div class="ntv3-choice"><button data-choice="lavender"><span class="ntv3-swatch"></span>Lavender</button><button data-choice="rose"><span class="ntv3-swatch"></span>Rose Gold</button><button data-choice="ivory"><span class="ntv3-swatch"></span>Ivory</button></div></section>'+
 '<section class="ntv3-card"><h2>Jinni · Notice Board</h2><p class="ntv3-status">'+noticeItems.length+' recent notices for teachers</p><button class="ntv3-pill" data-go="notices">Open notices →</button></section></div></div>';
 r.prepend(box);
 const legacy=r.querySelector('.noor-teacher-studio');
 if(legacy){const detail=document.createElement('details');detail.className='ntv3-oldtools';detail.innerHTML='<summary>Advanced tools · timetable requests, task editor & attendance calendar</summary>';r.append(detail);detail.append(legacy);}
 box.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.go){a.openView(b.dataset.go);return;}
  if(b.dataset.choice){applyTheme(b.dataset.choice);return;}
  const periodId=b.dataset.periodStart||b.dataset.periodFinish;
  if(!periodId)return;
  b.disabled=true;
  const run=(runs.data||[]).find(x=>x.period_id===periodId),status=b.dataset.periodStart?'ongoing':'done',now=new Date().toISOString();
  if(status==='done'&&run?.status!=='ongoing'){a.toast?.('Please start the class first.','error');b.disabled=false;return;}
  const date=new Date(),class_date=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  const req=run
    ?await db.from('noor_teacher_period_runs').update({status:'done',finished_at:now}).eq('id',run.id).eq('school_id',school).eq('teacher_id',id)
    :await db.from('noor_teacher_period_runs').insert({school_id:school,teacher_id:id,period_id:periodId,class_date,status:'ongoing',started_at:now});
  if(req.error){a.toast?.(req.error.message,'error');b.disabled=false;return;}
  a.toast?.(status==='done'?'Class finished for today.':'Class started for today.','success');a.openView('overview');
 });
 applyTheme(themeFor(id));
 if([periods.error,attendance.error,assigned.error,notes.error,notices.error,runs.error].some(Boolean)){const note=document.createElement('p');note.className='ntv3-status';note.textContent='Some data could not be loaded. Check your school permissions.';box.append(note)}
 }catch(e){console.warn('NOOR teacher workspace UI',e)}finally{busy=false}
}
const observer=new MutationObserver(()=>{if(root()?.querySelector('.noor-teacher-studio')&&!root()?.querySelector('.ntv3'))render();const shell=document.querySelector('#workspace .app-shell');if(shell?.dataset.teacherLook&&(document.getElementById('workspace')?.classList.contains('hidden')||app()?.profile?.role!=='teacher'))delete shell.dataset.teacherLook});
observer.observe(document.body,{subtree:true,childList:true});
})();