import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../noor-assessment-studio.js',import.meta.url),'utf8'),window={};vm.runInNewContext(source,{window});const restore=window.NOOR_WEEKLY_QUIZ.restoreDraft;
const json=x=>JSON.parse(JSON.stringify(x));
test('unsynced answers on this device are restored after leaving without submission',()=>{assert.deepEqual(json(restore(JSON.stringify({answers:['0','own answer'],dirty:true}),['',''])),{answers:['0','own answer'],dirty:true});});
test('a clean old device cache cannot overwrite newer server answers',()=>{assert.deepEqual(json(restore(JSON.stringify({answers:['old'],dirty:false}),['new'])),{answers:['new'],dirty:false});});
test('invalid cache cannot replace server answers',()=>{for(const raw of ['bad JSON',JSON.stringify({answers:['bad','extra'],dirty:true}),JSON.stringify({answers:[2],dirty:true})])assert.deepEqual(json(restore(raw,['saved'])),{answers:['saved'],dirty:false});});
test('legacy draft arrays can recover answers only when the server draft is empty',()=>{assert.deepEqual(json(restore('["0"]',[''])),{answers:['0'],dirty:true});assert.deepEqual(json(restore('["0"]',['1'])),{answers:['1'],dirty:false});});
