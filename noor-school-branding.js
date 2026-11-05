/* Durable school branding: save the private object path, renew its preview URL. */
(()=>{'use strict';
const app=()=>window.NOOR_AI_APP||{};
let interval=null,loading=null;
const same=(userId,school)=>app().user?.id===userId&&app().school===school;
function paint(school){
 if(app().school!==school)return;
 const brandTitle=document.querySelector('#sidebar .brand b');if(brandTitle)brandTitle.textContent=school.name||'School';
 const crumb=document.getElementById('crumbBrand');if(crumb)crumb.textContent=school.name||'School';
 const schoolName=document.getElementById('sidebarSchoolName');if(schoolName)schoolName.textContent=school.name||'School workspace';
 const badge=document.getElementById('sidebarSchoolLogo');
 if(badge){if(school.logo_url){const img=document.createElement('img');img.src=school.logo_url;img.alt=(school.name||'School')+' logo';badge.replaceChildren(img);}else badge.textContent=(school.name||'School').slice(0,1).toUpperCase();}
 const mark=document.querySelector('#sidebar .brand .nmark');
 if(mark){const logo=document.createElement(school.logo_url?'img':'span');logo.className='nmark';if(school.logo_url){logo.src=school.logo_url;logo.alt=(school.name||'School')+' logo';}else logo.textContent=(school.name||'School').slice(0,1).toUpperCase();logo.style.objectFit='contain';logo.style.borderRadius='12px';mark.replaceWith(logo);}
}
async function load(){
 const {db,user,school}=app();if(!db||!user?.id||!school?.id)return;
 if(loading?.school===school)return loading.promise;
 const promise=(async()=>{
  const canonical=!!window.NOOR_ACCOUNT_CONTEXT?.enabled();
  const result=canonical?await db.from('institution_branding').select('logo_path').eq('institution_id',school.id).maybeSingle():await db.from('school_settings').select('logo_path').eq('school_id',school.id).maybeSingle();
  if(result.error)throw result.error;
  if(!same(user.id,school))return;
  const path=result.data?.logo_path;
  school.logo_path=path||null;school.logo_url=null;
  if(school.logo_path){
   const signed=await db.storage.from(canonical?'noor-school-logos':'student-photos').createSignedUrl(school.logo_path,3600);
   if(signed.error)throw signed.error;
   if(!same(user.id,school))return;
   school.logo_url=signed.data?.signedUrl||school.logo_url;
  }
  paint(school);
 })();
 loading={school,promise};
 try{await promise;}finally{if(loading?.promise===promise)loading=null;}
 if(!interval)interval=setInterval(()=>load().catch(()=>{}),45*60*1000);
}
async function upload(file){
 const {db,user,school,profile}=app();
 if(!db||!user?.id||!school?.id||(!['owner','principal'].includes(profile?.role)&&!(profile?.role==='manager'&&window.NOOR_ACCOUNT_CONTEXT?.enabled())))throw Error('Only authorised school leadership can change the logo.');
 const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(!types[file?.type]||!file.size||file.size>3*1024*1024)throw Error('Choose JPG, PNG or WebP under 3 MB.');
 const verify=async()=>{const r=await db.auth.getUser();if(r.error||r.data?.user?.id!==user.id||!same(user.id,school))throw Error('Account changed. Sign in again before changing the school logo.');};
 await verify();
 const canonical=!!window.NOOR_ACCOUNT_CONTEXT?.enabled();
 if(loading?.school===school)await loading.promise.catch(()=>{});
 await verify();
 const path=canonical?school.id+'/logo-'+crypto.randomUUID()+'.'+types[file.type]:user.id+'/school-logo-'+school.id+'-'+crypto.randomUUID()+'.'+types[file.type];
 const uploaded=await db.storage.from(canonical?'noor-school-logos':'student-photos').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
 if(uploaded.error)throw uploaded.error;
 await verify();
 const saved=canonical?await db.from('institution_branding').upsert({institution_id:school.id,logo_path:path,updated_at:new Date().toISOString()},{onConflict:'institution_id'}).select('institution_id,logo_path').single():await db.from('school_settings').upsert({school_id:school.id,logo_path:path,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'school_id'}).select('school_id,logo_path').single();
 if(saved.error)throw saved.error;
 if((canonical?saved.data?.institution_id:saved.data?.school_id)!==school.id||saved.data?.logo_path!==path)throw Error('School logo was not saved.');
 if(!same(user.id,school))throw Error('Account changed. Reopen your school.');
 school.logo_path=path;
 await load();
 return path;
}
window.addEventListener('focus',()=>load().catch(()=>{}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load().catch(()=>{});});
window.NOOR_SCHOOL_BRANDING=Object.freeze({load,upload,paint});
})();
