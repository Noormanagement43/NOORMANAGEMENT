import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('the left drawer is the only mobile role navigation; no bottom shortcut bar is rendered',async()=>{
 const html=await read('index.html'),css=await read('noor-clean-phone.css'),drawer=await read('noor-mobile-drawer.js');
 const start=html.indexOf('function renderMobileNav(){'),end=html.indexOf('function renderWorkspace(){',start);
 assert(start>=0&&end>start);
 const fn=html.slice(start,end);
 assert.match(fn,/if\(bar\)bar\.remove\(\)/);
 assert.doesNotMatch(fn,/createElement\(['"]nav|innerHTML|appendChild/);
 assert.doesNotMatch(html,/noorMobileNav.*querySelectorAll/);
 assert.match(css,/#workspace #noorMobileNav.*display:none/s);
 assert.match(drawer,/sidebar\.classList\.contains\('open'\)/);
});
