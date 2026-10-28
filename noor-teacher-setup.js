/* Retired Principal-side class/teacher assignment workflow.
   Staff member onboarding remains in Staff & Access.
   Period and subject allocation belongs to the signed-in Teacher.
   Do not write teacher_assignments / noor_teacher_periods here.
*/
(()=>{
 'use strict';
 function open(){
   const app=window.NOOR_AI_APP||{};
   if(!['owner','principal','manager'].includes(app.profile?.role))return;
   app.openView?.('overview');
   app.toast?.('Period and subject selection belongs to each teacher. Manage staff accounts in Staff & Access.','info');
 }
 window.NOOR_TEACHER_SETUP=Object.freeze({open});
})();
