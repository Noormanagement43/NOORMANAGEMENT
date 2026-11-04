import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
 const page=await browser.newPage({viewport});const failures=[];page.on('pageerror',e=>failures.push(e.message));
 await page.setContent('<!doctype html><style>:root{--paper:#fffdfb;--canvas:#fff8f5;--ink:#2c2027;--muted:#806f79;--line:#ead9df;--berry:#54243b;--rose-soft:#f8eaf0;--rose-line:#e9cfda;--gold:#d6b174}</style><main id="settings"></main>');
 await page.addStyleTag({content:await readFile(new URL('../noor-secure-assistant.css',import.meta.url),'utf8')});
 await page.evaluate(()=>{window.calls=[];window.NOOR_AI_APP={user:{id:'test-user'},schoolId:'test-school',profile:{status:'active',role:'teacher'},db:{functions:{invoke:async(name,{body})=>{window.calls.push({name,body});return{data:body.action==='probe'?{brain:{key_saved:true,verified:true},manager:{key_saved:false}}:{response:'Teacher-reviewed test draft',...(body.action==='manager_plan'?{plan:'Proposed test plan'}:{})}}}}}}});
 await page.addScriptTag({content:await readFile(new URL('../noor-secure-assistant.js',import.meta.url),'utf8')});
 assert.equal(await page.locator('#noorAIModal').count(),0,'AI must open only on user action');
 await page.evaluate(()=>window.NOOR_SECURE_AI.mountSettings(document.getElementById('settings')));
 await page.getByRole('button',{name:'Open AI workspace'}).click();
 assert.equal(await page.locator('#noorAIConnectionTools').isVisible(),false,'Teacher must not see manager controls');
 await page.locator('#noorAIPrompt').fill('Draft a clear lesson');await page.locator('#noorAISend').click();
 await page.getByText('Teacher-reviewed test draft',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls[0].name),'noor-v2-ai');
 assert.equal(await page.evaluate(()=>window.calls[0].body.institution_id),'test-school');
 await page.locator('#noorAIClose').click();
 await page.evaluate(()=>{window.NOOR_AI_APP.profile.role='principal';window.NOOR_SECURE_AI.open()});
 await page.getByRole('button',{name:'Check AI connection'}).click();
 await page.getByText('Brain: model access verified; generation not tested · Manager: key missing',{exact:true}).waitFor();
 await page.locator('#noorAIPrompt').fill('Prepare a school plan');await page.getByRole('button',{name:'Manager + brain draft'}).click();
 await page.getByText(/Manager plan:/).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.at(-1).body.action),'manager_plan');
 const bounds=await page.locator('.noor-ai-v2-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+1,'Dialog overflows viewport');
 assert.deepEqual(failures,[]);
 await page.screenshot({path:'/tmp/noor-ai-workspace-'+viewport.width+'.png'});
 console.log('PASS: AI settings, role controls, canonical API, manager mode and responsive dialog',viewport.width);
 await page.close();
 }
}finally{await browser.close()}
