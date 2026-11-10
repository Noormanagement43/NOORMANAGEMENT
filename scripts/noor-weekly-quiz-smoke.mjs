import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 for(const viewport of [{width:390,height:844},{width:1366,height:900}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!doctype html><style>body{margin:0;padding:12px;background:#faf6f8}*{box-sizing:border-box}</style><main id="host"></main>');
  await page.addStyleTag({content:await readFile(new URL('../noor-weekly-quiz.css',import.meta.url),'utf8')});
  await page.evaluate(()=>{
   const teacher={id:'tm',role:'teacher'},student={id:'sm',role:'student'},school={id:'school',name:'Al-Falah School',timezone:'Asia/Kolkata'};
   window.testState={quizzes:[],attempts:[],published:0,submitted:0,approved:0,role:'teacher',today:'2026-11-14'};
   const s=window.testState;
   const draft={title:'Weekly Addition',questions:[{type:'mcq',prompt:'2+2?',options:['3','4'],marks:2},{type:'blank',prompt:'5 minus __ is 3',options:['2','3'],marks:1},{type:'short',prompt:'Explain addition',options:[],marks:3}],answer_key:[{answer:'1'},{answer:'0'},{answer:'Combining quantities',rubric:'3 marks for clear explanation'}]};
   const db={from(table){const b={select(){return b;},eq(){return b;},in(){return b;},order(){return b;},limit(){return b;},then(resolve){return Promise.resolve({data:table==='teacher_timetable_periods'?[{subject_name:'Maths',academic_group_id:'g'}]:table==='noor_weekly_quizzes'?s.quizzes:table==='noor_quiz_attempts'?s.attempts:[]}).then(resolve);}};return b;},
   functions:{invoke:async(_,input)=>({data:{output:input.body.action==='quiz'?structuredClone(draft):{scores:[{number:3,marks:2,reason:'Partial explanation'}]}}})},
   rpc:async(name,p)=>{
    if(name==='noor_publish_quiz'){s.published++;s.quizzes.push({id:'q',institution_id:'school',academic_group_id:p.p_group,title:p.p_title,subject_name:p.p_subject,quiz_date:p.p_date,questions:p.p_questions,max_marks:6});return{data:'q'};}
    if(name==='noor_submit_quiz'){s.submitted++;if(s.attempts.length)return{error:{message:'Final submission is locked'}};s.attempts.push({id:'a',quiz_id:'q',student_membership_id:'sm',answers:p.p_answers,objective_marks:3,correct_count:2,wrong_count:0,unanswered_count:0,pending_count:1});return{data:'a'};}
    if(name==='noor_quiz_review_data')return{data:{answer_key:draft.answer_key,students:[{membership_id:'sm',name:'Ayesha'}]}};
    if(name==='noor_approve_quiz_marks'){s.approved++;Object.assign(s.attempts[0],{reviewed_at:'2026-11-14',final_marks:5,pending_count:0,short_scores:p.p_short_scores});return{data:'result'};}
    if(name==='noor_quiz_result_key')return{data:s.today==='2026-11-14'?[]:[{number:1,answer:'B'},{number:2,answer:'A'},{number:3,answer:'Combining quantities'}]};
    throw Error('Unexpected RPC '+name);
   }};
   const context=async()=>({db,userId:s.role==='teacher'?'teacher':'student',membership:s.role==='teacher'?teacher:student,school});
   window.NOOR_AI_APP={db,user:{id:'teacher'},schoolId:'school',profile:{full_name:'Ayesha',requested_class_name:'Class 8',requested_section_name:'A'}};
   window.NOOR_SHARED_TIMETABLE={context,schoolDay:()=>s.today};window.NOOR_TEACHER_DATA={context,assignments:async()=>[{group_id:'g',class_label:'Class 8 · A'}]};
  });
  await page.addScriptTag({content:await readFile(new URL('../noor-weekly-quiz.js',import.meta.url),'utf8')});
  await page.evaluate(()=>NOOR_WEEKLY_QUIZ.teacher(document.getElementById('host')));
  await page.locator('[name=subject]').fill('Maths');await page.locator('[name=count]').fill('3');await page.locator('[name=source]').fill('Addition and subtraction');
  await page.getByRole('button',{name:'Create quiz draft',exact:true}).click();await page.getByRole('button',{name:'Approve & Publish Quiz'}).waitFor();
  assert.equal(await page.evaluate(()=>testState.published),0,'Draft must not publish itself');
  await page.locator('[name=prompt_0]').fill('What is 2 + 2?');await page.locator('[name=approved]').check();await page.getByRole('button',{name:'Approve & Publish Quiz'}).click();await page.getByText('Teacher-approved quiz published for 2026-11-14.').waitFor();
  await page.evaluate(()=>{testState.role='student';NOOR_AI_APP.user.id='student';document.getElementById('host').replaceChildren();return NOOR_WEEKLY_QUIZ.student(document.getElementById('host'));});
  assert.ok(await page.getByText('Al-Falah School',{exact:true}).count());assert.ok(await page.getByText('Ayesha',{exact:true}).count());
  await page.locator('[name=answer_0][value="0"]').check();await page.locator('[name=answer_0][value="1"]').check();await page.locator('[name=answer_1][value="0"]').check();await page.locator('[name=answer_2]').fill('Combining quantities');
  await page.getByRole('button',{name:'Save Final Answers',exact:true}).click();await page.getByRole('button',{name:'Keep editing'}).click();assert.equal(await page.evaluate(()=>testState.submitted),0);
  await page.evaluate(()=>{document.getElementById('host').replaceChildren();return NOOR_WEEKLY_QUIZ.student(document.getElementById('host'));});
  assert.equal(await page.locator('[name=answer_2]').inputValue(),'Combining quantities','Refresh retains unsaved answers for this account');
  assert.ok(await page.locator('[name=answer_0][value="1"]').isChecked());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No phone overflow');
  await page.screenshot({path:'/tmp/noor-quiz-'+viewport.width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Save Final Answers',exact:true}).click();await page.locator('dialog [data-final]').click();await page.getByText('Final answers saved · Locked',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-attempt]').count(),0);assert.equal(await page.evaluate(()=>testState.submitted),1);assert.deepEqual(await page.evaluate(()=>testState.attempts[0].answers),['1','0','Combining quantities']);
  assert.ok(await page.getByText(/Provisional, awaiting teacher approval/).count());assert.equal(await page.evaluate(()=>testState.approved),0);
  await page.evaluate(()=>{testState.role='teacher';NOOR_AI_APP.user.id='teacher';return NOOR_WEEKLY_QUIZ.teacher(document.getElementById('host'));});
  await page.getByRole('button',{name:'Review submissions & approve marks'}).click();await page.getByRole('button',{name:'Suggest short-answer marks'}).click();await page.getByText('Suggested marks only. Review and approve before publishing.').waitFor();
  assert.equal(await page.locator('[name=score_2]').inputValue(),'2');assert.equal(await page.evaluate(()=>testState.approved),0);
  await page.locator('[name=approve]').check();await page.getByRole('button',{name:'Approve & Add Weekly Marks'}).click();await page.getByText('Approved: 5 / 6 · Added to weekly subject marks.').waitFor();assert.equal(await page.evaluate(()=>testState.approved),1);
  await page.evaluate(()=>{testState.role='student';testState.today='2026-11-15';NOOR_AI_APP.user.id='student';document.getElementById('host').replaceChildren();return NOOR_WEEKLY_QUIZ.student(document.getElementById('host'));});await page.getByText('Answer key: 1. B · 2. A · 3. Combining quantities',{exact:true}).waitFor();
  assert.equal(await page.getByText(/Gemini|Groq/).count(),0,'Provider names stay out of the interface');assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('PASS: teacher draft approval, online answer changes, confirmation cancel, refresh recovery, single locked save, teacher grade approval, compact answer key, mobile/desktop layout.');
}finally{await browser.close();}
