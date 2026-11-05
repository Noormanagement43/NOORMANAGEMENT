/* Class choices are read only after the school joining code establishes membership. */
(()=>{'use strict';
function classes(rows,institution){return rows.filter(g=>g.institution_id===institution&&g.is_active===true&&g.group_type==='class');}
function sections(rows,institution,classId){return rows.filter(g=>g.institution_id===institution&&g.is_active===true&&g.group_type==='section'&&g.parent_group_id===classId);}
async function choices(db,profile){
 const auth=await db.auth.getUser();if(auth.error||auth.data?.user?.id!==profile.id)throw Error('Your account changed. Sign in again.');
 const result=await db.from('academic_groups').select('id,institution_id,name,group_type,parent_group_id,is_active').eq('institution_id',profile.institution_id).eq('is_active',true).order('name');
 if(result.error)throw result.error;return result.data||[];
}
async function save(db,profile,rows,classId,sectionId){
 if(!classes(rows,profile.institution_id).some(x=>x.id===classId)||!sections(rows,profile.institution_id,classId).some(x=>x.id===sectionId))throw Error('Select your school’s class and one of its sections.');
 const auth=await db.auth.getUser();if(auth.error||auth.data?.user?.id!==profile.id)throw Error('Your account changed. Sign in again.');
 const result=await db.rpc('noor_select_student_section',{p_institution:profile.institution_id,p_class:classId,p_section:sectionId});if(result.error)throw result.error;return result.data;
}
async function ensure({db,user,profile,enter,message}){
 if(profile.role!=='student'||profile.class_id&&profile.section_id)return false;
 const rows=await choices(db,profile),list=classes(rows,profile.institution_id);
 const old=document.getElementById('studentSchoolChoice');if(old)old.remove();
 const panel=document.createElement('section');panel.id='studentSchoolChoice';panel.className='notice info';
 panel.innerHTML='<h3>Select your class & section</h3><p>Only classes and sections created by your school are listed.</p><form><label>Class<select name="class_id" required><option value="">Select class</option></select></label><label>Section<select name="section_id" required disabled><option value="">Select class first</option></select></label><button type="submit" class="btn">Save & open my dashboard</button></form><p class="small-note" role="status"></p>';
 document.getElementById('loginForm').classList.add('hidden');document.getElementById('loginForm').after(panel);
 const form=panel.querySelector('form'),cl=form.elements.class_id,sec=form.elements.section_id,note=panel.querySelector('[role="status"]');
 for(const g of list){const o=document.createElement('option');o.value=g.id;o.textContent=g.name;cl.append(o);}
 if(!list.length){note.textContent='Your school has not created active classes yet. Ask your principal to add classes and sections.';form.querySelector('button').disabled=true;}
 cl.onchange=()=>{sec.replaceChildren();const start=document.createElement('option');start.value='';start.textContent='Select section';sec.append(start);const options=sections(rows,profile.institution_id,cl.value);for(const g of options){const o=document.createElement('option');o.value=g.id;o.textContent=g.name;sec.append(o);}sec.disabled=!options.length;note.textContent=cl.value&&!options.length?'No active sections exist for this class. Ask your principal to add them.':'';};
 if(profile.class_id&&list.some(x=>x.id===profile.class_id)){cl.value=profile.class_id;cl.onchange();}
 form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await save(db,profile,rows,cl.value,sec.value);panel.remove();await enter(user);}catch(e){note.textContent=/schema cache|Could not find/i.test(e.message||'')?'Class selection is awaiting school setup activation.':e.message;message('Class/section was not saved. '+note.textContent,'error');}finally{button.disabled=false;}};
 return true;
}
window.NOOR_STUDENT_ENROLMENT={classes,sections,choices,save,ensure};
})();
