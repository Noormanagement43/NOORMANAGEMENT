/* School controls are persisted by an authorized RPC; Creator access is the ceiling. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{},E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eligible=()=>['owner','principal','manager'].includes(A().profile?.role)&&A().profile?.status==='active';
const identity=()=>[A().user?.id,A().schoolId].join('|');
let request=0;
async function mount(root){
 if(!root)return;const key=identity(),version=++request;
 if(!eligible()){root.innerHTML='<div class="panel"><h1>Feature Controls</h1><p>School leadership access required.</p></div>';return;}
 root.innerHTML='<section class="panel nfc"><h1>Feature Controls</h1><p role="status">Loading school features…</p></section>';
 const valid=()=>root.isConnected&&key===identity()&&version===request&&eligible();
 try{
  const {data,error}=await A().db.rpc('noor_school_features',{p_institution:A().schoolId,p_changes:{}});
  if(!valid())return;if(error)throw error;if(!Array.isArray(data?.catalog))throw Error('School feature controls could not load.');
  draw(data.catalog);
 }catch(error){if(!valid())return;root.querySelector('.nfc').innerHTML='<h1>Feature Controls</h1><p role="alert">'+E(error.message||'Could not load features.')+'</p><button type="button" class="btn light" data-retry>Try again</button>';root.querySelector('[data-retry]').onclick=()=>mount(root);}
 function draw(catalog){
  let category='All Features',query='';const section=root.querySelector('.nfc');
  section.innerHTML='<header><div><small>'+E(A().school?.name||'My school')+'</small><h1>Feature Controls</h1><p>Choose the features available in your school. Changes save immediately.</p></div><span class="nfc-badge">School controls</span></header><div class="nfc-toolbar"><label>Find a feature<input type="search" placeholder="Search Calendar, Attendance…" maxlength="100" data-search></label><label>Category<select data-category>'+['All Features',...new Set(catalog.map(f=>f.category))].map(c=>'<option>'+E(c)+'</option>').join('')+'</select></label></div><p class="nfc-note">Only features allowed by NOOR Management can be switched on or off. Saved school records are preserved.</p><p role="status" aria-live="polite" data-status></p><div data-feature-list></div>';
  const list=section.querySelector('[data-feature-list]'),status=section.querySelector('[data-status]');
  function render(){const shown=catalog.filter(f=>(category==='All Features'||category===f.category)&&(f.label+' '+f.description).toLowerCase().includes(query));list.innerHTML=shown.length?shown.map(f=>'<article class="nfc-row"><div><span class="nfc-category">'+E(f.category)+'</span><h2>'+E(f.label)+'</h2><p>'+E(f.description)+'</p>'+(!f.creator_allowed?'<small class="nfc-locked">Disabled by NOOR Management</small>':f.school_enabled&&!f.enabled?'<small class="nfc-locked">Enable '+(f.feature_key==='smart_notes'?'Learning Library':'Report Cards')+' to use this feature.</small>':'')+'</div><button type="button" class="nfc-switch" role="switch" aria-label="'+E(f.label)+'" aria-checked="'+(f.creator_allowed&&f.school_enabled)+'" data-school-feature="'+E(f.feature_key)+'" '+(!f.creator_allowed?'disabled':'')+'>'+(f.creator_allowed&&f.school_enabled?'ON':'OFF')+'</button></article>').join(''):'<p>No matching features.</p>';}
  section.querySelector('[data-search]').oninput=e=>{query=e.target.value.trim().toLowerCase();render();};
  section.querySelector('[data-category]').onchange=e=>{category=e.target.value;render();};
  let saving=false;
  list.onclick=async e=>{const b=e.target.closest('[data-school-feature]');if(!b||b.disabled||saving||!valid())return;const f=catalog.find(x=>x.feature_key===b.dataset.schoolFeature);if(!f?.creator_allowed)return;saving=true;list.querySelectorAll('button').forEach(x=>x.disabled=true);status.textContent='Saving '+f.label+'…';
   try{
    const {data,error}=await A().db.rpc('noor_school_features',{p_institution:A().schoolId,p_changes:{[f.feature_key]:!f.school_enabled}});
    if(!valid())return;if(error)throw error;if(!Array.isArray(data?.catalog))throw Error('Feature setting was not confirmed.');
    catalog=data.catalog;
    await window.NOOR_PLATFORM_ACCESS?.init();
    if(!valid())return;status.textContent=f.label+' saved · '+(!f.school_enabled?'ON':'OFF');
   }catch(error){if(valid())status.textContent='Could not save: '+(error.message||'Try again.');}
   finally{saving=false;if(valid())render();}
  };
  render();
 }
}
window.NOOR_FEATURE_CONTROLS=Object.freeze({mount});
})();
