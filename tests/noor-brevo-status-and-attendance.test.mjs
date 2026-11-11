import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('Brevo status is read-only and account checks are leadership-scoped',()=>{
 const backend=file('supabase/functions/noor-backend-api/index.ts'),check=file('supabase/functions/noor-backend-api/brevo-email.ts'),ui=file('noor-communications.js');
 assert.match(backend,/brevo\.email\.check/);
 assert.match(backend,/institution_memberships/);
 assert.match(backend,/school_admin/);
 assert.match(check,/method:'GET'/);
 assert.match(check,/EMAIL_FROM/);
 assert.doesNotMatch(check,/smtp\/email|method:'POST'|service_role/);
 assert.match(ui,/data-email-readiness/);
 assert.match(ui,/No email will be sent/);
 assert.doesNotThrow(()=>new vm.Script(ui));
});
test('Teacher attendance cell tap changes the radio and reuses original save pipeline',()=>{
 const s=file('noor-teacher-data.js');
 assert.doesNotThrow(()=>new vm.Script(s));
 assert.match(s,/closest\('\.ta-status-cell'\)/);
 assert.match(s,/radio\.checked=true/);
 assert.match(s,/new Event\('change',\{bubbles:true\}\)/);
 assert.match(s,/noor_save_class_register/);
});
test('cached assets point at the updated Brevo and attendance implementations',()=>{
 const s=file('index.html');
 for(const part of ['noor-communications.js?v=20261109-multichannel-v3','noor-teacher-data.js?v=20261111-profile-theme-4','noor-communications-mobile.css?v=20261109-mobile-communications-1'])assert.ok(s.includes(part));
});
