import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(){const window={};vm.runInNewContext(read('noor-feature-registry.js'),{window});return window.NOOR_FEATURE_REGISTRY;}
const R=setup();
test('existing catalog keys and descriptions are preserved in the shared registry',()=>{
 const sql=read('supabase/migrations/20261113080505_creator_control_plane.sql').split('create table public.noor_feature_defaults')[0];
 const expected=[...sql.matchAll(/\('([^']+)','([^']+)','([^']+)','([^']+)'\)/g)].map(m=>({feature_key:m[1],label:m[2],category:m[3],description:m[4]}));
 assert.deepEqual(JSON.parse(JSON.stringify(R.catalog.map(({views,...f})=>f))),expected);
});
test('every actual navigation destination has a feature mapping or an explicit shell exemption',()=>{
 const html=read('index.html'),config=html.slice(html.indexOf('function navConfig('),html.indexOf('\n',html.indexOf('function navConfig(')));
 const ids=[...config.matchAll(/id:'([^']+)'/g)].map(m=>m[1]);
 for(const id of ids)assert(R.known(id),'Declare feature or shell for '+id+' in noor-feature-registry.js');
 // Include dynamically inserted sidebar links, resource launchers and role extensions.
 for(const id of ['live-analytics','help-support','teacher-resources','class-performance','teacher-classroom','today-note','student-portfolio','student-gaps','syllabus-tracker','rubric-assistant','deadline-planner','staff-access'])assert(R.known(id),id);
});
test('all aliases follow their switch and unrelated features remain available',()=>{
 for(const f of R.catalog)for(const view of [f.feature_key,...f.views]){
  assert.equal(R.allowed(view,{[f.feature_key]:false}),false,view);
  assert.equal(R.allowed(view,{[f.feature_key]:true}),true,view);
  assert.equal(R.allowed(view,{}),true,view);
 }
 assert.equal(R.allowed('teacher-classroom',{students:false}),false);
 assert.equal(R.allowed('teacher-calendar',{calendar:false}),false);
 assert.equal(R.allowed('school-calendar',{attendance:false}),true);
});
test('mixed resources launcher stays open for enabled child and closes when both are off',()=>{
 assert.equal(R.allowed('teacher-resources',{smart_notes:false,assignments:true}),true);
 assert.equal(R.allowed('teacher-resources',{smart_notes:true,assignments:false}),true);
 assert.equal(R.allowed('teacher-resources',{smart_notes:false,assignments:false}),false);
 for(const id of Object.keys(R.shells))assert.equal(R.allowed(id,Object.fromEntries(R.catalog.map(f=>[f.feature_key,false]))),true,id);
});
test('new registry declarations automatically join the registration payload and route guard',async()=>{
 const window={};vm.runInNewContext(read('noor-feature-registry.js').replace('const catalog=[','const catalog=[{feature_key:"new_module",label:"New module",category:"Learning",description:"A new module",views:["new-page"]},'),{window});
 const next=window.NOOR_FEATURE_REGISTRY;let payload;
 await next.sync({rpc:async(name,args)=>{assert.equal(name,'noor_creator_register_features');payload=args.p_features;return {data:{registered:next.catalog.length}};}});
 assert(payload.some(f=>f.feature_key==='new_module'));
 assert.equal(next.allowed('new-page',{new_module:false}),false);
 assert(payload.every(f=>!('enabled' in f)&&!('institution_id' in f)&&!('views' in f)));
});
test('registration errors and incomplete confirmation propagate before displaying controls',async()=>{
 await assert.rejects(R.sync({rpc:async()=>({error:Error('Creator required')})}),/Creator required/);
 await assert.rejects(R.sync({rpc:async()=>({data:{registered:0}})}),/not confirmed/);
});
test('both entry points load the registry before consumers; school overrides are kept by default',()=>{
 for(const [file,consumer] of [['index.html','noor-platform-access.js'],['creator.html','creator/creator.js']]){const html=read(file);assert(html.indexOf('noor-feature-registry.js')<html.indexOf(consumer));}
 assert.match(read('creator/creator.js'),/replaceOverrides=false/);
 assert.match(read('creator/creator.js'),/await window.NOOR_FEATURE_REGISTRY.sync\(db\);view=/);
});
