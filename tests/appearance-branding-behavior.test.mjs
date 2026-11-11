import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
function appearance(code, options={}){
 const root={dataset:{},classList:{toggle(){} }},writes=[],reads=[];
 const account={id:'user-a'},app={
  user:account,schoolId:options.schoolId||'school-a',school:{id:options.schoolId||'school-a',name:'Demo School'},
  profile:{role:options.role||'principal'},db:null
 };
 const database={
  auth:{getUser:async()=>({data:{user:account}})},
  from(table){assert.equal(table,'noor_school_appearance');let row;
   const q={select(){return q},eq(k,v){if(k==='institution_id')reads.push(v);return q},maybeSingle:async()=>({data:options.remote||{theme_key:'linen-pearl',color_mode:'light'}}),upsert(x){writes.push(x);row=x;return q},single:async()=>({data:{institution_id:row.institution_id}})};return q;}
 };
 app.db=database;
 const w={NOOR_AI_APP:app,addEventListener(){},dispatchEvent(){}};
 const doc={documentElement:root,querySelectorAll(){return[]},addEventListener(){},activeElement:null,hidden:false};
 const ctx={window:w,document:doc,CustomEvent:class{},console,Date,setTimeout:()=>1,clearTimeout(){}};
 runInNewContext(code,ctx);return{api:w.NOOR_THEME_SETTINGS,root,app,writes,reads,account};
}
test('principal theme is loaded and saved ONLY in current institution',async()=>{
 const x=appearance(await source('theme-system.js'));
 await x.api.loadForCurrentUser();
 assert.equal(x.root.dataset.noorTheme,'linen-pearl');
 x.api.setMode('dark');await x.api.flush();
 assert.equal(x.root.dataset.noorMode,'dark');
 assert.equal(x.reads[0],'school-a');
 assert.equal(x.writes[0].institution_id,'school-a');
 assert.equal(x.writes[0].color_mode,'dark');
});
test('teachers cannot change school theme or write settings',async()=>{
 const x=appearance(await source('theme-system.js'),{role:'teacher',remote:{theme_key:'sage-garden',color_mode:'light'}});
 await x.api.loadForCurrentUser();assert.equal(x.root.dataset.noorTheme,'sage-garden');
 x.api.setMode('dark');await x.api.flush();
 assert.equal(x.root.dataset.noorMode,'light');
 assert.equal(x.writes.length,0);
});
test('switching to a different school does not inherit the previous theme',async()=>{
 const x=appearance(await source('theme-system.js'),{remote:{theme_key:'rose-gold',color_mode:'light'}});
 await x.api.loadForCurrentUser();assert.equal(x.root.dataset.noorTheme,'rose-gold');
 x.app.schoolId='school-b';x.app.school={id:'school-b'};
 await x.api.loadForCurrentUser();assert.equal(x.reads.at(-1),'school-b');
 x.api.reset();assert.equal(x.root.dataset.noorTheme,'pastel-aurora');
 assert.equal(x.writes.length,0);
});
function branding(code){
 let stored='user-a/school-logo-school-a.png',signed=0,uploaded=0,saved=0;
 const user={id:'user-a'},school={id:'school-a',name:'QA school'},images=[];
 const app={user,school,profile:{role:'principal'},db:{auth:{getUser:async()=>({data:{user}})},storage:{from:()=>({upload:async()=>{uploaded++;return{}},createSignedUrl:async path=>{signed++;return{data:{signedUrl:'https://example.invalid/'+path+'?renewal='+signed}}}})},from:()=>{
  let row;const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{logo_path:stored}}),upsert(value){row=value;return q},single:async()=>{saved++;stored=row.logo_path;return{data:row}}};return q;
 }}};
 const context={window:{NOOR_AI_APP:app,addEventListener(){}},document:{addEventListener(){},getElementById(){return{replaceChildren(img){images.push(img.src)}}},querySelector(){return null},createElement(){return{style:{}}}},setInterval(){return 1},crypto:{randomUUID:()=>String(uploaded+1)}};
 runInNewContext(code,context);return{app,api:context.window.NOOR_SCHOOL_BRANDING,images,stats:()=>({stored,signed,uploaded,saved})};
}
test('school logo is restored and its expired display URL is renewed without re-upload',async()=>{
 const x=branding(await source('noor-school-branding.js'));
 await x.api.load();const first=x.app.school.logo_url;
 x.app.school={id:'school-a',name:'QA school'};await x.api.load();
 assert.ok(x.app.school.logo_url);assert.notEqual(x.app.school.logo_url,first);
 assert.equal(x.stats().uploaded,0);assert.equal(x.images.length,2);
});
test('logo replacement saves and verifies a durable school-specific path',async()=>{
 const x=branding(await source('noor-school-branding.js'));
 await x.api.upload({type:'image/png',size:100});
 assert.equal(x.stats().uploaded,1);assert.equal(x.stats().saved,1);
 assert.match(x.stats().stored,/^user-a\/school-logo-school-a-/);
 assert.equal(x.app.school.logo_path,x.stats().stored);
});
test('manager keeps own identity and cannot bypass school-logo write permissions',async()=>{
 const x=branding(await source('noor-school-branding.js'));x.app.profile.role='manager';
 await assert.rejects(x.api.upload({type:'image/png',size:100}),/authorised school leadership/);
 assert.equal(x.stats().uploaded,0);assert.equal(x.app.profile.role,'manager');
});
test('canonical manager cannot upload a school logo',async()=>{const x=branding(await source('noor-school-branding.js'));x.app.profile.role='manager';await assert.rejects(x.api.upload({type:'image/png',size:100}),/authorised school leadership/);assert.equal(x.stats().uploaded,0);});
