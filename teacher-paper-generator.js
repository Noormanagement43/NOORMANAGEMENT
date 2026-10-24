/* NOOR: editable teacher AI papers. Source photos and short descriptions are optional alternatives. */
(()=>{'use strict';
const a=()=>window.NOOR_AI_APP||{},e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPE={assignment:'Assignment',weekly_test:'Weekly Paper',practice:'Practice Worksheet',quiz:'Quiz'};
let v=null,draftId=null,output=null,waiting=false,paperContexts=[];
const style=document.createElement('style');style.textContent=[
'#view-paper-generator{--p:#60283e;--ink:#3a2730;color:var(--ink);max-width:1200px;margin:auto}',
'#view-paper-generator .pp-head{display:flex;align-items:start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px}',
'#view-paper-generator h1{font-size:clamp(24px,3vw,32px);color:#4d1c32;margin:5px 0}',
'#view-paper-generator h2{font-size:18px;color:#512339;margin:0 0 12px}',
'#view-paper-generator .pp-sub{font-size:12px;color:#806d78;line-height:1.65}',
'#view-paper-generator .pp-layout{display:grid;grid-template-columns:1.05fr .95fr;gap:15px}',
'#view-paper-generator .pp-card{background:white;border:1px solid #eddeea;border-radius:21px;padding:clamp(15px,2vw,22px);margin-bottom:15px;box-shadow:0 9px 30px #4c1e3c12}',
'#view-paper-generator .pp-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
'#view-paper-generator label{display:grid;gap:7px;font-weight:800;color:#673549;font-size:12px}',
'#view-paper-generator label.wide{grid-column:1/-1}',
'#view-paper-generator input,#view-paper-generator select,#view-paper-generator textarea{font:inherit;font-size:13px;width:100%;min-width:0;border:1px solid #e4ced8;border-radius:12px;padding:11px;background:#fffcfd;color:#3a2931}',
'#view-paper-generator textarea{min-height:120px;resize:vertical;line-height:1.55}',
'#view-paper-generator .pp-file{border:2px dashed #e1c6d3;border-radius:14px;padding:14px;background:#fff7fa}',
'#view-paper-generator .pp-btn{background:#64263f;color:white;border:0;border-radius:12px;padding:11px 15px;font-size:12px;font-weight:850;cursor:pointer}',
'#view-paper-generator .pp-btn.soft{background:#f7eaf0;border:1px solid #eacbd9;color:#6f3049}',
'#view-paper-generator .pp-btn:disabled{opacity:.5}',
'#view-paper-generator .pp-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}',
'#view-paper-generator .pp-notice{padding:12px;border-radius:13px;background:#fff5e7;color:#875c2d;font-size:11px;line-height:1.65}',
'#view-paper-generator .pp-status{font-size:12px;color:#763a55;min-height:18px}',
'#view-paper-generator .pp-preview{white-space:pre-wrap;background:#fffdfa;border:1px solid #e7d6df;border-radius:13px;padding:14px;font-size:12px;line-height:1.7;max-height:450px;overflow:auto}',
'#view-paper-generator .pp-list>div{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #eee2e8;padding:12px 0}',
'#view-paper-generator .pp-list strong{display:block;font-size:12px}#view-paper-generator .pp-list small{font-size:11px;color:#836e79}',
'#noorPaperPrint{display:none}',
'@media(max-width:820px){#view-paper-generator .pp-layout{grid-template-columns:1fr}}',
'@media(max-width:500px){#view-paper-generator .pp-fields{grid-template-columns:1fr}}',
'@media print{body>*:not(#noorPaperPrint){display:none!important}#noorPaperPrint{display:block!important;font:12pt/1.5 Arial,sans-serif;white-space:pre-wrap;padding:0}#noorPaperPrint pre{font:11pt/1.5 Arial,sans-serif;white-space:pre-wrap}@page{margin:17mm}}'
].join('');document.head.append(style);
const $=s=>v?.querySelector(s),ready=()=>a().profile?.role==='teacher'&&a().profile?.status==='active'&&a().schoolId&&a().user;
function status(s){const x=$('#ppStatus');if(x)x.textContent=s}
const readFile=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>no(Error('Could not read image.'));r.readAsDataURL(f)});
function paperText(o){
 let out=[o?.title||'Assignment',o?.instructions?'Instructions: '+o.instructions:''];
 for(const [i,x] of (o?.questions||[]).entries()){
  out.push('\n'+(i+1)+'. '+String(x.question||x.prompt||'')+(x.marks?' ('+x.marks+' marks)':''));
  if(Array.isArray(x.options))out.push(x.options.map((v,j)=>String.fromCharCode(65+j)+'. '+v).join('\n'));
 }
 return out.filter(Boolean).join('\n');
}
function answerText(o){return (o?.answer_key||[]).map((x,i)=>{x=typeof x==='string'?{answer:x}:x||{};return (x.number||i+1)+'. '+String(x.answer||'Teacher review required')+(x.explanation?'\n'+x.explanation:'')}).join('\n\n')}
function display(title,paper,answers){$('#ppTitle').value=title||'';$('#ppQuestions').value=paper||'';$('#ppAnswers').value=answers||'';$('#ppPreview').textContent=paper||'Generate a paper to preview.';$('#ppAnswerPreview').textContent=answers||'No answer key yet.'}

