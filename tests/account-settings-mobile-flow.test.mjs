import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('reset email resend follows Forgot password rather than living on login',()=>{
 const html=read('index.html'),recovery=read('forgot-password.html'),flow=read('noor-password-recovery.js');
 assert.match(html,/id="forgotBtn"/);
 assert.doesNotMatch(html,/id="resendConfirmBtn"/);
 assert.match(recovery,/<section id="emailStep"/);
 assert.match(recovery,/<section id="codeStep" hidden>/);
 assert.match(recovery,/id="resendRecovery"/);
 assert.ok(flow.includes("$('resendRecovery').addEventListener('click'"));
 assert.ok(flow.includes("$('emailStep').hidden=true;$('codeStep').hidden=false"));
});

test('phone roles use only left drawer and floating AI, with an accessible sign out',()=>{
 const html=read('index.html'),css=read('noor-clean-phone.css');
 assert.match(html,/id="mobileMenu"/);
 assert.match(html,/id="sidebarSignOut"/);
 assert.match(html,/sideFooter\.querySelector\('#sidebarSignOut'\).*logoutBtn/);
 assert.match(css,/#workspace #noorMobileNav\{display:none!important\}/);
 assert.match(css,/#workspace #noorHeaderAI\{display:none!important\}/);
 assert.match(css,/#workspace \.sidebar-bottom \.noor-side-signout/);
 assert.match(html,/noor-floating-ai\.js/);
});

test('Settings offers complete personal editing on principal and teacher; student adds own phone',()=>{
 const html=read('index.html'),student=read('student-portal.js'),groups=read('noor-profile-groups.js');
 assert.match(html,/id="noorProfileSettings"/);
 assert.match(html,/window\.NOOR_PROFILE_EDITOR\?\.open\(renderSettings\)/);
 assert.doesNotMatch(html,/role==='teacher'\?window\.NOOR_TEACHER_REFERENCE\?\.editProfile/);
 for(const name of ['email','full_name','date_of_birth','parent','parentphone','phone','roll_number','city','address'])
  assert.ok(student.includes('name="'+name+'"')||student.includes('name="'+name+'"'),name+' editable');
 assert.match(student,/NOOR_PROFILE_GROUPS\?\.markup\(\)/);
 assert.match(student,/mobile_number:v\('phone'\)/);
 assert.match(groups,/permission\?\.can_select===true/);
 assert.match(groups,/noor_select_student_section/);
});
