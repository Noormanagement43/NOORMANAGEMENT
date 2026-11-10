import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../noor-live-analytics.js',import.meta.url),'utf8');
function setup(app={}){const window={NOOR_AI_APP:app,addEventListener(){}};vm.runInNewContext(code,{window,document:{querySelectorAll:()=>[],addEventListener(){}},setInterval(){},Date,Map,Set,Intl,Error,Event});return window.NOOR_LIVE_ANALYTICS;}
test('automatic guidance detects low results, declining marks and falling attendance',()=>{const r=setup().signals({subject:'Maths',percentage:45,previous_percentage:80,attendance:65,previous_attendance:90});assert.equal(r.filter(s=>s.kind==='focus').length,2);assert.match(r.find(s=>s.kind==='attendance').text,/65%.*90%/);assert.match(r[0].text,/15 minutes/);});
test('appreciation uses actual strong or improving results',()=>{assert.equal(setup().signals({subject:'English',percentage:94})[0].kind,'star');assert.match(setup().signals({subject:'Maths',percentage:70,previous_percentage:50})[0].text,/improved by 20/);});
test('missing data never turns into a zero score or absence alert',()=>{assert.equal(setup().signals({subject:'Maths',percentage:null,previous_percentage:80,attendance:null}).length,0);});
test('weekly board escapes names and marks and never invents missing class teacher',()=>{const html=setup().achievers({week_start:'2026-11-09',as_of:'2026-11-11',achievers:[{name:'<img onerror=evil>',marks:90,max_marks:100,percentage:90,subject:'English'}]});assert.doesNotMatch(html,/<img onerror/);assert.match(html,/&lt;img onerror=evil&gt;/);assert.match(html,/Not assigned/);});
test('late responses are discarded after changing school',async()=>{let resolve;const a={user:{id:'a'},schoolId:'school-a',db:{rpc:()=>new Promise(r=>resolve=r)}};const live=setup(a); // opt in to canonical context for the read
// Create a second VM to expose the canonical switch.
const window={NOOR_AI_APP:a,NOOR_ACCOUNT_CONTEXT:{enabled:()=>true},addEventListener(){}};vm.runInNewContext(code,{window,document:{querySelectorAll:()=>[],addEventListener(){}},setInterval(){},Date,Map,Set,Intl,Error,Event});const read=window.NOOR_LIVE_ANALYTICS.read();a.schoolId='school-b';resolve({data:{rows:[],achievers:[]}});assert.equal(await read,null);});
