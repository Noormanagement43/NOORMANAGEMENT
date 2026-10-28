import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
function appearance(code,options={}){
 const store=new Map(),root={dataset:{},classList:{toggle(){}}};
 const account={id:'user-a',user_metadata:options.metadata||{}},writes=[];
 const app={user:account,db:{auth:{getUser:options.getUser|| (async()=>({data:{user:account}})),updateUser:async value=>{writes.push(value);return{data:{user:account}}}},from(){throw Error('Legacy table should not be required for metadata preferences');}}};
 const context={window:{NOOR_AI_APP:app,addEventListener(){},dispatchEvent(){}},document:{documentElement:root,querySelectorAll(){return[]}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},CustomEvent:class{},console,setTimeout:()=>1,clearTimeout(){}};
 runInNewContext(code,context);return{api:context.window.NOOR_THEME_SETTINGS,root,app,writes,store,account};
}
test('appearance sync saves all-page dark mode without relying on obsolete palette constraints',async()=>{
 const x=appearance(await source('theme-system.js'),{metadata:{noor_appearance:{theme_key:'linen-pearl',color_mode:'light',updated_at:'2026-10-28T10:00:00Z'}}});
 await x.api.loadForCurrentUser();
 assert.equal(x.root.dataset.noorTheme,'linen-pearl');
 x.api.setMode('dark');await x.api.flush();
 assert.equal(x.root.dataset.noorMode,'dark');
 assert.equal(x.store.get('noor.login-mode'),'dark');
 assert.equal(x.writes[0].data.noor_appearance.color_mode,'dark');
 assert.equal(x.writes[0].data.noor_appearance.theme_key,'linen-pearl');
});
test('late account load cannot undo a newer appearance selection',async()=>{
 let resolve;
 const x=appearance(await source('theme-system.js'),{getUser:()=>new Promise(r=>resolve=r)});
 const loading=x.api.loadForCurrentUser();x.api.setMode('dark');
 resolve({data:{user:{id:'user-a',user_metadata:{noor_appearance:{theme_key:'rose-whisper',color_mode:'light',updated_at:'2099-01-01'}}}}});
 await loading;assert.equal(x.root.dataset.noorMode,'dark');
});
test('a switched account cannot receive another account’s queued preference save',async()=>{
 const x=appearance(await source('theme-system.js'));x.api.setMode('dark');
 const writing=x.api.flush();x.app.user={id:'user-b'};await writing;
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