async function loadPaperContexts(){
 const app=a(),box=$('#ppContext');if(!box)return;
 const r=await app.db.from('teacher_assignments').select('class_id,section_id,subject_id').eq('school_id',app.schoolId).eq('teacher_id',app.user.id).eq('is_active',true).limit(200);
 if(r.error){status('Assigned classes unavailable: '+r.error.message);return}
 if(!r.data?.length){box.innerHTML='<option value="">Ask Principal to assign your class first</option>';status('Official school assignment required before making a class paper.');return}
 const classIds=[...new Set(r.data.map(x=>x.class_id))];
 const [cl,se,su]=await Promise.all([
  app.db.from('classes').select('id,name').eq('school_id',app.schoolId).eq('is_active',true).in('id',classIds),
  app.db.from('sections').select('id,class_id,name').eq('is_active',true).in('class_id',classIds),
  app.db.from('subjects').select('id,class_id,name').eq('school_id',app.schoolId)
 ]);
 if(cl.error||se.error||su.error){status('School classes unavailable: '+(cl.error||se.error||su.error).message);return}
 const classes=new Map((cl.data||[]).map(x=>[x.id,x])),sections=se.data||[],subjects=su.data||[];
 paperContexts=[];
 for(const item of r.data){
  const c=classes.get(item.class_id);if(!c)continue;
  const allowed=item.section_id?sections.filter(x=>x.id===item.section_id):sections.filter(x=>x.class_id===item.class_id);
  const subject=subjects.find(x=>x.id===item.subject_id);
  for(const sec of allowed.length?allowed:[null]){
   const ctx={class_id:c.id,class_name:c.name,section_id:sec?.id||null,section_name:sec?.name||'',subject_id:subject?.id||null,subject_name:subject?.name||''};
   if(!paperContexts.some(x=>x.class_id===ctx.class_id&&x.section_id===ctx.section_id&&x.subject_id===ctx.subject_id))paperContexts.push(ctx);
  }
 }
 box.innerHTML=paperContexts.map((x,i)=>'<option value="'+i+'">'+e(x.class_name)+(x.section_name?' — '+e(x.section_name):'')+(x.subject_name?' · '+e(x.subject_name):'')+'</option>').join('')||'<option value="">No active assigned classes</option>';
}
async function open(){
 if(!ready())return;
 v=document.getElementById('view-paper-generator');
 if(!v){v=document.createElement('section');v.id='view-paper-generator';v.className='view';document.querySelector('#workspace .content')?.append(v)}
 if(!v)return;
 output=null;draftId=null;
 v.innerHTML='<div class="pp-head"><div><small style="letter-spacing:2px;color:#9d657a">NOOR · TEACHER STUDIO</small><h1>Assignments & Weekly Papers</h1><p class="pp-sub">Generate from a textbook photo or short description. Customize before printing.</p></div><button class="pp-btn soft" id="ppBack">← Dashboard</button></div>'+
 '<div class="pp-layout"><div><section class="pp-card"><h2>✦ Generate a paper</h2><form id="ppForm" class="pp-fields">'+
  '<label class="wide">School Class & Section<select id="ppContext" required><option value="">Loading assigned school classes…</option></select></label>'+
 '<label class="wide">Subject name<input id="ppSubjectName" maxlength="100" placeholder="e.g. Science" required></label>'+ '<label>Paper type<select id="ppType">'+Object.entries(TYPE).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label>'+
 '<label>Language<select id="ppLang">'+['English','Urdu','Hindi','Telugu','Arabic','Bilingual (English + Urdu)'].map(x=>'<option>'+x+'</option>').join('')+'</select></label>'+
 '<label>Number of questions<select id="ppCount">'+[5,8,10,15,20,25].map(x=>'<option '+(x===10?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<label>Difficulty<select id="ppDifficulty"><option value="easy">Easy</option><option value="balanced" selected>Balanced</option><option value="challenging">Challenging</option></select></label>'+
 '<label class="wide"><span>Adaptive Practice Presets</span><span class="pp-actions" style="display:flex;gap:7px;flex-wrap:wrap;margin-top:7px"><button type="button" class="pp-btn soft" data-pp-preset="foundation">Foundation</button><button type="button" class="pp-btn soft" data-pp-preset="revision">Revision</button><button type="button" class="pp-btn soft" data-pp-preset="challenge">Challenge</button></span></label>'+ '<label>Marks/question<input id="ppMarks" type="number" min="1" max="20" value="2"></label><label>Topic (optional)<input id="ppTopic" maxlength="180" placeholder="Fractions"></label>'+
 '<label class="wide">Short description (optional if photo)<textarea id="ppDescription" placeholder="e.g. Questions about the water cycle"></textarea></label>'+
 '<label class="wide pp-file">Choose textbook photos (optional if description)<input id="ppImages" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>'+
 '<div class="wide pp-actions"><button class="pp-btn" type="submit" id="ppGenerate">✦ Generate Paper</button><button class="pp-btn soft" type="reset">Clear input</button></div></form><p class="pp-notice">AI makes an editable draft, not an automatically conducted exam. Always check the questions and answer key.</p><p id="ppStatus" class="pp-status" role="status"></p></section>'+
 '<section class="pp-card"><h2>My paper drafts</h2><div id="ppSaved" class="pp-list">Loading drafts…</div></section></div>'+
 '<section class="pp-card"><h2>Editable paper</h2><label>Paper title<input id="ppTitle" maxlength="180" placeholder="Title appears after generation"></label>'+
 '<label style="margin-top:12px">Questions<textarea rows="17" id="ppQuestions"></textarea></label>'+
 '<label style="margin-top:12px">Teacher answer key<textarea rows="8" id="ppAnswers"></textarea></label>'+ '<label style="margin-top:12px">Rubric Grading Assistant<textarea rows="5" id="ppRubric" placeholder="Review, customize and approve marking criteria"></textarea></label>'+ '<button class="pp-btn soft" type="button" id="ppRubricAssistant">✦ Suggest Marking Rubric</button><p class="pp-sub">Editable draft based on your paper marks. Teacher approves final grading.</p>'+
 '<div class="pp-actions"><button class="pp-btn" id="ppSave">Save draft</button><button class="pp-btn soft" id="ppPrint">Print / Save PDF</button><label style="display:flex;align-items:center;gap:4px"><input id="ppWithAnswers" style="width:auto" type="checkbox"> Include answers</label></div>'+
 '<div class="pp-card" style="margin-top:15px;padding:14px"><h2>Publish to assigned students</h2><p class="pp-sub">This sends questions only — the answer key remains private.</p><label>Due date and time<input type="datetime-local" id="ppDueAt"></label><label style="margin-top:9px">Total marks<input id="ppTotalMarks" type="number" min="1" max="1000" value="20"></label><div class="pp-actions"><button class="pp-btn" id="ppPublish" type="button">Publish Assignment</button><button class="pp-btn soft" id="ppShowInbox" type="button">Refresh Submissions</button></div><div id="ppPublished" class="pp-list"></div></div>'+ '<h2>Paper preview</h2><div class="pp-preview" id="ppPreview">Your paper will appear here.</div><details style="margin-top:11px"><summary>Teacher-only answer key</summary><div class="pp-preview" id="ppAnswerPreview"></div></details></section></div>';
 $('#ppBack').onclick=()=>a().openView('overview');$('#ppForm').onsubmit=x=>{x.preventDefault();generate()};
 $('#ppQuestions').oninput=()=>$('#ppPreview').textContent=$('#ppQuestions').value;
 v.querySelectorAll('[data-pp-preset]').forEach(btn=>btn.onclick=()=>{const presets={foundation:['easy','5','1'],revision:['balanced','10','2'],challenge:['challenging','15','3']},p=presets[btn.dataset.ppPreset];$('#ppDifficulty').value=p[0];$('#ppCount').value=p[1];$('#ppMarks').value=p[2];$('#ppTotalMarks').value=String(Number(p[1])*Number(p[2]));status('Practice level '+btn.dataset.ppPreset+' selected. Generate and review before sharing.');});
 $('#ppAnswers').oninput=()=>$('#ppAnswerPreview').textContent=$('#ppAnswers').value;
 $('#ppRubricAssistant').onclick=buildRubric;
 $('#ppContext').onchange=()=>{$('#ppSubjectName').value=paperContexts[Number($('#ppContext').value)]?.subject_name||''};$('#ppSave').onclick=save;$('#ppPrint').onclick=print;
  $('#ppPublish').onclick=publishAssignment;$('#ppShowInbox').onclick=()=>window.NOOR_ASSIGNMENT_PORTAL?.teacherInbox?.();
 await loadPaperContexts();$('#ppContext').onchange?.();await load();window.NOOR_ASSIGNMENT_PORTAL?.teacherInbox?.();
}
function buildRubric(){
 const raw=$('#ppQuestions').value.trim(),marksPerQuestion=Number($('#ppMarks').value)||1;
 if(!raw)return status('Generate or type your questions before using the rubric assistant.');
 const numbered=raw.split(/\n/).filter(x=>/^\s*\d+[\).]\s+/.test(x)).length,
 count=numbered||Number($('#ppCount').value)||1,total=Number($('#ppTotalMarks').value)||count*marksPerQuestion;
 const type=$('#ppType').value,subject=$('#ppSubjectName').value||'Subject',difficulty=$('#ppDifficulty').value;
 const criteria=type==='quiz'?['Correct option / factual accuracy','Completeness of answer']:
  ['Conceptual accuracy','Reasoning, method or supporting evidence','Clarity and completeness'];
 const weights=criteria.length===2?[80,20]:[60,30,10];
 const rubric=['NOOR TEACHER REVIEW DRAFT — '+subject,'Question count: '+count+' · Maximum marks: '+total,'Difficulty: '+difficulty,
  'Teacher-approved criteria (adjust before use):',...criteria.map((label,i)=>(i+1)+'. '+label+' — '+weights[i]+'% of applicable marks'),
  'Mark the answer against the approved question key and allocated marks.',
  'Partial credit is awarded by the teacher when supported by the rubric.',
  'Final marks and feedback must be confirmed by the teacher; do not grade automatically.'];
 $('#ppRubric').value=rubric.join('\n');
 status('Suggested rubric created. Review the criteria, save your paper draft, then grade students manually.');
}
async function generate(){
 if(waiting||!ready())return;
 waiting=true;$('#ppGenerate').disabled=true;status('Generating your questions and answer key…');
 try{
 const photos=Array.from($('#ppImages').files||[]),description=$('#ppDescription').value.trim(),topic=$('#ppTopic').value.trim();
  const context=paperContexts[Number($('#ppContext').value)];if(!context)throw Error('Choose your assigned school class and section.');
  const subjectName=context.subject_name||$('#ppSubjectName').value.trim();if(!subjectName)throw Error('Enter the paper subject.');
 if(!photos.length&&!description&&!topic)throw Error('Choose a photo OR add a short description or topic.');
 if(photos.length>8)throw Error('Maximum eight images per request.');
 let total=0;for(const f of photos){if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw Error('Use JPG, PNG or WebP photos.');if(f.size>4*1024*1024)throw Error('Each photo must be under 4 MB.');total+=f.size;}
 if(total>12*1024*1024)throw Error('Choose fewer or smaller photos.');
 const images=await Promise.all(photos.map(readFile));
 const req=await a().db.functions.invoke('noor-ai-academic-assistant',{body:{
 action:'paper',school_id:a().schoolId,topic,rough_text:description,images,...context,subject_name:subjectName,
 paper_type:$('#ppType').value,language:$('#ppLang').value,difficulty:$('#ppDifficulty').value,
 question_count:Number($('#ppCount').value),marks_per_question:Number($('#ppMarks').value)
 }});
 if(req.error||req.data?.error)throw Error(req.data?.error||req.error?.message||'AI paper generation failed.');
 const o=req.data?.output;if(!o||!Array.isArray(o.questions)||!o.questions.length)throw Error('No questions generated. Try a clearer photo or description.');
 output=o;draftId=null;display(o.title||TYPE[$('#ppType').value],paperText(o),answerText(o));$('#ppTotalMarks').value=String(Number($('#ppCount').value)*Number($('#ppMarks').value));
 status('✓ AI draft generated. Review and edit as needed.');a().toast?.('Paper generated.','success');
 }catch(err){status('Unable to generate: '+(err?.message||'Please retry.'))}
 finally{waiting=false;$('#ppGenerate').disabled=false}
}
async function publishAssignment(){
 const app=a(),context=paperContexts[Number($('#ppContext').value)],title=$('#ppTitle').value.trim()||TYPE[$('#ppType').value],body=$('#ppQuestions').value.trim();
 const due_at=$('#ppDueAt').value,max_marks=Number($('#ppTotalMarks').value),btn=$('#ppPublish');
 if(!context)return status('Choose your assigned school class/section.');
 if(!($('#ppSubjectName').value.trim()||context.subject_name))return status('Enter a subject before publishing.');
 if(!body)return status('Generate and review the questions first.');
 if(!due_at||!Number.isFinite(new Date(due_at).getTime())||new Date(due_at)<=new Date())return status('Select a future due date and time.');
 if(!Number.isInteger(max_marks)||max_marks<1||max_marks>1000)return status('Total marks must be between 1 and 1000.');
 if(!window.NOOR_ASSIGNMENT_PORTAL?.publish)return status('Assignment service unavailable; reload and try again.');
 btn.disabled=true;status('Publishing to your assigned students…');
 try{
  await window.NOOR_ASSIGNMENT_PORTAL.publish({title,body,context,due_at,max_marks,paper_draft_id:draftId,answer_key_text:$('#ppAnswers').value.trim()});
  status('✓ Assignment published for the selected school/class/section. Students can now access it.');
  await window.NOOR_ASSIGNMENT_PORTAL.teacherInbox();
 }catch(err){status('Publish failed: '+(err.message||'Please retry.'))}
 finally{btn.disabled=false}
}
async function save(){
 if(!ready())return;const paper=$('#ppQuestions').value.trim(),answer=$('#ppAnswers').value.trim();
 if(!paper)return status('Generate or enter questions before saving.');
  const context=paperContexts[Number($('#ppContext').value)];if(!context)return status('Choose your assigned school class and section.');
 const title=$('#ppTitle').value.trim()||TYPE[$('#ppType').value],row={
 school_id:a().schoolId,teacher_id:a().user.id,title:title.slice(0,180),paper_type:$('#ppType').value,class_id:context.class_id,section_id:context.section_id,subject_id:context.subject_id,
 language:$('#ppLang').value,source_description:$('#ppDescription').value.slice(0,10000),
 content:{...(output||{}),paper_text:paper,answer_key_text:answer,teacher_subject_name:$('#ppSubjectName').value.trim(),teacher_rubric_text:$('#ppRubric').value.trim(),teacher_edited:true},updated_at:new Date().toISOString()
 };
 $('#ppSave').disabled=true;
 try{
 const db=a().db;
 const r=draftId?await db.from('noor_teacher_paper_drafts').update(row).eq('school_id',a().schoolId).eq('teacher_id',a().user.id).eq('id',draftId).select('id').single():
 await db.from('noor_teacher_paper_drafts').insert(row).select('id').single();
 if(r.error)throw r.error;draftId=r.data.id;status('✓ Paper draft saved privately.');await load();
 }catch(err){status('Could not save paper: '+(err?.message||'Unknown error'))}
 finally{$('#ppSave').disabled=false}
}
async function print(){
 const questions=$('#ppQuestions').value;if(!questions.trim())return status('Create or open a paper before printing.');
 let schoolName=a().school?.name||'',schoolLogo=a().school?.logo_url||'';
 try{
  const r=await a().db.from('school_directory').select('name,logo_url').eq('id',a().schoolId).single();
  if(!r.error&&r.data){schoolName=r.data.name;schoolLogo=r.data.logo_url||schoolLogo}
 }catch(err){console.warn('School branding request failed',err)}
 if(!schoolName)return status('School branding unavailable. Reopen your school account.');
 let el=document.getElementById('noorPaperPrint');
 if(!el){el=document.createElement('div');el.id='noorPaperPrint';document.body.append(el)}
 const safeLogo=/^https:\/\//i.test(schoolLogo||'')?'<img alt="School crest" src="'+e(schoolLogo)+'" style="max-width:90px;max-height:75px;object-fit:contain">':'';
 const ctx=paperContexts[Number($('#ppContext')?.value)]||{};
 const head='<header style="text-align:center;border-bottom:2px solid #54243b;padding-bottom:12px;margin-bottom:15px">'+safeLogo+
  '<h1 style="font:700 21pt Georgia,serif;margin:7px 0">'+e(schoolName)+'</h1>'+
  '<h2 style="font-size:12pt;margin:4px 0">'+e($('#ppTitle').value||TYPE[$('#ppType').value]||'Question Paper')+'</h2>'+
  '<p style="font-size:10pt">Class: '+e(ctx.class_name||'________________')+' · Section: '+e(ctx.section_name||'______')+
  ' · Subject: '+e(ctx.subject_name||$('#ppSubjectName')?.value||'________________')+' · Date: '+e(new Date().toLocaleDateString('en-IN'))+'</p></header>';
 el.innerHTML=head+'<p style="font-size:10pt">Student Name: _______________________ &nbsp; Roll Number: ___________</p>'+
  '<pre>'+e(questions)+'</pre>'+
  ($('#ppWithAnswers').checked?'<hr><h2>Teacher-only answer key (confidential)</h2><pre>'+e($('#ppAnswers').value)+'</pre>'+(($('#ppRubric').value||'').trim()?'<h3>Marking rubric</h3><pre>'+e($('#ppRubric').value)+'</pre>':''):'')+
  '<footer style="margin-top:30px;text-align:center;font:9pt Arial;color:#777">Powered by NOOR School Management</footer>';
 window.print();
}
async function load(){
 const box=$('#ppSaved');if(!box||!ready())return;
 const r=await a().db.from('noor_teacher_paper_drafts').select('id,title,content,language,paper_type,updated_at,class_id,section_id,subject_id').eq('school_id',a().schoolId).eq('teacher_id',a().user.id).order('updated_at',{ascending:false}).limit(25);
 if(r.error){box.textContent='Could not load drafts: '+r.error.message;return}
 const rows=r.data||[];
 box.innerHTML=rows.length?rows.map(x=>'<div><div><strong>'+e(x.title)+'</strong><small>'+e(TYPE[x.paper_type]||'Paper')+' · '+e(new Date(x.updated_at).toLocaleDateString('en-IN'))+'</small></div><button class="pp-btn soft" data-paper="'+e(x.id)+'">Edit</button></div>').join(''):'<p class="pp-sub">No saved papers yet.</p>';
 box.onclick=ev=>{const b=ev.target.closest('[data-paper]');if(!b)return;const item=rows.find(x=>x.id===b.dataset.paper);if(!item)return;draftId=item.id;output=item.content||{};$('#ppType').value=item.paper_type;$('#ppLang').value=item.language;const i=paperContexts.findIndex(x=>x.class_id===item.class_id&&x.section_id===(item.section_id||null)&&x.subject_id===(item.subject_id||null));if(i>=0)$('#ppContext').value=String(i);$('#ppSubjectName').value=item.content?.teacher_subject_name||paperContexts[i]?.subject_name||'';$('#ppRubric').value=item.content?.teacher_rubric_text||'';display(item.title,item.content?.paper_text||paperText(item.content),item.content?.answer_key_text||answerText(item.content));status('Saved paper loaded for editing.');$('#ppQuestions').scrollIntoView({behavior:'smooth',block:'center'})};
}
window.NOOR_PAPER_GENERATOR={open};
})();