import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('feature toggles have unequivocal red OFF / green ON state with white sliding thumb',()=>{
 const school=read('noor-feature-controls.css'),creator=read('creator/creator.css');
 assert.match(school,/\.nfc-switch\[aria-checked="false"\][\s\S]*?background:#ee2541!important/);
 assert.match(school,/\.nfc-switch\[aria-checked="true"\][\s\S]*?background:#08a838!important/);
 assert.match(creator,/\.nc-toggle:not\(\.on\)[\s\S]*?background:#ee2541!important/);
 assert.match(creator,/\.nc-toggle\.on[\s\S]*?background:#08a838!important/);
 assert.match(school,/\.nfc-switch::after/);
 assert.match(creator,/\.nc-toggle::after/);
});
test('the user supplied avatar is a lightweight WEBP committed as a real local file',()=>{
 const bytes=readFileSync(new URL('../assets/school-assistant-avatar.webp',import.meta.url));
 assert.ok(bytes.length>700&&bytes.length<20_000);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
});
test('floating assistant is the same draggable launcher with image and only AI visible',()=>{
 const code=read('noor-floating-ai.js'),style=read('noor-floating-ai.css');
 assert.match(code,/school-assistant-avatar\.webp/);
 assert.match(code,/noor-floating-ai-copy"><strong>AI<\/strong>/);
 assert.doesNotMatch(code,/(Ask NOOR AI|Drag to move|NOOR Guide)/);
 assert.match(code,/setPointerCapture/);
 assert.match(code,/pointermove/);
 assert.match(code,/NOOR_SECURE_AI\.open\(\)/);
 assert.match(style,/noorAssistantFloat/);
 assert.match(style,/#noorFloatingAI\.noor-floating-ai\[hidden\]\{display:none!important\}/);
 assert.match(style,/prefers-reduced-motion:reduce/);
});
test('chat is white labelled Your School Assistant and retains app access verification',()=>{
 const code=read('noor-secure-assistant.js');
 assert.match(code,/Your School Assistant/);
 assert.match(code,/school-assistant-avatar\.webp/);
 assert.doesNotMatch(code,/>NOOR Assistant<|NOOR Guide/);
 assert.match(code,/await verify\(scope\)/);
 assert.match(code,/data-new/);
 assert.match(code,/data-clear/);
 const style=read('noor-app-help.css');
 assert.match(style,/\.nh-starters button:nth-child\(4n\+2\)/);
});
test('primary application sidebar navConfig stays unchanged by this visual release',()=>{
 const index=read('index.html');
 assert.match(index,/function navConfig\(\)/);
 assert.match(index,/id:'manager-activities'/);
 assert.match(index,/id:'feature-controls'/);
 assert.match(index,/noor-floating-ai\.js\?v=20261116-portrait-2/);
});
