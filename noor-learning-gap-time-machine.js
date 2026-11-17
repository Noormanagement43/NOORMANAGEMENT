/* School & College Learning Gap Time Machine: teacher-reviewed evidence, no synthetic outcomes. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ID=v=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(v||''));
const early=v=>/^(nursery|lkg|ukg|kg|kg ?1|kg ?2|kindergarten|pre.?kg)$/i.test(String(v||'').trim());
let dlg=null,session=null,serial=0,featureKey='',featureAllowed=null,featureLoading=false;
const title='Learning Gap Time Machine';
const empty='<p class="lgt-empty">Not Enough Evidence. Learning findings appear only after real teacher-reviewed assessments.</p>';
function button(text,action,extra=''){return '<button type="button" data-lgt="'+E(action)+'" '+extra+'>'+E(text)+'</button>';}
function status(text){const el=dlg?.querySelector('[data-lgt-status]');if(el)el.textContent=text||'';}
function check(c){if(!c||A().user?.id!==c.userId||A().schoolId!==c.school.id)throw Error('Your school session changed. Reopen this page.');}
async function qry(c,table,cols='*',filter={}){check(c);let q=c.db.from(table).select(cols).eq('institution_id',c.school.id);for(const [key,val] of Object.entries(filter))q=q.eq(key,val);const r=await q.limit(500);if(r.error)throw r.error;check(c);return r.data||[];}
async function rpc(c,name,params){check(c);const r=await c.db.rpc(name,params);if(r.error)throw r.error;check(c);return r.data;}
const time=v=>v?new Date(v).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
const txt=v=>String(v??'').trim();
function box(head,content){return '<section class="lgt-card"><h3>'+E(head)+'</h3>'+content+'</section>';}
function layout(head,content){dlg.querySelector('[data-lgt-main]').innerHTML='<header class="lgt-head"><span>SCHOOL & COLLEGE · LEARNING INTELLIGENCE</span><h2>'+E(head)+'</h2></header>'+content;}
function field(name,label,value='',kind='text'){return '<label class="lgt-field">'+E(label)+(kind==='textarea'?'<textarea name="'+E(name)+'" maxlength="1800">'+E(value)+'</textarea>':'<input name="'+E(name)+'" value="'+E(value)+'" maxlength="1800">')+'</label>';}
function studentOwn(c,member){return c.membership.id===member;}
function conceptsById(items){return new Map(items.map(x=>[x.id,x]));}
async function base(){const c=await window.NOOR_SHARED_TIMETABLE.context();if(!c?.school?.id||!ID(c.school.id))throw Error('Verified institution required');return c;}
async function verifyFeature(a,key){
 if(featureLoading)return;
 featureLoading=true;
 try{
  const access=await a.db.rpc('noor_feature_access',{p_institution:a.schoolId});
  if(featureKey!==key)return;
  featureAllowed=!access.error&&!access.data?.paused&&access.data?.features?.learning_gap_time_machine===true;
 }catch{if(featureKey===key)featureAllowed=false;}
 finally{featureLoading=false;if(featureKey===key&&featureAllowed)attach();}
}
function attach(){
 const a=A(),p=a.profile,root=document.querySelector('#workspace:not(.hidden)');
 if(!root||!p||p.status!=='active'||!a.user||!a.schoolId||!window.NOOR_SHARED_TIMETABLE?.context)return;
 const key=a.user.id+':'+a.schoolId;
 if(featureKey!==key){featureKey=key;featureAllowed=null;root.querySelectorAll('[data-lgt-launcher]').forEach(x=>x.remove());}
 if(featureAllowed===null){void verifyFeature(a,key);return;}
 if(!featureAllowed)return;
 const role=p.role,scope=role==='student'?'#view-student-progress':role==='teacher'?'#view-teacher-classroom':role==='parent'?'#view-overview':role==='principal'||role==='manager'?'#view-overview':null;
 if(!scope)return;
 const host=document.querySelector(scope)||document.querySelector('#view-overview');
 if(!host||host.querySelector('[data-lgt-launcher]'))return;
 const strip=document.createElement('section');strip.className='lgt-launcher';strip.dataset.lgtLauncher='';strip.innerHTML='<div><b>'+E(role==='student'?'My Learning Journey':role==='parent'?'Learning at home':title)+'</b><small>Curriculum-based progress, practice and improvement</small></div>'+button('Open learning journey','open');
 host.append(strip);
}
function observe(){const root=document.getElementById('workspace');if(!root)return;new MutationObserver(()=>attach()).observe(root,{subtree:true,childList:true,attributes:false});attach();}
async function open(){
 if(dlg?.isConnected){dlg.showModal?.();return;}
 dlg=document.createElement('dialog');dlg.className='lgt-dialog';dlg.setAttribute('aria-label',title);
 dlg.innerHTML='<div class="lgt-bar"><strong>'+E(title)+'</strong>'+button('Close','close')+'</div><div data-lgt-main class="lgt-main">Checking your school and classroom access…</div><p class="lgt-status" data-lgt-status role="status"></p>';
 document.body.append(dlg);dlg.addEventListener('close',()=>{dlg.remove();dlg=null;session=null;serial++;});dlg.showModal();const n=++serial;
 try {
  const c=await base();if(n!==serial)return;const access=await c.db.rpc('noor_feature_access',{p_institution:c.school.id});if(access.error||access.data?.features?.learning_gap_time_machine!==true||access.data?.paused)throw Error('Learning intelligence is not enabled for your school.');session=c;
  const role=A().profile.role;
  if(role==='teacher')await teacher(c);
  else if(role==='student')await student(c);
  else if(role==='parent')await parent(c);
  else if(role==='principal'||role==='manager')await principal(c);
  else layout(title,empty);
 }catch(e){if(n===serial&&dlg)layout('Cannot open learning journey',box('Access check', '<p>'+E(e.message||e)+'</p>'));}
}
async function teacher(c,groupId,studentId,subjectInput=''){
 const groups=await window.NOOR_TEACHER_DATA.assignments(c);
 if(!groups.length){layout('Teacher Learning Overview',box('Assigned classes','<p>No active teaching group assigned. School leadership can assign your class and section.</p>'));return;}
 const selected=groups.find(g=>g.group_id===groupId)||groups[0],cls=selected.class_id;
 const [all,qs,periods,deps]=await Promise.all([
  qry(c,'learning_concepts','id,class_group_id,subject_name,concept_title,status,created_at,curriculum_version'),
  c.db.from('noor_weekly_quizzes').select('id,academic_group_id,title,subject_name,questions,quiz_date').eq('institution_id',c.school.id).eq('academic_group_id',selected.group_id).order('quiz_date',{ascending:false}).limit(40),
  c.db.from('teacher_timetable_periods').select('subject_name').eq('institution_id',c.school.id).eq('academic_group_id',selected.group_id).limit(100),
  qry(c,'concept_dependencies','concept_id,prerequisite_concept_id')]);
 if(qs.error)throw qs.error;if(periods.error)throw periods.error;check(c);
 const groupConcepts=all.filter(x=>x.class_group_id===cls&&x.status!=='archived');
 const options=[...new Set([...groupConcepts.map(x=>x.subject_name),...(qs.data||[]).map(q=>q.subject_name),...(periods.data||[]).map(q=>q.subject_name)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const subject=(subjectInput?.trim()||options[0]||'Mathematics').slice(0,140);
 const versions=[...new Set(groupConcepts.filter(x=>x.subject_name.toLowerCase()===subject.toLowerCase()).map(x=>x.curriculum_version))];
 const concepts=groupConcepts.filter(x=>x.subject_name.toLowerCase()===subject.toLowerCase());
 const conceptMap=conceptsById(concepts);
 const dependencies=deps.filter(x=>conceptMap.has(x.concept_id)&&conceptMap.has(x.prerequisite_concept_id));
 const iso=d=>new Date(d).toISOString().slice(0,10);
 const now=new Date(),previous=new Date(now.getTime()-365*86400000);
 const r=await c.db.rpc('noor_class_performance',{p_institution:c.school.id,p_group:selected.group_id,p_from:iso(previous),p_to:iso(now)});
 if(r.error)throw r.error;check(c);
 const roster=(r.data?.students||[]).filter(x=>ID(x.membership_id)).slice(0,500);
 const target=roster.find(x=>x.membership_id===studentId)||null;
 const quizRows=(qs.data||[]).filter(q=>String(q.subject_name).toLowerCase()===subject.toLowerCase());
 const input='<div class="lgt-filters"><label>Class / Section<select data-lgt-group>'+
 groups.map(g=>'<option value="'+E(g.group_id)+'" '+(selected.group_id===g.group_id?'selected':'')+'>'+E(g.class_label)+'</option>').join('')+
 '</select></label><label>Subject<input data-lgt-subject list="lgtSubjects" value="'+E(subject)+'" maxlength="140"><datalist id="lgtSubjects">'+options.map(v=>'<option value="'+E(v)+'">').join('')+'</datalist></label>'+
 '<div class="lgt-inline">'+button('Load subject','load-subject')+'</div><label>Student<select data-lgt-student><option value="">Select a student</option>'+
 roster.map(x=>'<option value="'+E(x.membership_id)+'" '+(target?.membership_id===x.membership_id?'selected':'')+'>'+E(x.name)+'</option>').join('')+'</select></label></div>';
 let html=input+'<div class="lgt-stats">'+box('Students assessed',String(roster.filter(x=>x.assessments>0).length))+
 box('Teacher-approved concepts',String(concepts.filter(x=>x.status==='approved').length))+
 box('Class / Stream',E(selected.class_label))+'</div>';
 html+=box('Curriculum concept map','<p>Build each subject with your school or college syllabus. Teacher must review every concept and prerequisite.</p>'+
 '<form data-lgt-create-concept><div class="lgt-filters"><label>Concept title<input name="title" required minlength="2" maxlength="120" placeholder="e.g. Place Value / Fractions / Thermodynamics"></label>'+
 '<label>Curriculum version<input name="version" required maxlength="40" value="'+E(versions[0]||'school-v1')+'"></label>'+
 '<label>Prerequisite (optional)<select name="prerequisite"><option value="">No prerequisite</option>'+concepts.filter(x=>x.status==='approved').map(k=>'<option value="'+E(k.id)+'">'+E(k.concept_title)+' · '+E(k.curriculum_version)+'</option>').join('')+'</select></label></div>'+
 '<label><input type="checkbox" name="approve" required> I checked this concept against the school syllabus.</label>'+
 '<button type="submit">Approve & add concept</button></form>'+
 '<div class="lgt-graph">'+dependencies.map(d=>'<p>'+E(conceptMap.get(d.prerequisite_concept_id)?.concept_title||'Prerequisite')+' → '+E(conceptMap.get(d.concept_id)?.concept_title||'Topic')+'</p>').join('')+
 '</div>'+(concepts.length?'<p>'+concepts.map(x=>E(x.concept_title)+' ('+E(x.curriculum_version)+')').join(' · ')+'</p>':'<p>No concepts configured for this subject yet.</p>')+
 '<small>Prerequisite links identify possibilities, not verified root causes.</small>');
 if(concepts.length&&quizRows.length)html+=box('Map real assessment questions','<p>Mapping is teacher-approved. Only checked, saved results contribute evidence.</p>'+
 quizRows.slice(0,8).map(q=>(q.questions||[]).slice(0,30).map((item,i)=>
 '<div class="lgt-map-line"><small>'+E(time(q.quiz_date))+' · '+E(q.title)+'</small><p>Q'+(i+1)+'. '+E(item.prompt)+'</p>'+
 '<select data-lgt-map-quiz="'+E(q.id)+'" data-lgt-map-index="'+i+'"><option value="">Choose concept</option>'+
 concepts.filter(k=>k.status==='approved').map(k=>'<option value="'+E(k.id)+'">'+E(k.concept_title)+'</option>').join('')+
 '</select></div>').join('')).join(''));
 else html+=box('Assessment evidence','<p>No mapped, teacher-approved '+E(subject)+' test available in this section yet. For younger learners, use teacher competency observations instead.</p>');
 if(target&&concepts.length){
  const [mastery,findings,evidence,plans,timeline]=await Promise.all([
    qry(c,'student_concept_mastery','student_membership_id,concept_id,evidence_count,source_count,confidence,estimated_mastery,mastery_state,last_checked_at',{student_membership_id:target.membership_id}),
    qry(c,'learning_gap_findings','student_membership_id,concept_id,status,evidence_summary,confidence',{student_membership_id:target.membership_id}),
    qry(c,'student_concept_evidence','student_membership_id,concept_id,source_type,earned,possible,assessed_at',{student_membership_id:target.membership_id}),
    qry(c,'learning_recovery_plans','id,student_membership_id,concept_id,teacher_status,generated_plan,assigned_at',{student_membership_id:target.membership_id}),
    qry(c,'learning_timeline_events','student_membership_id,concept_id,event_type,occurred_at',{student_membership_id:target.membership_id})]);
  const selectedRows=items=>items.filter(x=>x.student_membership_id===target.membership_id);
  html+=box('Student Learning Detail · '+target.name,concepts.map(k=>{
    const m=selectedRows(mastery).find(x=>x.concept_id===k.id),f=selectedRows(findings).find(x=>x.concept_id===k.id);
    const ev=selectedRows(evidence).filter(x=>x.concept_id===k.id),p=selectedRows(plans).filter(x=>x.concept_id===k.id);
    const related=dependencies.filter(d=>d.concept_id===k.id).map(d=>{
     const name=conceptMap.get(d.prerequisite_concept_id)?.concept_title||'Earlier concept';
     const mastery=selectedRows(mastery).find(x=>x.concept_id===d.prerequisite_concept_id);
     return name+': '+(mastery?.mastery_state||'Not Enough Evidence');
    });
    const verified=m?.evidence_count>=3&&m?.source_count>=2;
    return '<article class="lgt-concept"><h4>'+E(k.concept_title)+'</h4><p><b>'+E(verified?m.mastery_state:'Not Enough Evidence')+
    '</b> · '+(m?.evidence_count||0)+' evidence items · '+(m?.source_count||0)+' assessment sources</p>'+
    '<small>Confidence: '+(verified?Math.round(m.confidence*100)+'%':'Not Enough Evidence')+' · Last: '+E(time(m?.last_checked_at))+'</small>'+
    '<details><summary>Why might this student need extra support?</summary><p>Verified responses: '+E(ev.map(x=>x.earned+'/'+x.possible+' ('+x.source_type+')').join(', ')||'No saved assessment evidence')+'</p>'+
    '<p>Possible prerequisites (not confirmed): '+E(related.join('; ')||'No prerequisite mapped')+'</p>'+
    '<p>Recovery plans: '+p.length+'</p>'+
    (early(selected.class_name)?button('Record playful observation','observe:'+k.id+':'+target.membership_id):
      button('Record micro-diagnostic','diagnostic:'+k.id+':'+target.membership_id))+
    (f?.status==='needs_review'?button('Confirm observed gap','confirm:'+k.id+':'+target.membership_id)+button('Dismiss suggestion','dismiss:'+k.id+':'+target.membership_id):'')+
    (f?.status==='confirmed'?button('Prepare recovery plan','plan:'+k.id+':'+target.membership_id):'')+
    (p.some(x=>x.teacher_status==='completed')?button('Reassess learning','reassess:'+p.find(x=>x.teacher_status==='completed').id+':'+k.id+':'+target.membership_id):'')+
    (f?.status==='confirmed'&&m?.estimated_mastery>=75?button('Mark resolved','resolve:'+k.id+':'+target.membership_id):'')+
    '</details></article>';
  }).join('')+'<p class="lgt-foot">One wrong answer cannot confirm a learning gap. All decisions can be reviewed by the teacher.</p>');
  html+=box('Historical learning timeline',selectedRows(timeline).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))).slice(0,20).map(x=>'<p>'+E(time(x.occurred_at))+' · '+E(x.event_type.replaceAll('_',' '))+'</p>').join('')||empty);
 }
 layout('Class Learning Overview',html);
 const groupControl=dlg.querySelector('[data-lgt-group]');
 if(groupControl)groupControl.onchange=e=>teacher(c,e.target.value,null,'');
 const studentControl=dlg.querySelector('[data-lgt-student]');
 if(studentControl)studentControl.onchange=e=>teacher(c,selected.group_id,e.target.value,subject);
 const form=dlg.querySelector('[data-lgt-create-concept]');
 if(form)form.onsubmit=async e=>{
  e.preventDefault();const values=new FormData(form);const title=txt(values.get('title'));const version=txt(values.get('version'));
  const prereq=txt(values.get('prerequisite'))||null;if(values.get('approve')!=='on')return;
  const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{await rpc(c,'noor_lg_add_concept',{p_group:selected.group_id,p_subject:subject,p_title:title,p_curriculum_version:version,p_prerequisite:prereq});
   await teacher(c,selected.group_id,target?.membership_id||null,subject);status('Teacher-reviewed concept saved to this school.');}
  catch(error){status(error.message||String(error));btn.disabled=false;}
 };
}
function observationPanel(c,concept,member){
 const examples=[
 'Show or point to an example of '+concept.concept_title+'.',
 'Use a picture, toy or classroom object to demonstrate '+concept.concept_title+'.',
 'Repeat the concept with different concrete objects.'
 ];
 layout('Playful Teacher Observation',box('Age-appropriate competency check',
 '<p>Observe three short activities without requiring the child to read or type. Review each observation before saving. One observation session is not enough to confirm a learning gap.</p>'+
 '<form data-lgt-observation>'+examples.map((x,i)=>field('a'+i,'Activity '+(i+1),x)+
 '<label>Observed outcome '+(i+1)+'<select name="s'+i+'"><option value="">Choose after observing</option><option value="true">Demonstrated</option><option value="false">More practice helpful</option></select></label>').join('')+
 '<button type="submit">Save teacher observations</button></form>'));
 const form=dlg.querySelector('[data-lgt-observation]');
 form.onsubmit=async e=>{
  e.preventDefault();const v=new FormData(form);
  const activities=examples.map((_,i)=>({activity:txt(v.get('a'+i)),demonstrated:v.get('s'+i)==='true'}));
  if(examples.some((_,i)=>!['true','false'].includes(v.get('s'+i)))){status('Choose an observed result for each activity.');return;}
  const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{await rpc(c,'noor_lg_observe',{p_student:member,p_concept:concept.id,p_activities:activities});
    status('Teacher observations recorded with real dates. Review further evidence before confirming any gap.');
  }catch(error){status(error.message||String(error));}finally{btn.disabled=false;}
 };
}
function diagnosticPanel(c,concept,member,planId=null){
 const examples=['Explain '+concept.concept_title+' in your own words or with an example.',
 'Show the steps or give a worked example of '+concept.concept_title+'.',
 'Apply '+concept.concept_title+' to a new real-life or class-related example.'];
 layout(planId?'Recovery Reassessment':'Teacher-reviewed Micro-diagnostic',box('3 targeted questions',
 '<p>These are editable draft prompts, not verified student results. Ask one concept per question and record actual responses after review.</p>'+
 '<form data-lgt-diagnostic>'+examples.map((x,i)=>field('q'+i,'Question '+(i+1),x)+
 '<label>Observed answer '+(i+1)+'<select name="s'+i+'"><option value="">Choose after assessment</option><option value="0">Not yet demonstrated</option><option value="1">Demonstrated</option></select></label>').join('')+
 '<button type="submit">Record checked evidence</button></form>'));
 const form=dlg.querySelector('[data-lgt-diagnostic]');
 form.onsubmit=async e=>{
  e.preventDefault();const v=new FormData(form),questions=examples.map((_,i)=>txt(v.get('q'+i)));
  if(examples.some((_,i)=>!['0','1'].includes(v.get('s'+i)))){status('Score each question after assessing the learner.');return;}
  const scores=examples.map((_,i)=>Number(v.get('s'+i))),btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{await (planId?rpc(c,'noor_lg_reassess',{p_plan:planId,p_questions:questions,p_scores:scores}):
    rpc(c,'noor_lg_diagnostic',{p_student:member,p_concept:concept.id,p_questions:questions,p_scores:scores}));
   status(planId?'Reassessment saved. Teacher must review improvement before resolution.':'Diagnostic evidence saved. Further independent evidence may be needed.');
  }catch(error){status(error.message||String(error));}finally{btn.disabled=false;}
 };
}
function planPanel(c,concept,member){
 layout('Recovery Plan Review',box('Teacher-approved 5–10 minute activity','<p>Use a short visual explanation, a guided example and one independent practice. Edit before assigning.</p><form data-lgt-plan>'+field('lesson','5–10 minute micro-lesson','Explain '+concept.concept_title+' using a visual, example or hands-on activity appropriate to the learner. Model one simple example.','textarea')+
 field('practice','One short independent activity','Practice one short '+concept.concept_title+' activity. Explain or demonstrate the reasoning.','textarea')+field('followup','Follow-up date (optional)','')+
 '<label><input type="checkbox" name="approve" required> I checked the lesson and practice against the school syllabus.</label><button type="submit">Approve & assign to student</button></form>'));
 dlg.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.target,v=new FormData(f);try{f.querySelector('button').disabled=true;await rpc(c,'noor_lg_review',{p_student:member,p_concept:concept.id,p_action:'assign_plan',p_plan:{lesson:txt(v.get('lesson')),practice:txt(v.get('practice')),follow_up:txt(v.get('followup'))}});status('Teacher-approved recovery activity assigned.');}catch(ex){status(ex.message||String(ex));}finally{f.querySelector('button').disabled=false;}};
}
async function student(c){
 const [all,m,p,t]=await Promise.all([
  qry(c,'learning_concepts','id,concept_title,status,class_group_id,subject_name'),
  qry(c,'student_concept_mastery','student_membership_id,concept_id,mastery_state,evidence_count,estimated_mastery'),
  qry(c,'learning_recovery_plans','id,student_membership_id,concept_id,teacher_status,generated_plan,assigned_at'),
  qry(c,'learning_timeline_events','student_membership_id,concept_id,event_type,occurred_at')
 ]);
 const by=conceptsById(all.filter(x=>x.status==='approved')),mine=m.filter(x=>studentOwn(c,x.student_membership_id)),plans=p.filter(x=>studentOwn(c,x.student_membership_id)&&['assigned','completed'].includes(x.teacher_status));
 const milestones=t.filter(x=>studentOwn(c,x.student_membership_id)).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))).slice(0,8);
 layout('My Learning Journey',box('Topics I understand',mine.filter(x=>x.mastery_state==='Demonstrated Mastery').map(x=>'<p>✓ '+E(by.get(x.concept_id)?.concept_title)+'</p>').join('')||empty)+
 box('Topics I am practising',mine.filter(x=>x.mastery_state!=='Demonstrated Mastery'&&x.mastery_state!=='Not Enough Evidence').map(x=>'<p>'+E(by.get(x.concept_id)?.concept_title)+' · '+E(x.mastery_state)+'</p>').join('')||empty)+
 box('My next learning activity',plans.map(x=>'<article class="lgt-concept"><h4>'+E(by.get(x.concept_id)?.concept_title||'Your practice')+'</h4><p>'+E(x.generated_plan?.lesson)+'</p><p><b>Try:</b> '+E(x.generated_plan?.practice)+'</p><small>'+E(x.teacher_status)+'</small>'+(x.teacher_status==='assigned'?button('I have completed this practice','complete:'+x.id):'')+'</article>').join('')||'<p>Your teacher has not assigned a recovery activity yet.</p>')+
 box('My improvement milestones',milestones.map(x=>'<p>'+E(time(x.occurred_at))+' · '+E(x.event_type.replaceAll('_',' '))+'</p>').join('')||'<p>New milestones will appear as you practise.</p>'));
}
async function parent(c){
 const preferred=String(A().profile?.preferred_language||'en').toLowerCase();
 const lang=preferred.includes('urdu')||preferred==='ur'?'ur':
   preferred.includes('telugu')||preferred==='te'?'te':
   preferred.includes('hindi')||preferred==='hi'?'hi':'en';
 const words={
 en:{heading:'Family Learning Summary',home:'Support at home',none:'Teacher-approved progress appears when your school verifies your child link.',activity:'Try a calm, ten-minute learning activity using examples at home.',foot:'Only your linked child and approved learning guidance are visible.'},
 ur:{heading:'بچے کی تعلیمی پیش رفت',home:'گھر میں مدد',none:'اسکول کے تصدیق شدہ رابطے کے بعد ہی بچے کی تعلیمی معلومات دکھائی جائیں گی۔',activity:'گھر میں مثالوں کے ذریعے دس منٹ کی آسان مشق کریں۔',foot:'صرف آپ کے منسلک بچے کی منظور شدہ تعلیمی رہنمائی دکھائی جاتی ہے۔'},
 te:{heading:'పిల్లల అభ్యాస పురోగతి',home:'ఇంట్లో అభ్యాస సహాయం',none:'పాఠశాల మీ పిల్లల అనుబంధాన్ని నిర్ధారించిన తర్వాతే సమాచారం కనిపిస్తుంది.',activity:'ఇంట్లో ఉదాహరణలతో పది నిమిషాలు సరదాగా సాధన చేయండి.',foot:'మీతో అనుసంధానమైన పిల్లల ఆమోదించిన విద్యా సమాచారం మాత్రమే కనిపిస్తుంది.'},
 hi:{heading:'बच्चे की सीखने की प्रगति',home:'घर पर सहायता',none:'विद्यालय द्वारा बच्चे का संबंध सत्यापित करने पर ही जानकारी दिखेगी।',activity:'घर पर उदाहरणों के साथ दस मिनट का सरल अभ्यास करें।',foot:'केवल आपके जुड़े हुए बच्चे की स्वीकृत शैक्षिक जानकारी दिखाई जाती है।'}
 }[lang];
 const links=await qry(c,'noor_guardian_links','guardian_membership_id,student_membership_id');
 const ids=links.filter(x=>x.guardian_membership_id===c.membership.id).map(x=>x.student_membership_id);
 if(!ids.length){layout(words.heading,box(words.home,'<p>'+E(words.none)+'</p>'));return;}
 const [mastery,concepts]=await Promise.all([
  qry(c,'student_concept_mastery','student_membership_id,concept_id,mastery_state'),
  qry(c,'learning_concepts','id,concept_title,subject_name,status')]);
 const by=conceptsById(concepts.filter(x=>x.status==='approved'));
 const visible=mastery.filter(x=>ids.includes(x.student_membership_id)&&by.has(x.concept_id)).slice(0,20);
 layout(words.heading,box(words.home,visible.map(x=>
 '<p><b>'+E(by.get(x.concept_id).subject_name+' · '+by.get(x.concept_id).concept_title)+'</b> · '+E(x.mastery_state)+'. '+E(words.activity)+'</p>').join('')||empty)+
 '<p class="lgt-foot">'+E(words.foot)+'</p>');
}
async function principal(c){
 const data=await rpc(c,'noor_lg_principal_summary',{p_institution:c.school.id});
 layout('Principal Learning Intelligence','<div class="lgt-stats">'+
 box('Students with sufficient evidence',String(data?.assessed_students||0))+
 box('Findings awaiting teacher review',String(data?.findings_to_review||0))+
 box('Completed recovery activities',String(data?.completed_plans||0))+'</div>'+
 box('Class, Stream & Subject support', (data?.scopes||[]).map(x=>
 '<p><b>'+E(x.group_name)+' · '+E(x.subject_name)+'</b> · '+E(x.concept_count)+' concepts · '+E(x.recheck_count)+' need recheck · '+E(x.evidence_pending)+' without enough evidence</p>').join('')||empty)+
 '<p class="lgt-foot">School-wide aggregate only. No private student or teacher notes are displayed.</p>');
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-lgt]');if(!b)return;
 const act=b.dataset.lgt;if(act==='open'){await open();return;}if(act==='close'){dlg?.close();return;}
 const c=session;if(!c||!dlg)return;
 try{
    if(act==='load-subject'){const el=dlg.querySelector('[data-lgt-subject]'),group=dlg.querySelector('[data-lgt-group]'),student=dlg.querySelector('[data-lgt-student]');await teacher(c,group.value,student?.value||null,el.value);return;}
  if(act.startsWith('confirm:')||act.startsWith('resolve:')||act.startsWith('dismiss:')){const [action,concept,member]=act.split(':');await rpc(c,'noor_lg_review',{p_student:member,p_concept:concept,p_action:action});status('Teacher review saved.');return;}
  if(act.startsWith('complete:')){await rpc(c,'noor_lg_complete',{p_plan:act.split(':')[1]});await student(c);return;}
  if(act.startsWith('diagnostic:')||act.startsWith('plan:')||act.startsWith('reassess:')||act.startsWith('observe:')){const parts=act.split(':');const action=parts[0],id=action==='reassess'?parts[2]:parts[1],member=action==='reassess'?parts[3]:parts[2],planId=action==='reassess'?parts[1]:null;const all=await qry(c,'learning_concepts','id,concept_title,status');const concept=all.find(x=>x.id===id);if(!concept)throw Error('Concept no longer available.');if(action==='observe')observationPanel(c,concept,member);else if(action==='diagnostic'||action==='reassess')diagnosticPanel(c,concept,member,planId);else planPanel(c,concept,member);return;}
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