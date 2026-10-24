/* NOOR Teacher Profile Experience — reference-inspired lavender UI.
   Keeps existing authenticated views and real Supabase-backed widgets intact. */
(()=>{'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const css=document.createElement('style');css.textContent=`
body:has(.noor-teacher-studio) {background:#f2f0fa}
body:has(.noor-teacher-studio) .sidebar{background:linear-gradient(160deg,#625ca6 0%,#5a529d 58%,#8675be 100%);border-radius:0 25px 25px 0}
body:has(.noor-teacher-studio) .sidebar .nav button.active{background:#ddd7fa;color:#342e69;border-radius:15px}
body:has(.noor-teacher-studio) .main{background:linear-gradient(135deg,#f3f2fc,#f8f6ff)}
.noor-teacher-studio{font-family:'DM Sans',system-ui,sans-serif!important;color:#29243d!important}
.noor-teacher-studio .nts-hero{background:#fff!important;color:#29243d!important;box-shadow:0 10px 28px #5d4e9110!important}
.noor-teacher-studio .nts-hero h2{color:#30284e!important}
.noor-teacher-studio .nts-card{border-radius:24px!important;box-shadow:0 10px 26px #655da012!important}
.noor-teacher-studio .ntx-profile{display:flex;align-items:center;gap:24px;padding:24px;background:white;border-radius:25px;margin-bottom:16px;border:1px solid #ebe7f8}
.noor-teacher-studio .ntx-avatar{width:132px;height:132px;border-radius:50%;background:linear-gradient(140deg,#d7cdfa,#f3d8ee);display:grid;place-items:center;font-size:48px;font-weight:800;color:#6558a4;overflow:hidden;flex-shrink:0}
.noor-teacher-studio .ntx-avatar img{width:100%;height:100%;object-fit:cover}
.noor-teacher-studio .ntx-profile h2{margin:0 0 6px;color:#30284e;font-size:23px}
.noor-teacher-studio .ntx-profile p{margin:5px 0;color:#746c8c;font-size:12px}
.noor-teacher-studio .ntx-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
.noor-teacher-studio .ntx-actions button{background:#ece8fb;color:#5b4e9c}
.noor-teacher-studio .ntx-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin:14px 0}
.noor-teacher-studio .ntx-step{border:1px solid #e8e3f5;border-radius:19px;padding:18px;background:linear-gradient(120deg,#f0edfd,#fceef6);text-align:left;min-height:100px}
.noor-teacher-studio .ntx-step strong{display:block;font-size:14px;color:#342d65}
.noor-teacher-studio .ntx-step small{display:block;color:#746b8b;margin-top:7px}
.noor-teacher-studio .ntx-step:hover{box-shadow:0 7px 22px #6b5fa327}
.noor-teacher-studio .ntx-progress{height:7px;background:#e7e2f6;border-radius:20px;overflow:hidden;margin-top:12px}
.noor-teacher-studio .ntx-progress span{display:block;height:100%;background:linear-gradient(90deg,#7062b6,#d38bc7)}
@media(max-width:740px){.noor-teacher-studio .ntx-profile{flex-direction:column;align-items:flex-start;padding:18px}.noor-teacher-studio .ntx-avatar{width:90px;height:90px;font-size:34px}.noor-teacher-studio .ntx-steps{grid-template-columns:1fr}.noor-teacher-studio .ntx-profile h2{font-size:19px}}
`;document.head.append(css);
function decorate(){
const app=window.NOOR_AI_APP,root=document.querySelector('.noor-teacher-studio');
if(!root||app?.profile?.role!=='teacher'||root.querySelector('.ntx-profile'))return;
const p=app.profile||{},name=p.full_name||'Teacher';
const hero=document.createElement('section');hero.className='ntx-profile';
const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const avatar=p.avatar_url?'<img src="'+escape(p.avatar_url)+'" alt="Teacher profile photo">':escape(initials);
hero.innerHTML='<div class="ntx-avatar">'+avatar+'</div><div style="min-width:0"><h2>'+escape(name)+'</h2><p>◉ '+escape(app.school?.name||'My school')+' · Teacher</p><p>✉ '+escape(p.email||app.user?.email||'')+'</p><p>Student attendance · Lesson plans · Weekly papers</p><div class="ntx-actions"><button data-view="profile">Edit profile & photo</button><button data-view="schedules">My timetable</button><button data-view="notifications">Principal messages</button></div></div>';
const steps=document.createElement('section');steps.className='ntx-steps';
steps.innerHTML='<button class="ntx-step" data-view="attendance"><strong>✓ Student attendance</strong><small>Open assigned class and mark attendance</small></button><button class="ntx-step" data-view="weekly-plan"><strong>▤ Weekly assignments</strong><small>Lesson planning and weekly work</small></button><button class="ntx-step" data-view="assessments"><strong>✎ Weekly test papers</strong><small>Create and review assessments and marks</small></button><button class="ntx-step" data-view="teaching"><strong>✦ AI Smart Notes</strong><small>Choose photo · English / Urdu / Hindi · Generate</small></button><button class="ntx-step" data-view="schedules"><strong>◷ Timetable & progress</strong><small>View scheduled periods and class progress</small></button><button class="ntx-step" data-view="notices"><strong>◇ Principal notices</strong><small>School announcements and assigned instructions</small></button>';
root.prepend(steps);root.prepend(hero);
root.addEventListener('click',e=>{const b=e.target.closest('.ntx-step,[data-view]');if(b?.dataset.view){app.openView?.(b.dataset.view)}});
}
const observer=new MutationObserver(()=>{if(document.querySelector('.noor-teacher-studio:not(:has(.ntx-profile))'))decorate()});observer.observe(document.body,{subtree:true,childList:true});decorate();
})();