import {chromium} from 'playwright';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=new URL('preview/principal-dashboard-preview.html',process.env.SITE_URL||'http://127.0.0.1:8060/');
 await page.goto(url.href);await page.waitForSelector('#noor-principal');
 await page.waitForFunction(()=>document.querySelector('#pd-status')?.textContent.includes('updated'));
 const assert=(value,message)=>{if(!value)throw Error(message)};
 assert(await page.locator('.pd-kpi').count()===4,'four real-data KPIs');
 assert(await page.locator('#pd-kpis').innerText().then(t=>!t.includes('1,250')&&!t.includes('90.2%')),'no fictional KPI figures');
 assert((await page.locator('#pd-trend').innerText()).includes('No attendance records'),'no-data attendance fallback');
 assert((await page.locator('#pd-periods').innerText()).includes('No approved class periods'),'no-data period fallback');
 await page.click('#pd-mode');assert(await page.locator('#noor-principal').evaluate(el=>el.classList.contains('pd-dark')),'theme toggle');
 await page.locator('[data-route="notices"]').first().click();assert((await page.locator('#preview-toast').innerText()).includes('notices'),'notices quick route');
 await page.click('[data-route="school-tasks"]');assert((await page.locator('#preview-toast').innerText()).includes('school-tasks'),'tasks quick route');

 // In-browser reversible access UX with isolated mock members: no real students modified.
 await page.waitForSelector('#noorMemberControl .ac-search');
 await page.evaluate(()=>{
   const a=window.NOOR_AI_APP;
   const oldFrom=a.db.from.bind(a.db);
   a.db.from=(table)=>{
     if(table!=='profiles'&&table!=='school_memberships')return oldFrom(table);
     const q={select(){return q},eq(){return q},in(){return q},ilike(){return q},order(){return q},limit(){return q},
       then(resolve,reject){
         const data=table==='profiles'?
           [{id:'fixture-student',full_name:'Sample Student',email:'student@example.invalid',role:'student',
             status:'active',avatar_path:null,roll_number:'01'}]:
           [{user_id:'fixture-student',role:'student',status:'active'}];
         return Promise.resolve({data,error:null}).then(resolve,reject);
       }};
     return q;
   };
   a.db.rpc=async (name,options)=>{
     if(name!=='noor_set_member_access')throw new Error('Wrong access RPC: '+name);
     (window.__noorAccessCalls ||= []).push({name,options});
     return {data:{user_id:options.p_user_id,role:'student',
       membership_status:options.p_action==='pause'?'suspended':'active',
       profile_status:options.p_action==='pause'?'inactive':'active'},error:null};
   };
 });
 await page.fill('#noorMemberControl .ac-search','Sample');
 await page.waitForSelector('[data-person="fixture-student"]');
 await page.click('[data-person="fixture-student"]');
 assert(await page.locator('#noorMemberControl .ac-photo').count()===1,'large member photo/profile');
 page.on('dialog',dialog=>dialog.accept());
 await page.click('#noorMemberControl [data-access="pause"]');
 await page.waitForSelector('#noorMemberControl [data-access="reactivate"]');
 await page.click('#noorMemberControl [data-access="reactivate"]');
 await page.waitForSelector('#noorMemberControl [data-access="pause"]');
 const calls=await page.evaluate(()=>window.__noorAccessCalls||[]);
 assert(calls.length===2&&calls[0].options.p_action==='pause'&&calls[1].options.p_action==='reactivate','pause/reactivate actions use secure RPC');
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=390),'mobile overflow');
 await page.evaluate(()=>{window.NOOR_AI_APP.profile.role='student';window.NOOR_PRINCIPAL_STUDIO.render()});
 assert(await page.locator('#noor-principal').count()===0,'student cannot open principal dashboard');
 assert(!errors.length,errors.join('\n'));
 console.log('PASS: live KPIs, empty states, principal member search/photo, pause/reactivate RPC, mobile, role guard');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
