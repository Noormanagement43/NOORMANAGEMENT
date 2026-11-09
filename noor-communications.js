/* In-app school announcements. Database RLS, not the selected tab, chooses recipients. */
(()=>{'use strict';const A=()=>window.NOOR_AI_APP||{},E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let channel=null,key='',timer=null;
async function context(){const a=A(),uid=a.user?.id,sid=a.schoolId;if(!uid||!sid)throw Error('Sign in to your school.');const u=await a.db.auth.getUser();if(u.error||u.data?.user?.id!==uid)throw Error('Account changed.');const r=await a.db.from('institution_memberships').select('id,role,status').eq('institution_id',sid).eq('user_id',uid).eq('status','active').single();if(r.error||!r.data||r.data.status!=='active')throw r.error||Error('Active membership required.');if(A().user?.id!==uid||A().schoolId!==sid)throw Error('Account changed.');return{db:a.db,uid,sid,m:r.data,manage:['principal','school_admin','university_admin','academic_admin'].includes(r.data.role)};}
const same=c=>A().user?.id===c.uid&&A().schoolId===c.sid;
async function read(c){const [messages,seen]=await Promise.all([c.db.from('noor_school_messages').select('id,title,body,kind,audience,starts_at,created_at').eq('institution_id',c.sid).order('created_at',{ascending:false}).limit(100),c.db.from('noor_message_reads').select('message_id').eq('institution_id',c.sid).eq('membership_id',c.m.id)]);if(messages.error||seen.error)throw messages.error||seen.error;if(!same(c))throw Error('Account changed.');const ids=new Set((seen.data||[]).map(x=>x.message_id));return(messages.data||[]).map(x=>({...x,read:ids.has(x.id)}));}
async function send(c,values){
 if(!same(c)||!c.manage)throw Error('School leadership required.');
 const selected=Array.isArray(values.audience)?values.audience:[],channels=Array.isArray(values.channels)?values.channels:[];
 if(!selected.length||!channels.length)throw Error('Tick recipients and In-app or Email delivery.');
 const request_key=values.request_key||crypto.randomUUID();
 const result=await c.db.functions.invoke('noor-communications-api',{body:{
  action:'dispatch',institution_id:c.sid,request_key,kind:values.kind,
  title:String(values.title||'').trim(),body:String(values.body||'').trim(),
  audience:selected,channels,starts_at:values.kind==='meeting'?new Date(values.starts_at).toISOString():null
 }});
 if(result.error){
  let reason;try{reason=await result.error.context?.json();}catch{}
  throw Error(reason?.hint||reason?.error||result.error.message||'School communication unavailable.');
 }
 if(result.data?.error)throw Error(result.data.error);
 if(!same(c))throw Error('Account changed.');
 window.dispatchEvent(new CustomEvent('noor:school-message-saved'));
 return result.data;
}
async function mark(c,id){if(!same(c))throw Error('Account changed.');const r=await c.db.from('noor_message_reads').insert({institution_id:c.sid,membership_id:c.m.id,message_id:id});if(r.error&&r.error.code!=='23505')throw r.error;}
function cards(rows){return rows.map(m=>'<article class="np-message '+(m.read?'':'unread')+'"><small>'+E(m.kind==='email'?'School inbox':m.kind)+' · '+E(new Date(m.created_at).toLocaleDateString())+'</small><h3>'+E(m.title)+'</h3>'+(m.starts_at?'<p><b>'+E(new Date(m.starts_at).toLocaleString())+'</b></p>':'')+'<p class="np-message-body">'+E(m.body)+'</p></article>').join('')||'<p class="np-empty">No notices or meeting messages yet.</p>';}
async function refreshBell(){const b=document.getElementById('noorSchoolBell');if(!b)return;try{const c=await context(),rows=await read(c),n=rows.filter(x=>!x.read).length;if(!same(c))return;b.querySelector('[data-count]').textContent=n?String(n):'';b.setAttribute('aria-label','Notifications'+(n?', '+n+' unread':''));}catch{b.querySelector('[data-count]').textContent='';}}
async function inbox(){document.getElementById('noor-school-inbox')?.remove();const d=document.createElement('dialog');d.id='noor-school-inbox';d.className='np-inbox';d.innerHTML='<header><h2>Notifications</h2><button class="btn light" data-close type="button" aria-label="Close notifications">×</button></header><p data-status>Loading school messages…</p><div data-messages></div>';document.body.append(d);d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();try{const c=await context(),rows=await read(c);if(!same(c)||!d.isConnected)return;d.querySelector('[data-status]').textContent='Notices, meetings and school inbox messages · latest 100';d.querySelector('[data-messages]').innerHTML=cards(rows);if(rows.some(x=>!x.read)){const b=document.createElement('button');b.className='btn';b.textContent='Mark all shown as read';d.querySelector('[data-status]').after(b);b.onclick=async()=>{b.disabled=true;try{for(const m of rows.filter(x=>!x.read))await mark(c,m.id);await refreshBell();d.querySelectorAll('.unread').forEach(el=>el.classList.remove('unread'));b.textContent='All read';}catch(e){d.querySelector('[data-status]').textContent=e.message;b.disabled=false;}};}}catch(e){d.querySelector('[data-status]').textContent=e.message;}}
async function showDeliveryHistory(c,host){
 const panel=host.querySelector('[data-delivery-history]');if(!panel||!same(c)||!c.manage)return;
 const result=await c.db.from('noor_school_campaigns')
  .select('title,created_at,queued_count,accepted_count,failed_count,channels')
  .eq('institution_id',c.sid).order('created_at',{ascending:false}).limit(8);
 if(result.error){panel.textContent='Delivery status unavailable.';return;}
 panel.innerHTML=(result.data||[]).map(x=>
  '<div class="np-delivery-row"><b>'+E(x.title)+'</b><small>'+E(new Date(x.created_at).toLocaleDateString())+'</small><span>'+
   (x.channels.includes('email')?'Queued '+x.queued_count+' · Accepted by Brevo '+x.accepted_count+' · Failed/Skipped '+x.failed_count:'In-app only')+
   '</span></div>').join('')||'<p>No delivery campaigns yet.</p>';
}
async function mount(host){host.innerHTML='<section class="np-hub">Loading…</section>';try{const c=await context(),messages=await read(c);if(!same(c))return;host.innerHTML='<section class="np-hub"><h1>Notices & Meetings</h1><p>School updates, meetings and messages in one place.</p><button type="button" class="btn light" data-school-calendar>School calendar & earlier events</button>'+(c.manage?'<div class="np-hub-actions">'+[['notice','Notice','notice'],['meeting','Meeting','meeting'],['email','Email','email']].map(([key,label,icon])=>'<button type="button" data-compose="'+key+'">'+(window.NOOR_UI_POLISH?.icon(icon)||'')+'<b>'+label+'</b></button>').join('')+'</div><div class="np-email-readiness"><button type="button" class="btn light" data-email-readiness>Check Brevo email status</button><p role="status" data-email-readiness-status>Checks API and verified sender. No email will be sent.</p></div><div data-composer></div>':'')+'<section class="np-card"><h2>School messages</h2><div data-school-messages>'+cards(messages)+'</div></section>'+(c.manage?'<section class="np-card np-delivery-history"><h2>Email delivery queue</h2><div data-delivery-history>Loading…</div></section>':'')+'</section>';host.querySelector('[data-school-calendar]').onclick=()=>A().openView('school-calendar');if(c.manage)showDeliveryHistory(c,host).catch(()=>{});host.querySelector('[data-email-readiness]')?.addEventListener('click',async event=>{
 const button=event.currentTarget,status=host.querySelector('[data-email-readiness-status]');button.disabled=true;status.textContent='Checking Brevo without sending an email…';
 try{
  if(!same(c)||!c.manage)throw Error('School leadership required.');
  const response=await c.db.functions.invoke('noor-backend-api',{body:{action:'brevo.email.check',institution_id:c.sid}});
  if(response.error)throw response.error;
  if(!same(c))throw Error('Account changed.');
  const x=response.data||{},messages={BREVO_API_KEY_MISSING:'Brevo API key is not configured.',BREVO_API_KEY_REJECTED:'Brevo rejected its saved API key.',BREVO_ACCOUNT_UNAVAILABLE:'Brevo account check did not succeed.',EMAIL_FROM_MISSING:'Verified sender EMAIL_FROM must be configured server-side.',EMAIL_FROM_INVALID:'Configured sender email is invalid.',SENDER_NOT_REGISTERED:'Configured email is not registered as a Brevo sender.',SENDER_NOT_VERIFIED:'Configured Brevo sender is not verified.',BREVO_SENDERS_UNAVAILABLE:'Brevo sender verification could not be checked.',BREVO_CHECK_FAILED:'Connection check failed. Try later.'};
  status.textContent=x.delivery_ready?'Brevo API and sender verified. External email sending has not been tested.':(messages[x.reason]||'Brevo email is not verified yet.')+' No message was sent.';
 }catch(e){status.textContent='Brevo status unavailable: '+e.message;}finally{button.disabled=false;}
});host.querySelectorAll('[data-compose]').forEach(button=>button.onclick=()=>{
 const kind=button.dataset.compose,box=host.querySelector('[data-composer]');
 const roles=[['student','Students','All enrolled students'],['manager','Managers','School administrative staff'],['staff','Staff & Teachers','All teaching and other staff'],['parent','Parents','Registered parent accounts']];
 box.innerHTML='<form class="np-card np-send-form"><div class="np-compose-top"><h2>'+E(kind==='email'?'New Email':kind==='meeting'?'Schedule Meeting':'Create Notice')+'</h2><p>Compose once, choose who receives it and where it goes.</p></div>'+
 '<input type="hidden" name="kind" value="'+E(kind)+'">'+
 '<fieldset class="np-audience np-multi-audience"><legend>Send to <small>Choose one or more</small></legend><div class="np-recipient-picks">'+
 roles.map(([role,title,sub])=>'<label><input type="checkbox" name="audience" value="'+role+'"><span class="np-recipient-card"><b>'+title+'</b><small>'+sub+'</small></span></label>').join('')+'</div></fieldset>'+
 '<fieldset class="np-delivery"><legend>Delivery options</legend><div class="np-delivery-choices">'+
 '<label><input type="checkbox" name="channels" value="in_app" '+(kind==='email'?'':'checked')+'><span><b>In-app</b><small>NOOR school inbox + notification bell</small></span></label>'+
 '<label><input type="checkbox" name="channels" value="email" '+(kind==='email'?'checked':'')+'><span><b>Real Email</b><small>Send to registered school-member email addresses via Brevo</small></span></label>'+
 '</div><p>For external email, Brevo needs a verified sender. The principal email is used as From only if Brevo verifies it; otherwise the verified school sender is used with Reply-To set to the principal email.</p></fieldset>'+
 '<label>Subject<input name="title" maxlength="180" required placeholder="Enter a clear subject"></label>'+
 '<label>Message<textarea name="body" rows="5" maxlength="20000" required placeholder="Write the school message…"></textarea></label>'+
 (kind==='meeting'?'<label>Meeting date & time<input name="starts_at" type="datetime-local" required></label>':'')+
 '<button class="np-primary np-send-message" type="submit">Review & Send</button><p role="status" aria-live="polite"></p></form>';
 box.scrollIntoView({block:'nearest',behavior:'smooth'});
 const form=box.querySelector('form'),submit=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');
 form.onsubmit=async event=>{
  event.preventDefault();
  const values=new FormData(form),audience=values.getAll('audience').map(String),channels=values.getAll('channels').map(String);
  if(!audience.length||!channels.length){status.textContent='Select at least one recipient group and delivery option.';return;}
  const summary='Send '+values.get('kind')+' to '+audience.join(', ')+' via '+channels.map(x=>x==='in_app'?'In-app':'Email').join(' + ')+'?';
  if(!form.dataset.confirmed){
   status.textContent=summary+' Tap Send now to confirm.';
   submit.textContent='Send now';form.dataset.confirmed='yes';return;
  }
  submit.disabled=true;status.textContent='Saving your school message and email queue…';
  try{
   const reply=await send(c,{request_key:form.dataset.requestKey||(form.dataset.requestKey=crypto.randomUUID()),
    kind:String(values.get('kind')),title:String(values.get('title')),body:String(values.get('body')),
    starts_at:values.get('starts_at'),audience,channels});
   const channelStatus=reply.in_app_created?'In-app message published. ':'';
   const emailStatus=channels.includes('email')?reply.email_queued>0
     ?reply.email_queued+' email(s) queued for Brevo (not yet delivered). '
     :'No eligible members with verified email addresses for these groups. ':'';
   status.textContent=(reply.duplicate?'This request already exists. ':'')+channelStatus+emailStatus;
   form.dataset.confirmed='';form.dataset.requestKey='';submit.textContent='Review & Send';
   await refreshBell();
   host.querySelector('[data-school-messages]').innerHTML=cards(await read(c));
   await showDeliveryHistory(c,host);
  }catch(error){status.textContent='Not sent: '+error.message;form.dataset.confirmed='';submit.textContent='Review & Send';}
  finally{submit.disabled=false;}
 };
 form.addEventListener('input',()=>{form.dataset.confirmed='';submit.textContent='Review & Send';});
});
}catch(e){host.textContent='School messages unavailable: '+e.message;}}
async function init(){const a=A();if(!a.user?.id||!a.schoolId||!window.NOOR_ACCOUNT_CONTEXT?.enabled())return;const mini=document.querySelector('#workspace .user-mini');if(mini&&!document.getElementById('noorSchoolBell')){const b=document.createElement('button');b.id='noorSchoolBell';b.type='button';b.className='np-bell';b.innerHTML=(window.NOOR_UI_POLISH?.icon('notifications')||'')+'<span>Notifications</span><b data-count></b>';b.onclick=inbox;mini.prepend(b);}await refreshBell();const next=a.user.id+':'+a.schoolId;if(next===key)return;document.getElementById('noor-school-inbox')?.remove();if(channel)a.db.removeChannel(channel);key=next;channel=a.db.channel('noor-school-inbox-'+key);for(const table of ['noor_school_messages','noor_message_reads'])channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'institution_id=eq.'+a.schoolId},()=>{clearTimeout(timer);timer=setTimeout(()=>{refreshBell();window.dispatchEvent(new CustomEvent('noor:school-message-saved'));},150);});channel.subscribe();}
document.addEventListener('click',e=>{if(e.target.closest('#logoutBtn,#signOutSettings')){document.getElementById('noor-school-inbox')?.remove();document.querySelectorAll('.np-photo-dialog').forEach(d=>d.remove());document.getElementById('noorSchoolBell')?.remove();if(channel)A().db?.removeChannel(channel);channel=null;key='';}},true);
window.addEventListener('noor:workspace-ready',init);window.addEventListener('load',init);window.NOOR_COMMUNICATIONS=Object.freeze({context,read,send,mark,mount,inbox,init});})();
