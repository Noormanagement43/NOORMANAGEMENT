/* Existing NOOR login/forms -> destination institution APIs. No privileged keys. */
(()=>{'use strict';
const enabled=()=>window.NOOR_ACCOUNT_CONTEXT?.enabled();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function register(db,user,setup){
 const auth=await db.auth.getUser();if(auth.error||auth.data?.user?.id!==user.id)throw Error('Sign in again before finishing school setup.');
 const existing=await db.from('institution_memberships').select('id,institution_id,role,status').eq('user_id',user.id);if(existing.error)throw existing.error;
 if(existing.data?.some(m=>m.status==='active'))return {institution_id:existing.data.find(m=>m.status==='active').institution_id,existing:true};
 if(existing.data?.length)throw Error('Your existing school access needs management review. Do not create another school.');
 const name=String(setup.school_name||'').trim();if(name.length<2||name.length>160)throw Error('Enter a school name between 2 and 160 characters.');
 const slug=(name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'school')+'-'+crypto.randomUUID().slice(0,8);
 const r=await db.rpc('register_institution_for_current_user',{p_name:name,p_slug:slug,p_type:setup.institution_type==='university'?'university':'school'});if(r.error)throw r.error;return r.data;
}
async function join(db,institution,code,expectedUserId,kind){
 const auth=await db.auth.getUser();if(auth.error||!auth.data?.user||expectedUserId&&auth.data.user.id!==expectedUserId)throw Error('Your sign-in changed. Please sign in again.');
 if(!uuid.test(String(institution)))throw Error('Select your school from the name suggestions.');
 if(!String(code||'').trim())throw Error('Enter the joining code shared by your principal.');
 const r=await db.rpc(kind?'noor_join_selected_institution':'noor_join_institution',{p_institution:institution,p_code:code.trim(),...(kind?{p_kind:kind}:{})});if(r.error)throw r.error;return r.data;
}
function boundDraft(raw,user){if(!raw)return null;try{const d=JSON.parse(raw);return d.pending_auth_uid===user.id&&d.pending_email===String(user.email||'').toLowerCase()&&Date.now()-Number(d.pending_created_at||0)<7*86400000?d:null;}catch{return null;}}
function install({db,enter,message,showLogin,redirectTo}){
 if(!enabled()||!db)return;
 const $=id=>document.getElementById(id),value=id=>$(id)?.value?.trim()||'';
 const generic=e=>/Invalid login credentials/i.test(e?.message||'')?'Email or password is incorrect. If needed, use Forgot password.':/Email not confirmed/i.test(e?.message||'')?'Verify your email before signing in. Use Resend verification email.':/schema cache|does not exist|Could not find/i.test(e?.message||'')?'School setup could not finish. Your account is preserved; please refresh and retry.':e?.message||'Could not complete this request.';
 function capture(id,callback){const el=$(id);if(!el)return;el.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const button=el.querySelector('[type="submit"]');if(button?.disabled)return;if(button)button.disabled=true;try{await callback();}catch(error){message(generic(error),'error');}finally{if(button)button.disabled=false;}},true);}
 function showCodes(institution,codes){
  const old=$('canonicalCodes');if(old)old.remove();const panel=document.createElement('div');panel.id='canonicalCodes';panel.className='modal-backdrop show';panel.style.cssText='display:grid;place-items:center;position:fixed;inset:0;z-index:200;background:#20101c99;padding:20px;overflow:auto';
  const card=document.createElement('section');card.className='auth-card';card.style.cssText='max-width:560px;width:100%;padding:24px';
  const title=document.createElement('h2');title.textContent='School created — save your joining details';card.append(title);
  const hint=document.createElement('p');hint.textContent='Share your school name and the correct Student or Staff code. Management codes can be set separately in Settings. Codes remain active until you change them in Settings.';card.append(hint);
  for(const [name,val] of [['Student Joining Code',codes.student||'Not generated — retry from school setup'],['Staff Joining Code',codes.teacher||'Not generated — retry from school setup']]){const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.readOnly=true;input.value=val;input.style.cssText='width:100%;margin:8px 0 14px';input.onclick=()=>input.select();card.append(label,input);}
  const share=document.createElement('button');share.type='button';share.className='btn light';share.textContent='Copy school joining link';share.onclick=async()=>{const link=new URL(redirectTo);link.searchParams.set('school',institution);try{await navigator.clipboard.writeText(link.href);share.textContent='School link copied — share code separately';}catch{message('Share your school name and the correct joining code.','info');}};card.append(share);
  const close=document.createElement('button');close.className='btn';close.textContent='Continue to dashboard';close.onclick=()=>panel.remove();card.append(close);panel.append(card);document.body.append(panel);
 }
 async function create(user,draft){
  const r=await register(db,user,draft);localStorage.removeItem('noor.pendingOwnerSetup');
  const codes={};if(!r.existing){for(const role of ['student','teacher']){const c=await db.rpc('noor_rotate_join_code',{p_institution:r.institution_id,p_role:role});if(!c.error)codes[role]=c.data;} }
  await enter(user);if(!r.existing)showCodes(r.institution_id,codes);
 }
 function finish(user){
  $('loginForm').classList.add('hidden');let panel=$('finishSchoolSetup');if(panel)panel.remove();panel=document.createElement('section');panel.id='finishSchoolSetup';panel.className='notice info';
  panel.innerHTML='<h3>Finish your school connection</h3><p>Your account is signed in. No school membership has been saved yet.</p><form id="finishCreateSchool"><label>Institution type<select name="institution_type"><option value="school">School</option><option value="university">College / University</option></select></label><label>New school name<input name="school" minlength="2" maxlength="160" required></label><button type="submit" class="btn">Create my school & open Principal dashboard</button></form><hr><form id="finishJoinSchool"><label>School / university name<input name="institution" required></label><label>Joining group<select name="kind"><option value="student">Student</option><option value="teacher">Staff / Teacher</option><option value="manager">Management</option></select></label><label>Student / Staff Joining Code<input name="code" required autocomplete="off" maxlength="128"></label><button type="submit" class="btn">Join my school</button></form><p>Existing teachers and students should use the school details from their principal.</p>';
  $('loginForm').after(panel);window.NOOR_INSTITUTION_ACCESS?.picker($('finishJoinSchool').elements.institution,db);
  capture('finishCreateSchool',async()=>{await create(user,{school_name:$('finishCreateSchool').elements.school.value,institution_type:$('finishCreateSchool').elements.institution_type.value});panel.remove();});
  capture('finishJoinSchool',async()=>{const f=$('finishJoinSchool');await join(db,f.elements.institution.dataset.institution,f.elements.code.value,user.id,f.elements.kind.value);panel.remove();await resume(user);});
 }
 async function resume(user){
  const profile=await window.NOOR_ACCOUNT_CONTEXT.profile(db,user.id);if(profile.error)throw profile.error;
  if(profile.data?.status==='active'){let choice;try{choice=JSON.parse(sessionStorage.getItem('noor.pendingClass')||'null');}catch{}if(choice?.user_id===user.id&&choice.institution===profile.data.institution_id&&['student','teacher'].includes(profile.data.role)){const selected=await db.rpc(profile.data.role==='teacher'?'noor_select_teacher_section':'noor_select_student_section',{p_institution:choice.institution,p_class:choice.class_id,p_section:choice.section_id});if(selected.error)throw selected.error;sessionStorage.removeItem('noor.pendingClass');Object.assign(profile.data,{class_id:choice.class_id,section_id:choice.section_id});}localStorage.removeItem('noor.pendingOwnerSetup');/* Existing active members can enter; class setup must not block login. */await enter(user);return;}
  if(profile.data?.status==='inactive')throw Error('Your school access is paused. Ask your principal to reactivate the same account.');
  const draft=boundDraft(localStorage.getItem('noor.pendingOwnerSetup'),user);if(draft){await create(user,draft);return;}
  let pending;try{pending=JSON.parse(sessionStorage.getItem('noor.pendingJoin')||'null');}catch{}
  const meta=user.user_metadata||{};
  if(pending?.user_id===user.id){try{await join(db,pending.institution,pending.code,user.id,pending.kind);}catch(error){sessionStorage.removeItem('noor.pendingJoin');finish(user);message('Your account is preserved. Select your school and enter the correct code. '+generic(error),'error');return;}sessionStorage.removeItem('noor.pendingJoin');await resume(user);return;}
  if(meta.school_id&&meta.noor_join_code){await join(db,meta.school_id,meta.noor_join_code,user.id);await resume(user);return;}
  if(meta.noor_parent_intent){message('Your parent account is ready. Your principal must link it to your child before school access opens.','info');return;}
  finish(user);
 }
 capture('loginForm',async()=>{const r=await db.auth.signInWithPassword({email:value('loginEmail'),password:$('loginPassword').value});if(r.error)throw r.error;if(!r.data?.user)throw Error('Sign-in did not finish.');await resume(r.data.user);});
 capture('ownerRegisterForm',async()=>{
  const password=$('ownerPassword').value;if(password!==$('ownerConfirmPassword').value)throw Error('Passwords do not match.');
  const email=value('ownerOfficialEmail'),draft={school_name:value('ownerSchoolName'),institution_type:value('ownerInstitutionType')||'school',pending_email:email.toLowerCase(),pending_created_at:Date.now()};
  const r=await db.auth.signUp({email,password,options:{data:{full_name:value('ownerFullName'),noor_onboarding:{school_name:draft.school_name,office_phone:value('ownerContactPhone')}},emailRedirectTo:redirectTo}});if(r.error)throw r.error;if(!r.data?.user)throw Error('Account was not created.');
  if(r.data.user.identities?.length===0)throw Error('This account may already exist. Sign in with its password to finish school setup.');
  localStorage.setItem('noor.pendingOwnerSetup',JSON.stringify({...draft,pending_auth_uid:r.data.user.id}));
  if(r.data.session)await create(r.data.user,draft);else{showLogin();$('loginEmail').value=email;message('Account created. Verify your email, then sign in here to finish creating the school.','success');}
 });
 for(const kind of ['student','staff'])capture(kind==='student'?'registerForm':'staffJoinForm',async()=>{
  const student=kind==='student',email=value(student?'studentEmail':'joinStaffEmail'),password=$(student?'studentPassword':'joinStaffPassword').value;
  if(password!==$(student?'studentConfirmPassword':'joinStaffConfirmPassword').value)throw Error('Passwords do not match.');
  const institution=$(student?'schoolSelect':'joinStaffSchoolSelect')?.dataset.institution,code=value(student?'joinCode':'joinStaffCode'),joiningKind=student?'student':value('joinStaffRole')==='manager'?'manager':'teacher';if(!uuid.test(institution)||!code)throw Error('Select your school by name and enter its joining code.');
  const choice=joiningKind==='manager'?null:window.NOOR_SIGNUP_GROUPS?.validate(student?'student':'teacher');
  const r=await db.auth.signUp({email,password,options:{data:{full_name:value(student?'studentName':'joinFullName'),mobile_number:value(student?'studentMobile':'joinStaffMobile'),parent_name:student?value('parentName'):undefined,roll_number:student?value('rollNumber'):undefined},emailRedirectTo:redirectTo}});if(r.error)throw r.error;if(!r.data?.user||r.data.user.identities?.length===0)throw Error('This account may already exist. Sign in instead.');
  const photo=document.getElementById(student?'studentPhoto':'joinStaffPhoto')?.files?.[0];if(photo){if(!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size>3*1024*1024)throw Error('Use a JPG, PNG or WebP photo under 3 MB.');const photoData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read your profile photo.'));reader.readAsDataURL(photo);});sessionStorage.setItem('noor.pendingPhotoData.'+r.data.user.id,photoData);}
  sessionStorage.setItem('noor.pendingJoin',JSON.stringify({user_id:r.data.user.id,institution,code,kind:joiningKind}));if(choice)sessionStorage.setItem('noor.pendingClass',JSON.stringify({user_id:r.data.user.id,institution,...choice}));
  if(r.data.session){try{await join(db,institution,code,r.data.user.id,joiningKind);}catch(error){sessionStorage.removeItem('noor.pendingJoin');finish(r.data.user);message('Account created. Select your school and retry its joining code. '+generic(error),'error');return;}sessionStorage.removeItem('noor.pendingJoin');await resume(r.data.user);}else{showLogin();$('loginEmail').value=email;message('Verify your email, then sign in. Your school connection will finish securely.','success');}
 });
 if(document.createElement&&document.querySelector){
 const parentTab=document.createElement('button');parentTab.type='button';parentTab.className='tab';parentTab.textContent='Parent sign-up';const parentForm=document.createElement('form');parentForm.id='noorParentRegister';parentForm.className='hidden';parentForm.innerHTML='<h3>Create parent account</h3><p>Verify your own email first. Your principal must then link your account to your child in People & Access.</p><label>Full name<input name="full_name" maxlength="120" required autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><label>Confirm password<input name="confirm" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn full" type="submit">Create parent account</button>';
 const tabs=document.querySelector('.tabs');if(tabs){tabs.append(parentTab);$('staffJoinForm').after(parentForm);parentTab.onclick=()=>{document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));parentTab.classList.add('active');$('authTitle').textContent='Parent registration';$('authSubtitle').textContent='Create your account, verify your email, then ask the principal to link your child.';for(const id of ['loginForm','registerForm','ownerRegisterForm','staffJoinForm','recoveryForm'])$(id)?.classList.add('hidden');parentForm.classList.remove('hidden');};for(const id of ['loginTab','registerTab','ownerTab','joinTab'])$(id)?.addEventListener('click',()=>{parentForm.classList.add('hidden');parentTab.classList.remove('active');});capture('noorParentRegister',async()=>{const f=parentForm.elements;if(f.password.value!==f.confirm.value)throw Error('Passwords do not match.');const r=await db.auth.signUp({email:f.email.value.trim(),password:f.password.value,options:{data:{full_name:f.full_name.value.trim(),noor_parent_intent:true},emailRedirectTo:redirectTo}});if(r.error)throw r.error;if(!r.data?.user||r.data.user.identities?.length===0)throw Error('Account may already exist. Sign in instead.');parentForm.classList.add('hidden');showLogin();$('loginEmail').value=f.email.value.trim();message('Account created. Verify your email; ask your principal to link your child before signing in.','success');});}
 }
 return {resume};
}
function prepare(){
 if(!enabled())return;
 for(const id of ['schoolSelect','joinStaffSchoolSelect']){const el=document.getElementById(id);if(!el)continue;let input=el;if(el.tagName==='SELECT'){input=document.createElement('input');input.id=id;input.type='text';input.required=true;el.replaceWith(input);}window.NOOR_INSTITUTION_ACCESS?.picker(input,window.NOOR_AI_APP?.db);document.querySelector('label[for="'+id+'"]')?.replaceChildren(document.createTextNode('School / university name *'));}
 const staffForm=document.querySelector('#staffJoinForm .formgrid');if(staffForm){const school=document.getElementById('joinStaffSchoolSelect')?.closest('.field'),code=document.getElementById('joinStaffCode')?.closest('.field');if(school&&code){staffForm.prepend(code);staffForm.prepend(school);}}
 for(const [id,text] of [['btnRoleTeacher','Staff / Teacher Joining Code *'],['btnRoleManagement','Management Joining Code *']]){const button=document.getElementById(id);if(button&&!button.dataset.canonicalLabel){button.dataset.canonicalLabel='yes';button.addEventListener('click',()=>{document.querySelector('label[for="joinStaffCode"]').textContent=text;});}}
 const studentForm=document.querySelector('#registerForm .formgrid');if(studentForm){const school=document.getElementById('schoolSelect')?.closest('.field'),code=document.getElementById('joinCode')?.closest('.field');if(school&&code){studentForm.prepend(code);studentForm.prepend(school);}}

 for(const id of ['ownerStudentJoinCode','ownerStaffJoinCode']){const input=document.getElementById(id);if(input){input.required=false;input.disabled=true;input.closest('.field').hidden=true;}}
 for(const id of ['joinCode','joinStaffCode']){const code=document.getElementById(id);if(code){code.maxLength=128;code.removeAttribute('pattern');code.inputMode='text';}}
 window.NOOR_SIGNUP_GROUPS?.install(window.NOOR_AI_APP?.db);
 const note=document.querySelector('#ownerRegisterForm .notice');if(note)note.textContent='Create your school once. Secure Student and Staff joining codes are generated after the school is saved.';
 const schoolName=document.getElementById('ownerSchoolName');if(schoolName)schoolName.maxLength=160;
 const photo=document.getElementById('studentPhoto');if(photo)photo.required=false;
 const staffPhoto=document.getElementById('joinStaffPhoto');if(staffPhoto)staffPhoto.required=false;
}
window.NOOR_CANONICAL_ONBOARDING={enabled,register,join,boundDraft,install,prepare};
})();
