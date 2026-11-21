import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('universal search clear helper covers native search, labelled and dynamically marked search inputs',async()=>{
 const code=await read('noor-common-controls.js');
 for(const pattern of ['input[type="search"]','input[placeholder*="search" i]','input[aria-label*="search" i]','input[name*="search" i]','input[class*="search" i]','input[id*="search" i]','input[data-search]','input[data-filter-search]'])assert.ok(code.includes(pattern));
 assert.match(code,/new MutationObserver/);
 assert.match(code,/dispatchEvent\(new Event\('input'/);
 assert.match(code,/dispatchEvent\(new Event\('change'/);
 assert.match(code,/aria-label','Clear search'/);
 assert.match(code,/input\.focus\(\)/);
 assert.match(code,/dataset\.noorSearchClear==='ready'/);
});
test('search clear styling follows selected school theme and remains keyboard visible',async()=>{
 const css=await read('noor-common-controls.css');
 assert.match(css,/color:var\(--berry/);
 assert.match(css,/\.noor-clear-search:focus-visible/);
 assert.match(css,/\.noor-clear-search\[hidden\]/);
});
