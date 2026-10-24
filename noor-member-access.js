/* NOOR: Principal Student & Staff access panel, backed by school-scoped Supabase RPC.
 * This module never directly edits auth.users, school membership status, or academic records.
 */
(function () {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const app = () => window.NOOR_AI_APP;
  const isPrincipal = () => {
    const a=app();
    return Boolean(a?.db && a.schoolId && a.user && ['owner','principal'].includes(a.profile?.role) &&
      a.profile?.status==='active' && a.school?.verification_status==='verified' &&
      a.school?.account_status==='active' && a.school?.is_active);
  };
  let debounce=null, generation=0, people=[], selected=null, busy=false, pending=false;
  let contextKey='';
  const style=document.createElement('style');
  style.textContent=[
    '#noorMemberControl{--am:#602947;--al:#eddee6;border:1px solid var(--al);border-radius:21px;padding:18px;background:#fff;color:#392a34;box-shadow:0 9px 26px #4e203710;margin:16px 0}',
    '#noorMemberControl *{box-sizing:border-box}',
    '#noorMemberControl .ac-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
    '#noorMemberControl h2{margin:0;font:800 19px/1.2 Manrope,system-ui,sans-serif;color:var(--am)}',
    '#noorMemberControl p{color:#785e6e;font-size:13px;line-height:1.55;margin:5px 0 10px}',
    '#noorMemberControl .ac-search{width:100%;min-height:48px;border-radius:13px;background:#fff9fb;border:1px solid #dfcbd6;padding:12px 14px;font-size:15px;color:#38202c;outline-offset:2px}',
    '#noorMemberControl .ac-list{display:grid;gap:8px;max-height:330px;overflow:auto;margin-top:10px}',
    '#noorMemberControl .ac-result{width:100%;text-align:left;display:flex;align-items:center;gap:12px;border:1px solid #f0e4eb;border-radius:13px;background:#fff;padding:10px;cursor:pointer;min-height:62px;color:#3c2533}',
    '#noorMemberControl .ac-result:hover,#noorMemberControl .ac-result:focus-visible{border-color:#ae758f;background:#fff6fa}',
    '#noorMemberControl .ac-avatar{width:50px;height:56px;border-radius:9px;background:#eee2e9;color:#592b43;display:grid;place-items:center;flex:none;font-weight:800;overflow:hidden}',
    '#noorMemberControl .ac-avatar img{width:100%;height:100%;object-fit:cover}',
    '#noorMemberControl .ac-result strong{display:block;font-size:14px}',
    '#noorMemberControl .ac-result small{font-size:11px;color:#896e7d}',
    '#noorMemberControl .ac-status{display:inline-flex;padding:5px 9px;border-radius:99px;background:#edf8f0;color:#226747;font-size:11px;font-weight:800;margin-left:auto;white-space:nowrap}',
    '#noorMemberControl .ac-status.paused{background:#fff0e9;color:#9c4931}',
    '#noorMemberControl .ac-profile{margin-top:15px;border-top:1px solid #ead9e3;padding-top:15px}',
    '#noorMemberControl .ac-detail{display:flex;align-items:flex-start;gap:17px;flex-wrap:wrap}',
    '#noorMemberControl .ac-photo{height:166px;width:148px;flex:none;background:#f4e8ee;display:grid;place-items:center;color:#60344d;border-radius:14px;overflow:hidden;font:800 36px Manrope,sans-serif}',
    '#noorMemberControl .ac-photo img{width:100%;height:100%;object-fit:cover}',
    '#noorMemberControl .ac-info{min-width:0;flex:1}',
    '#noorMemberControl .ac-info h3{margin:0 0 7px;font:800 19px Manrope,sans-serif;word-break:break-word}',
    '#noorMemberControl .ac-info p{margin:3px 0;overflow-wrap:anywhere}',
    '#noorMemberControl .ac-controls{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}',
    '#noorMemberControl .ac-btn{border:1px solid #d9bbcb;border-radius:12px;background:#fff8fa;color:#672c4a;min-height:44px;padding:10px 15px;font-size:13px;font-weight:800;cursor:pointer}',
    '#noorMemberControl .ac-btn.pause{background:#fff0e9;color:#943e2b;border-color:#e6bcab}',
    '#noorMemberControl .ac-btn.reactivate{background:#e7f7ec;color:#226846;border-color:#bbdfc9}',
    '#noorMemberControl .ac-btn:disabled{opacity:.5;cursor:wait}',
    '#noorMemberControl .ac-feedback{font-size:12px;color:#725469;min-height:18px;margin-top:8px}',
    '@media(max-width:520px){#noorMemberControl{padding:14px;border-radius:17px}#noorMemberControl .ac-photo{width:128px;height:148px}#noorMemberControl .ac-detail{gap:11px}#noorMemberControl .ac-btn{flex:1;min-width:128px}#noorMemberControl .ac-search{font-size:16px}}'
  ].join('');
  document.head.appendChild(style);
  const statusLabel = person => (person?.membership?.status==='suspended' || person?.status==='inactive') ? 'Paused' :
    person?.membership?.status==='removed' ? 'Removed' :
    person?.membership?.status==='active' && person?.status==='active' ? 'Active' : 'Restricted';
  const shortInitials = name => String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x.slice(0,1).toUpperCase()).join('');
  function drawRows(root) {
    const list=$('.ac-list',root);
    if(!list)return;
    list.innerHTML=people.length ? people.map(person=>{
      const state=statusLabel(person);
      return '<button type="button" class="ac-result" data-person="'+escape(person.id)+'">'+
        '<span class="ac-avatar">'+escape(shortInitials(person.full_name))+'</span>'+
        '<span style="flex:1;min-width:0"><strong>'+escape(person.full_name)+'</strong><small>'+
        escape(person.role==='teacher'?'Teacher':'Student')+(person.roll_number?' · Roll '+escape(person.roll_number):'')+
        '</small></span><span class="ac-status '+(state==='Paused'?'paused':'')+'">'+escape(state)+'</span></button>';
    }).join(''):'<p>No matching student or teacher records found in this school.</p>';
  }
  async function findPeople(root) {
    const input=$('.ac-search',root);if(!input)return;
    const term=input.value.trim().replace(/[%_\\]/g,'');
    const thisGeneration=++generation,school=app()?.schoolId;
    const feedback=$('.ac-feedback',root),list=$('.ac-list',root);
    if(term.length<2){people=[];list.innerHTML='<p>Type at least 2 letters to search names.</p>';feedback.textContent='';return;}
    list.innerHTML='<p>Searching secure school records…</p>';
    try {
      const {data,error}=await app().db.from('profiles')
        .select('id,full_name,email,role,status,avatar_path,roll_number')
        .eq('school_id',school).in('role',['student','teacher'])
        .ilike('full_name','%'+term+'%').order('full_name').limit(35);
      if(error)throw error;
      const ids=(data||[]).map(p=>p.id);
      let memberships=[];
      if(ids.length){
        const res=await app().db.from('school_memberships')
          .select('user_id,status,role').eq('school_id',school).in('user_id',ids);
        if(res.error)throw res.error;
        memberships=res.data||[];
      }
      if(thisGeneration!==generation || !root.isConnected || school!==app()?.schoolId)return;
      const map=new Map(memberships.map(m=>[m.user_id,m]));
      people=(data||[]).map(p=>({...p,membership:map.get(p.id)||null}));
      drawRows(root);
      feedback.textContent=people.length===35?'Showing first 35 matching people. Refine the name to narrow results.':'';
    }catch(e){
      if(thisGeneration!==generation)return;
      list.textContent='Search unavailable: '+(e.message||'Check database permission.');
    }
  }
  function profileHtml(person){
    const state=statusLabel(person),allowed=['Active','Paused'].includes(state);
    const action=state==='Active'?'pause':'reactivate';
    const button=allowed?'<button type="button" class="ac-btn '+action+'" data-access="'+action+'">'+
      (action==='pause'?'Pause access':'Reactivate access')+'</button>':'';
    return '<div class="ac-detail"><div class="ac-photo" id="noorMemberPhoto">'+escape(shortInitials(person.full_name))+'</div>'+
      '<div class="ac-info"><h3>'+escape(person.full_name)+'</h3>'+
      '<p><b>'+escape(person.role==='teacher'?'Teacher':'Student')+'</b> · '+escape(state)+'</p>'+
      '<p>'+escape(person.email||'Email unavailable')+'</p>'+
      (person.roll_number?'<p>Roll no.: '+escape(person.roll_number)+'</p>':'')+
      '<p>School records remain saved when access is paused.</p>'+
      '<div class="ac-controls">'+button+'<button type="button" class="ac-btn" data-close-profile="1">Close profile</button></div>'+
      (!allowed?'<p>This membership needs a separate school administration review.</p>':'')+
      '<div class="ac-feedback" role="status" id="noorMemberActionStatus"></div></div></div>';
  }
  async function showProfile(root,id){
    selected=people.find(p=>p.id===id)||null;
    const profile=$('.ac-profile',root);
    if(!selected||!profile)return;
    const person=selected;
    profile.hidden=false;
    profile.innerHTML=profileHtml(person);
    if(person.avatar_path){
      try {
        const res=await app().db.storage.from('student-photos').createSignedUrl(person.avatar_path,300);
        if(res.error)throw res.error;
        if(selected?.id!==id || !profile.isConnected)return;
        const box=$('#noorMemberPhoto',profile);
        if(box&&res.data?.signedUrl){
          const img=document.createElement('img');img.src=res.data.signedUrl;img.alt=person.full_name+' profile photo';
          box.replaceChildren(img);
        }
      } catch(err){console.warn('Member profile photo not available',err?.message);}
    }
    profile.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  async function changeAccess(root,action){
    if(busy||!selected||!isPrincipal())return;
    if(!['pause','reactivate'].includes(action))return;
    const person=selected,school=app().schoolId;
    const label=action==='pause'?'Pause':'Reactivate';
    if(!window.confirm(label+' '+person.full_name+' ('+person.role+')? '+(action==='pause'?
      'They will lose access to this school, including existing sessions. Their records will be kept.':
      'Their existing account will be allowed into this school again.')))return;
    busy=true;
    root.querySelectorAll('[data-access]').forEach(b=>b.disabled=true);
    const feedback=$('#noorMemberActionStatus',root);
    if(feedback)feedback.textContent='Saving access status securely…';
    try {
      const {data,error}=await app().db.rpc('noor_set_member_access',{
        p_user_id:person.id,p_action:action,p_reason:null
      });
      if(error)throw error;
      if(!root.isConnected||school!==app()?.schoolId)return;
      person.membership={...person.membership,status:data.membership_status};
      person.status=data.profile_status;
      selected=person;
      $('.ac-profile',root).innerHTML=profileHtml(person);
      drawRows(root);
      app().toast?.(person.full_name+' — '+(action==='pause'?'access paused':'access reactivated')+'.','success');
    }catch(e){
      if(feedback)feedback.textContent='Could not update access: '+(e.message||'Please try again.');
      app().toast?.('Access update failed. Check Principal permissions.','error');
      root.querySelectorAll('[data-access]').forEach(b=>b.disabled=false);
    }finally{busy=false;}
  }
  function mount(){
    if(!isPrincipal())return;
    const view=$('#view-principal-studio'),dashboard=$('#noor-principal');
    if(!view?.classList.contains('active')||!dashboard)return;
    const identity=String(app().user.id)+'|'+String(app().schoolId);
    if(contextKey!==identity){contextKey=identity;people=[];selected=null;generation++;}
    if($('#noorMemberControl',dashboard))return;
    const root=document.createElement('section');root.id='noorMemberControl';
    root.setAttribute('aria-label','Principal student and staff access control');
    root.innerHTML='<div class="ac-head"><h2>Student & Staff Access</h2>'+
      '<span class="ac-status">Principal Control</span></div>'+
      '<p>Search a student or teacher by name. Open their profile photo, then pause or reactivate school access.</p>'+
      '<input class="ac-search" type="search" autocomplete="off" aria-label="Search student or teacher by name" placeholder="Search student or teacher name…">'+
      '<div class="ac-list" aria-live="polite"><p>Type at least 2 letters to search names.</p></div>'+
      '<div class="ac-profile" hidden></div><div class="ac-feedback" aria-live="polite"></div>';
    const top=$('.pd-head',dashboard);
    if(top)top.after(root);else dashboard.prepend(root);
    $('.ac-search',root).addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>findPeople(root),300);});
    root.addEventListener('click',event=>{
      const target=event.target.closest('button');if(!target||!root.contains(target))return;
      if(target.dataset.person)showProfile(root,target.dataset.person);
      else if(target.dataset.access)changeAccess(root,target.dataset.access);
      else if(target.dataset.closeProfile){selected=null;$('.ac-profile',root).hidden=true;}
    });
  }
  let mounting=false;
  const observer=new MutationObserver(()=>{
    if(mounting)return;
    if(!isPrincipal())return;
    const view=$('#view-principal-studio');
    if(!view?.classList.contains('active')||!$('#noor-principal',view)||$('#noorMemberControl',view))return;
    mounting=true;try{mount();}finally{mounting=false;}
  });
  if(document.body)observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  mount();

  // Client-side session lock follows the server-side membership policies.
  // Failed network requests do not count as suspension; the next check retries.
  let checking=false,locked=false;
  async function checkMyAccess(){
    const a=app();
    if(locked||checking||!a?.db||!a.user||!['student','teacher'].includes(a.profile?.role))return;
    if($('#workspace')?.classList.contains('hidden'))return;
    checking=true;
    try{
      const [profile,membership]=await Promise.all([
        a.db.from('profiles').select('status,school_id,role').eq('id',a.user.id).maybeSingle(),
        a.db.from('school_memberships').select('status,role').eq('user_id',a.user.id)
          .eq('school_id',a.schoolId).maybeSingle()
      ]);
      if(profile.error||membership.error)return;
      const valid=profile.data?.status==='active' &&
        profile.data?.school_id===a.schoolId &&
        profile.data?.role===a.profile.role &&
        membership.data?.status==='active' &&
        membership.data?.role===a.profile.role;
      if(valid)return;
      locked=true;
      try{sessionStorage.setItem('noor.member.access_message',
        'Your school access is paused or no longer active. Contact your Principal to reactivate your account.');}catch{}
      $('#workspace')?.classList.add('hidden');
      await a.db.auth.signOut();
      window.location.reload();
    }catch(e){console.warn('NOOR access recheck failed',e?.message);}
    finally{checking=false;}
  }
  window.setInterval(checkMyAccess,15000);
  window.addEventListener('focus',checkMyAccess);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkMyAccess();});
  try {
    const message=sessionStorage.getItem('noor.member.access_message');
    if(message){
      sessionStorage.removeItem('noor.member.access_message');
      const box=$('#authMessage');
      if(box){box.textContent=message;box.className='notice error';box.classList.remove('hidden');}
    }
  }catch{}
})();