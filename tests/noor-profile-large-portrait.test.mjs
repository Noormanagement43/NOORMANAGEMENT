import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const get=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('all role portraits use the principal reference dimensions, without oversized minimum heights',async()=>{
 const s=await get('noor-profile-portraits.css');
 for(const role of ['.noor-profile-avatar.avatar','.nt-photo','.pd-photo','.sp-avatar'])assert.ok(s.includes(role));
 assert.match(s,/width:140px!important;height:185px!important/);
 assert.match(s,/width:115px!important;height:150px!important/);
 assert.doesNotMatch(s,/min-height:(?:475|425|385|310|265)px/);
 assert.match(s,/object-fit:cover!important/);
 assert.match(await get('index.html'),/noor-profile-portraits\.css\?v=20261028-principal-size-v3/);
});
