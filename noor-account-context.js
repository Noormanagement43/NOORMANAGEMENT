/* Read legacy dashboard identity from verified destination memberships. No roles are granted here. */
(()=>{'use strict';
const enabled=()=>window.NOOR_CONFIG?.SUPABASE_URL==='https://ayrryemawwplguaauxij.supabase.co';
const role=value=>({school_admin:'manager',faculty:'teacher',university_admin:'principal',academic_admin:'principal',university_student:'student'})[value]||value;
async function profile(db,id){try{
 const auth=await db.auth.getUser();if(auth.error)throw auth.error;if(auth.data?.user?.id!==id)throw Error('Sign in again to load your own account.');
 const [pr,mr]=await Promise.all([db.from('profiles').select('*').eq('id',id).maybeSingle(),db.from('institution_memberships').select('id,institution_id,user_id,role,status,joined_at').eq('user_id',id)]);
 if(pr.error)throw pr.error;if(mr.error)throw mr.error;if(!pr.data)return{data:null,error:null};
 const available=(mr.data||[]).filter(m=>m.status==='active');if(available.length>1)throw Error('This account belongs to multiple schools. Choose your school before opening the dashboard.');
 const assigned=(mr.data||[])[0],m=available[0],p={...pr.data,email:auth.data.user.email,role:m?role(m.role):'student',status:m?'active':assigned?'inactive':'pending',school_id:m?.institution_id||null,institution_id:m?.institution_id||null,membership_id:m?.id||null};
 const contact=auth.data.user.user_metadata?.noor_contact||{};p.mobile_number=typeof contact.phone==='string'?contact.phone:'';p.city_or_area=typeof contact.location==='string'?contact.location:'';p.date_of_birth=typeof contact.date_of_birth==='string'?contact.date_of_birth:'';
 const platform=await db.from('platform_roles').select('role').eq('user_id',id);if(platform.error)throw platform.error;
 if((platform.data||[]).some(x=>['platform_owner','platform_admin'].includes(x.role))){p.role='creator';p.status='active';}
 if(m&&['student','teacher'].includes(p.role)){
 const enrolled=await db.from('academic_group_memberships').select('group_id').eq('membership_id',m.id).eq('institution_id',m.institution_id).eq('status','active').in('group_role',p.role==='teacher'?['teacher','faculty']:['student']);
 if(enrolled.error)throw enrolled.error;
 if(enrolled.data?.length){const groups=await db.from('academic_groups').select('id,name,group_type,parent_group_id').eq('institution_id',m.institution_id).eq('is_active',true).in('id',enrolled.data.map(x=>x.group_id));if(groups.error)throw groups.error;const section=groups.data?.find(g=>g.group_type==='section'),cl=groups.data?.find(g=>g.group_type==='class');p.section_id=section?.id||null;p.class_id=section?.parent_group_id||cl?.id||null;p.requested_section_name=section?.name||'';if(!cl&&p.class_id){const parent=await db.from('academic_groups').select('name').eq('institution_id',m.institution_id).eq('id',p.class_id).maybeSingle();if(parent.error)throw parent.error;p.requested_class_name=parent.data?.name||'';}else p.requested_class_name=cl?.name||'';}
 }
 return{data:p,error:null};
}catch(error){return{data:null,error};}}
async function membership(db,id,schoolId){const r=await db.from('institution_memberships').select('role,status').eq('user_id',id).eq('institution_id',schoolId).maybeSingle();return{...r,data:r.data?{...r.data,role:role(r.data.role)}:null};}
async function school(db,id){const r=await db.from('institutions').select('id,name,institution_type,status,timezone,created_at').eq('id',id).maybeSingle();return{...r,data:r.data?{...r.data,is_active:r.data.status==='active',account_status:r.data.status==='active'?'active':'pending',verification_status:r.data.status==='active'?'verified':'pending'}:null};}
window.NOOR_ACCOUNT_CONTEXT=Object.freeze({enabled,profile,membership,school});
})();
