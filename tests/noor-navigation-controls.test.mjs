import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('login has a compact accessible eye, not a full-width Show password button',()=>{
 const html=read('index.html');
 assert.match(html,/id="toggleLoginPassword"[^>]*class="noor-password-eye"/);
 assert.match(html,/aria-pressed="false"/);
 assert.doesNotMatch(html,/id="toggleLoginPassword"[^>]*>Show password<\/button>/);
});
test('search clear control dispatches input and change to existing handlers',()=>{
 const js=read('noor-common-controls.js');
 assert.match(js,/Clear search/);
 assert.match(js,/input\.dispatchEvent\(new Event\('input'/);
 assert.match(js,/input\.dispatchEvent\(new Event\('change'/);
});
test('principal gets exactly eight navigation items and manager gets operational pages',()=>{
 const html=read('index.html');
 const nav=html.slice(html.indexOf('function navConfig()'),html.indexOf('function renderMobileNav()'));
 const principal=nav.match(/if\(\['owner','principal'\]\.includes\(role\)\)return \[(.*?)\];if\(role==='manager'\)/s);
 assert.ok(principal);
 assert.equal((principal[1].match(/\{id:/g)||[]).length,8);
 for(const id of ['overview','live-analytics','student-directory','staff-management','manager-activities','feature-controls','notices','settings'])assert.ok(principal[1].includes("id:'"+id+"'"));
 const manager=nav.slice(nav.indexOf("if(role==='manager')return"));
 for(const id of ['classes','schedules','attendance','assessments','manager'])assert.ok(manager.includes("id:'"+id+"'"));
 assert.match(html,/open\(\{activityOnly:true\}\)/);
 const workspace=read('noor-manager-workspace.js');
 assert.match(workspace,/if\(activityOnly\).*\.remove\(\)/);
});
test('feature switches show red/green tracks while retaining aria-checked',()=>{
 const creator=read('creator/creator.css'),principal=read('noor-feature-controls.css');
 assert.match(creator,/\.nc-toggle\.on\{background:#218650/);
 assert.match(creator,/background:#b83f4b/);
 assert.match(principal,/\.nfc-switch\[aria-checked=true\]/);
 assert.match(principal,/\.nfc-switch::after/);
});
