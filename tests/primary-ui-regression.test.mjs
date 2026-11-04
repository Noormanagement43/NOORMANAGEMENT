import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('dark-mode action contrast and keyboard focus rules are present',async()=>{
 const css=await read('noor-palettes.css');
 assert.match(css,/data-noor-mode="dark"\]\s+#workspace\s+:is\(\.btn\.light/);
 assert.match(css,/focus-visible\s*\{outline:3px solid #f3d294/i);
 assert.match(css,/data-noor-mode="dark"\].*noor-tt-form button/);
});
test('teacher profile dialog follows light/dark design tokens and is loaded',async()=>{
 const [html,js]=await Promise.all([read('index.html'),read('teacher-profile-editor.js')]);
 assert.match(html,/teacher-profile-editor\.js\?v=20261104-dark-profile-1/);
 assert.match(js,/var\(--paper,#fff\)/);
 assert.match(js,/var\(--ink,#302950\)/);
 assert.match(js,/\.eq\('id',app\.user\.id\)\.eq\('school_id',app\.schoolId\)/);
});
test('navigation recovery and teacher-owned periods remain wired',async()=>{
 const [html,setup]=await Promise.all([read('index.html'),read('noor-teacher-setup.js')]);
 for(const marker of ['resetPasswordForEmail','PASSWORD_RECOVERY','mobileBackBtn','noorGoBack'])assert.ok(html.includes(marker),marker);
 assert.match(setup,/Period and subject allocation belongs to the signed-in Teacher/);
});
