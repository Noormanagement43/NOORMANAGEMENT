/* Class 3 Maths Learning Gap Time Machine. Existing navigation and branding remain unchanged. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ID=v=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(v||''));
const class3=v=>/^(?:3|3rd|class\s*3|grade\s*3|third)$/i.test(String(v||'').trim());
let dlg=null,session=null,serial=0;
const title='Learning Gap Time Machine';
const empty='<p class="lgt-empty">Not Enough Evidence. Learning findings appear only after real teacher-reviewed assessments.</p>';
function button(text,action,extra=''){return '<button type="button" data-lgt="'+E(action)+'" '+extra+'>'+E(text)+'</button>';}
function status(text){const el=dlg?.querySelector('[data-lgt-status]');if(el)el.textContent=text||'';}
function check(c){if(!c||A().user?.id!==c.userId||A().schoolId!==c.school.id)throw Error('Your school session changed. Reopen this page.');}
async function qry(c,table,cols='*'){check(c);const r=await c.db.from(table).select(cols).eq('institution_id',c.school.id);if(r.error)throw r.error;check(c);return r.data||[];}
async function rpc(c,name,params){check(c);const r=await c.db.rpc(name,params);if(r.error)throw r.error;check(c);return r.data;}
const time=v=>v?new Date(v).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
const txt=v=>String(v??'').trim();
function box(head,content){return '<section class="lgt-card"><h3>'+E(head)+'</h3>'+content+'</section>';}
function layout(head,content){dlg.querySelector('[data-lgt-main]').innerHTML='<header class="lgt-head"><span>CLASS 3 · MATHEMATICS PILOT</span><h2>'+E(head)+'</h2></header>'+content;}
function field(name,label,value='',kind='text'){return '<label class="lgt-field">'+E(label)+(kind==='textarea'?'<textarea name="'+E(name)+'" maxlength="1800">'+E(value)+'</textarea>':'<input name="'+E(name)+'" value="'+E(value)+'" maxlength="1800">')+'</label>';}
function studentOwn(c,member){return c.membership.id===member;}
function conceptsById(items){return new Map(items.map(x=>[x.id,x]));}
async function base(){const c=await window.NOOR_SHARED_TIMETABLE.context();if(!c?.school?.id||!ID(c.school.id))throw Error('Verified institution required');return c;}
function attach(){
 const a=A(),p=a.profile,root=document.querySelector('#workspace:not(.hidden)');
 if(!root||!p||p.status!=='active'||!a.user||!a.schoolId||!window.NOOR_SHARED_TIMETABLE?.context)return;
 const role=p.role,scope=role==='student'?'#view-student-progress':role==='teacher'?'#view-teacher-classroom':role==='parent'?'#view-overview':role==='principal'||role==='manager'?'#view-overview':null;
 if(!scope)return;
 const host=document.querySelector(scope)||document.querySelector('#view-overview');
 if(!host||host.querySelector('[data-lgt-launcher]'))return;
 const strip=document.createElement('section');strip.className='lgt-launcher';strip.dataset.lgtLauncher='';strip.innerHTML='<div><b>'+E(role==='student'?'My Learning Journey':role==='parent'?'Learning at home':title)+'</b><small>Class 3 Maths · concept evidence & supportive practice</small></div>'+button('Open learning journey','open');
 host.append(strip);
}
function observe(){const root=document.getElementById('workspace');if(!root)return;new MutationObserver(()=>attach()).observe(root,{subtree:true,childList:true,attributes:false});attach();}
async function open(){
 if(dlg?.isConnected){dlg.showModal?.();return;}
 dlg=document.createElement('dialog');dlg.className='lgt-dialog';dlg.setAttribute('aria-label',title);
 dlg.innerHTML='<div class="lgt-bar"><strong>'+E(title)+'</strong>'+button('Close','close')+'</div><div data-lgt-main class="lgt-main">Checking your school and classroom access…</div><p class="lgt-status" data-lgt-status role="status"></p>';
 document.body.append(dlg);dlg.addEventListener('close',()=>{dlg.remove();dlg=null;session=null;serial++;});dlg.showModal();const n=++serial;
 try {
  const c=await base();if(n!==serial)return;session=c;
  const role=A().profile.role;
  if(role==='teacher')await teacher(c);
  else if(role==='student')await student(c);
  else if(role==='parent')await parent(c);
  else if(role==='principal'||role==='manager')await principal(c);
  else layout(title,empty);
 }catch(e){if(n===serial&&dlg)layout('Cannot open learning journey',box('Access check', '<p>'+E(e.message||e)+'</p>'));}
}
async function teacher(c,groupId,studentId){
 const groups=(await window.NOOR_TEACHER_DATA.assignments(c)).filter(g=>class3(g.class_name));
 if(!groups.length){layout('Teacher Learning Overview',box('Class 3 required','<p>The pilot is limited to your assigned Class 3 sections. No eligible section is assigned to this account.</p>'));return;}
 const selected=groups.find(g=>g.group_id===groupId)||groups[0],cls=selected.class_id;
 const all=await qry(c,'learning_concepts','id,class_group_id,concept_title,status,created_at');
 const concepts=all.filter(x=>x.class_group_id===cls);
 const dependencies=(await qry(c,'concept_dependencies','concept_id,prerequisite_concept_id')).filter(x=>concepts.some(k=>k.id===x.concept_id));
 const conceptMap=conceptsById(concepts);
 const [raw,quizzes]=await Promise.all([
 c.db.rpc('noor_class_performance',{p_institution:c.school.id,p_group:selected.group_id,p_from:'2025-01-01',p_to:'2027-12-31'}),
 c.db.from('noor_weekly_quizzes').select('id,academic_group_id,title,subject_name,questions,quiz_date').eq('institution_id',c.school.id).eq('academic_group_id',selected.group_id).order('quiz_date',{ascending:false}).limit(20)]);
 if(raw.error)throw raw.error;if(quizzes.error)throw quizzes.error;check(c);
 const roster=(raw.data?.students||[]).filter(x=>ID(x.membership_id));
 const target=roster.find(x=>x.membership_id===studentId)||roster[0]||null;
 const filter='<div class="lgt-filters"><label>Class / Section<select data-lgt-group>'+groups.map(g=>'<option value="'+E(g.group_id)+'" '+(selected.group_id===g.group_id?'selected':'')+'>'+E(g.class_label)+'</option>').join('')+'</select></label><label>Student<select data-lgt-student><option value="">Choose student</option>'+roster.map(s=>'<option value="'+E(s.membership_id)+'" '+(target?.membership_id===s.membership_id?'selected':'')+'>'+E(s.name)+'</option>').join('')+'</select></label></div>';
 let html=filter+'<div class="lgt-stats">'+box('Students assessed',String(roster.filter(s=>s.assessments>0).length))+
 box('Approved concepts',String(concepts.filter(x=>x.status==='approved').length))+
 box('Pilot',E(selected.class_label))+'</div>';
 if(!concepts.length)html+=box('Start the concept map','<p>Place Value → Regrouping → Multi-digit Subtraction → Complex Arithmetic. Teacher approval is required before quiz mapping.</p>'+button('Create Class 3 concept map','pilot'));
 else html+=box('Prerequisite concept map','<div class="lgt-graph">'+dependencies.map(d=>'<p>'+E(conceptMap.get(d.prerequisite_concept_id)?.concept_title||'Earlier concept')+' → '+E(conceptMap.get(d.concept_id)?.concept_title||'Next concept')+'</p>').join('')+'</div><small>These links are curriculum suggestions, not confirmed root causes.</small>');
 if(concepts.length&&(quizzes.data||[]).length)html+=box('Map approved quiz questions','<p>Choose a teacher-reviewed concept for each actual quiz question.</p>'+quizzes.data.filter(q=>/math/i.test(q.subject_name)).slice(0,5).map(q=>(q.questions||[]).map((x,i)=>'<div class="lgt-map-line"><small>'+E(time(q.quiz_date))+' · '+E(q.title)+'</small><p>Q'+(i+1)+'. '+E(x.prompt)+'</p><select data-lgt-map-quiz="'+E(q.id)+'" data-lgt-map-index="'+i+'"><option value="">Choose concept</option>'+concepts.map(k=>'<option value="'+E(k.id)+'">'+E(k.concept_title)+'</option>').join('')+'</select></div>').join('')).join(''));
 else html+=box('Real quiz evidence','<p>No teacher-approved Class 3 Maths quiz is available for this section yet. Existing quiz marks are never invented.</p>');
 if(target&&concepts.length){
  const [mastery,findings,evidence,plans,timeline]=await Promise.all([
    qry(c,'student_concept_mastery','student_membership_id,concept_id,evidence_count,source_count,confidence,estimated_mastery,mastery_state,last_checked_at'),
    qry(c,'learning_gap_findings','student_membership_id,concept_id,status,evidence_summary,confidence'),
    qry(c,'student_concept_evidence','student_membership_id,concept_id,source_type,earned,possible,assessed_at'),
    qry(c,'learning_recovery_plans','id,student_membership_id,concept_id,teacher_status,generated_plan,assigned_at'),
    qry(c,'learning_timeline_events','student_membership_id,concept_id,event_type,occurred_at')]);
  const mine=x=>x.filter(v=>v.student_membership_id===target.membership_id);
  html+=box('Student Learning Detail · '+target.name,concepts.map(k=>{
    const m=mine(mastery).find(x=>x.concept_id===k.id),f=mine(findings).find(x=>x.concept_id===k.id),ev=mine(evidence).filter(x=>x.concept_id===k.id),p=mine(plans).filter(x=>x.concept_id===k.id);
    const prerequisites=dependencies.filter(d=>d.concept_id===k.id).map(d=>conceptMap.get(d.prerequisite_concept_id)).filter(Boolean);
    const related=prerequisites.map(pr=>{const source=mine(mastery).find(x=>x.concept_id===pr.id);return pr.concept_title+': '+(source?.mastery_state||'Not Enough Evidence')+' ('+(source?.evidence_count||0)+' evidence items)';});
    const verified=m?.evidence_count>=3&&m?.source_count>=2;
    return '<article class="lgt-concept"><h4>'+E(k.concept_title)+'</h4><p><b>'+E(verified?m.mastery_state:'Not Enough Evidence')+'</b> · '+(m?.evidence_count||0)+' evidence items · '+(m?.source_count||0)+' assessment sources</p><small>Confidence: '+(verified?Math.round(m.confidence*100)+'%':'Not Enough Evidence')+' · Last: '+E(time(m?.last_checked_at))+'</small>'+
    '<details><summary>Why is this student struggling? · Evidence</summary><p>Observed answers: '+E(ev.map(x=>x.earned+'/'+x.possible+' ('+x.source_type+')').join(', ')||'No saved evidence')+'</p><p>' +E('Possible prerequisite causes (not confirmed): '+(related.join('; ')||'No prerequisite mapped yet'))+' <p>Teacher should confirm understanding using separate diagnostic questions.</p></p><p>Recovery plans: '+p.length+'; latest '+E(p[p.length-1]?.teacher_status||'none')+'</p>'+button('Record 3-question diagnostic','diagnostic:'+k.id+':'+target.membership_id)+(f?.status==='needs_review'?button('Confirm observed gap','confirm:'+k.id+':'+target.membership_id)+button('Dismiss suggestion','dismiss:'+k.id+':'+target.membership_id):'')+(f?.status==='confirmed'?button('Prepare recovery plan','plan:'+k.id+':'+target.membership_id):'')+(f?.status==='confirmed'&&m?.estimated_mastery>=75?button('Mark resolved','resolve:'+k.id+':'+target.membership_id):'')+(p.some(x=>x.teacher_status==='completed')?button('Reassess learning','reassess:'+p.find(x=>x.teacher_status==='completed').id+':'+k.id+':'+target.membership_id):'')+'</details></article>';
  }).join('')+'<p class="lgt-foot">A single incorrect answer cannot confirm a learning gap. Teacher approval is mandatory.</p>');
  html+=box('Learning timeline',mine(timeline).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))).slice(0,12).map(t=>'<p>'+E(time(t.occurred_at))+' · '+E(t.event_type.replaceAll('_',' '))+'</p>').join('')||empty);
 }
 layout('Class Learning Overview',html);dlg.querySelector('[data-lgt-group]').onchange=e=>teacher(c,e.target.value);
 dlg.querySelector('[data-lgt-student]').onchange=e=>teacher(c,selected.group_id,e.target.value);
}
function diagnosticPanel(c,concept,member,planId=null){
 const names={'Place Value':['What is the value of 5 in 352?','Write 423 in hundreds, tens and ones.','Which is greater: 309 or 390?'],
 'Regrouping':['Show one ten as ten ones using blocks.','Explain 42 - 18 using tens and ones.','How many tens are left after regrouping in 63 - 27?'],
 'Multi-digit Subtraction':['Work out 321 - 105.','Work out 403 - 178.','Explain your first regrouping step in 532 - 276.'],
 'Complex Arithmetic':['Solve 310 - 145.','Solve 240 + 175.','Explain how regrouping helps in multi-step arithmetic.']};
 const samples=names[concept.concept_title]||['Explain this concept in your own words.','Solve a simple example using this concept.','Show the steps and explain why they work.'];
 layout(planId?'Recovery reassessment':'Micro-diagnostic review',box('Teacher-reviewed questions','<p>Review or edit each Class 3 Maths question. Score each answer after assessing the student. Do not treat these examples as verified student responses.</p><form data-lgt-diagnostic>'+samples.map((q,i)=>field('q'+i,'Question '+(i+1),q)+ '<label>Result '+(i+1)+'<select name="s'+i+'"><option value="0">Needs more practice</option><option value="1">Correct / demonstrated</option></select></label>').join('')+'<button type="submit">Save diagnostic evidence</button></form>'));
 dlg.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.target,v=new FormData(f);const questions=samples.map((_,i)=>txt(v.get('q'+i))),scores=samples.map((_,i)=>Number(v.get('s'+i)));
  try{f.querySelector('button').disabled=true;await (planId?rpc(c,'noor_lg_reassess',{p_plan:planId,p_questions:questions,p_scores:scores}):rpc(c,'noor_lg_diagnostic',{p_student:member,p_concept:concept.id,p_questions:questions,p_scores:scores}));status(planId?'Reassessment saved with before/after evidence. Teacher must confirm any resolution.':'Diagnostic saved with current timestamp; refresh learning overview to review all evidence.');}
  catch(ex){status(ex.message||String(ex));}finally{f.querySelector('button').disabled=false;}
 };
}
function planPanel(c,concept,member){
 layout('Recovery Plan Review',box('Teacher-approved 5–10 minute activity','<p>Use a short visual explanation, a guided example and one independent practice. Edit before assigning.</p><form data-lgt-plan>'+field('lesson','5–10 minute micro-lesson','Use counters or place-value blocks to explain '+concept.concept_title+'. Model one example with the learner.','textarea')+
 field('practice','One short independent activity','Try one new '+concept.concept_title+' problem with a visual model. Explain each step.','textarea')+field('followup','Follow-up date (optional)','')+
 '<label><input type="checkbox" name="approve" required> I checked the lesson and practice against the school syllabus.</label><button type="submit">Approve & assign to student</button></form>'));
 dlg.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.target,v=new FormData(f);try{f.querySelector('button').disabled=true;await rpc(c,'noor_lg_review',{p_student:member,p_concept:concept.id,p_action:'assign_plan',p_plan:{lesson:txt(v.get('lesson')),practice:txt(v.get('practice')),follow_up:txt(v.get('followup'))}});status('Teacher-approved recovery activity assigned.');}catch(ex){status(ex.message||String(ex));}finally{f.querySelector('button').disabled=false;}};
}
async function student(c){
 const [all,m,p,t]=await Promise.all([
  qry(c,'learning_concepts','id,concept_title,status,class_group_id'),
  qry(c,'student_concept_mastery','student_membership_id,concept_id,mastery_state,evidence_count,estimated_mastery'),
  qry(c,'learning_recovery_plans','id,student_membership_id,concept_id,teacher_status,generated_plan,assigned_at'),
  qry(c,'learning_timeline_events','student_membership_id,concept_id,event_type,occurred_at')
 ]);
 const by=conceptsById(all),mine=m.filter(x=>studentOwn(c,x.student_membership_id)),plans=p.filter(x=>studentOwn(c,x.student_membership_id)&&['assigned','completed'].includes(x.teacher_status));
 const milestones=t.filter(x=>studentOwn(c,x.student_membership_id)).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))).slice(0,8);
 layout('My Learning Journey',box('Topics I understand',mine.filter(x=>x.mastery_state==='Demonstrated Mastery').map(x=>'<p>✓ '+E(by.get(x.concept_id)?.concept_title)+'</p>').join('')||empty)+
 box('Topics I am practising',mine.filter(x=>x.mastery_state!=='Demonstrated Mastery'&&x.mastery_state!=='Not Enough Evidence').map(x=>'<p>'+E(by.get(x.concept_id)?.concept_title)+' · '+E(x.mastery_state)+'</p>').join('')||empty)+
 box('My next learning activity',plans.map(x=>'<article class="lgt-concept"><h4>'+E(by.get(x.concept_id)?.concept_title||'Maths practice')+'</h4><p>'+E(x.generated_plan?.lesson)+'</p><p><b>Try:</b> '+E(x.generated_plan?.practice)+'</p><small>'+E(x.teacher_status)+'</small>'+(x.teacher_status==='assigned'?button('I have completed this practice','complete:'+x.id):'')+'</article>').join('')||'<p>Your teacher has not assigned a recovery activity yet.</p>')+
 box('My improvement milestones',milestones.map(x=>'<p>'+E(time(x.occurred_at))+' · '+E(x.event_type.replaceAll('_',' '))+'</p>').join('')||'<p>New milestones will appear as you practise.</p>'));
}
async function parent(c){
 const links=await qry(c,'noor_guardian_links','guardian_membership_id,student_membership_id');
 const ids=links.filter(x=>x.guardian_membership_id===c.membership.id).map(x=>x.student_membership_id);
 if(!ids.length){layout('Family Learning Summary',box('Read-only','<p>Teacher-approved progress appears here only when the school has verified your child link.</p>'));return;}
 const [mastery,concepts]=await Promise.all([qry(c,'student_concept_mastery','student_membership_id,concept_id,mastery_state'),qry(c,'learning_concepts','id,concept_title')]);const by=conceptsById(concepts);
 layout('Family Learning Summary',box('Support at home',mastery.filter(x=>ids.includes(x.student_membership_id)).slice(0,10).map(x=>'<p>'+E(by.get(x.concept_id)?.concept_title||'Maths')+' · '+E(x.mastery_state)+'. Try a 10-minute counting or place-value activity together.</p>').join('')||empty)+'<p class="lgt-foot">This read-only summary never shows other students or private teacher notes.</p>');
}
async function principal(c){
 const [concepts,mastery,findings,plans]=await Promise.all([
  qry(c,'learning_concepts','id,class_group_id,concept_title'),
  qry(c,'student_concept_mastery','concept_id,student_membership_id,mastery_state'),
  qry(c,'learning_gap_findings','concept_id,status'),
  qry(c,'learning_recovery_plans','concept_id,teacher_status')]);
 const ids=new Set(concepts.map(x=>x.id));const relevant=mastery.filter(x=>ids.has(x.concept_id));
 const totals={assessed:new Set(relevant.filter(x=>x.mastery_state!=='Not Enough Evidence').map(x=>x.student_membership_id)).size,
 review:findings.filter(x=>ids.has(x.concept_id)&&['needs_review','confirmed'].includes(x.status)).length,
 completed:plans.filter(x=>ids.has(x.concept_id)&&x.teacher_status==='completed').length};
 layout('Principal Learning Intelligence', '<div class="lgt-stats">'+box('Students with sufficient evidence',totals.assessed)+box('Concept findings to review',totals.review)+box('Completed practice plans',totals.completed)+'</div>'+
 box('School-wide concept support',concepts.map(x=>'<p>'+E(x.concept_title)+' · '+relevant.filter(m=>m.concept_id===x.id&&m.mastery_state==='Recheck Recommended').length+' rechecks recommended</p>').join('')||empty)+
 '<p class="lgt-foot">Aggregated Class 3 Maths evidence only. Educational risk estimates are not diagnoses or guaranteed predictions.</p>');
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-lgt]');if(!b)return;
 const act=b.dataset.lgt;if(act==='open'){await open();return;}if(act==='close'){dlg?.close();return;}
 const c=session;if(!c||!dlg)return;
 try{
  if(act==='pilot'){const groups=(await window.NOOR_TEACHER_DATA.assignments(c)).filter(g=>class3(g.class_name));if(!groups.length)return;await rpc(c,'noor_lg_start_pilot',{p_class:groups[0].class_id});status('Class 3 concept map created; approve via question mapping.');await teacher(c,groups[0].group_id);return;}
  if(act.startsWith('confirm:')||act.startsWith('resolve:')||act.startsWith('dismiss:')){const [action,concept,member]=act.split(':');await rpc(c,'noor_lg_review',{p_student:member,p_concept:concept,p_action:action});status('Teacher review saved.');return;}
  if(act.startsWith('complete:')){await rpc(c,'noor_lg_complete',{p_plan:act.split(':')[1]});await student(c);return;}
  if(act.startsWith('diagnostic:')||act.startsWith('plan:')||act.startsWith('reassess:')){const parts=act.split(':');const action=parts[0],id=action==='reassess'?parts[2]:parts[1],member=action==='reassess'?parts[3]:parts[2],planId=action==='reassess'?parts[1]:null;const all=await qry(c,'learning_concepts','id,concept_title,status');const concept=all.find(x=>x.id===id);if(!concept)throw Error('Concept no longer available.');if(action==='diagnostic'||action==='reassess')diagnosticPanel(c,concept,member,planId);else planPanel(c,concept,member);return;}
 }catch(ex){status(ex.message||String(ex));}
});
document.addEventListener('change',async e=>{
 const x=e.target;if(!x.matches('[data-lgt-map-quiz]')||!session||!x.value)return;
 try{const c=session;await rpc(c,'noor_lg_map_question',{p_quiz:x.dataset.lgtMapQuiz,p_index:Number(x.dataset.lgtMapIndex),p_concept:x.value});status('Quiz concept mapping approved. Reviewed submissions will be processed once only.');}
 catch(ex){status(ex.message||String(ex));}
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
window.NOOR_LEARNING_GAP=Object.freeze({open});
})();