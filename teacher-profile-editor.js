/* NOOR Teacher: editable own profile name and mobile number. Photo remains in Settings. */
(()=>{'use strict';
const a=()=>window.NOOR_AI_APP;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css=document.createElement('style');css.textContent=[
'.nt-profile-backdrop{position:fixed;inset:0;background:#1e193d91;z-index:100040;display:flex;align-items:center;justify-content:center;padding:15px}',
'.nt-profile-modal{width:min(450px,100%);max-height:95vh;overflow:auto;background:white;border-radius:23px;padding:24px;box-shadow:0 20px 70px #24173f55;color:#302950}',
'.nt-profile-modal h2{margin:0 0 5px;font-size:21px;color:#382f60}',
'.nt-profile-modal p{font-size:12px;color:#776e89}',
'.nt-profile-modal label{display:grid;gap:6px;margin:15px 0;font-size:12px;font-weight:800;color:#4c416f}',
'.nt-profile-modal input{border:1px solid #e0d9ef;padding:12px;border-radius:12px;font:inherit;color:#332a53}',
'.nt-profile-modal .nt-buttons{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}',
'.nt-profile-modal button{border-radius:12px;border:1px solid #ddd6ed;padding:11px 15px;background:#f3effc;color:#5a4c98;font-weight:800;cursor:pointer}',
'.nt-profile-modal button.nt-save{background:#6255a5;color:white}',
'.nt-profile-modal button:disabled{opacity:.55}'
].join('');document.head.append(css);
function edit(){
 const app=a();if(!app||app.profile?.role!=='teacher'||!app.user||!app.schoolId)return;
 if(document.querySelector('.nt-profile-backdrop'))return;
 const el=document.createElement('div');el.className='nt-profile-backdrop';el.setAttribute('role','presentation');
 el.innerHTML='<form class="nt-profile-modal" role="dialog" aria-modal="true" aria-label="Edit Teacher personal profile"><h2>Edit personal details</h2><p>Update your display name and phone number. School, role and permissions remain managed by the Principal.</p><label>Full name<input name="full_name" maxlength="140" required value="'+esc(app.profile.full_name||'')+'"></label><label>Phone number<input name="mobile_number" maxlength="25" inputmode="tel" placeholder="Optional" value="'+esc(app.profile.mobile_number||'')+'"></label><div class="nt-buttons"><button type="button" data-close>Cancel</button><button class="nt-save" type="submit">Save changes</button></div><p id="ntProfileError" role="status"></p></form>';
 document.body.append(el);
 const close=()=>el.remove();
 el.querySelector('[data-close]').onclick=close;el.addEventListener('click',e=>{if(e.target===el)close()});
 el.querySelector('input[name="full_name"]').focus();
 const form=el.querySelector('form');
 form.onsubmit=async ev=>{
  ev.preventDefault();const full_name=form.elements.full_name.value.trim(),mobile_number=form.elements.mobile_number.value.trim();
  const b=form.querySelector('button[type=submit]');if(!full_name)return;
  b.disabled=true;
  const update=await app.db.from('profiles').update({full_name,mobile_number:mobile_number||null,updated_at:new Date().toISOString()}).eq('id',app.user.id).eq('school_id',app.schoolId).select('id,full_name,mobile_number').maybeSingle();
  if(update.error||!update.data){form.querySelector('#ntProfileError').textContent=update.error?.message||'Could not update profile. Check school permissions.';b.disabled=false;return;}
  app.profile.full_name=update.data.full_name;app.profile.mobile_number=update.data.mobile_number;
  for(const id of ['topName','sideUserName']){const el=document.getElementById(id);if(el)el.textContent=full_name;}
  close();app.toast?.('Profile details updated.','success');app.openView('overview');
 };
}
const obs=new MutationObserver(()=>{const card=document.querySelector('#view-overview .ntv3-profile .ntv3-actionbar');
 if(!card||card.querySelector('#ntEditProfileDetails')||a()?.profile?.role!=='teacher')return;
 const btn=document.createElement('button');btn.type='button';btn.className='ntv3-pill';btn.id='ntEditProfileDetails';btn.textContent='✎ Edit personal details';btn.onclick=edit;card.append(btn);
});
obs.observe(document.body,{childList:true,subtree:true});
})();