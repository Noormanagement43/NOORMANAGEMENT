import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('edit-profile portrait uses a bounded frame while retaining photo editing and account ownership',async()=>{
 const [html,css]=await Promise.all([read('index.html'),read('noor-profile-portraits.css')]);
 assert.match(html,/class="panel noor-profile-main"/);
 assert.match(html,/class="noor-profile-photo-col"/);
 assert.match(html,/class="noor-profile-main-content"/);
 assert.match(html,/class="noor-profile-identity"/);
 assert.match(html,/id="noorProfilePhotoInput"/);
 assert.match(html,/id="noorProfilePhotoSave"/);
 assert.match(html,/await uploadPendingPhoto\(currentUser\.id,file\)/);
 assert.match(html,/noor-profile-portraits\.css\?v=20261028-principal-size-v3/);
 assert.match(css,/#view-profile \.noor-profile-main\{/);
 assert.match(css,/#view-profile \.noor-profile-photo-col\{/);
 assert.match(css,/\.noor-profile-avatar\.avatar[,\{]/);
 assert.match(css,/height:100%!important/);
 assert.match(css,/object-fit:cover!important/);
});

test('teacher and principal photo frames share dimensions and mobile compatible',async()=>{
 const [css,teacher,principal]=await Promise.all([read('noor-profile-portraits.css'),read('teacher-reference.js'),read('principal-live.js')]);
 assert.match(teacher,/nt-photo-column/);
 assert.match(teacher,/ntChangePhoto/);
 assert.match(principal,/pd-photo/);
 assert.match(css,/#workspace \.noor-t4 \.nt-photo-column/);
 assert.match(css,/#noor-principal \.pd-profile \.pd-photo/);
 assert.match(css,/height:185px!important/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/\.sp-root \.sp-intro \.sp-avatar/); // Same portrait size for students.
 assert.doesNotThrow(()=>new Script(teacher));
 assert.doesNotThrow(()=>new Script(principal));
});

test('do not silently switch the original NOOR project or change the intended burgundy login',async()=>{
 const [config,html]=await Promise.all([read('config.js'),read('index.html')]);
 assert.match(config,/ayrryemawwplguaauxij.supabase.co/);
 assert.doesNotMatch(config,/npzedchxfurcphvpjock/);
 assert.match(html,/noor-official-logo\.svg/);
 assert.match(html,/id="loginTab"/);
 assert.match(html,/id="ownerTab"/);
 assert.match(html,/id="joinTab"/);
});
