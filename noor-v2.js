/* New NOOR standalone workspace; reads ONLY the new institution-id Supabase.
   This runs independently of the legacy school-id site. No fake KPI data.
 */
(function(){
'use strict';
const conf=window.NOOR_V2_CONFIG;
const $=selector=>document.querySelector(selector);
const root=$('#v2Root'),logout=$('#v2Logout'),toast=$('#v2Toast');
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const icons=window.NOOR_SUBJECT_ICONS;
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const managementRoles=['principal','school_admin','university_admin','academic_admin'];
const teacherRoles=['teacher','faculty'];
let db=null,authMode='signin',state={user:null,profile:null,groups:[],periods:[],memberships:[],institution:null,membership:null,tab:'home',photoUrl:null};
let channel=null,bootstrapId=0,loading=false;
function say(message,error=false){toast.textContent=message;toast.hidden=false;toast.dataset.error=error?'yes':'no';setTimeout(()=>{if(toast.textContent===message)toast.hidden=true},5200)}
function err(error){return error?.message||String(error)||'An unexpected error occurred.'}
function button(text,action,primary=false){return '<button type="button" class="v2-btn '+(primary?'v2-primary':'v2-outline')+'" data-action="'+action+'">'+text+'</button>'}
function titleBlock(title,kicker='',description=''){return '<div class="v2-title"><div><span class="v2-kicker">'+escapeHTML(kicker)+'</span><h1>'+escapeHTML(title)+'</h1><p>'+escapeHTML(description)+'</p></div></div>'}
function activeUserId(){return state.user?.id}
function canManage(){return managementRoles.includes(state.membership?.role)}
function canSchedule(){return teacherRoles.includes(state.membership?.role)}
function noData(text){return '<div class="v2-empty"><span aria-hidden="true">☁️</span><p>'+escapeHTML(text)+'</p></div>'}
function subject(name){return icons?.display(name)||{icon:'📚',tone:'general',hue:230,initials:'?',matched:false}}
function symbol(name){const x=subject(name);return '<span class="v2-subject-symbol" style="--sh:'+x.hue+'" title="'+escapeHTML(x.label||name)+'">'+x.icon+(x.matched?'':'<small>'+escapeHTML(x.initials||'?')+'</small>')+'</span>'}
function renderAuth(){
 state.tab='home';logout.hidden=true;
 root.innerHTML='<div class="v2-auth-shell"><section class="v2-auth-showcase"><div class="v2-kicker">NEW SUPABASE · VERIFIED ROLE ACCESS</div><h1>Inspire learning.<br><em>Organise everything.</em></h1><p>NOOR for schools and universities. Every account has its own picture, timetable, class records and permissions.</p><div class="v2-showcase-art"><span>✦</span><span>📘</span><span>🌿</span><span>🧮</span></div></section>'+
 '<section class="v2-panel v2-auth-card"><h2>'+(authMode==='signup'?'Create NOOR account':'Welcome to NOOR')+'</h2><p>Sign in to the new NOOR Management Supabase project.</p>'+
 '<form id="v2AuthForm" class="v2-form">'+(authMode==='signup'?'<label>Full name<input name="name" required autocomplete="name" maxlength="120"></label>':'')+
 '<label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required minlength="8" autocomplete="'+(authMode==='signin'?'current-password':'new-password')+'"></label>'+
 '<button class="v2-btn v2-primary v2-full" type="submit">'+(authMode==='signin'?'Sign in securely':'Register account')+'</button></form>'+
 '<button type="button" class="v2-text-btn" data-action="switch-auth">'+(authMode==='signin'?'New here? Create an account':'Already registered? Sign in')+'</button>'+
 '<p class="v2-footnote">School membership and profile photos are isolated using Supabase RLS. You will see only real records.</p></section></div>';
}
function renderOnboarding(){
 logout.hidden=false;
 root.innerHTML=titleBlock('Welcome to your NEW NOOR workspace','ACCOUNT CONFIRMED','This connected project has no active institution membership for your signed-in account.')+
 '<div class="v2-onboard-grid"><section class="v2-panel"><h2>Register your institution</h2><p>If this is a new school or university, create it here. Its Principal account activates immediately.</p>'+
 '<form id="v2CreateInstitution" class="v2-form"><label>School / University name<input name="name" maxlength="160" required placeholder="Institution official name"></label>'+
 '<label>Institution type<select name="type"><option value="school">School</option><option value="university">University / College</option></select></label>'+
 '<label>Unique short ID<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80" required placeholder="example-school"></label>'+
 '<button class="v2-btn v2-primary" type="submit">Create institution & open dashboard</button></form></section>'+
 '<section class="v2-panel v2-guide"><span class="v2-guide-icon">🔐</span><h2>Already cloned your school?</h2><p>There are currently no active memberships in this connected Supabase project. Sign in to the project that holds your imported schools, or verify the imported membership records.</p><p>We will not invent classes, students or attendance to fill the dashboard.</p>'+button('Re-check connected data','refresh',true)+'</section></div>';
}
function pickName(){return state.profile?.full_name||state.user?.email?.split('@')[0]||'NOOR member'}
function dateTime(t){return t?new Date(t).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'—'}
function iconMenu(){return [
 ['home','⌂','Dashboard'],
 ['timetable','◷','Timetable'],
 ['classes','▦','Classes'],
 ['profile','◉','My Profile']
 ].map(([id,ico,label])=>'<button type="button" data-tab="'+id+'" class="'+(id===state.tab?'active':'')+'"><span>'+ico+'</span><small>'+label+'</small></button>').join('')}
function shell(body){
 const inst=state.institution,role=state.membership?.role||'Member';
 const caption=role.replaceAll('_',' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
 logout.hidden=false;
 root.innerHTML='<div class="v2-layout"><aside class="v2-sidebar"><div class="v2-institution"><span class="v2-logo">✦</span><div><strong>'+escapeHTML(inst?.name||'NOOR')+'</strong><small>'+escapeHTML(inst?.institution_type||'School')+' · '+escapeHTML(caption)+'</small></div></div>'+
 '<nav aria-label="Workspace navigation">'+iconMenu()+'</nav><div class="v2-side-footer">New NOOR Management<br>Secure institution workspaces</div></aside>'+
 '<div class="v2-content">'+body+'</div></div><nav class="v2-mobile-nav" aria-label="Phone workspace navigation">'+iconMenu()+'</nav>';
}
function profileHero(){
 const name=pickName(),user=state.user;
 return '<div class="v2-profile-hero"><div class="v2-profile-photo" aria-label="Account profile photograph">'+(state.photoUrl?'<img alt="'+escapeHTML(name)+'" src="'+escapeHTML(state.photoUrl)+'">':'<span>'+escapeHTML(name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join(''))+'</span>')+'</div>'+
 '<div class="v2-profile-details"><span class="v2-kicker">'+escapeHTML(state.membership?.role.replaceAll('_',' ')||'Member')+'</span><h2>'+escapeHTML(name)+'</h2><p>'+escapeHTML(user?.email||'')+'</p><p>'+escapeHTML(state.institution?.name||'')+'</p>'+button('Edit my profile','profile',false)+'</div>'+
 '<div class="v2-profile-note"><span>❦</span><blockquote>Better learning begins with thoughtful teaching.</blockquote></div></div>';
}
function renderHome(){
 const all=state.groups,periods=state.periods;const classes=all.filter(g=>g.group_type==='class'&&g.is_active!==false),sections=all.filter(g=>g.group_type==='section'&&g.is_active!==false);
 const total=periods.length,own=periods.filter(p=>p.teacher_membership_id===state.membership.id).length;
 shell(titleBlock('Good morning, '+pickName(),'NEW NOOR · LIVE DATABASE','All counts below are read from your active school records, not demo data.')+
 profileHero()+
 '<div class="v2-metrics"><div class="v2-metric v2-blue"><span>📘</span><small>Active Classes</small><strong>'+classes.length+'</strong><p>Real academic groups</p></div>'+
 '<div class="v2-metric v2-green"><span>🌿</span><small>Sections</small><strong>'+sections.length+'</strong><p>In this institution</p></div>'+
 '<div class="v2-metric v2-rose"><span>◷</span><small>Weekly Periods</small><strong>'+total+'</strong><p>Saved timetable entries</p></div>'+
 '<div class="v2-metric v2-lilac"><span>✎</span><small>My Periods</small><strong>'+own+'</strong><p>Teacher-owned lessons</p></div></div>'+
 '<div class="v2-two-cols"><section class="v2-panel"><header><div><span class="v2-kicker">SCHEDULE</span><h2>My Teaching Timetable</h2></div>'+button('Open Timetable →','timetable',true)+'</header>'+
 (canSchedule()?periods.filter(p=>p.teacher_membership_id===state.membership.id).slice(0,4).map(periodCard).join('')||noData('No lessons created yet. Add your first period without waiting for Principal assignment.'):periods.slice(0,4).map(periodCard).join('')||noData('No published teacher periods in your school yet.'))+'</section>'+
 '<section class="v2-panel"><header><div><span class="v2-kicker">ACADEMICS</span><h2>Classes & Sections</h2></div>'+button('Explore →','classes')+'</header>'+
 (classes.length?classes.slice(0,6).map(c=>'<div class="v2-list-line"><strong>'+escapeHTML(c.name)+'</strong><small>'+sections.filter(s=>s.parent_group_id===c.id).length+' sections</small></div>').join(''):noData('No academic classes created in this database yet.'))+
 '</section></div>');
}
function groupLabel(id){const x=state.groups.find(v=>v.id===id);if(!x)return'General / not assigned';const parent=state.groups.find(v=>v.id===x.parent_group_id);return parent?parent.name+' · '+x.name:x.name}
function periodCard(row){
 const mine=canSchedule()&&row.teacher_membership_id===state.membership?.id;
 return '<div class="v2-period-row">'+symbol(row.subject_name)+'<div class="v2-period-content"><b>'+escapeHTML(row.subject_name)+'</b><small>'+escapeHTML(groupLabel(row.academic_group_id))+' · '+escapeHTML(days[row.weekday]||'')+'</small></div><div class="v2-period-time">'+escapeHTML(String(row.start_time).slice(0,5))+'–'+escapeHTML(String(row.end_time).slice(0,5))+'</div>'+
 (mine?'<button type="button" data-edit-period="'+escapeHTML(row.id)+'" class="v2-btn v2-outline">Edit</button>':'')+'</div>';
}
function renderTimetable(){
 const teacher=canSchedule(),mine=state.periods.filter(x=>x.teacher_membership_id===state.membership?.id);
 const selected=teacher?mine:state.periods;
 const grouped=days.map((label,day)=>({label,rows:selected.filter(x=>x.weekday===day)}));
 shell(titleBlock('My Weekly Timetable','FLEXIBLE TEACHER WORKSPACE','Teachers create and edit their own lessons. No Principal approval step is required.')+
 '<div class="v2-title-action">'+(teacher?button('+ Add Period','add-period',true):'<span class="v2-pill">School timetable · view only</span>')+'</div>'+
 '<div class="v2-timetable-grid">'+grouped.map(d=>'<section class="v2-panel v2-day"><header><h2>'+d.label+'</h2><span class="v2-pill">'+d.rows.length+' periods</span></header>'+
 (d.rows.length?d.rows.map(periodCard).join(''):noData('No saved periods'))+'</section>').join('')+'</div>');
}
function renderClasses(){
 const classes=state.groups.filter(x=>x.group_type==='class'),sections=state.groups.filter(x=>x.group_type==='section');
 shell(titleBlock('Classes & Sections','ACADEMIC MANAGEMENT','All entries are real, school-scoped academic groups.')+
 '<div class="v2-title-action">'+(canManage()?button('+ Create Class','new-class',true)+button('+ Add Section','new-section'):'' )+'</div>'+
 '<div class="v2-two-cols"><section class="v2-panel"><h2>Classes · '+classes.length+'</h2>'+
 (classes.length?classes.map(x=>'<div class="v2-list-line"><strong>'+escapeHTML(x.name)+'</strong><small>'+sections.filter(y=>y.parent_group_id===x.id).length+' sections</small></div>').join(''):noData('Your school has no created classes.'))+'</section>'+
 '<section class="v2-panel"><h2>Sections · '+sections.length+'</h2>'+
 (sections.length?sections.map(x=>'<div class="v2-list-line"><strong>'+escapeHTML(groupLabel(x.id))+'</strong><small>'+escapeHTML(x.code||'Section')+'</small></div>').join(''):noData('Sections have not been added yet.'))+'</section></div>');
}
function renderProfile(){
 shell(titleBlock('My Profile','PERSONAL AND PRIVATE','Your picture and name belong only to your own authenticated user ID.')+
 '<div class="v2-two-cols"><section class="v2-panel v2-edit-profile">'+profileHero()+
 '<form id="v2ProfileForm" class="v2-form"><label>Full name<input name="name" value="'+escapeHTML(state.profile?.full_name||'')+'" required maxlength="120"></label>'+
 '<label>Change my photo<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
 '<button class="v2-btn v2-primary" type="submit">Save my own profile</button></form></section>'+
 '<section class="v2-panel"><h2>Account protection</h2><p>Pictures are stored in a private bucket, grouped by your authenticated user ID. Other students cannot replace your profile.</p>'+
 '<p>Your institution: <b>'+escapeHTML(state.institution?.name)+'</b></p><p>Role: <b>'+escapeHTML(state.membership?.role)+'</b></p><p>Signed in as: <b>'+escapeHTML(state.user?.email)+'</b></p></section></div>');
}
function renderCurrent(){
 switch(state.tab){case'timetable':renderTimetable();break;case'classes':renderClasses();break;case'profile':renderProfile();break;default:renderHome()}
}
function showDialog(title,body,onSubmit){
 const existing=$('#v2Dialog');if(existing)existing.remove();
 const dialog=document.createElement('dialog');dialog.id='v2Dialog';dialog.className='v2-dialog';
 dialog.innerHTML='<form id="v2DialogForm" class="v2-form"><header><h2>'+escapeHTML(title)+'</h2><button type="button" class="v2-icon-btn" data-close>✕</button></header>'+body+
 '<p id="v2DialogStatus" role="alert" class="v2-status"></p><footer><button class="v2-btn v2-outline" type="button" data-close>Cancel</button><button class="v2-btn v2-primary" type="submit">Save changes</button></footer></form>';
 root.append(dialog);
 dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());
 dialog.querySelector('#v2DialogForm').onsubmit=async e=>{
  e.preventDefault();const b=dialog.querySelector('[type=submit]');b.disabled=true;
  try{await onSubmit(new FormData(e.target));dialog.close();await reloadSchool();say('Saved to your school database.');renderCurrent()}
  catch(error){dialog.querySelector('#v2DialogStatus').textContent=err(error)}
  finally{b.disabled=false}
 };
 dialog.showModal();
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 return dialog;
}
function openPeriod(row){
 if(!canSchedule())return say('Only teachers and faculty can edit their own timetable.',true);
 const list=state.groups.filter(g=>g.is_active!==false && ['class','section','cohort','tutorial_group','course_group'].includes(g.group_type));
 const groupOptions='<option value="">General lesson / no class</option>'+list.map(g=>'<option value="'+escapeHTML(g.id)+'" '+(g.id===row?.academic_group_id?'selected':'')+'>'+escapeHTML(groupLabel(g.id))+'</option>').join('');
 const choice=(value)=>days.map((day,idx)=>'<option value="'+idx+'" '+(Number(value)===idx?'selected':'')+'>'+day+'</option>').join('');
 const body='<div class="v2-form-grid"><label>Day<select name="weekday">'+choice(row?.weekday??new Date().getDay())+'</select></label><label>Period number<input name="period_number" type="number" required min="1" max="20" value="'+escapeHTML(row?.period_number||1)+'"></label>'+
 '<label>Start<input name="start_time" type="time" required value="'+escapeHTML(String(row?.start_time||'09:00').slice(0,5))+'"></label><label>End<input name="end_time" type="time" required value="'+escapeHTML(String(row?.end_time||'09:45').slice(0,5))+'"></label></div>'+
 '<label>Class / Section<select name="academic_group_id">'+groupOptions+'</select></label>'+
 '<label>Subject<div class="v2-subject-field"><span id="v2LiveSubject" class="v2-subject-symbol">📚</span><input name="subject_name" required maxlength="140" autocomplete="off" value="'+escapeHTML(row?.subject_name||'')+'" placeholder="Type a subject name"></div></label>'+
 '<label>Room / Lab (optional)<input name="room_label" maxlength="100" value="'+escapeHTML(row?.room_label||'')+'"></label>';
 const d=showDialog(row?'Edit my period':'Add my period',body,async form=>{
  const subjectName=String(form.get('subject_name')||'').trim(),start=String(form.get('start_time')||''),end=String(form.get('end_time')||'');
  if(!subjectName||!start||!end||start>=end)throw Error('Enter a subject and a valid period time range.');
  const payload={institution_id:state.institution.id,teacher_membership_id:state.membership.id,academic_group_id:form.get('academic_group_id')||null,
   subject_name:subjectName,weekday:Number(form.get('weekday')),period_number:Number(form.get('period_number')),start_time:start,end_time:end,room_label:form.get('room_label')||null,created_by:state.user.id};
  await window.NOOR_AVATAR_SAFE.ownUser(db,state.user.id);
  let q=row?db.from('teacher_timetable_periods').update({...payload,created_by:row.created_by}).eq('id',row.id).eq('teacher_membership_id',state.membership.id):
   db.from('teacher_timetable_periods').insert(payload);
  const {data,error}=await q.select('id').single();
  if(error||!data)throw error||Error('The period was not saved. Your teacher membership may be inactive.');
 });
 const subj=d.querySelector('input[name="subject_name"]');
 const live=d.querySelector('#v2LiveSubject');
 const update=()=>{const x=subject(subj.value);live.textContent=x.icon+(x.matched?'':' '+(x.initials||''));live.style.setProperty('--sh',String(x.hue));};
 subj.addEventListener('input',update);update();
}
function newGroup(type){
 if(!canManage())return say('Only authorised school managers can create classes.',true);
 const classes=state.groups.filter(g=>g.group_type==='class');
 const body='<label>'+ (type==='class'?'Class name':'Section name') +'<input name="name" maxlength="120" required placeholder="'+(type==='class'?'Class 1':'Section A')+'"></label>'+
 '<label>Code (optional)<input name="code" maxlength="40"></label>'+
 (type==='section'?'<label>Parent class<select name="parent_group_id" required><option value="">Choose a class</option>'+
 classes.map(c=>'<option value="'+escapeHTML(c.id)+'">'+escapeHTML(c.name)+'</option>').join('')+'</select></label>':'')+
 '<label>Capacity (optional)<input name="capacity" type="number" min="1"></label>';
 showDialog(type==='class'?'Create School Class':'Add Class Section',body,async f=>{
  const name=String(f.get('name')||'').trim();if(!name)throw Error('Enter the class or section name.');
  const payload={institution_id:state.institution.id,group_type:type,name,code:String(f.get('code')||'').trim()||null,
   capacity:f.get('capacity')?Number(f.get('capacity')):null};
  if(type==='section')payload.parent_group_id=f.get('parent_group_id')||null;
  const {data,error}=await db.from('academic_groups').insert(payload).select('id').single();
  if(error||!data)throw error||Error('Class could not be created.');
 });
}
async function reloadSchool(){
 const m=state.membership;
 if(!m)return;
 const current=await db.auth.getUser();
 if(current.error||current.data?.user?.id!==state.user.id)throw Error('Your session changed. Sign in again.');
 const [institution,groups,periods,profile]=await Promise.all([
  db.from('institutions').select('id,name,institution_type,status').eq('id',m.institution_id).maybeSingle(),
  db.from('academic_groups').select('id,institution_id,parent_group_id,name,code,group_type,is_active').eq('institution_id',m.institution_id).order('name').limit(500),
  db.from('teacher_timetable_periods').select('id,institution_id,academic_group_id,teacher_membership_id,created_by,subject_name,weekday,period_number,start_time,end_time,room_label').eq('institution_id',m.institution_id).order('weekday').order('start_time').limit(500),
  db.from('profiles').select('id,full_name,avatar_url').eq('id',state.user.id).maybeSingle()
 ]);
 for(const x of [institution,groups,periods,profile])if(x.error)throw x.error;
 if(institution.data?.status!=='active')throw Error('Your school has not been activated.');
 state.institution=institution.data;state.groups=groups.data||[];state.periods=periods.data||[];state.profile=profile.data||state.profile;
 const ref=state.profile?.avatar_url||'';
 state.photoUrl=ref?await window.NOOR_AVATAR_SAFE.signedUrl({client:db,storedReference:ref,userId:state.user.id}):null;
}
async function bootstrap(){
 if(loading)return;const token=++bootstrapId;loading=true;
 try{
  if(!db){root.innerHTML='<p class="v2-error">The new Supabase library did not load. Check your connection.</p>';return}
  const auth=await db.auth.getUser();if(token!==bootstrapId)return;
  if(auth.error||!auth.data?.user){state={user:null,profile:null,groups:[],periods:[],memberships:[],institution:null,membership:null,tab:'home',photoUrl:null};renderAuth();return}
  const user=auth.data.user;state.user=user;logout.hidden=false;
  const [profile,memberships]=await Promise.all([
   db.from('profiles').select('id,full_name,avatar_url').eq('id',user.id).maybeSingle(),
   db.from('institution_memberships').select('id,user_id,institution_id,role,status').eq('user_id',user.id).eq('status','active').limit(20)
  ]);
  if(token!==bootstrapId)return;
  if(profile.error||memberships.error)throw profile.error||memberships.error;
  state.profile=profile.data;state.memberships=memberships.data||[];
  if(!state.profile){
   const name=user.user_metadata?.full_name||user.email?.split('@')[0]||'NOOR member';
   const res=await db.from('profiles').insert({id:user.id,full_name:name}).select('id,full_name,avatar_url').single();
   if(res.error)throw res.error;state.profile=res.data;
  }
  if(!state.memberships.length){state.membership=null;renderOnboarding();return}
  const remembered=sessionStorage.getItem('noor.v2.selected-institution');
  state.membership=state.memberships.find(m=>m.institution_id===remembered)||state.memberships[0];
  await reloadSchool();if(token!==bootstrapId)return;
  renderCurrent();
  if(channel)await db.removeChannel(channel);
  channel=db.channel('noor-v2-live-'+state.institution.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'teacher_timetable_periods',filter:'institution_id=eq.'+state.institution.id},async()=>{try{await reloadSchool();renderCurrent()}catch(e){console.warn('Timetable sync failed',e)}})
   .subscribe();
 }catch(e){console.error('NOOR v2 workspace:',e);root.innerHTML='<section class="v2-panel v2-main-error"><h2>New NOOR account needs attention</h2><p>'+escapeHTML(err(e))+'</p>'+button('Retry','refresh',true)+'</section>'}
 finally{loading=false}
}
async function submitAuth(form){
 const f=new FormData(form),email=String(f.get('email')||'').trim(),password=String(f.get('password')||'');
 const button=form.querySelector('[type="submit"]');button.disabled=true;
 try{
  if(authMode==='signup'){
   const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:String(f.get('name')||'').trim()}}});
   if(error)throw error;
   if(data.session)await bootstrap();else say('Account created. Confirm your email before signing in.');
  }else{
   const {data,error}=await db.auth.signInWithPassword({email,password});
   if(error)throw error;
   if(!data.user)throw Error('Sign-in was not completed.');
   await bootstrap();
  }
 }catch(e){say(err(e),true)}
 finally{button.disabled=false}
}
async function saveProfile(form){
 const f=new FormData(form),u=state.user,p=state.profile;
 if(!u||!p||p.id!==u.id)throw Error('Account identity mismatch. Sign in again.');
 await window.NOOR_AVATAR_SAFE.ownUser(db,u.id);
 const file=f.get('photo');
 if(file instanceof File && file.size){
  const result=await window.NOOR_AVATAR_SAFE.uploadOwn({client:db,userId:u.id,profile:p,file,backend:'v2'});
  state.photoUrl=result.avatar_url;
 }
 const fullName=String(f.get('name')||'').trim();if(!fullName)throw Error('Enter your name.');
 await window.NOOR_AVATAR_SAFE.ownUser(db,u.id);
 const {data,error}=await db.from('profiles').update({full_name:fullName}).eq('id',u.id).select('id,full_name,avatar_url').single();
 if(error||data?.id!==u.id)throw error||Error('No profile was updated.');
 state.profile=data;
 await reloadSchool();renderProfile();say('Your own profile was updated.');
}
root.addEventListener('click',async event=>{
 const nav=event.target.closest('[data-tab]');if(nav){state.tab=nav.dataset.tab;renderCurrent();return}
 const action=event.target.closest('[data-action]');if(action){
  switch(action.dataset.action){
   case'switch-auth':authMode=authMode==='signin'?'signup':'signin';renderAuth();break;
   case'profile':state.tab='profile';renderCurrent();break;
   case'timetable':state.tab='timetable';renderCurrent();break;
   case'classes':state.tab='classes';renderCurrent();break;
   case'add-period':openPeriod(null);break;
   case'new-class':newGroup('class');break;
   case'new-section':newGroup('section');break;
   case'refresh':bootstrap();break;
  }
  return;
 }
 const edit=event.target.closest('[data-edit-period]');if(edit){const p=state.periods.find(x=>x.id===edit.dataset.editPeriod);if(p)openPeriod(p)}
});
root.addEventListener('submit',async event=>{
 const id=event.target.id;
 if(!['v2AuthForm','v2CreateInstitution','v2ProfileForm'].includes(id))return;
 event.preventDefault();const b=event.target.querySelector('[type=submit]');if(b)b.disabled=true;
 try{
  if(id==='v2AuthForm')await submitAuth(event.target);
  if(id==='v2ProfileForm')await saveProfile(event.target);
  if(id==='v2CreateInstitution'){
   const f=new FormData(event.target),p={p_name:String(f.get('name')||'').trim(),p_slug:String(f.get('slug')||'').trim(),p_type:String(f.get('type')||'school')};
   const {error}=await db.rpc('register_institution_for_current_user',p);
   if(error)throw error;
   await bootstrap();say('Your new institution has been created.');
  }
 }catch(e){say(err(e),true)}
 finally{if(b)b.disabled=false}
});
logout.onclick=async()=>{if(db){await db.auth.signOut();if(channel)await db.removeChannel(channel)}state.user=null;state.membership=null;renderAuth()};
$('#v2Theme').onclick=()=>{
 const all=['pastel-aurora','linen-pearl','porcelain-blue','rose-whisper','rose-gold'];
 const now=document.documentElement.dataset.noorTheme;
 const next=all[(all.indexOf(now)+1)%all.length];
 document.documentElement.dataset.noorTheme=next;
 try{localStorage.setItem('noor.v2.theme',next)}catch{}
 say('Theme: '+next.replaceAll('-',' '));
};
try{
 const saved=localStorage.getItem('noor.v2.theme');if(['pastel-aurora','linen-pearl','porcelain-blue','rose-whisper','rose-gold'].includes(saved))document.documentElement.dataset.noorTheme=saved;
 if(!window.supabase?.createClient)throw Error('Supabase JavaScript could not be loaded.');
 db=window.supabase.createClient(conf.SUPABASE_URL,conf.SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.sessionStorage,storageKey:'noor.v2.auth.'+new URL(conf.SUPABASE_URL).hostname}
 });
 db.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'){state.user=null;state.membership=null;renderAuth()}
  else if(event==='SIGNED_IN'&&session?.user?.id&&state.user?.id&&session.user.id!==state.user.id){
   state.user=null;state.membership=null;renderAuth();setTimeout(bootstrap,0);
  }
 });
 bootstrap();
}catch(error){root.innerHTML='<section class="v2-panel v2-main-error"><h2>NOOR new database connection is unavailable</h2><p>'+escapeHTML(err(error))+'</p></section>'}
})();
