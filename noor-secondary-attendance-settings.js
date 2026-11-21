/* School-scoped selection for the Secondary Attendance reference chart. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const leadership=new Set(['principal','school_admin','university_admin','academic_admin']);
let revision=0;
const rank=c=>{const name=String(c.name||'').trim().toLowerCase(),m=name.match(/\d+/);if(m)return Number(m[0]);const words={first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10};const w=name.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/);return w?words[w[1]]:9999;};
function standardIds(classes){return classes.filter(c=>(c.education_path||'school')==='school'&&rank(c)>=6&&rank(c)<=10).map(c=>String(c.id));}
async function mount(root){
 if(!root)return;
 const token=++revision,app=A(),uid=app.user?.id,sid=app.schoolId,db=app.db;
 if(!uid||!sid||!db){root.replaceChildren();return;}
 root.innerHTML='<section class="panel noor-secondary-settings"><p role="status">Loading Secondary Attendance settings…</p></section>';
 const valid=()=>token===revision&&root.isConnected&&A().user?.id===uid&&A().schoolId===sid;
 try{
  const auth=await db.auth.getUser();
  if(auth.error||auth.data?.user?.id!==uid||!valid())throw Error('Your sign-in changed. Reopen Settings.');
  const membership=await db.from('institution_memberships').select('id,role,status').eq('user_id',uid).eq('institution_id',sid).eq('status','active').single();
  if(membership.error||!membership.data)throw membership.error||Error('Active school membership required.');
  const canEdit=leadership.has(membership.data.role);
  const groups=await window.NOOR_SCHOOL_STRUCTURE.fetchGroups(db,sid);
  if(!valid())return;
  const classes=groups.filter(g=>g.group_type==='class'&&g.is_active!==false).sort(window.NOOR_SCHOOL_STRUCTURE.compareGroups);
  const sections=groups.filter(g=>g.group_type==='section'&&g.is_active!==false);
  let preference=null;
  const pref=await db.from('institution_dashboard_preferences').select('secondary_class_ids').eq('institution_id',sid).maybeSingle();
  if(!valid())return;
  if(pref.error)throw pref.error;
  preference=pref.data?.secondary_class_ids;
  let selected=new Set(Array.isArray(preference)?preference.map(String):standardIds(classes));
  render();
  function render(){
   const selectedCount=selected.size;
   root.innerHTML='<section class="panel noor-secondary-settings"><header class="noor-secondary-settings-head"><div><span class="eyebrow">Dashboard display</span><h2>Secondary Attendance Classes</h2><p>Choose which real classes or streams appear in the Secondary Attendance chart. Section names come from Classes &amp; Sections setup.</p></div><span class="noor-secondary-settings-count" data-selected-count>'+selectedCount+' selected</span></header>'+
    '<div class="noor-secondary-settings-toolbar"><label class="noor-secondary-settings-search"> <span>Find a class or stream</span><input type="search" placeholder="Search classes, grades or streams…" maxlength="100" data-secondary-search></label>'+
    '<div class="noor-secondary-settings-actions"><button type="button" class="btn light" data-standard>Use standard 6–10</button><button type="button" class="btn light" data-clear>Clear selection</button></div></div>'+
    '<div class="noor-secondary-settings-list" data-class-list></div>'+
    '<footer class="noor-secondary-settings-footer"><p role="status" aria-live="polite" data-status>'+(canEdit?'Changes apply to this school dashboard only.':'Only school leadership can change this selection.')+'</p>'+
    (canEdit?'<button type="button" class="btn" data-save>Save selection</button>':'')+'</footer></section>';
   const list=root.querySelector('[data-class-list]'),search=root.querySelector('[data-secondary-search]'),status=root.querySelector('[data-status]'),count=root.querySelector('[data-selected-count]');
   const escape=E;
   function draw(){
    const query=search.value.trim().toLowerCase();
    const shown=classes.filter(c=>(String(c.name||'')+' '+String(c.education_path||'')).toLowerCase().includes(query));
    count.textContent=selected.size+' selected';
    list.innerHTML=shown.length?shown.map(c=>{
     const child=sections.filter(s=>s.parent_group_id===c.id),names=child.map(s=>String(s.name||'').replace(/^section\s*/i,''));
     const path=c.education_path==='university'?'College / stream':'School class';
     return '<label class="noor-secondary-class-option"><input type="checkbox" data-class-id="'+escape(c.id)+'" '+(selected.has(String(c.id))?'checked':'')+(!canEdit?' disabled':'')+'><span class="noor-secondary-class-copy"><strong>'+escape(c.name)+'</strong><small>'+path+' · '+child.length+' section(s)'+(names.length?' · '+escape(names.join(', ')):'')+'</small></span></label>';
    }).join(''):'<p class="noor-secondary-settings-empty">No matching active class or stream.</p>';
   }
   search.addEventListener('input',draw);
   list.addEventListener('change',event=>{
    const box=event.target.closest('input[data-class-id]');if(!box||!canEdit)return;
    if(box.checked)selected.add(box.dataset.classId);else selected.delete(box.dataset.classId);
    draw();
   });
   root.querySelector('[data-standard]').onclick=()=>{selected=new Set(standardIds(classes));status.textContent='Standard school classes 6–10 selected. Save to apply.';draw();};
   root.querySelector('[data-clear]').onclick=()=>{selected.clear();status.textContent='No classes selected. Save to show an empty chart until you choose classes.';draw();};
   root.querySelector('[data-save]')?.addEventListener('click',async()=>{
    const button=root.querySelector('[data-save]');
    if(button.disabled||!valid())return;
    const ids=[...selected];
    if(ids.length>100){status.textContent='Select no more than 100 classes or streams.';return;}
    if(ids.some(id=>!classes.some(c=>String(c.id)===id))) {status.textContent='A selected class is no longer active. Refresh Settings.';return;}
    button.disabled=true;status.textContent='Saving school dashboard settings…';
    try{
     const latest=await db.auth.getUser();
     if(latest.error||latest.data?.user?.id!==uid||!valid())throw Error('Your account or school changed. Sign in again.');
     const result=await db.from('institution_dashboard_preferences').upsert({institution_id:sid,secondary_class_ids:ids,updated_at:new Date().toISOString()},{onConflict:'institution_id'}).select('institution_id,secondary_class_ids').single();
     if(result.error)throw result.error;
     if(result.data?.institution_id!==sid)throw Error('Saved preference belongs to a different school.');
     selected=new Set((result.data.secondary_class_ids||[]).map(String));
     status.textContent='Secondary Attendance selection saved for this school.';
     window.dispatchEvent(new CustomEvent('noor:secondary-attendance-settings-saved',{detail:{institution_id:sid}}));
     window.NOOR_PRINCIPAL_LIVE?.refresh?.();
     draw();
    }catch(error){if(valid())status.textContent='Could not save: '+(error.message||'Please retry.');}
    finally{if(valid())button.disabled=false;}
   });
   draw();
  }
 }catch(error){
  if(!valid())return;
  root.innerHTML='<section class="panel noor-secondary-settings"><h2>Secondary Attendance Classes</h2><p class="notice error" role="alert">'+E(error.message||'Could not load dashboard settings.')+'</p><button type="button" class="btn light" data-retry>Retry</button></section>';
  root.querySelector('[data-retry]').onclick=()=>mount(root);
 }
}
window.NOOR_SECONDARY_ATTENDANCE_SETTINGS=Object.freeze({mount,standardIds});
})();
