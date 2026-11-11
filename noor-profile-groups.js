/* Profile class/section labels come from verified memberships; initial selection uses the existing guarded RPC. */
(()=>{'use strict';
const app=()=>window.NOOR_AI_APP||{};
const eligible=()=>window.NOOR_ACCOUNT_CONTEXT?.enabled()&&['student','teacher'].includes(app().profile?.role);
function markup(){return eligible()?'<fieldset class="noor-profile-groups"><legend>Class &amp; section</legend><label>Class<select name="profile_class" aria-label="Class"><option value="">Loading class…</option></select></label><label>Section<select name="profile_section" aria-label="Section"><option value="">Loading section…</option></select></label><p data-group-status role="status"></p></fieldset>':'';}
async function load(form){
 const host=form?.querySelector('.noor-profile-groups');if(!host)return;
 const a=app(),uid=a.user?.id,school=a.schoolId,p=a.profile,cl=form.elements.profile_class,sec=form.elements.profile_section,status=host.querySelector('[data-group-status]');
 host.dataset.loading='yes';cl.disabled=true;sec.disabled=true;
 const option=(el,label,rows,value)=>{el.replaceChildren();const first=document.createElement('option');first.value='';first.textContent=label;el.append(first);for(const row of rows){const o=document.createElement('option');o.value=row.id;o.textContent=row.name;el.append(o);}el.value=value||'';};
 try{
  const rows=await window.NOOR_SIGNUP_GROUPS.fetch(a.db,school);
  if(app().user?.id!==uid||app().schoolId!==school||!host.isConnected)return;
  const classes=rows.filter(g=>g.group_type==='class'&&g.is_active),sections=id=>rows.filter(g=>g.group_type==='section'&&g.parent_group_id===id&&g.is_active);
  const linked=!!p.class_id;
  option(cl,'Select class',classes,p.class_id);option(sec,'Select section',sections(p.class_id),p.section_id);
  const refresh=()=>{option(sec,'Select section',sections(cl.value),'');sec.disabled=!sections(cl.value).length;sec.required=sections(cl.value).length>0;};
  cl.disabled=linked;sec.disabled=linked||!sections(cl.value).length;cl.required=!linked;sec.required=!linked&&sections(cl.value).length>0;
  cl.onchange=refresh;
  status.textContent=linked?'Your saved class and section. Ask your principal if this assignment needs changing.':'Your signup class was not saved. Select it once here to complete your profile.';
  host.dataset.loading='no';
 }catch(error){host.dataset.loading='failed';status.textContent='Could not load class and section: '+error.message;}
}
async function save(values){
 if(!eligible())return;
 const a=app(),p=a.profile,uid=a.user?.id,school=a.schoolId;
 // Disabled linked selectors are omitted by FormData. Existing enrolments are never changed here.
 if(p.class_id||!Object.prototype.hasOwnProperty.call(values,'profile_class'))return;
 const cl=String(values.profile_class||''),sec=String(values.profile_section||'')||null;
 if(!cl)throw Error('Select your class and section.');
 const auth=await a.db.auth.getUser();if(auth.error||auth.data?.user?.id!==uid||app().schoolId!==school)throw Error('Account changed. Reopen Settings.');
 const r=await a.db.rpc(p.role==='teacher'?'noor_select_teacher_section':'noor_select_student_section',{p_institution:school,p_class:cl,p_section:sec});if(r.error)throw r.error;
 if(app().user?.id!==uid||app().schoolId!==school)throw Error('Account changed. Reopen Settings.');
 const fresh=await window.NOOR_ACCOUNT_CONTEXT.profile(a.db,uid);if(fresh.error)throw fresh.error;if(!fresh.data?.class_id)throw Error('Class save could not be confirmed. Retry Settings.');Object.assign(p,{class_id:fresh.data.class_id,section_id:fresh.data.section_id,requested_class_name:fresh.data.requested_class_name,requested_section_name:fresh.data.requested_section_name});
}
window.NOOR_PROFILE_GROUPS=Object.freeze({markup,load,save});
})();
