/* Parent periods use verified guardian links and the existing timetable RLS. */
(()=>{'use strict';
const app=()=>window.NOOR_AI_APP||{};
let generation=0,scope='',snapshot=[],host=null,day='',busy=false;
const allowed=()=>app().profile?.role==='parent'&&app().user?.id&&app().schoolId;
const key=()=>app().user?.id+':'+app().schoolId;
function active(){return allowed()&&host?.isConnected&&document.getElementById('view-overview')?.classList.contains('active')&&scope===key();}
function paint(){if(active())host.innerHTML=window.NOOR_DASHBOARD_EXPERIENCE.readerFocus(snapshot,{timeZone:app().school?.timezone});}
async function mount(target){
 if(!allowed()||!target)return;host=target;scope=key();snapshot=[];const version=++generation,identity=scope;busy=true;
 target.innerHTML='<section class="noor-live-periods"><h2>Current periods</h2><p role="status">Loading your linked child’s timetable…</p></section>';
 try{
  window.NOOR_SHARED_TIMETABLE.subscribe();const result=await window.NOOR_SHARED_TIMETABLE.load();
  if(version!==generation||identity!==key()||!target.isConnected||!allowed())return;
  if(result.error)throw result.error;
  day=window.NOOR_SHARED_TIMETABLE.schoolDay(app().school?.timezone);
  if(result.guardianGroupCount===0){target.innerHTML='<section class="noor-live-periods"><h2>Your child’s periods</h2><p>No child is linked to your parent account yet. Ask your principal to link your child so their timetable can appear here.</p></section>';return;}
  const names=await app().db.rpc('noor_period_teacher_names',{p_institution:app().schoolId});
  if(version!==generation||identity!==key()||!target.isConnected||!allowed())return;
  if(names.error)throw names.error;
  snapshot=(result.data||[]).map(p=>({...p,teacher_name:(names.data||[]).find(x=>x.period_id===p.id)?.teacher_name||'Teacher'}));paint();
 }catch(error){if(version===generation&&identity===key()&&target.isConnected){target.innerHTML='<section class="noor-live-periods"><h2>Current periods</h2><p data-error role="status"></p><button type="button" class="noor-secondary-action" data-parent-period-retry>Retry</button></section>';target.querySelector('[data-error]').textContent=error.message||'Timetable could not load.';target.querySelector('[data-parent-period-retry]').onclick=()=>mount(target);}}
 finally{if(version===generation)busy=false;}
}
window.addEventListener('noor:period-clock',()=>{if(!active()||busy)return;if(day!==window.NOOR_SHARED_TIMETABLE.schoolDay(app().school?.timezone))mount(host);else paint();});
window.addEventListener('noor:timetable-saved',()=>{if(active())mount(host);});
window.addEventListener('focus',()=>{if(active()&&!busy)mount(host);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active()&&!busy)mount(host);});
window.addEventListener('noor:workspace-ready',()=>{if(scope!==key()){generation++;snapshot=[];scope='';host=null;busy=false;}});
window.NOOR_PARENT_DASHBOARD=Object.freeze({mount});
})();
