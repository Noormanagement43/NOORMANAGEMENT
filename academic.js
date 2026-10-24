/* NOOR AI academic + management workflows: additive client for the existing authenticated app. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const A = () => window.NOOR_AI_APP || {};
const db = () => A().db;
const p = () => A().profile;
const u = () => A().user;
const sid = () => A().schoolId;
const role = () => p()?.role || '';
const E = v => (A().escapeHtml || (x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))))(v??'');
const msg = (s,t) => A().toast ? A().toast(s,t||'info') : alert(s);
const today = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const btn = (id,text,cl) => '<button id="'+id+'" type="button" class="acad-btn '+(cl||'')+'">'+E(text)+'</button>';
const notice = (id,text,cl) => '<div id="'+id+'" class="acad-notice '+(cl||'')+'" role="status">'+E(text)+'</div>';
const panel = (title,desc,body) => '<section class="acad-panel"><h3>'+E(title)+'</h3><p>'+E(desc||'')+'</p>'+body+'</section>';
const shell = (eyebrow,title,desc,body) => '<div class="acad-page"><section class="acad-hero"><div class="acad-hero-row"><div><div class="eyebrow">'+E(eyebrow)+'</div><h1>'+E(title)+'</h1><p>'+E(desc)+'</p></div><span class="acad-status">'+E(role().toUpperCase())+'</span></div></section>'+body+'</div>';
const empty = s => '<div class="acad-empty">'+E(s)+'</div>';
const field = (id,label,type,required,placeholder) => '<div class="field"><label for="'+id+'">'+E(label)+(required?' *':'')+'</label><input id="'+id+'" type="'+(type||'text')+'" '+(required?'required ':'')+' placeholder="'+E(placeholder||'')+'"></div>';
const ta = (id,label,placeholder) => '<div class="field"><label for="'+id+'">'+E(label)+'</label><textarea id="'+id+'" placeholder="'+E(placeholder||'')+'"></textarea></div>';
const val = id => $(id)?.value?.trim?.() || '';
const opts = (rows,k,l,prompt) => '<option value="">'+E(prompt||'Select')+'</option>'+(rows||[]).map(x=>'<option value="'+E(x[k])+'">'+E(x[l])+'</option>').join('');
const table = (heads,rows) => rows?.length ? '<div class="acad-table-wrap"><table class="acad-table"><thead><tr>'+heads.map(x=>'<th>'+E(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>' : empty('No saved records match this view yet.');
const status = (id,text,cl) => {const n=$(id);if(n){n.className='acad-notice '+(cl||'');n.textContent=text;n.style.display='block';}};
const err = e => e?.message || 'Request failed. Check the connection and your permissions.';
const state = {years:[],classes:[],sections:[],subjects:[],units:[],assignments:[],reports:[],notes:[],lastAI:null,noteContext:null,planOutput:null,editNoteId:null,editPlanId:null,reportTimer:null};
const leader = () => ['creator','owner','principal'].includes(role());
async function permit(key){if(leader())return true;if(role()!=='manager'||!sid())return false;const r=await db().from('role_permissions').select('is_allowed').eq('school_id',sid()).eq('role','manager').eq('permission_key',key).maybeSingle();return !r.error&&r.data?.is_allowed===true;}
async function loadContext(){
 if(!sid()||!db())return;
 const results=await Promise.all([
  db().from('academic_years').select('id,label,starts_on,ends_on,is_current').eq('school_id',sid()).order('starts_on',{ascending:false}),
  db().from('classes').select('id,school_id,name,is_active,sort_order').eq('school_id',sid()).eq('is_active',true).order('sort_order').order('name'),
  db().from('sections').select('id,class_id,name,is_active').eq('is_active',true).order('name'),
  db().from('subjects').select('id,school_id,class_id,name,is_active').eq('school_id',sid()).eq('is_active',true).order('name'),
  db().from('syllabus_units').select('id,academic_year_id,class_id,section_id,subject_id,unit_type,title,sequence_no,syllabus_weight,is_active').eq('school_id',sid()).eq('is_active',true).order('sequence_no'),
  role()==='teacher'?db().from('teacher_assignments').select('class_id,section_id,subject_id,is_active').eq('school_id',sid()).eq('teacher_id',u().id).eq('is_active',true):Promise.resolve({data:[],error:null})
 ]);
 state.years=results[0].data||[];state.classes=results[1].data||[];state.sections=results[2].data||[];state.subjects=results[3].data||[];state.units=results[4].data||[];state.assignments=results[5].data||[];
 if(role()==='teacher'&&state.assignments.length){
  const classes=new Set(state.assignments.map(x=>x.class_id));state.classes=state.classes.filter(x=>classes.has(x.id));
  const subjects=new Set(state.assignments.map(x=>x.subject_id).filter(Boolean));if(subjects.size)state.subjects=state.subjects.filter(x=>subjects.has(x.id));
 }
}
function contextHtml(date=false,unit=true){
 let h='<div class="acad-fields"><div class="field"><label for="acadYear">Academic year *</label><select id="acadYear" required>'+opts(state.years,'id','label','Select academic year')+'</select></div><div class="field"><label for="acadClass">Class *</label><select id="acadClass" required>'+opts(state.classes,'id','name','Select assigned class')+'</select></div><div class="field"><label for="acadSection">Section</label><select id="acadSection">'+opts(state.sections.filter(x=>state.classes.some(c=>c.id===x.class_id)),'id','name','Whole class')+'</select></div><div class="field"><label for="acadSubject">Subject *</label><select id="acadSubject" required>'+opts(state.subjects,'id','name','Select assigned subject')+'</select></div>';
 if(unit)h+='<div class="field"><label for="acadUnit">Chapter / lesson / topic</label><select id="acadUnit">'+opts(state.units,'id','title','Select curriculum unit')+'</select></div>';
 if(date)h+='<div class="field"><label for="acadDate">Date *</label><input id="acadDate" type="date" required value="'+today()+'"></div>';
 return h+'</div>';
}
function setDefaults(){
 const y=$('acadYear');if(y&&!y.value){const v=state.years.find(x=>x.is_current)||state.years[0];if(v)y.value=v.id;}
 if($('acadClass')&&!$('acadClass').value&&state.classes.length===1)$('acadClass').value=state.classes[0].id;
 if($('acadSubject')&&!$('acadSubject').value&&state.subjects.length===1)$('acadSubject').value=state.subjects[0].id;
 bindContext();fillUnits();
}
function bindContext(){
 if($('acadClass'))$('acadClass').onchange=()=>{if($('acadSection'))$('acadSection').innerHTML=opts(state.sections.filter(x=>x.class_id===val('acadClass')),'id','name','Whole class');fillSubjectsForSelectedClass();fillUnits();};
 if($('acadSection'))$('acadSection').onchange=()=>{fillSubjectsForSelectedClass();fillUnits();};
 ['acadYear','acadSubject'].forEach(id=>{if($(id))$(id).onchange=fillUnits;});
 if($('acadUnit'))$('acadUnit').onchange=()=>{const x=state.units.find(v=>v.id===val('acadUnit'));if(x&&$('acadTopic')&&!val('acadTopic'))$('acadTopic').value=x.title;};
}
function fillSubjectsForSelectedClass(){
 const select=$('acadSubject');if(!select)return;
 const previous=select.value,klass=val('acadClass'),section=val('acadSection');
 let subjects=state.subjects;
 if(role()==='teacher')subjects=subjects.filter(sub=>state.assignments.some(a=>a.class_id===klass&&(!a.subject_id||a.subject_id===sub.id)&&(!a.section_id||a.section_id===section||!section)));
 select.innerHTML=opts(subjects,'id','name','Select assigned subject');
 if(subjects.some(s=>s.id===previous))select.value=previous;else if(subjects.length===1)select.value=subjects[0].id;
}
function fillUnits(){
 if(!$('acadUnit'))return;const y=val('acadYear'),c=val('acadClass'),s=val('acadSubject'),se=val('acadSection'),old=val('acadUnit');
 const rows=state.units.filter(x=>(!y||x.academic_year_id===y)&&(!c||x.class_id===c)&&(!s||x.subject_id===s)&&(!se||!x.section_id||x.section_id===se));
 $('acadUnit').innerHTML=opts(rows,'id','title','Select curriculum unit');if(rows.some(x=>x.id===old))$('acadUnit').value=old;
}
function context(topic){
 const year=state.years.find(x=>x.id===val('acadYear')),c=state.classes.find(x=>x.id===val('acadClass')),se=state.sections.find(x=>x.id===val('acadSection')),sub=state.subjects.find(x=>x.id===val('acadSubject'));
 return {school_id:sid(),academic_year_id:val('acadYear'),academic_year_label:year?.label||'',class_id:val('acadClass'),class_name:c?.name||'',section_id:val('acadSection')||null,section_name:se?.name||'Whole class',subject_id:val('acadSubject'),subject_name:sub?.name||'',unit_id:val('acadUnit')||null,topic:topic||''};
}
async function ai(payload){
 const r=await db().functions.invoke('noor-ai-academic-assistant',{body:payload});
 if(r.error)throw new Error(r.data?.error||r.error.message||'AI request failed');
 if(r.data?.error)throw new Error(r.data.error);return r.data;
}
function outputHtml(o){
 if(!o||typeof o!=='object')return E(o||'');
 if(typeof o.notes_text==='string')return '<div style="white-space:pre-wrap;line-height:1.7">'+E(o.notes_text)+'</div>';
 if(typeof o.teacher_edited_plan_text==='string')return '<div style="white-space:pre-wrap;line-height:1.7">'+E(o.teacher_edited_plan_text)+'</div>';
 const top=['title','subject','topic','language','summary','revision_activity','suggested_duration_minutes','confidence'];
 let h='';top.forEach(k=>{if(o[k]!==undefined)h+='<div><b>'+E(k.replaceAll('_',' '))+'</b><p>'+E(Array.isArray(o[k])?o[k].join(' · '):o[k])+'</p></div>';});
 ['learning_objectives','key_concepts','definitions','worked_examples','facts_and_formulas','short_answer_questions','long_answer_questions','revision_questions','homework','daily_plan','objectives','planned_coverage','teacher_checks','uncertainties','items_to_verify'].forEach(k=>{
  if(o[k]===undefined)return;h+='<h3>'+E(k.replaceAll('_',' '))+'</h3>';
  if(Array.isArray(o[k]))h+='<ul>'+o[k].map(v=>'<li>'+(typeof v==='object'?Object.entries(v).map(([a,b])=>'<b>'+E(a.replaceAll('_',' '))+':</b> '+E(Array.isArray(b)?b.join('; '):b)).join(' · '):E(v))+'</li>').join('')+'</ul>';
  else h+='<p>'+E(o[k])+'</p>';
 });
 return h||'<pre>'+E(JSON.stringify(o,null,2))+'</pre>';
}
function readableText(o){
 if(o&&typeof o.notes_text==='string')return o.notes_text;
 if(o&&typeof o.teacher_edited_plan_text==='string')return o.teacher_edited_plan_text;
 const el=document.createElement('div');el.innerHTML=outputHtml(o);
 return String(el.innerText||el.textContent||'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
async function imageData(inputId){
 const files=Array.from($(inputId)?.files||[]);
 if(files.length>8)throw new Error('Choose up to 8 syllabus images.');
 let total=0;
 for(const f of files){
  if(!/^image\/(jpeg|png|webp)$/.test(f.type))throw new Error('Only JPG, PNG and WebP images are currently supported.');
  if(f.size>4*1024*1024)throw new Error('Each image must be under 4 MB.');
  total+=f.size;if(total>12*1024*1024)throw new Error('Keep all selected images under 12 MB total.');
 }
 if(!files.length)return [];
 const c=context(val('acadTopic'));
 const canArchiveSource=Boolean(c.school_id&&c.academic_year_id&&c.class_id&&c.subject_id);
 state.sourceFileIds=[];state.sourceUploadPaths=[];
 const out=[];
 for(const f of files){
  const dataUrl=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>no(new Error('Could not read an image.'));r.readAsDataURL(f);});
  if(canArchiveSource){
   try{
  const safe=f.name.replace(/[^A-Za-z0-9._-]/g,'_').slice(-120);
  const path=c.school_id+'/'+u().id+'/'+crypto.randomUUID()+'-'+safe;
  const up=await db().storage.from('noor-syllabus-source').upload(path,f,{contentType:f.type,upsert:false});
  if(up.error)throw new Error('Private syllabus upload failed: '+up.error.message);
  const row={school_id:c.school_id,academic_year_id:c.academic_year_id,uploaded_by:u().id,class_id:c.class_id,section_id:c.section_id,subject_id:c.subject_id,unit_id:c.unit_id,storage_path:path,original_file_name:f.name.slice(0,255),mime_type:f.type,file_size_bytes:f.size,extraction_confidence:'not_run'};
  const meta=await db().from('syllabus_uploads').insert(row).select('id').single();
  if(meta.error){await db().storage.from('noor-syllabus-source').remove([path]);throw new Error('Could not register uploaded source page: '+meta.error.message);}
  state.sourceFileIds.push(meta.data.id);state.sourceUploadPaths.push(path);
   }catch(archiveError){console.warn('Optional source archive skipped. Notes generation remains available.');}
  }
  out.push(dataUrl);
 }
 return out;
}
function renderTeaching(){
 const body='<div class="acad-grid"><section class="acad-panel"><h3>AI Smart Notes Generator</h3><p><b>Choose a photo OR type a short description.</b> All academic details are optional for a private draft.</p><form id="notesForm" class="acad-form"><details class="acad-context-optional"><summary>Optional: year, class, subject & chapter (needed only to publish)</summary>'+contextHtml().replaceAll(' required','').replaceAll('Academic year *','Academic year (optional)').replaceAll('Class *','Class (optional)').replaceAll('Subject *','Subject (optional)')+'</details>'+
 '<div class="field"><label for="acadTopic">Topic / title (optional)</label><input id="acadTopic" maxlength="240" placeholder="e.g. Photosynthesis"></div><div class="field"><label for="acadLanguage">Notes language</label><select id="acadLanguage"><option>English</option><option>Urdu</option><option>Hindi</option><option>Arabic</option><option>Telugu</option><option>Bilingual (English + Urdu)</option><option>Other</option></select></div>'+
 ta('roughNotes','Short description (optional if you chose a photo)','e.g. Explain water cycle for children')+
 '<div class="field"><label for="syllabusImages">Choose photo / gallery / camera (optional)</label><input id="syllabusImages" type="file" accept="image/jpeg,image/png,image/webp" multiple><div class="acad-field-help">Phone: tap Choose Files to select Gallery, Camera or Files (depending on device). Computer: select image files.</div><div class="acad-field-help">Max 8 images per request. PDF/DOC files are not enabled in this release.</div></div>'+
 '<div class="acad-actions">'+btn('extractSyllabusBtn','Extract photo text (optional)','alt')+btn('generateNotesBtn','✦ Generate Smart Notes')+'</div><div id="ocrStatus" style="display:none"></div>'+
 ta('reviewedSyllabusText','Reviewed extracted text','Correct OCR mistakes here before generating notes')+
 '<div id="notesAiStatus" style="display:none"></div><div id="notesOutput" class="acad-notes-preview">'+empty('Generated note preview will appear here.')+'</div>'+
 '<div class="field full"><label for="notesEditor">Edit your Smart Notes before saving or publishing</label><textarea id="notesEditor" rows="16" placeholder="Generated notes appear here after AI review. Edit the text freely."></textarea><div class="acad-field-help">Changes in this editor are saved with the note. Publishing remains a teacher-controlled action.</div></div>'+
 '<div class="acad-actions">'+btn('saveNotesDraft','Save draft','alt')+btn('publishNotes','Approve & publish','gold')+btn('printNotes','Print / Save PDF','alt')+'</div></form></section>'+
 '<section class="acad-panel"><h3>Define syllabus units</h3><p>Configure chapters, lessons and topics for the selected school, year, class and subject.</p><form id="unitForm" class="acad-form"><p class="acad-muted">Uses the same year, class, section and subject selected above for Smart Notes.</p>'+
 '<div class="acad-fields"><div class="field"><label for="unitType">Unit type</label><select id="unitType"><option value="chapter">Chapter</option><option value="lesson">Lesson</option><option value="topic">Topic</option></select></div><div class="field"><label for="unitSequence">Sequence</label><input id="unitSequence" type="number" min="0" value="1"></div><div class="field full"><label for="unitTitle">Unit title *</label><input id="unitTitle" required maxlength="240"></div><div class="field"><label for="unitWeight">Optional syllabus weight</label><input id="unitWeight" type="number" min="0" max="100" step="0.1"></div></div>'+btn('createUnitBtn','Add curriculum unit')+'</form><div id="unitList" style="margin-top:14px"></div></section>'+
 '<section class="acad-panel"><h3>My saved notes</h3><p>Quick private drafts require no extra fields. Publishing to a class requires school details.</p><div id="myPrivateNotesList"></div><div id="myNotesList">'+empty('Loading…')+'</div></section></div>';
 $('view-teaching').innerHTML=shell('Teacher workspace','My Teaching & Smart Notes','Subject-wise notes, syllabus tracking and teacher-reviewed materials using your assigned classes.',body);
 $('notesForm').onsubmit=e=>e.preventDefault();$('syllabusImages').onchange=()=>{state.images=[];state.ocrOutput=null;};$('extractSyllabusBtn').onclick=extractImages;$('generateNotesBtn').onclick=generateNotes;$('saveNotesDraft').onclick=()=>saveNotes(false);$('publishNotes').onclick=()=>saveNotes(true);$('printNotes').onclick=printTeachingNotes;$('createUnitBtn').onclick=createUnit;
 loadContext().then(()=>{setDefaults();renderUnits();loadMyNotes();}).catch(e=>status('notesAiStatus',err(e),'error'));
}
async function printTeachingNotes(){
 const notes=$('notesEditor')?.value?.trim();
 if(!notes){msg('Generate and review notes before printing.','error');return}
 const schoolId=sid();if(!schoolId){msg('School account required to print branded notes.','error');return}
 let schoolName=window.NOOR_AI_APP?.school?.name||'',logo=window.NOOR_AI_APP?.school?.logo_url||'';
 try{
  const result=await db().from('school_directory').select('name,logo_url').eq('id',schoolId).single();
  if(!result.error&&result.data){schoolName=result.data.name;logo=result.data.logo_url||logo;}
 }catch(err){console.warn('Notes school branding request failed',err)}
 if(!schoolName){msg('Cannot confirm your school name. Reopen the school account.','error');return}
 let printable=document.getElementById('noorPaperPrint');
 if(!printable){printable=document.createElement('div');printable.id='noorPaperPrint';document.body.append(printable)}
 const logoHTML=/^https:\/\//i.test(logo||'')?'<img alt="School logo" src="'+E(logo)+'" style="max-width:90px;max-height:75px;object-fit:contain">':'';
 const title=val('acadTopic')||state.lastAI?.title||'Smart Notes';
 printable.innerHTML='<header style="text-align:center;padding:10px 0 14px;border-bottom:2px solid #54243b;margin-bottom:16px">'+logoHTML+
  '<h1 style="font:700 21pt Georgia,serif;margin:5px">'+E(schoolName)+'</h1><h2 style="font-size:13pt;margin:4px">'+E(title)+'</h2>'+
  '<div style="font-size:10pt">Smart Notes · '+E(val('acadLanguage')||'English')+' · '+E(new Date().toLocaleDateString('en-IN'))+'</div></header>'+
  '<pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:11pt/1.65 Arial">'+E(notes)+'</pre>'+
  '<footer style="margin-top:28px;text-align:center;font:9pt Arial;color:#777">Teacher-reviewed material · Powered by NOOR</footer>';
 window.print();
}
async function extractImages(){
 try{status('ocrStatus','Extracting page text…');const c=context(val('acadTopic'));if(!c.school_id)throw new Error('Sign in to your school first.');
 const imgs=await imageData('syllabusImages');if(!imgs.length)throw new Error('Choose syllabus photographs first.');
 const r=await ai({...c,action:'extract_text',language:val('acadLanguage'),rough_text:val('roughNotes'),images:imgs});
 state.ocrOutput=r.output;state.images=imgs;$('reviewedSyllabusText').value=r.output?.extracted_text||'';
 status('ocrStatus','Extraction confidence: '+(r.output?.confidence||'needs_review')+'. Review uncertain handwriting and correct the extracted text before generation.',r.output?.confidence==='high'?'success':'');
 }catch(e){status('ocrStatus',err(e),'error');}
}
async function generateNotes(){
 try{status('notesAiStatus','Generating notes…');const c=context(val('acadTopic'));if(!c.school_id)throw new Error('Sign in to your school first.');
 let imgs=state.images||[];if(!imgs.length)imgs=await imageData('syllabusImages');
 if(!imgs.length&&!val('roughNotes')&&!val('reviewedSyllabusText')&&!c.topic)throw new Error('Choose a photo OR type a short description to generate notes.');
 const r=await ai({...c,action:'notes',language:val('acadLanguage'),rough_text:val('roughNotes'),reviewed_source_text:val('reviewedSyllabusText'),images:imgs});
 state.lastAI=r.output;state.noteContext=c;$('notesOutput').innerHTML=outputHtml(r.output);$('notesEditor').value=readableText(r.output);
 status('notesAiStatus','AI draft created. Teacher review is required before publishing. Tokens used: '+(r.usage?.input_tokens||0)+' input / '+(r.usage?.output_tokens||0)+' output.','success');
 }catch(e){status('notesAiStatus',err(e),'error');}
}
async function saveNotes(publish){
 try{
 if(!state.lastAI||!state.noteContext)throw new Error('Generate notes first.');
 if(publish&&!confirm('Publish this reviewed note to the selected class / section?'))return;
 const edited=val('notesEditor');if(!edited)throw new Error('Review the generated notes before saving.');const content={...state.lastAI,notes_text:edited,teacher_edited:true};const c=context(val('acadTopic')||state.noteContext?.topic||state.lastAI.title);
 const hasAcademicDetails=Boolean(c.academic_year_id&&c.class_id&&c.subject_id);
 if(!hasAcademicDetails&&!publish){
   const row={school_id:sid(),teacher_id:u().id,title:String(state.lastAI.title||c.topic||'Smart Notes').slice(0,240),language:val('acadLanguage')||'English',source_description:val('roughNotes'),content,updated_at:new Date().toISOString()};
   const req=state.quickNoteId?db().from('noor_private_smart_notes').update(row).eq('id',state.quickNoteId).eq('teacher_id',u().id).select('id').single():db().from('noor_private_smart_notes').insert(row).select('id').single();
   const res=await req;if(res.error)throw res.error;state.quickNoteId=res.data.id;msg('Saved privately. Class/subject are optional.','success');await loadPrivateNotes();return;
 }
 if(!hasAcademicDetails)throw new Error('To publish for students, choose academic year, your assigned class and subject in Optional school details. You can generate and save private drafts without these fields.');
 const row={school_id:c.school_id,academic_year_id:c.academic_year_id,teacher_id:u().id,class_id:c.class_id,section_id:c.section_id,subject_id:c.subject_id,unit_id:c.unit_id,title:String(state.lastAI.title||c.topic||'Smart Notes').slice(0,240),source_text:val('roughNotes'),extracted_text:val('reviewedSyllabusText'),extraction_confidence:state.ocrOutput?.confidence||'not_run',source_file_ids:state.sourceFileIds||[],content,status:state.editNoteId&&publish?'published':'draft',published_to_students:!!(state.editNoteId&&publish),published_at:state.editNoteId&&publish?new Date().toISOString():null,created_by:u().id,updated_by:u().id};
 let r=state.editNoteId?await db().from('smart_notes').update(row).eq('id',state.editNoteId).select('id').single():await db().from('smart_notes').insert(row).select('id').single();
 if(r.error)throw r.error;state.editNoteId=r.data.id;state.lastAI=content;$('notesOutput').innerHTML=outputHtml(content);if(state.sourceFileIds?.length){const attach=await db().from('syllabus_uploads').update({note_id:r.data.id,extracted_text:val('reviewedSyllabusText'),extraction_confidence:state.ocrOutput?.confidence||'not_run'}).in('id',state.sourceFileIds);if(attach.error)throw attach.error;}if(publish){const update=await db().from('smart_notes').update({status:'published',published_to_students:true,published_at:new Date().toISOString()}).eq('id',r.data.id).eq('teacher_id',u().id).select('id').single();if(update.error)throw new Error('Draft saved but publishing failed: '+update.error.message);}msg(publish?'Reviewed notes published.':'Draft saved to the database.','success');await loadMyNotes();
 }catch(e){msg(err(e),'error');}
}
async function createUnit(e){
 e.preventDefault?.();try{const c=context(val('unitTitle'));if(!c.school_id||!c.academic_year_id||!c.class_id||!c.subject_id||!c.topic)throw new Error('Select year, class, subject and unit title.');
 const weight=val('unitWeight');const r=await db().from('syllabus_units').insert({school_id:sid(),academic_year_id:c.academic_year_id,class_id:c.class_id,section_id:c.section_id,subject_id:c.subject_id,title:c.topic,unit_type:val('unitType')||'chapter',sequence_no:Number(val('unitSequence')||0),syllabus_weight:weight===''?null:Number(weight),created_by:u().id});
 if(r.error)throw r.error;msg('Curriculum unit saved.','success');await loadContext();fillUnits();await renderUnits();
 }catch(e){msg(err(e),'error');}
}
async function saveProgress(unit,progress,pct){
 const row={school_id:sid(),academic_year_id:val('acadYear'),syllabus_unit_id:unit.id,teacher_id:u().id,class_id:val('acadClass'),section_id:val('acadSection')||null,subject_id:val('acadSubject'),progress_status:progress,completion_source:'teacher_report',teacher_reported_percentage:pct,last_updated_by:u().id};
 let q=db().from('syllabus_progress').select('id').eq('school_id',row.school_id).eq('academic_year_id',row.academic_year_id).eq('syllabus_unit_id',row.syllabus_unit_id).eq('teacher_id',row.teacher_id).eq('class_id',row.class_id).eq('subject_id',row.subject_id).is('section_id',row.section_id);
 const f=await q;if(f.error)throw f.error;
 if(f.data?.length){const r=await db().from('syllabus_progress').update(row).eq('id',f.data[0].id);if(r.error)throw r.error;}
 else {const r=await db().from('syllabus_progress').insert(row);if(r.error)throw r.error;}
}
async function renderUnits(){
 const box=$('unitList');if(!box)return;
 const y=val('acadYear'),c=val('acadClass'),s=val('acadSubject'),sec=val('acadSection');
 const rows=state.units.filter(x=>(!y||x.academic_year_id===y)&&(!c||x.class_id===c)&&(!s||x.subject_id===s)&&(!sec||!x.section_id||x.section_id===sec));
 const ids=rows.map(x=>x.id);let progress=[];
 if(ids.length){const q=await db().from('syllabus_progress').select('id,syllabus_unit_id,progress_status,teacher_reported_percentage').eq('school_id',sid()).eq('teacher_id',u().id).in('syllabus_unit_id',ids);progress=q.data||[];}
 const labels={not_started:'Not Started',in_progress:'In Progress',completed:'Completed',requires_revision:'Requires Revision'};
 box.innerHTML=table(['Unit','Type','Progress','Reported %','Update'],rows.map(x=>{
  const v=progress.find(q=>q.syllabus_unit_id===x.id);
  return '<tr><td>'+E(x.title)+'</td><td>'+E(x.unit_type)+'</td><td>'+E(labels[v?.progress_status||'not_started'])+'</td><td>'+(v?.teacher_reported_percentage==null?'—':E(v.teacher_reported_percentage+'%'))+'</td><td><select data-prog="'+E(x.id)+'">'+Object.entries(labels).map(([k,l])=>'<option value="'+k+'" '+((v?.progress_status||'not_started')===k?'selected':'')+'>'+l+'</option>').join('')+'</select> <button class="acad-btn alt" data-saveprog="'+E(x.id)+'" type="button">Save</button></td></tr>';
 }));
 box.querySelectorAll('[data-saveprog]').forEach(b=>b.onclick=async()=>{try{const x=rows.find(i=>i.id===b.dataset.saveprog);await saveProgress(x,box.querySelector('[data-prog="'+x.id+'"]').value,null);await loadContext();await renderUnits();msg('Progress saved without adding a duplicate record.','success');}catch(e){msg(err(e),'error');}});
}
async function loadMyNotes(){
 const box=$('myNotesList');if(!box)return;let q=db().from('smart_notes').select('id,title,status,published_to_students,updated_at,content,source_file_ids').eq('school_id',sid()).order('updated_at',{ascending:false}).limit(40);
 if(role()==='teacher')q=q.eq('teacher_id',u().id);
 const r=await q;if(r.error){box.innerHTML=notice('noteLoadError',err(r.error),'error');await loadPrivateNotes();return;}state.notes=r.data||[];
 box.innerHTML=state.notes.length?state.notes.map(x=>'<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>'+E(x.title)+'</b><div class="acad-muted">'+E(x.status)+' · '+E(new Date(x.updated_at).toLocaleDateString())+'</div><button class="acad-btn alt" type="button" data-opennote="'+E(x.id)+'">Open</button>'+(x.source_file_ids?.length?' <button class="acad-btn alt" type="button" data-sources="'+E(x.id)+'">View source pages ('+x.source_file_ids.length+')</button><div id="sources-'+E(x.id)+'"></div>':'')+'</div>').join(''):empty('No saved notes yet.');
 box.querySelectorAll('[data-opennote]').forEach(b=>b.onclick=()=>openNote(b.dataset.opennote));
 box.querySelectorAll('[data-sources]').forEach(b=>b.onclick=()=>loadSourceLinks(b.dataset.sources));
 await loadPrivateNotes();
}
async function loadPrivateNotes(){
 const box=$('myPrivateNotesList');if(!box||role()!=='teacher')return;
 const r=await db().from('noor_private_smart_notes').select('id,title,language,updated_at,content,source_description').eq('school_id',sid()).eq('teacher_id',u().id).order('updated_at',{ascending:false}).limit(25);
 if(r.error){box.innerHTML=notice('privateDraftError',err(r.error),'error');return;}
 state.privateNotes=r.data||[];
 box.innerHTML='<h4>My private Smart Notes drafts</h4>'+((r.data||[]).map(x=>'<div style="padding:9px 0;border-bottom:1px solid var(--line)"><b>'+E(x.title)+'</b><div class="acad-muted">'+E(x.language)+' · '+E(new Date(x.updated_at).toLocaleDateString())+'</div><button class="acad-btn alt" type="button" data-quick-note="'+E(x.id)+'">Edit this draft</button></div>').join('')||'<p class="acad-muted">No private drafts yet.</p>');
 box.querySelectorAll('[data-quick-note]').forEach(b=>b.onclick=()=>{
  const x=state.privateNotes.find(n=>n.id===b.dataset.quickNote);if(!x)return;
  state.quickNoteId=x.id;state.editNoteId=null;state.lastAI=x.content;state.noteContext={school_id:sid(),topic:x.title};state.images=[];
  $('notesEditor').value=readableText(x.content);$('notesOutput').innerHTML=outputHtml(x.content);
  $('acadTopic').value=x.title;$('roughNotes').value=x.source_description||'';$('acadLanguage').value=x.language||'English';
  $('notesEditor').scrollIntoView({behavior:'smooth',block:'center'});msg('Private draft opened. Edit or publish to an assigned class later.','success');
 });
}
async function loadSourceLinks(noteId){
 const box=$('sources-'+noteId);if(!box)return;
 const n=state.notes.find(x=>x.id===noteId);if(!n?.source_file_ids?.length){box.innerHTML=empty('No linked source pages.');return;}
 const r=await db().from('syllabus_uploads').select('id,storage_path,original_file_name').in('id',n.source_file_ids);
 if(r.error){box.innerHTML=notice('sourceLinkError',err(r.error),'error');return;}
 const links=[];
 for(const x of (r.data||[])){const s=await db().storage.from('noor-syllabus-source').createSignedUrl(x.storage_path,300);if(!s.error&&s.data?.signedUrl)links.push('<a href="'+E(s.data.signedUrl)+'" target="_blank" rel="noopener noreferrer">'+E(x.original_file_name)+'</a>');}
 box.innerHTML=links.length?'<div class="acad-source-links">'+links.join('<br>')+'</div>':empty('Source links could not be created for your role.');
}
async function openNote(id){
 const r=await db().from('smart_notes').select('*').eq('id',id).single();if(r.error){msg(err(r.error),'error');return;}
 const x=r.data;state.editNoteId=id;state.sourceFileIds=x.source_file_ids||[];state.lastAI=x.content;state.noteContext={school_id:x.school_id,academic_year_id:x.academic_year_id,class_id:x.class_id,section_id:x.section_id,subject_id:x.subject_id,unit_id:x.unit_id,topic:x.title};
 [['acadYear',x.academic_year_id],['acadClass',x.class_id],['acadSection',x.section_id||''],['acadSubject',x.subject_id],['acadUnit',x.unit_id||''],['acadTopic',x.title],['roughNotes',x.source_text],['reviewedSyllabusText',x.extracted_text]].forEach(([k,v])=>{if($(k))$(k).value=v||'';});
 $('notesOutput').innerHTML=outputHtml(x.content);if($('notesEditor'))$('notesEditor').value=readableText(x.content);msg('Saved note loaded. Review before approving or publishing.','success');
}
function renderWeekly(){
 const body='<div class="acad-grid"><section class="acad-panel"><h3>Weekly Teaching Plan</h3><p>AI proposes a week using source text and objectives. Plans are not marked completed automatically.</p><form id="weekForm" class="acad-form">'+contextHtml(false,false)+'<div class="acad-fields">'+field('weekStart','Week starts','date',true)+field('weekEnd','Week ends','date',true)+'</div>'+field('weekChapter','Chapter / unit','text',false)+ta('weekObjectives','Learning objectives','Expected outcomes for pupils')+ta('weekRequirements','Timetable, activities, homework, assessments, resources','Available days, periods and resources')+ta('weekSource','Reviewed syllabus source text','Paste reviewed syllabus text')+'<div id="weekStatus" style="display:none"></div><div id="weekPreview" class="acad-notes-preview">'+empty('Suggested week will appear here.')+'</div><div class="field full"><label for="weekPlanEditor">Edit the suggested weekly plan</label><textarea id="weekPlanEditor" rows="13" placeholder="Generate a plan and adjust each day before saving."></textarea></div><div class="acad-actions">'+btn('makeWeekPlan','Suggest weekly plan')+btn('saveWeekPlan','Save editable plan','alt')+btn('printWeekPlan','Print / Save PDF','gold')+'</div></form></section><section class="acad-panel"><h3>Saved plans</h3><div id="savedWeekPlans">'+empty('Loading saved plans…')+'</div></section></div>';
 $('view-weekly-plan').innerHTML=shell('Teacher workspace','Weekly Teaching Plan','Organize the week by subject, academic year, lesson objective and actual timetable.',body);
 $('weekForm').onsubmit=e=>e.preventDefault();$('makeWeekPlan').onclick=makeWeek;$('saveWeekPlan').onclick=saveWeek;$('printWeekPlan').onclick=()=>window.print();
 loadContext().then(()=>{setDefaults();loadWeeks();}).catch(e=>status('weekStatus',err(e),'error'));
}
async function makeWeek(){
 try{const c=context(val('weekChapter'));if(!c.school_id||!c.academic_year_id||!c.class_id||!c.subject_id||!val('weekStart')||!val('weekEnd'))throw new Error('Select year/class/subject and week dates.');
 if(val('weekStart')>val('weekEnd'))throw new Error('Week end must be after the start.');
 const r=await ai({...c,action:'weekly_plan',week_start:val('weekStart'),week_end:val('weekEnd'),objectives:val('weekObjectives'),weekly_requirements:val('weekRequirements'),reviewed_source_text:val('weekSource')});
 state.planOutput=r.output;$('weekPreview').innerHTML=outputHtml(r.output);$('weekPlanEditor').value=readableText(r.output);status('weekStatus','Suggested plan is editable and remains a draft until saved.','success');
 }catch(e){status('weekStatus',err(e),'error');}
}
async function saveWeek(){
 try{if(!state.planOutput)throw new Error('Generate a plan first.');const c=context(val('weekChapter'));const edited=val('weekPlanEditor');if(!edited)throw new Error('Review the weekly plan in the editor before saving.');const planData={...state.planOutput,teacher_edited_plan_text:edited,teacher_edited:true};const row={school_id:sid(),academic_year_id:c.academic_year_id,teacher_id:u().id,class_id:c.class_id,section_id:c.section_id,subject_id:c.subject_id,week_start:val('weekStart'),week_end:val('weekEnd'),chapter_title:val('weekChapter'),unit_id:c.unit_id,plan_data:planData,status:'draft',created_by:u().id,updated_by:u().id};
 const r=state.editPlanId?await db().from('lesson_plans').update(row).eq('id',state.editPlanId).select('id').single():await db().from('lesson_plans').insert(row).select('id').single();if(r.error)throw r.error;state.editPlanId=r.data.id;state.planOutput=planData;$('weekPreview').innerHTML=outputHtml(planData);msg('Weekly plan saved as draft.','success');await loadWeeks();
 }catch(e){msg(err(e),'error');}
}
async function loadWeeks(){
 const box=$('savedWeekPlans');if(!box)return;let q=db().from('lesson_plans').select('id,week_start,week_end,chapter_title,status,plan_data,academic_year_id,class_id,subject_id,section_id').eq('school_id',sid()).order('week_start',{ascending:false}).limit(60);
 if(role()==='teacher')q=q.eq('teacher_id',u().id);const r=await q;if(r.error){box.innerHTML=notice('weekLoadError',err(r.error),'error');return;}
 box.innerHTML=table(['Week','Chapter','Status','Open'],(r.data||[]).map(x=>'<tr><td>'+E(x.week_start)+' – '+E(x.week_end)+'</td><td>'+E(x.chapter_title||x.plan_data?.title||'Weekly Plan')+'</td><td>'+E(x.status)+'</td><td><button class="acad-btn alt" data-week="'+E(x.id)+'" type="button">Open</button></td></tr>'));
 box.querySelectorAll('[data-week]').forEach(b=>b.onclick=async()=>{const q=await db().from('lesson_plans').select('*').eq('id',b.dataset.week).single();if(q.error){msg(err(q.error),'error');return;}const x=q.data;state.editPlanId=x.id;state.planOutput=x.plan_data;[['acadYear',x.academic_year_id],['acadClass',x.class_id],['acadSection',x.section_id||''],['acadSubject',x.subject_id],['weekStart',x.week_start],['weekEnd',x.week_end],['weekChapter',x.chapter_title||'']].forEach(([k,v])=>{if($(k))$(k).value=v||'';});$('weekPreview').innerHTML=outputHtml(x.plan_data);if($('weekPlanEditor'))$('weekPlanEditor').value=readableText(x.plan_data);});
}
function reportKey(){return 'noor-report-draft-v2-'+u()?.id+'-'+sid();}
function reportData(){
 const c=context(val('reportTopic'));
 return {...c,report_date:val('acadDate')||today(),topic_taught:val('reportTopic'),page_range:val('reportPages'),planned_coverage:val('reportPlanned'),actual_coverage:val('reportActual'),teacher_reported_percentage:val('reportPct')===''?null:Number(val('reportPct')),activities_completed:val('reportActivities'),homework_assigned:val('reportHomework'),student_understanding:val('reportUnderstanding'),difficulties:val('reportDifficulties'),next_lesson_plan:val('reportNext'),additional_remarks:val('reportRemarks'),rough_input:val('reportRough'),lesson_status:val('reportUnitStatus')||'in_progress'};
}
function renderDaily(){
 const body='<div class="acad-grid"><section class="acad-panel"><h3>Daily teaching report</h3><p>Draft recovery is stored locally while editing. The status changes only when the database confirms the save.</p><form id="dailyForm" class="acad-form">'+contextHtml(true)+field('reportTopic','Topic actually taught','text',true)+field('reportPages','Lesson / page range','text',false)+field('reportPct','Teacher-reported coverage (%)','number',false,'Optional; not verified')+ta('reportPlanned','Planned syllabus coverage')+ta('reportActual','Actual syllabus coverage')+ta('reportActivities','Activities completed')+ta('reportHomework','Homework assigned')+ta('reportUnderstanding','Student understanding / participation')+ta('reportDifficulties','Difficulties encountered')+ta('reportNext','Next lesson plan')+ta('reportRemarks','Additional remarks')+ta('reportRough','Optional rough input')+btn('formatReportBtn','Organise rough input with AI','alt')+'<div class="field"><label for="reportUnitStatus">Selected unit status</label><select id="reportUnitStatus"><option value="not_started">Not Started</option><option value="in_progress" selected>In Progress</option><option value="completed">Completed</option><option value="requires_revision">Requires Revision</option></select></div><div id="reportStatus" style="display:none"></div><div class="acad-actions">'+btn('saveReportDraft','Save draft','alt')+btn('submitReport','Submit Daily Report','gold')+btn('printReport','Print / Save PDF','alt')+'</div></form></section><section class="acad-panel"><h3>My recent reports</h3><div id="teacherNotifications"></div><h3 style="margin-top:16px">My report history</h3><div id="myReportHistory">'+empty('Loading reports…')+'</div></section></div>';
 $('view-daily-report').innerHTML=shell('Teacher workspace','Today’s Teaching Report','Actual work, assignments, student understanding and next steps. Submitted reports are visible to authorized school management.',body);
 $('dailyForm').onsubmit=e=>e.preventDefault();$('dailyForm').addEventListener('input',onReportInput);$('dailyForm').addEventListener('change',onReportInput);
 $('saveReportDraft').onclick=()=>saveReport(false);$('submitReport').onclick=()=>saveReport(true);$('printReport').onclick=()=>window.print();$('formatReportBtn').onclick=formatReport;
 loadContext().then(()=>{setDefaults();restoreReport();loadExistingReport();loadReportHistory();loadTeacherNotifications();}).catch(e=>status('reportStatus',err(e),'error'));
}
function onReportInput(){try{localStorage.setItem(reportKey(),JSON.stringify(reportData()));status('reportStatus','Local recovery draft saved; server autosave pending.');}catch{}
 clearTimeout(state.reportTimer);state.reportTimer=setTimeout(()=>saveReport(false,true),1200);
}
function restoreReport(){
 try{const x=JSON.parse(localStorage.getItem(reportKey())||'null');if(!x)return;
 [['acadYear',x.academic_year_id],['acadClass',x.class_id],['acadSection',x.section_id||''],['acadSubject',x.subject_id],['acadUnit',x.unit_id||''],['acadDate',x.report_date],['reportTopic',x.topic_taught],['reportPages',x.page_range],['reportPlanned',x.planned_coverage],['reportActual',x.actual_coverage],['reportPct',x.teacher_reported_percentage],['reportActivities',x.activities_completed],['reportHomework',x.homework_assigned],['reportUnderstanding',x.student_understanding],['reportDifficulties',x.difficulties],['reportNext',x.next_lesson_plan],['reportRemarks',x.additional_remarks],['reportRough',x.rough_input],['reportUnitStatus',x.lesson_status]].forEach(([k,v])=>{if($(k)&&v!==null&&v!==undefined)$(k).value=v;});
 status('reportStatus','A local recovery draft was found. Verify it and save to server.');
 }catch{}
}
async function findReport(c){
 let q=db().from('daily_teaching_reports').select('*').eq('school_id',c.school_id).eq('teacher_id',u().id).eq('class_id',c.class_id).eq('subject_id',c.subject_id).eq('report_date',c.report_date);
 q=c.section_id?q.eq('section_id',c.section_id):q.is('section_id',null);return await q.maybeSingle();
}
async function loadExistingReport(){
 const c=reportData();if(!c.class_id||!c.subject_id)return;
 const r=await findReport(c);if(r.error){status('reportStatus',err(r.error),'error');return;}const x=r.data;if(!x)return;
 [['reportTopic',x.topic_taught],['reportPages',x.page_range],['reportPlanned',x.planned_coverage],['reportActual',x.actual_coverage],['reportPct',x.teacher_reported_percentage],['reportActivities',x.activities_completed],['reportHomework',x.homework_assigned],['reportUnderstanding',x.student_understanding],['reportDifficulties',x.difficulties],['reportNext',x.next_lesson_plan],['reportRemarks',x.additional_remarks],['reportRough',x.rough_input]].forEach(([k,v])=>{if($(k)&&v!==null)$(k).value=v;});
 if(['submitted','reviewed'].includes(x.report_status)){['reportTopic','reportPages','reportPlanned','reportActual','reportPct','reportActivities','reportHomework','reportUnderstanding','reportDifficulties','reportNext','reportRemarks','reportRough'].forEach(k=>{if($(k))$(k).disabled=true;});$('submitReport').disabled=true;$('saveReportDraft').disabled=true;}
 status('reportStatus','Server record status: '+x.report_status.toUpperCase()+'. '+(x.report_status==='reviewed'?'Request a correction from the Headmaster if necessary.':''),x.report_status==='reviewed'?'success':'');
}
async function saveReport(submit,silent){
 try{
 const c=reportData();if(!c.school_id||!c.academic_year_id||!c.class_id||!c.subject_id||!c.topic_taught||!c.actual_coverage){if(!silent)status('reportStatus','Complete academic year, class, subject, topic and actual coverage.','error');return;}
 if(c.teacher_reported_percentage!==null&&(!Number.isFinite(c.teacher_reported_percentage)||c.teacher_reported_percentage<0||c.teacher_reported_percentage>100))throw new Error('Reported coverage must be 0–100.');
 const found=await findReport(c);if(found.error)throw found.error;const old=found.data;
 if(submit&&old&&['submitted','reviewed'].includes(old.report_status))throw new Error('This report has already been submitted. Ask management to return it for correction.');
 const row={school_id:c.school_id,academic_year_id:c.academic_year_id,teacher_id:u().id,class_id:c.class_id,section_id:c.section_id,subject_id:c.subject_id,unit_id:c.unit_id,report_date:c.report_date,topic_taught:c.topic_taught,page_range:c.page_range,planned_coverage:c.planned_coverage,actual_coverage:c.actual_coverage,teacher_reported_percentage:c.teacher_reported_percentage,activities_completed:c.activities_completed,homework_assigned:c.homework_assigned,student_understanding:c.student_understanding,difficulties:c.difficulties,next_lesson_plan:c.next_lesson_plan,additional_remarks:c.additional_remarks,rough_input:c.rough_input,report_status:submit?'submitted':'draft',submitted_at:submit?new Date().toISOString():null};
 const r=old?await db().from('daily_teaching_reports').update(row).eq('id',old.id).select('id,report_status,submitted_at').single():await db().from('daily_teaching_reports').insert(row).select('id,report_status,submitted_at').single();
 if(r.error)throw r.error;
 if(c.unit_id){const unit=state.units.find(x=>x.id===c.unit_id);if(unit)await saveProgress(unit,c.lesson_status,c.teacher_reported_percentage);}
 if(submit){localStorage.removeItem(reportKey());status('reportStatus','Submitted to database at '+new Date(r.data.submitted_at||Date.now()).toLocaleString()+'.','success');['reportTopic','reportPages','reportPlanned','reportActual','reportPct','reportActivities','reportHomework','reportUnderstanding','reportDifficulties','reportNext','reportRemarks','reportRough'].forEach(k=>{if($(k))$(k).disabled=true;});$('submitReport').disabled=true;$('saveReportDraft').disabled=true;}
 else if(!silent)status('reportStatus','Draft saved to NOOR AI at '+new Date().toLocaleTimeString()+'.','success');
 if(submit||!silent)await loadReportHistory();
 }catch(e){try{localStorage.setItem(reportKey(),JSON.stringify(reportData()));}catch{}if(!silent||submit)status('reportStatus','NOT submitted: '+err(e)+'. A recovery copy remains in this browser.','error');}
}
async function formatReport(){
 try{const c=reportData();if(!val('reportRough'))throw new Error('Enter rough points first.');status('reportStatus','Formatting rough report text…');
 const r=await ai({...c,action:'format_report',rough_text:val('reportRough'),report_fields:c});
 const x=r.output||{};[['topic_taught','reportTopic'],['page_range','reportPages'],['planned_coverage','reportPlanned'],['actual_coverage','reportActual'],['teacher_reported_percentage','reportPct'],['activities_completed','reportActivities'],['homework_assigned','reportHomework'],['student_understanding','reportUnderstanding'],['difficulties','reportDifficulties'],['next_lesson_plan','reportNext'],['additional_remarks','reportRemarks']].forEach(([a,b])=>{if($(b)&&x[a]!==undefined&&x[a]!==null)$(b).value=x[a];});
 status('reportStatus','AI formatting is a suggestion. Review fields before saving/submitting.','success');
 }catch(e){status('reportStatus',err(e),'error');}
}
async function loadTeacherNotifications(){
 const box=$('teacherNotifications');if(!box||!sid()||!u()?.id)return;
 const r=await db().from('notification_events').select('id,event_type,subject,status,created_at').eq('recipient_profile_id',u().id).eq('school_id',sid()).order('created_at',{ascending:false}).limit(25);
 box.innerHTML=r.error?notice('teacherNotifyError',err(r.error),'error'):'<h3>In-app notices / feedback</h3>'+table(['When','Notice','Status'],(r.data||[]).map(x=>'<tr><td>'+E(new Date(x.created_at).toLocaleString())+'</td><td>'+E(x.subject||x.event_type)+'</td><td>'+E(x.status||'queued')+'</td></tr>'));
}
async function loadReportHistory(){
 const box=$('myReportHistory');if(!box)return;
 const r=await db().from('daily_teaching_reports').select('report_date,topic_taught,report_status,updated_at').eq('school_id',sid()).eq('teacher_id',u().id).order('report_date',{ascending:false}).limit(30);
 box.innerHTML=r.error?notice('historyError',err(r.error),'error'):table(['Date','Topic','Status','Updated'],(r.data||[]).map(x=>'<tr><td>'+E(x.report_date)+'</td><td>'+E(x.topic_taught)+'</td><td>'+E(x.report_status)+'</td><td>'+E(new Date(x.updated_at).toLocaleString())+'</td></tr>'));
}
function renderMonitoring(){
 const body='<section class="acad-panel"><div class="acad-toolbar"><div><h3>Daily academic monitoring</h3><p>Records with no submission are not treated as zero teaching activity.</p></div>'+btn('refreshMonitor','Refresh')+'</div><div class="acad-filter"><div><label class="acad-label" for="monFrom">From</label><input id="monFrom" type="date" value="'+new Date(Date.now()-29*86400000).toISOString().slice(0,10)+'"></div><div><label class="acad-label" for="monTo">To</label><input id="monTo" type="date" value="'+today()+'"></div><div><label class="acad-label" for="monYear">Academic year</label><select id="monYear"><option value="">All academic years</option></select></div><div><label class="acad-label" for="monStatus">Status</label><select id="monStatus"><option value="">All statuses</option><option>draft</option><option>submitted</option><option>reviewed</option><option>returned</option></select></div><div><label class="acad-label" for="monTeacher">Teacher</label><select id="monTeacher"><option value="">All teachers</option></select></div></div><div class="acad-filter"><div><label class="acad-label" for="monClass">Class</label><select id="monClass">'+opts(state.classes,'id','name','All classes')+'</select></div><div><label class="acad-label" for="monSection">Section</label><select id="monSection">'+opts(state.sections,'id','name','All sections')+'</select></div><div><label class="acad-label" for="monSubject">Subject</label><select id="monSubject">'+opts(state.subjects,'id','name','All subjects')+'</select></div><div class="acad-actions">'+btn('applyMonitor','Apply filters')+btn('exportMonitor','Export CSV','alt')+btn('printMonitor','Print / Save PDF','gold')+'</div></div><div id="monitorStatus" style="display:none"></div><div id="monitorStats" class="acad-metrics"></div><div id="monitorRows" style="margin-top:16px">'+empty('Loading saved reports…')+'</div><div id="reviewFormPanel" style="margin-top:16px"></div><div id="reviewHistory" style="margin-top:16px"></div></section>';
 let yearForm='';
 if(leader()||role()==='manager')yearForm=panel('Academic year setup','Create a named year for the school. Historical reports keep their year link.','<form id="yearForm" class="acad-form">'+field('newYearLabel','Academic year label','text',true,'2026–2027')+field('newYearStart','Start date','date',true)+field('newYearEnd','End date','date',true)+'<label class="acad-check-row"><input id="newYearCurrent" type="checkbox"> Mark as current</label>'+btn('saveAcademicYear','Save year')+'</form>');
 $('view-academic-monitoring').innerHTML=shell('School leadership','Academic Monitoring','Saved daily reports, syllabus progress and monthly/yearly teaching indicators. Coverage is not a substitute for measuring student learning.',body+yearForm);
 $('refreshMonitor').onclick=async()=>{await loadContext();await loadTeachers();await loadReports();};$('applyMonitor').onclick=loadReports;$('exportMonitor').onclick=exportReports;$('printMonitor').onclick=()=>window.print();
 if($('yearForm'))$('yearForm').onsubmit=saveYear;
 loadContext().then(async()=>{const yr=$('monYear');if(yr){yr.innerHTML=opts(state.years,'id','label','All academic years');const current=state.years.find(x=>x.is_current)||state.years[0];if(current)yr.value=current.id;}await loadTeachers();await loadReports();}).catch(e=>status('monitorStatus',err(e),'error'));
}
async function loadTeachers(){
 const x=$('monTeacher');if(!x)return;
 if(!leader()&&!(await permit('view_teacher_activity'))){x.innerHTML='<option value="">Not authorized</option>';return;}
 const r=await db().from('profiles').select('id,full_name,email,status').eq('school_id',sid()).eq('role','teacher').eq('status','active').order('full_name').limit(500);
 state.teachers=r.data||[];x.innerHTML=opts(state.teachers,'id','full_name','All teachers');
}
async function loadReports(){
 const box=$('monitorRows');if(!box)return;
 try{
 let q=db().from('daily_teaching_reports').select('id,school_id,academic_year_id,teacher_id,class_id,section_id,subject_id,unit_id,report_date,topic_taught,report_status,teacher_reported_percentage,activities_completed,homework_assigned,difficulties,next_lesson_plan,updated_at,submitted_at,version,planned_coverage,actual_coverage,page_range,student_understanding,additional_remarks,rough_input').eq('school_id',sid()).gte('report_date',val('monFrom')||'1900-01-01').lte('report_date',val('monTo')||today()).order('report_date',{ascending:false}).limit(1000);
 [['monStatus','report_status'],['monTeacher','teacher_id'],['monClass','class_id'],['monSection','section_id'],['monSubject','subject_id']].forEach(([a,b])=>{if(val(a))q=q.eq(b,val(a));});
 if(val('monYear'))q=q.eq('academic_year_id',val('monYear'));
 const r=await q;if(r.error)throw r.error;state.reports=r.data||[];
 const records=state.reports,submittedRows=records.filter(x=>['submitted','reviewed','returned'].includes(x.report_status)),submittedTeachers=new Set(submittedRows.map(x=>x.teacher_id)),teachersWithAny=new Set(records.map(x=>x.teacher_id)).size,issues=records.filter(x=>x.difficulties?.trim()).length;
 const noNarrowFilters=!val('monStatus')&&!val('monTeacher')&&!val('monClass')&&!val('monSection')&&!val('monSubject');
 const pending=noNarrowFilters?Math.max(0,state.teachers.length-submittedTeachers.size):'—';
 $('monitorStats').innerHTML=[['Active teachers',state.teachers.length],['Teachers with submitted reports',submittedTeachers.size],['Teachers with no submission in range',pending],['Reports in range',records.length],['Classes covered',new Set(records.map(x=>x.class_id)).size],['Subjects taught',new Set(records.map(x=>x.subject_id)).size],['Teachers with any record',teachersWithAny],['Reports with issues',issues]].map(([a,b])=>'<div class="acad-metric"><strong>'+E(b)+'</strong><span>'+E(a)+'</span></div>').join('');
 box.innerHTML=table(['Date','Teacher','Class / subject','Topic','Status','Details'],records.map(x=>'<tr><td>'+E(x.report_date)+'</td><td>'+E((state.teachers||[]).find(t=>t.id===x.teacher_id)?.full_name||'Teacher')+'</td><td>'+E(state.classes.find(c=>c.id===x.class_id)?.name||'Class')+'<div class="acad-muted">'+E(state.subjects.find(s=>s.id===x.subject_id)?.name||'Subject')+'</div></td><td>'+E(x.topic_taught)+'</td><td><span class="acad-status">'+E(x.report_status)+'</span></td><td>'+(x.difficulties?'<span class="acad-status warn">Issue</span>':'')+' <button type="button" class="acad-btn alt" data-report="'+E(x.id)+'">Open / review</button></td></tr>'));
 box.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>openReview(b.dataset.report));
 await reportSummary(records);status('monitorStatus',records.length?'Loaded actual saved reports. Missing reports are not inferred from the timetable.':'No saved reports match these filters.',records.length?'success':'');
 }catch(e){box.innerHTML=notice('monitorError',err(e),'error');status('monitorStatus',err(e),'error');}
}
async function reportSummary(reports){
 const box=$('reviewHistory');if(!box)return;
 const selectedYear=val('monYear')||state.years.find(x=>x.is_current)?.id||state.years[0]?.id;
 let units=[],progress=[];
 if(selectedYear){
  let uq=db().from('syllabus_units').select('id,class_id,section_id,subject_id,title').eq('school_id',sid()).eq('academic_year_id',selectedYear).eq('is_active',true);
  if(val('monClass'))uq=uq.eq('class_id',val('monClass'));
  if(val('monSection'))uq=uq.or('section_id.is.null,section_id.eq.'+val('monSection'));
  if(val('monSubject'))uq=uq.eq('subject_id',val('monSubject'));
  const ures=await uq;if(ures.error){box.innerHTML=notice('summaryUnitsError',err(ures.error),'error');return;}units=ures.data||[];
  let pq=db().from('syllabus_progress').select('syllabus_unit_id,progress_status,teacher_reported_percentage').eq('school_id',sid()).eq('academic_year_id',selectedYear);
  if(val('monClass'))pq=pq.eq('class_id',val('monClass'));
  if(val('monSection'))pq=pq.or('section_id.is.null,section_id.eq.'+val('monSection'));
  if(val('monSubject'))pq=pq.eq('subject_id',val('monSubject'));
  const pres=await pq;if(pres.error){box.innerHTML=notice('summaryProgressError',err(pres.error),'error');return;}progress=pres.data||[];
 }
 const unitIds=new Set(units.map(x=>x.id)),bestStatus=new Map(),rank={not_started:1,in_progress:2,completed:3,requires_revision:4};
 progress.filter(x=>unitIds.has(x.syllabus_unit_id)).forEach(x=>{const old=bestStatus.get(x.syllabus_unit_id);if(!old||(rank[x.progress_status]||0)>(rank[old.progress_status]||0))bestStatus.set(x.syllabus_unit_id,x);});
 const completed=[...bestStatus.values()].filter(x=>x.progress_status==='completed').length;
 const inProgress=[...bestStatus.values()].filter(x=>x.progress_status==='in_progress').length;
 const revision=[...bestStatus.values()].filter(x=>x.progress_status==='requires_revision').length;
 const pct=reports.filter(x=>x.teacher_reported_percentage!=null),avg=pct.length?(pct.reduce((s,x)=>s+Number(x.teacher_reported_percentage),0)/pct.length).toFixed(1)+'%':'Not reported';
 const submitted=reports.filter(x=>['submitted','reviewed','returned'].includes(x.report_status));
 const monthly=new Map();
 reports.forEach(r=>{const key=String(r.report_date||'').slice(0,7);if(!key)return;let m=monthly.get(key);if(!m){m={month:key,submitted:0,teachers:new Set(),percentages:[]};monthly.set(key,m);}if(['submitted','reviewed','returned'].includes(r.report_status)){m.submitted++;m.teachers.add(r.teacher_id);}if(r.teacher_reported_percentage!=null)m.percentages.push(Number(r.teacher_reported_percentage));});
 const trendRows=[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(m=>'<tr><td>'+E(m.month)+'</td><td>'+E(m.submitted)+'</td><td>'+E(m.teachers.size)+'</td><td>'+E(m.percentages.length?(m.percentages.reduce((s,v)=>s+v,0)/m.percentages.length).toFixed(1)+'%':'Not reported')+'</td></tr>');
 const monthlyHtml=trendRows.length?table(['Month','Submitted reports','Teachers submitting','Mean teacher-reported coverage'],trendRows):empty('No saved reports for the selected period.');
 const metrics=[
  ['Submitted / reviewed / returned reports',submitted.length],
  ['Draft reports',reports.filter(x=>x.report_status==='draft').length],
  ['Syllabus units defined',units.length],
  ['Units marked completed',completed],
  ['Units in progress',inProgress],
  ['Units requiring revision',revision],
  ['Units not yet marked complete',Math.max(0,units.length-completed)],
  ['Reports with homework assigned',reports.filter(x=>x.homework_assigned?.trim()).length],
  ['Reports with assessment/test activity mentioned',reports.filter(x=>/assessment|test|quiz/i.test((x.activities_completed||'')+' '+(x.homework_assigned||''))).length],
  ['Reports with issues',reports.filter(x=>x.difficulties?.trim()).length],
  ['Mean teacher-reported coverage',avg]
 ];
 box.innerHTML='<h3>Academic reporting summary</h3><div class="acad-grid three">'+metrics.map(([a,b])=>'<div class="acad-metric"><strong style="font-size:20px">'+E(b)+'</strong><span>'+E(a)+'</span></div>').join('')+'</div><h3 style="margin-top:20px">Monthly coverage trend</h3>'+monthlyHtml+'<p class="acad-muted">Period: '+E(val('monFrom')||'start of records')+' to '+E(val('monTo')||today())+'. Syllabus metrics use '+E(state.years.find(x=>x.id===selectedYear)?.label||'the selected academic year')+'. Topics are counted once by curriculum-unit ID; progress is an academic monitoring indicator, not proof of learning quality. Teacher percentages remain self-reported unless independently verified.</p>';
}
async function saveYear(e){
 e.preventDefault();try{if(!(await permit('manage_syllabus')))throw new Error('Your role cannot manage academic years.');
 const a=val('newYearLabel'),s=val('newYearStart'),e2=val('newYearEnd');if(!a||!s||!e2||s>e2)throw new Error('Enter a valid label and date range.');
 if($('newYearCurrent').checked){const q=await db().from('academic_years').update({is_current:false}).eq('school_id',sid()).eq('is_current',true);if(q.error)throw q.error;}
 const r=await db().from('academic_years').insert({school_id:sid(),label:a,starts_on:s,ends_on:e2,is_current:$('newYearCurrent').checked,created_by:u().id});if(r.error)throw r.error;
 msg('Academic year saved.','success');await loadContext();await loadTeachers();await loadReports();
 }catch(e){status('monitorStatus',err(e),'error');}
}
async function openReview(id){
 const r=state.reports.find(x=>x.id===id);if(!r)return;
 $('reviewFormPanel').innerHTML=panel('Report review','Authorized leadership feedback; internal remarks stay out of the student dashboard.',
 '<div class="acad-grid three">'+[['Date',r.report_date],['Teacher',(state.teachers||[]).find(t=>t.id===r.teacher_id)?.full_name||'Teacher'],['Status',r.report_status],['Topic',r.topic_taught],['Coverage',r.teacher_reported_percentage==null?'Not reported':r.teacher_reported_percentage+'% teacher-reported'],['Version',r.version]].map(([a,b])=>'<div class="acad-metric"><span>'+E(a)+'</span><strong style="font-size:15px">'+E(b)+'</strong></div>').join('')+'</div><div class="acad-grid">'+[['Planned coverage',r.planned_coverage],['Actual coverage',r.actual_coverage],['Activities',r.activities_completed],['Homework',r.homework_assigned],['Student understanding',r.student_understanding],['Difficulties',r.difficulties],['Next lesson',r.next_lesson_plan],['Remarks',r.additional_remarks]].map(([a,b])=>'<div><b>'+E(a)+'</b><p>'+E(b||'Not recorded')+'</p></div>').join('')+'</div><form id="reviewForm" class="acad-form"><div class="field"><label for="reviewAction">Decision</label><select id="reviewAction"><option value="reviewed">Mark reviewed</option><option value="returned">Return for correction</option></select></div>'+ta('reviewFeedback','Feedback to teacher (required)')+ta('reviewInternal','Internal administrative remark (optional)')+btn('saveReview','Save review')+'<div id="reviewStatus" style="display:none"></div></form>');
 $('saveReview').onclick=async()=>{try{if(!(await permit('review_reports')))throw new Error('You do not have report-review permission.');if(!val('reviewFeedback'))throw new Error('Enter feedback for the teacher.');
 const q=await db().from('academic_report_reviews').insert({school_id:sid(),report_id:id,reviewer_id:u().id,action:val('reviewAction'),feedback:val('reviewFeedback'),internal_remark:val('reviewInternal')||null});
 if(q.error)throw q.error;status('reviewStatus',val('reviewAction')==='returned'?'Report returned and teacher notification queued.':'Report marked reviewed and teacher notification queued.','success');await loadReports();await loadReviewHistory(id);
 }catch(e){status('reviewStatus',err(e),'error');}};
 await loadReviewHistory(id);
}
async function loadReviewHistory(id){
 const box=$('reviewHistory');if(!box)return;const r=await db().from('academic_report_reviews').select('action,feedback,internal_remark,created_at').eq('school_id',sid()).eq('report_id',id).order('created_at',{ascending:false});
 box.innerHTML=r.error?notice('reviewHistoryError',err(r.error),'error'):table(['When','Decision','Feedback','Internal remark'],(r.data||[]).map(x=>'<tr><td>'+E(new Date(x.created_at).toLocaleString())+'</td><td>'+E(x.action)+'</td><td>'+E(x.feedback)+'</td><td>'+E(x.internal_remark||'—')+'</td></tr>'));
}
function exportReports(){
 const headers=['School','Academic year','Report date','Teacher','Class','Section','Subject','Topic taught','Status','Teacher-reported coverage (%)','Planned coverage','Actual coverage','Lesson/page range','Activities completed','Homework assigned','Student understanding / participation','Difficulties','Next lesson','Remarks','Submitted at'];
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const rows=(state.reports||[]).map(r=>[
  A().school?.name||sid(),
  state.years.find(y=>y.id===r.academic_year_id)?.label||'—',
  r.report_date,
  state.teachers.find(t=>t.id===r.teacher_id)?.full_name||'—',
  state.classes.find(k=>k.id===r.class_id)?.name||'—',
  state.sections.find(s=>s.id===r.section_id)?.name||(r.section_id?'—':'Whole class'),
  state.subjects.find(s=>s.id===r.subject_id)?.name||'—',
  r.topic_taught,r.report_status,r.teacher_reported_percentage,
  r.planned_coverage,r.actual_coverage,r.page_range,r.activities_completed,
  r.homework_assigned,r.student_understanding,r.difficulties,r.next_lesson_plan,
  r.additional_remarks,r.submitted_at
 ]);
 const csv=[headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
 download('\ufeff'+csv,'noor-ai-academic-report-'+today()+'.csv');
}
async function renderStudentNotes(){
 const body='<section class="acad-panel"><div class="acad-toolbar"><div><h3>Approved study material</h3><p>Only teacher-published notes for your class/section are requested; database RLS filters the results as well.</p></div>'+btn('refreshStudentNotes','Refresh')+'</div><div id="studentNotesList">'+empty('Loading notes…')+'</div></section>';
 $('view-notes').innerHTML=shell('Student dashboard','My Notes & Revision','Approved notes, chapter summaries, revision questions and permitted learning material.',body);$('refreshStudentNotes').onclick=loadStudentNotes;loadStudentNotes();
}
async function loadStudentNotes(){
 const box=$('studentNotesList');if(!box)return;
 const x=p();if(role()!=='student'){box.innerHTML=empty('Student view only.');return;}
 let q=db().from('smart_notes').select('id,title,content,updated_at').eq('school_id',sid()).eq('status','published').eq('published_to_students',true).eq('class_id',x.class_id).order('updated_at',{ascending:false}).limit(100);
 q=x.section_id?q.or('section_id.is.null,section_id.eq.'+x.section_id):q.is('section_id',null);
 const r=await q;if(r.error){box.innerHTML=notice('studentNotesErr',err(r.error),'error');return;}
 box.innerHTML=(r.data||[]).length?(r.data||[]).map(n=>'<details class="acad-panel"><summary><b>'+E(n.title)+'</b><span class="acad-muted"> · '+E(new Date(n.updated_at).toLocaleDateString())+'</span></summary><div class="acad-notes-preview">'+outputHtml(n.content)+'</div><button class="acad-btn alt" data-noteprint="'+E(n.id)+'" type="button">Print / Save PDF</button></details>').join(''):empty('No approved notes are published for this class yet.');
 box.querySelectorAll('[data-noteprint]').forEach(b=>b.onclick=()=>window.print());
}
async function renderDirectory(kind){
 const student=kind==='student',unified=['owner','principal'].includes(role()),id=unified?'view-student-directory':(student?'view-student-directory':'view-teacher-directory'),permission=student?'view_students':'view_teacher_activity';
 if(!leader()&&!(await permit(permission))){$(id).innerHTML=shell('School management','Access restricted','This directory requires the relevant school permission.',empty('Your role is not authorized to open this directory.'));return;}
 const body='<section class="acad-panel"><div class="acad-toolbar"><div><h3>People directory</h3><p>Search by name, email, roll number or staff ID. Records are limited to this school and your permissions.</p></div>'+(unified?'<div class="field"><label class="acad-label" for="dirKind">Record type</label><select id="dirKind"><option value="student">Student</option><option value="teacher">Teacher / Staff</option></select></div>':'')+'</div><div class="acad-search"><input id="dirSearch" placeholder="Search name, email, '+(student?'roll number':'employee ID')+'"><button class="acad-btn" id="doDirSearch">Search</button><button class="acad-btn alt" id="dirExport">Export CSV</button></div><div class="acad-filter"><div><label class="acad-label" for="dirClass">Class</label><select id="dirClass">'+opts(state.classes,'id','name','All classes')+'</select></div><div><label class="acad-label" for="dirSection">Section</label><select id="dirSection">'+opts(state.sections,'id','name','All sections')+'</select></div><div><label class="acad-label" for="dirStatus">Status</label><select id="dirStatus"><option value="">All</option><option>active</option><option>pending</option><option>inactive</option><option>removed</option><option>transferred</option></select></div></div><div id="dirStatusMessage" style="display:none"></div><div id="dirResults">'+empty('Enter a search or choose filters.')+'</div></section><section id="dirDetail" class="acad-panel" style="display:none;margin-top:14px"></section>';
 $(id).innerHTML=shell('School management',unified?'People & Staff':(student?'Student Directory':'Teacher Directory'),'Search authorised school people, open their identity and review their real records.',body);
 $('doDirSearch').onclick=()=>searchDirectory(kind);$('dirSearch').onkeydown=e=>{if(e.key==='Enter')searchDirectory(kind);};$('dirExport').onclick=exportDirectory;
 $('dirKind')?.addEventListener('change',()=>{const k=val('dirKind');const input=$('dirSearch');if(input)input.placeholder='Search name, email, '+(k==='student'?'roll number':'employee ID');searchDirectory(k);});
 await searchDirectory(kind);
}
async function searchDirectory(kind){
 const actualKind=$('dirKind')?val('dirKind'):kind;const student=actualKind==='student',query=val('dirSearch').toLowerCase();let q=db().from('profiles').select('id,full_name,email,role,status,school_id,mobile_number,parent_name,roll_number,class_id,section_id,created_at,updated_at').eq('school_id',sid()).eq('role',student?'student':'teacher').order('full_name').limit(500);
 if(val('dirClass'))q=q.eq('class_id',val('dirClass'));if(val('dirSection'))q=q.eq('section_id',val('dirSection'));if(['active','pending','inactive'].includes(val('dirStatus')))q=q.eq('status',val('dirStatus'));
 const r=await q;if(r.error){status('dirStatusMessage',err(r.error),'error');return;}state.directoryRows=r.data||[];
 if(!student&&state.directoryRows.length){const mr=await db().from('school_memberships').select('user_id,username,employee_id,status,removed_at,removal_reason').eq('school_id',sid()).in('user_id',state.directoryRows.map(x=>x.id));if(mr.error){status('dirStatusMessage',err(mr.error),'error');return;}const byUser=new Map((mr.data||[]).map(m=>[m.user_id,m]));state.directoryRows=state.directoryRows.map(x=>{const m=byUser.get(x.id);return {...x,username:m?.username,employee_id:m?.employee_id,membership_status:m?.status,removed_at:m?.removed_at,removal_reason:m?.removal_reason};});}
 if(val('dirStatus')==='removed')state.directoryRows=state.directoryRows.filter(x=>x.membership_status==='removed');
 else if(val('dirStatus')==='active')state.directoryRows=state.directoryRows.filter(x=>x.status==='active'&&(!x.membership_status||x.membership_status==='active'));
 else if(val('dirStatus')==='transferred')state.directoryRows=state.directoryRows.filter(x=>x.membership_status==='transferred');
 const rows=state.directoryRows.filter(x=>!query||[x.full_name,x.email,x.roll_number,x.mobile_number,x.username,x.employee_id].some(s=>String(s||'').toLowerCase().includes(query)));
 $('dirResults').innerHTML=table(['Name / email','Class / section','Roll / employee ID','School status','Open'],rows.map(x=>'<tr><td><b>'+E(x.full_name)+'</b><div class="acad-muted">'+E(x.email)+'</div>'+(x.username?'<div class="acad-muted">@'+E(x.username)+'</div>':'')+'</td><td>'+E(state.classes.find(a=>a.id===x.class_id)?.name||'—')+'<div class="acad-muted">'+E(state.sections.find(a=>a.id===x.section_id)?.name||'—')+'</div></td><td>'+E(student?(x.roll_number||x.id.slice(0,8)):(x.employee_id||x.username||x.id.slice(0,8)))+'<div class="acad-muted">'+E(x.mobile_number||'')+'</div></td><td>'+E(x.membership_status||x.status||'—')+(x.removed_at?'<div class="acad-muted">Removed '+E(new Date(x.removed_at).toLocaleDateString())+'</div>':'')+'</td><td><button type="button" class="acad-btn alt" data-openprofile="'+E(x.id)+'">Open profile</button></td></tr>'));
 $('dirResults').querySelectorAll('[data-openprofile]').forEach(b=>b.onclick=()=>openProfile($('dirKind')?val('dirKind'):kind,b.dataset.openprofile));
 status('dirStatusMessage',rows.length+' saved '+(student?'student':'teacher')+' record(s). Missing activity is not inferred.','success');
}
async function openProfile(kind,id){
 const student=kind==='student',x=(state.directoryRows||[]).find(a=>a.id===id);if(!x)return;
 const box=$('dirDetail');box.style.display='block';
 let body='<div class="acad-grid three">'+[['Name',x.full_name],['Email',x.email],['Status',x.status],['School',A().school?.name||x.school_id],['Class',state.classes.find(a=>a.id===x.class_id)?.name||'—'],['Section',state.sections.find(a=>a.id===x.section_id)?.name||'—'],['Roll / ID',x.roll_number||x.id.slice(0,8)],['Mobile',x.mobile_number||'—'],['Parent / guardian',student?x.parent_name||'—':'Not applicable']].map(([a,b])=>'<div class="acad-metric"><span>'+E(a)+'</span><strong style="font-size:15px;word-break:break-word">'+E(b)+'</strong></div>').join('')+'</div><div id="directoryHistory" style="margin-top:16px"></div>';
 box.innerHTML='<div class="acad-toolbar"><h3>'+E(student?'Student identity & progress':'Staff identity & activity')+'</h3><div class="acad-actions">'+(student?'<button type="button" class="acad-btn alt" data-edit-profile>Open edit / status controls</button>':'<button type="button" class="acad-btn alt" data-manage-staff>Manage staff access</button>')+'</div></div>'+body;
 box.querySelector('[data-edit-profile]')?.addEventListener('click',()=>{A().openView?.('students');setTimeout(()=>{const q=$('studentSearch');if(q){q.value=x.full_name||'';q.dispatchEvent(new Event('input'));}},350);});
 box.querySelector('[data-manage-staff]')?.addEventListener('click',()=>A().openView?.('staff-management'));
 if(student){
  const [att,tasks,marks,scores]=await Promise.all([
   db().from('attendance_records').select('status,marked_at').eq('student_id',x.id).order('marked_at',{ascending:false}).limit(100),
   db().from('task_assignees').select('status,response,created_at').eq('assignee_id',x.id).order('created_at',{ascending:false}).limit(100),
   db().from('school_tasks').select('title,task_type,status,created_at').eq('school_id',sid()).eq('class_id',x.class_id).limit(100),
   db().from('assessment_results').select('marks_obtained,grade_label,teacher_feedback,marked_at,assessment:school_assessments(title,assessment_date,max_marks,subject_id,assessment_type)').eq('school_id',sid()).eq('student_id',x.id).order('marked_at',{ascending:false}).limit(100)
  ]);
  $('directoryHistory').innerHTML='<h3>Attendance</h3>'+(att.error?notice('attErr',err(att.error),'error'):table(['Marked','Status'],(att.data||[]).map(r=>'<tr><td>'+E(new Date(r.marked_at).toLocaleString())+'</td><td>'+E(r.status)+'</td></tr>')))+'<h3>Assigned tasks</h3>'+(tasks.error?notice('taskErr',err(tasks.error),'error'):table(['Date','Status','Response'],(tasks.data||[]).map(r=>'<tr><td>'+E(new Date(r.created_at).toLocaleDateString())+'</td><td>'+E(r.status)+'</td><td>'+E(r.response||'—')+'</td></tr>')))+'<h3>Class tasks</h3>'+(marks.error?notice('taskSchoolErr',err(marks.error),'error'):table(['Date','Title','Type','Status'],(marks.data||[]).map(r=>'<tr><td>'+E(new Date(r.created_at).toLocaleDateString())+'</td><td>'+E(r.title)+'</td><td>'+E(r.task_type)+'</td><td>'+E(r.status)+'</td></tr>')))+'<h3>Subject-wise test results</h3>'+ (scores.error?notice('scoresErr',err(scores.error),'error'):table(['Date','Assessment','Subject','Marks','Grade / feedback'],(scores.data||[]).map(r=>'<tr><td>'+E(r.assessment?.assessment_date||new Date(r.marked_at).toLocaleDateString())+'</td><td>'+E(r.assessment?.title||'Assessment')+'<div class="acad-muted">'+E(r.assessment?.assessment_type||'')+'</div></td><td>'+E(state.subjects.find(z=>z.id===r.assessment?.subject_id)?.name||'Subject')+'</td><td>'+E(r.marks_obtained)+' / '+E(r.assessment?.max_marks??'—')+'</td><td>'+E(r.grade_label||'—')+'<div class="acad-muted">'+E(r.teacher_feedback||'')+'</div></td></tr>')));
 }else{
  const [reports,plans,notes,sched,assign]=await Promise.all([
   db().from('daily_teaching_reports').select('report_date,topic_taught,report_status,teacher_reported_percentage').eq('teacher_id',x.id).eq('school_id',sid()).order('report_date',{ascending:false}).limit(100),
   db().from('lesson_plans').select('week_start,week_end,chapter_title,status').eq('teacher_id',x.id).eq('school_id',sid()).order('week_start',{ascending:false}).limit(100),
   db().from('smart_notes').select('title,status,published_to_students,updated_at').eq('teacher_id',x.id).eq('school_id',sid()).order('updated_at',{ascending:false}).limit(100),
   db().from('teacher_schedule_entries').select('schedule_date,starts_at,ends_at,topic,status,entry_type').eq('teacher_id',x.id).eq('school_id',sid()).order('schedule_date',{ascending:false}).limit(100),
   db().from('teacher_assignments').select('class_id,section_id,subject_id,is_active').eq('teacher_id',x.id).eq('school_id',sid())
  ]);
  $('directoryHistory').innerHTML='<h3>Assigned classes / subjects</h3>'+(assign.error?notice('assignErr',err(assign.error),'error'):table(['Class','Section','Subject','Status'],(assign.data||[]).map(r=>'<tr><td>'+E(state.classes.find(a=>a.id===r.class_id)?.name||'Class')+'</td><td>'+E(state.sections.find(a=>a.id===r.section_id)?.name||'All')+'</td><td>'+E(state.subjects.find(a=>a.id===r.subject_id)?.name||'Subject')+'</td><td>'+E(r.is_active?'Active':'Inactive')+'</td></tr>')))+'<h3>Daily reports</h3>'+(reports.error?notice('reportsErr',err(reports.error),'error'):table(['Date','Topic','Status','Reported %'],(reports.data||[]).map(r=>'<tr><td>'+E(r.report_date)+'</td><td>'+E(r.topic_taught)+'</td><td>'+E(r.report_status)+'</td><td>'+(r.teacher_reported_percentage==null?'Not reported':E(r.teacher_reported_percentage+'%'))+'</td></tr>')))+'<h3>Weekly plans</h3>'+(plans.error?notice('plansErr',err(plans.error),'error'):table(['Week','Chapter','Status'],(plans.data||[]).map(r=>'<tr><td>'+E(r.week_start)+' – '+E(r.week_end)+'</td><td>'+E(r.chapter_title||'—')+'</td><td>'+E(r.status)+'</td></tr>')))+'<h3>Smart Notes</h3>'+(notes.error?notice('notesErr',err(notes.error),'error'):table(['Updated','Title','Status'],(notes.data||[]).map(r=>'<tr><td>'+E(new Date(r.updated_at).toLocaleDateString())+'</td><td>'+E(r.title)+'</td><td>'+E(r.status)+'</td></tr>')))+'<h3>Schedule</h3>'+(sched.error?notice('schedErr',err(sched.error),'error'):table(['Date','Time','Topic','Type','Status'],(sched.data||[]).map(r=>'<tr><td>'+E(r.schedule_date||'—')+'</td><td>'+E((r.starts_at||'')+'–'+(r.ends_at||''))+'</td><td>'+E(r.topic||'—')+'</td><td>'+E(r.entry_type)+'</td><td>'+E(r.status)+'</td></tr>')));
 }
}
function exportDirectory(){const a=state.directoryRows||[];if(!a.length){msg('No directory records to export.');return;}const keys=['full_name','email','role','status','roll_number','mobile_number','class_id','section_id','created_at'];const csv=[keys.join(','),...a.map(x=>keys.map(k=>'"'+String(x[k]??'').replaceAll('"','""')+'"').join(','))].join('\r\n');download(csv,'noor-ai-directory-'+today()+'.csv');}
function download(body,name){const url=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function renderStaff(){
 if(!leader()&&!(await permit('manage_staff'))){$('view-staff-management').innerHTML=shell('Management','Access restricted','Staff operations require an authorized school role.',empty('Your current role cannot manage staff.'));return;}
 const body='<div class="acad-grid"><section class="acad-panel"><h3>Secure staff invitation</h3><p>Token hash is stored; raw invitation is sent once. Principal, Manager, Teacher or Student can be invited. Ownership cannot be claimed by a role picker.</p><form id="inviteForm" class="acad-form"><div class="field"><label for="inviteRole">Role *</label><select id="inviteRole"><option value="principal">Principal</option><option value="manager">Manager</option><option value="teacher">Teacher</option><option value="student">Student</option></select></div>'+field('inviteEmail','Email (recommended)','email',false)+field('inviteName','Name','text',false)+ '<div class="field"><label for="inviteExpiry">Expires in</label><select id="inviteExpiry"><option value="1">1 day</option><option value="3">3 days</option><option selected value="7">7 days</option><option value="14">14 days</option></select></div>'+btn('makeInvite','Create invitation')+'</form><div id="inviteStatus" style="display:none"></div><div id="inviteLinkBox"></div></section><section class="acad-panel"><h3>School Secret Code</h3><p>Generated randomly; hash only is stored. Rotating it invalidates the old secret. It is not a master password.</p>'+btn('rotateSecret','Rotate secret code','gold')+'<div id="secretStatus" style="display:none"></div><div id="secretOnce"></div><hr class="divider"><h3>Manager permissions</h3><div id="permissionsBox">'+empty('Loading permission grants…')+'</div></section></div><section class="acad-panel"><div class="acad-toolbar"><div><h3>Memberships / staff status</h3><p>Removing staff revokes membership and teacher assignments but preserves academic history.</p></div>'+btn('refreshStaff','Refresh')+'</div><div id="staffStatus" style="display:none"></div><div id="staffRows"></div></section><section class="acad-panel"><h3>Recent administrative audit log</h3><div id="staffAudit"></div></section>';
 $('view-staff-management').innerHTML=shell('School leadership','Access & Staff Management','Invitations, least-privilege Manager access, staff removal / reactivation and school-specific administrative history.',body);
 $('inviteForm').onsubmit=createInvite;$('rotateSecret').onclick=rotateSecret;$('refreshStaff').onclick=()=>{loadStaff();loadPermissions();};if(!['creator','owner'].includes(role())){[...$('inviteRole').options].forEach(o=>{if(['principal','manager'].includes(o.value))o.disabled=true;});$('inviteRole').value='teacher';}await loadPermissions();await loadStaff();
}
async function createInvite(e){
 e.preventDefault();try{if(!(await permit('manage_invites')))throw new Error('Your role cannot create invitations.');const r=val('inviteRole');if(!['principal','manager','teacher','student'].includes(r))throw new Error('Invalid invite role.');
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)),hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 const expires=new Date(Date.now()+Number(val('inviteExpiry')||7)*86400000).toISOString();
 const q=await db().from('school_invitations').insert({school_id:sid(),role:r,invited_email:val('inviteEmail').toLowerCase()||null,invited_name:val('inviteName')||null,token_hash:hash,created_by:u().id,expires_at:expires,max_uses:1}).select('expires_at').single();if(q.error)throw q.error;
 const url=new URL(location.href);url.searchParams.set('invite',token);$('inviteLinkBox').innerHTML='<div class="acad-notice success"><b>Invitation created.</b><p>Expires '+E(new Date(q.data.expires_at).toLocaleString())+'. Send privately to the intended person.</p><input id="inviteUrl" readonly value="'+E(url.toString())+'"><button type="button" class="acad-btn alt" id="copyInvite">Copy link</button></div>';
 $('copyInvite').onclick=async()=>{try{await navigator.clipboard.writeText(url.toString());msg('Invite link copied.','success');}catch{$('inviteUrl').select();msg('Select and copy the link.');}};
 status('inviteStatus','Created one-use '+r+' invitation; the raw token is not stored.','success');await loadStaff();
 }catch(e){status('inviteStatus',err(e),'error');}
}
async function rotateSecret(){
 if(!confirm('Rotate the school secret code? The previous secret will no longer match.'))return;
 try{const q=await db().rpc('noor_rotate_school_secret_code',{p_school_id:sid()});if(q.error)throw q.error;const secret=q.data;
 $('secretOnce').innerHTML='<div class="acad-notice success">New secret (copy now; not shown again after leaving this view):<p><code>'+E(secret)+'</code></p><button type="button" class="acad-btn alt" id="copySecret">Copy code</button></div>';
 $('copySecret').onclick=async()=>{try{await navigator.clipboard.writeText(secret);msg('Secret copied. Keep it private.','success');}catch{msg('Select code and copy manually.');}};
 status('secretStatus','Secret rotated and audit entry added.','success');
 }catch(e){status('secretStatus',err(e),'error');}
}
const permKeys=['view_students','manage_students','view_attendance','manage_attendance','view_academic_reports','review_reports','manage_syllabus','publish_notes','view_teacher_activity','manage_staff','manage_schedules','manage_notices','manage_meetings','manage_settings','manage_permissions','manage_invites','view_audit_logs','manage_classes','manage_subjects','manage_tasks','manage_assessments'];
async function loadPermissions(){
 const box=$('permissionsBox');if(!box)return;if(!['creator','owner'].includes(role())){box.innerHTML=empty('Only the Platform Creator or School Owner can change the Manager permission matrix.');return;}
 const q=await db().from('role_permissions').select('permission_key,is_allowed').eq('school_id',sid()).eq('role','manager');if(q.error){box.innerHTML=notice('permErr',err(q.error),'error');return;}
 const values=Object.fromEntries((q.data||[]).map(x=>[x.permission_key,x.is_allowed]));
 box.innerHTML=permKeys.map(k=>'<label class="acad-check-row"><input type="checkbox" data-perm="'+k+'" '+(values[k]?'checked':'')+'> '+E(k.replaceAll('_',' '))+'</label>').join('')+'<div class="acad-actions">'+btn('savePerms','Save Manager grants')+'</div><div id="permStatus" style="display:none"></div>';
 $('savePerms').onclick=async()=>{try{const rows=permKeys.map(k=>({school_id:sid(),role:'manager',permission_key:k,is_allowed:!!box.querySelector('[data-perm="'+k+'"]')?.checked,updated_by:u().id}));
 const z=await db().from('role_permissions').upsert(rows,{onConflict:'school_id,role,permission_key'});if(z.error)throw z.error;status('permStatus','Manager grants saved; database policies enforce each permission.','success');await loadPermissions();
 }catch(e){status('permStatus',err(e),'error');}};
}
async function loadStaff(){
 const box=$('staffRows');if(!box)return;const q=await db().from('school_memberships').select('id,user_id,role,status,username,employee_id,joined_at,removed_at,removal_reason').eq('school_id',sid()).order('created_at',{ascending:false}).limit(500);
 if(q.error){box.innerHTML=notice('staffLoadErr',err(q.error),'error');return;}
 const mem=q.data||[],ids=mem.map(x=>x.user_id);let users=[];
 if(ids.length){const r=await db().from('profiles').select('id,full_name,email,role,status').in('id',ids);if(r.error){box.innerHTML=notice('staffProfilesErr',err(r.error),'error');return;}users=r.data||[];}
 box.innerHTML=table(['Member','Role','School membership','History','Action'],mem.map(m=>{const x=users.find(v=>v.id===m.user_id)||{};
 return '<tr><td><b>'+E(x.full_name||m.username||'Member')+'</b><div class="acad-muted">'+E(x.email||'')+'</div></td><td>'+E(m.role)+'</td><td>'+E(m.status)+'</td><td>'+E(m.joined_at?new Date(m.joined_at).toLocaleDateString():'—')+(m.removed_at?'<div>Removed '+E(new Date(m.removed_at).toLocaleDateString())+'</div>':'')+'</td><td>'+(m.status==='active'&&m.role!=='owner'&&m.user_id!==u().id?'<button class="acad-btn danger" type="button" data-remove="'+E(m.id)+'" data-name="'+E(x.full_name||m.username||'member')+'">Remove</button>':m.status==='removed'?'<button class="acad-btn alt" type="button" data-reactivate="'+E(m.id)+'">Reactivate</button>':'—')+'</td></tr>';
 }));
 box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeMember(b.dataset.remove,b.dataset.name));
 box.querySelectorAll('[data-reactivate]').forEach(b=>b.onclick=()=>reactivateMember(b.dataset.reactivate));
 const a=await db().from('administrative_audit_logs').select('action,reason,metadata,created_at').eq('school_id',sid()).order('created_at',{ascending:false}).limit(30);
 $('staffAudit').innerHTML=a.error?notice('auditLoadErr',err(a.error),'error'):table(['Time','Action','Reason','Context'],(a.data||[]).map(x=>'<tr><td>'+E(new Date(x.created_at).toLocaleString())+'</td><td>'+E(x.action)+'</td><td>'+E(x.reason||'—')+'</td><td><code>'+E(JSON.stringify(x.metadata||{}))+'</code></td></tr>'));
}
async function removeMember(id,name){
 const reason=prompt('Remove '+name+' from this school? Historical records stay. Enter reason:');if(reason===null)return;if(!reason.trim()){msg('Reason is required.','error');return;}
 if(!confirm('Confirm revoking '+name+' school membership?'))return;
 const q=await db().rpc('noor_remove_school_member',{p_membership_id:id,p_reason:reason.trim()});if(q.error){msg(err(q.error),'error');return;}msg('Membership removed; historical academic records retained.','success');await loadStaff();
}
async function reactivateMember(id){
 if(!(await permit('manage_staff'))){msg('Your role cannot reactivate membership.','error');return;}
 if(!confirm('Reactivate membership? Verify the staff member and assignments first.'))return;
 try{
  const q=await db().rpc('noor_reactivate_school_member',{p_membership_id:id});if(q.error)throw q.error;
  msg('Membership reactivated; historical records retained. Teacher assignments must be explicitly re-assigned.','success');await loadStaff();
 }catch(e){msg(err(e),'error');}
}
function renderManagement(){
 const cards=[['academic-monitoring','Academic Monitoring','Daily reports, syllabus progress and monthly/yearly summaries'],['student-directory','Student Directory','Find a student by name or roll number'],['teacher-directory','Teacher Directory','Actual teaching history, assignments and schedules'],['staff-management','Staff & Access','Invitations, Manager permissions, secret rotation and removal'],['attendance','Attendance','Save class attendance records'],['schedules','Schedules & Extra Classes','Scheduled and completed sessions'],['meetings','Meetings & Calendar','School meeting and event records'],['notices','School Notices','Create and list school announcements'],['audit-logs','Audit Logs','Authorized administrative history']];
 const body='<div class="acad-grid three">'+[['Principal','Academic operations and authorized staff oversight.'],['School Creator / Owner','School identity, leadership and access settings.'],['Manager','Only the granular permissions explicitly granted to this role.']].map(([a,b])=>'<div class="acad-panel"><h3>'+E(a)+'</h3><p>'+E(b)+'</p><span class="acad-status">Role checked on the server</span></div>').join('')+'</div><section class="acad-panel"><h3>Master Administration</h3><p>No universal master password is offered. Signed-in identity and school-specific authorization are required.</p><div class="acad-grid three">'+cards.map(([a,b,c])=>'<button class="acad-panel" type="button" data-mgmt="'+a+'" style="text-align:left;cursor:pointer"><h3>'+E(b)+' →</h3><p>'+E(c)+'</p></button>').join('')+'</div></section>';
 $('view-management').innerHTML=shell('Management Portal','School Management Portal','Three leadership roles are available by invitation / secure provisioning; selecting a role does not grant it.',body);
 $('view-management').querySelectorAll('[data-mgmt]').forEach(b=>b.onclick=()=>A().openView?.(b.dataset.mgmt));
}
async function renderSchedules(){
 if(role()==='teacher'){
  $('view-schedules').innerHTML=shell('Teacher workspace','My Schedule','View saved timetable entries. Only authorized leadership can create or change schedules; completed sessions require an explicit record.','<section class="acad-panel"><div class="acad-toolbar"><h3>My scheduled sessions</h3>'+btn('refreshSchedules','Refresh','alt')+'</div><div id="scheduleRows"></div></section>');
  await loadContext();await loadSchedules();return;
 }
 const body='<div class="acad-grid"><section class="acad-panel"><h3>Schedule / extra class</h3><p>A planned class remains scheduled until someone records actual completion.</p><form id="scheduleForm" class="acad-form">'+contextHtml(true,false)+'<div class="field"><label for="scheduleTeacher">Assigned teacher *</label><select id="scheduleTeacher" required><option value="">Loading active teachers…</option></select></div><div class="field"><label for="scheduleType">Type</label><select id="scheduleType"><option value="regular">Regular period</option><option value="extra">Extra class</option><option value="remedial">Remedial</option><option value="revision">Revision</option><option value="meeting">Meeting</option></select></div>'+field('scheduleStart','Start time','time',true)+field('scheduleEnd','End time','time',true)+field('scheduleTopic','Topic / purpose','text',true)+ta('schedulePurpose','Reason / resources')+'<div id="scheduleStatus" style="display:none"></div>'+btn('createSchedule','Save schedule')+'</form></section><section class="acad-panel"><h3>Saved schedule</h3><div id="scheduleRows"></div></section></div>';
 $('view-schedules').innerHTML=shell('School management','Schedules & Extra Classes','Timetable and supplementary teaching sessions linked to the existing school records.',body);
 $('scheduleForm').onsubmit=saveSchedule;await loadContext();setDefaults();const t=await db().from('profiles').select('id,full_name,email').eq('school_id',sid()).eq('role','teacher').eq('status','active').order('full_name').limit(500);if(t.error){status('scheduleStatus',err(t.error),'error');$('scheduleTeacher').innerHTML='<option value="">Could not load teachers</option>';}else{$('scheduleTeacher').innerHTML=opts(t.data||[],'id','full_name','Select assigned teacher');}loadSchedules();
}
async function saveSchedule(e){
 e.preventDefault();try{if(role()==='teacher'||!(await permit('manage_schedules')))throw new Error('Only management with Schedule permission can create a school schedule.');const c=context(val('scheduleTopic')),d=val('acadDate'),start=val('scheduleStart'),end=val('scheduleEnd'),teacherId=val('scheduleTeacher');
 if(!c.academic_year_id||!c.class_id||!c.subject_id||!d||!start||!end||start>=end||!c.topic||!teacherId)throw new Error('Complete the year, teacher, class, subject, date, topic and times.');
 const assignments=await db().from('teacher_assignments').select('id,section_id,subject_id').eq('school_id',sid()).eq('teacher_id',teacherId).eq('class_id',c.class_id).eq('is_active',true);if(assignments.error)throw assignments.error;
 const assigned=(assignments.data||[]).some(a=>(!a.subject_id||a.subject_id===c.subject_id)&&(!a.section_id||a.section_id===c.section_id));
 if(!assigned)throw new Error('That teacher has no active assignment matching this class, section and subject. Assign the teacher first.');
 const type=val('scheduleType'),row={school_id:sid(),academic_year_id:c.academic_year_id,teacher_id:teacherId,class_id:c.class_id,section_id:c.section_id,subject_id:c.subject_id,schedule_date:d,starts_at:start,ends_at:end,topic:c.topic,entry_type:type,status:'scheduled',created_by:u().id};
 const a=await db().from('teacher_schedule_entries').insert(row);if(a.error)throw a.error;
 if(type!=='regular'){const b=await db().from('extra_class_records').insert({school_id:sid(),academic_year_id:c.academic_year_id,teacher_id:teacherId,class_id:c.class_id,section_id:c.section_id,subject_id:c.subject_id,schedule_date:d,starts_at:start,ends_at:end,topic:c.topic,purpose:val('schedulePurpose'),status:'scheduled',created_by:u().id});if(b.error)throw b.error;}
 status('scheduleStatus','Schedule saved as scheduled—not completed.','success');await loadSchedules();
 }catch(e){status('scheduleStatus',err(e),'error');}
}
async function loadSchedules(){
 const box=$('scheduleRows');if(!box)return;let q=db().from('teacher_schedule_entries').select('id,teacher_id,class_id,subject_id,schedule_date,starts_at,ends_at,topic,status,entry_type').eq('school_id',sid()).order('schedule_date',{ascending:false}).limit(250);if(role()==='teacher')q=q.eq('teacher_id',u().id);
 const r=await q;if(r.error){box.innerHTML=notice('scheduleErr',err(r.error),'error');return;}
 box.innerHTML=table(['Date','Class / subject','Time / type','Topic','Status / action'],(r.data||[]).map(x=>'<tr><td>'+E(x.schedule_date)+'</td><td>'+E(state.classes.find(c=>c.id===x.class_id)?.name||'Class')+'<div class="acad-muted">'+E(state.subjects.find(s=>s.id===x.subject_id)?.name||'Subject')+'</div></td><td>'+E((x.starts_at||'')+'–'+(x.ends_at||''))+'<div>'+E(x.entry_type)+'</div></td><td>'+E(x.topic)+'</td><td>'+E(x.status)+(x.status==='scheduled'&&(x.teacher_id===u().id||leader())?' <button class="acad-btn alt" type="button" data-done="'+E(x.id)+'">Mark completed</button>':'')+'</td></tr>'));
 box.querySelectorAll('[data-done]').forEach(b=>b.onclick=async()=>{if(!confirm('Confirm this class was actually completed?'))return;const t=await db().rpc('noor_complete_teaching_session',{p_schedule_id:b.dataset.done});if(t.error)msg(err(t.error),'error');else{msg('Completion recorded.','success');loadSchedules();}});
}
async function renderAttendance(){
 const body='<div class="acad-grid"><section class="acad-panel"><h3>Take attendance</h3><form id="attendanceForm" class="acad-form"><div class="acad-fields"><div class="field"><label for="attClass">Class *</label><select id="attClass" required></select></div><div class="field"><label for="attSection">Section</label><select id="attSection"></select></div><div class="field"><label for="attDate">Date *</label><input id="attDate" type="date" value="'+today()+'" required></div></div><div id="attRoster">'+empty('Select class to load roster.')+'</div><div id="attStatus" style="display:none"></div>'+btn('saveAttendance','Save attendance')+'</form></section><section class="acad-panel"><h3>Recent attendance sessions</h3><div id="attHistory"></div></section></div>';
 $('view-attendance').innerHTML=shell('School management','Attendance','Write into the existing attendance sessions and attendance records; attendance is not inferred.',body);
 await loadContext();$('attClass').innerHTML=opts(state.classes,'id','name','Select class');if(state.classes.length===1)$('attClass').value=state.classes[0].id;
 const setSec=()=>{$('attSection').innerHTML=opts(state.sections.filter(x=>x.class_id===val('attClass')),'id','name','Whole class');};setSec();$('attClass').onchange=()=>{setSec();loadRoster();};$('attSection').onchange=loadRoster;$('attDate').onchange=loadRoster;$('saveAttendance').onclick=saveAttendance;await loadRoster();await loadAttendanceHistory();
}
async function loadRoster(){
 const box=$('attRoster');if(!box)return;const c=val('attClass');if(!c){box.innerHTML=empty('Choose a class.');return;}
 let q=db().from('profiles').select('id,full_name,roll_number').eq('school_id',sid()).eq('role','student').eq('status','active').eq('class_id',c).order('full_name').limit(500);if(val('attSection'))q=q.eq('section_id',val('attSection'));
 const r=await q;if(r.error){box.innerHTML=notice('attRosterErr',err(r.error),'error');return;}if(!r.data?.length){box.innerHTML=empty('No active student records are available through your current permissions.');return;}
 box.innerHTML=table(['Student','Roll','Status','Note'],r.data.map(x=>'<tr><td>'+E(x.full_name)+'</td><td>'+E(x.roll_number||'—')+'</td><td><select data-att="'+E(x.id)+'"><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></td><td><input data-attnote="'+E(x.id)+'" placeholder="Optional note"></td></tr>'));
}
async function saveAttendance(){
 try{const c=val('attClass'),date=val('attDate'),section=val('attSection')||null;if(!c||!date)throw new Error('Select class/date.');
 const q=await db().from('attendance_sessions').select('id,section_id').eq('school_id',sid()).eq('class_id',c).eq('attendance_date',date);if(q.error)throw q.error;
 let ses=(q.data||[]).find(x=>(x.section_id||null)===section);
 if(!ses){const r=await db().from('attendance_sessions').insert({school_id:sid(),class_id:c,section_id:section,attendance_date:date,status:'draft',taken_by:u().id}).select('id').single();if(r.error)throw r.error;ses={id:r.data.id};}
 for(const a of $('attRoster').querySelectorAll('[data-att]')){
  const student=a.dataset.att,note=$('attRoster').querySelector('[data-attnote="'+CSS.escape(student)+'"]').value.trim()||null;
  const old=await db().from('attendance_records').select('id').eq('session_id',ses.id).eq('student_id',student).maybeSingle();if(old.error)throw old.error;
  const row={school_id:sid(),session_id:ses.id,student_id:student,status:a.value,note,marked_by:u().id,marked_at:new Date().toISOString()};
  const r=old.data?await db().from('attendance_records').update(row).eq('id',old.data.id):await db().from('attendance_records').insert(row);if(r.error)throw r.error;
 }
 const end=await db().from('attendance_sessions').update({status:'submitted',submitted_at:new Date().toISOString()}).eq('id',ses.id);if(end.error)throw end.error;
 status('attStatus','Attendance saved and submitted.','success');await loadAttendanceHistory();
 }catch(e){status('attStatus',err(e),'error');}
}
async function loadAttendanceHistory(){
 const box=$('attHistory');if(!box)return;const r=await db().from('attendance_sessions').select('attendance_date,class_id,section_id,status').eq('school_id',sid()).order('attendance_date',{ascending:false}).limit(40);
 box.innerHTML=r.error?notice('attHistoryErr',err(r.error),'error'):table(['Date','Class','Section','Status'],(r.data||[]).map(x=>'<tr><td>'+E(x.attendance_date)+'</td><td>'+E(state.classes.find(c=>c.id===x.class_id)?.name||'Class')+'</td><td>'+E(state.sections.find(s=>s.id===x.section_id)?.name||'Whole class')+'</td><td>'+E(x.status)+'</td></tr>'));
}
function eventSchoolId(){return role()==='creator'?val('eventSchool'):sid();}
async function renderEvents(isNotice){
 const can=await permit(isNotice?'manage_notices':'manage_meetings'),title=isNotice?'School Notices':'Meetings';
 const roles=['owner','principal'].includes(role())?[['teacher','Teachers'],['student','Students'],['principal','Principal'],['owner','School owner']]:[['student','Students'],['teacher','Teachers'],['principal','Principal'],['owner','School owner'],['manager','Manager'],['parent','Parents / guardians']];
 const schoolPicker=role()==='creator'?'<div class="field"><label for="eventSchool">School</label><select id="eventSchool" required><option value="">Loading schools…</option></select><small class="acad-muted">Choose which school should receive this notice or meeting.</small></div>':'';
 const audience=can?'<section class="acad-panel"><h3>'+(isNotice?'Write a notice':'Schedule a meeting')+'</h3><p class="acad-muted">Choose who should receive it, write the details, then press Send. It will appear in the selected people’s NOOR AI dashboard.</p><form id="eventForm" class="acad-form">'+schoolPicker+field('eventTitle',isNotice?'Notice title':'Meeting title','text',true)+'<div class="field"><label>Send to</label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin-top:6px"><label><input type="checkbox" id="audience_all" checked> <b>Everyone at school</b></label>'+roles.map(([v,l])=>'<label><input type="checkbox" class="eventAudience" value="'+v+'"> '+l+'</label>').join('')+'</div><small class="acad-muted">“Everyone at school” includes the available school audience roles.</small></div>'+(isNotice?'':'<div class="field"><label for="eventType">Meeting type</label><select id="eventType"><option value="meeting">Staff / school meeting</option><option value="parent_meeting">Parent meeting</option><option value="academic">Academic meeting</option><option value="other">Other</option></select></div>')+field('eventStart',isNotice?'Publish from':'Meeting date & time','datetime-local',true)+(isNotice?'':'<div class="field"><label for="eventLocation">Location / meeting link</label><input id="eventLocation" maxlength="300" placeholder="Room, venue or online meeting link"></div>')+ta('eventBody',isNotice?'Notice details':'Agenda / details')+'<div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="submit" id="sendEventBtn">'+(isNotice?'Send notice':'Send meeting invite')+' →</button></div><div id="eventStatus" style="display:none"></div></form></section>':'';
 const activeCommunicationView=document.querySelector('.view.active')?.id;const view=['view-notices','view-meetings'].includes(activeCommunicationView)?activeCommunicationView:(isNotice?'view-notices':'view-meetings');const otherView=$(view==='view-notices'?'view-meetings':'view-notices');if(otherView)otherView.replaceChildren();
 $(''+view).innerHTML=shell('School workspace','Notices & Meetings','One place to send school notices or schedule meetings, with clear recipients and saved history.','<div class="acad-toolbar communication-switch"><button type="button" class="acad-btn '+(isNotice?'':'alt')+'" data-communication-mode="notice">Send a notice</button><button type="button" class="acad-btn '+(isNotice?'alt':'')+'" data-communication-mode="meeting">Schedule a meeting</button></div>'+audience+'<section class="acad-panel"><div class="acad-toolbar"><div><h3>Sent & saved</h3><p class="acad-muted">Published items are shown below. Email delivery is separate.</p></div>'+btn('refreshEvents','Refresh','alt')+'</div><div id="eventsRows"></div></section>');
 $(view).querySelectorAll('[data-communication-mode]').forEach(b=>b.onclick=()=>renderEvents(b.dataset.communicationMode==='notice'));
 $('breadcrumb').textContent=['owner','principal'].includes(role())?'Notices & Meetings':title;
 if(role()==='creator'&&$('eventSchool')){
  const schools=await db().from('schools').select('id,name').order('name');
  const picker=$('eventSchool');
  if(schools.error){picker.innerHTML='<option value="">Could not load schools</option>';status('eventStatus','Could not load the school list. Please refresh and try again.','error');}
  else{picker.innerHTML='<option value="">Choose a school</option>'+(schools.data||[]).map(x=>'<option value="'+E(x.id)+'">'+E(x.name)+'</option>').join('');if((schools.data||[]).length===1)picker.value=schools.data[0].id;picker.addEventListener('change',()=>loadEvents(isNotice));}
 }
 const start=$('eventStart');
 if(start){const d=new Date(Date.now()+(isNotice?0:30*60000));d.setMinutes(d.getMinutes()-d.getTimezoneOffset());start.value=d.toISOString().slice(0,16);}
 const all=$('audience_all');
 if(all){all.addEventListener('change',()=>document.querySelectorAll('.eventAudience').forEach(x=>x.checked=false));document.querySelectorAll('.eventAudience').forEach(x=>x.addEventListener('change',()=>{if(x.checked)all.checked=false;if(![...document.querySelectorAll('.eventAudience')].some(y=>y.checked))all.checked=true;}));}
 if(can)$('eventForm').onsubmit=e=>saveEvent(e,isNotice);
 $('refreshEvents').onclick=()=>loadEvents(isNotice);await loadEvents(isNotice);
}
async function saveEvent(e,isNotice){
 e.preventDefault();
 const send=$('sendEventBtn');if(send)send.disabled=true;
 try{
  const title=val('eventTitle'),body=val('eventBody'),targetSchoolId=eventSchoolId();
  if(!targetSchoolId)throw new Error(role()==='creator'?'Choose a school first.':'Your account is not connected to an active school workspace.');
  if(!title||!body)throw new Error('Please enter a title and details.');
  const all=$('audience_all')?.checked;
  const selected=[...document.querySelectorAll('.eventAudience:checked')].map(x=>x.value);
  const targetRoles=all?(['owner','principal'].includes(role())?['student','teacher','principal','owner']:['student','teacher','principal','owner','manager','parent']):selected;
  if(!targetRoles.length)throw new Error('Choose at least one recipient.');
  const startValue=val('eventStart');
  const start=startValue?new Date(startValue).toISOString():new Date().toISOString();
  const payload=isNotice
   ?{school_id:targetSchoolId,created_by:u().id,title,body,target_roles:targetRoles,starts_at:start,ends_at:null,is_active:true}
   :{school_id:targetSchoolId,created_by:u().id,title,description:body,event_type:val('eventType')||'meeting',starts_at:start,ends_at:null,location:val('eventLocation')||null,target_roles:targetRoles};
  const q=await db().from(isNotice?'school_notices':'calendar_events').insert(payload);
  if(q.error)throw q.error;
  status('eventStatus',(isNotice?'Notice sent':'Meeting invite sent')+' to: '+(all?'Everyone at school':targetRoles.map(x=>({student:'Students',teacher:'Teachers',principal:'Principal',owner:'School owner',manager:'Manager',parent:'Parents / guardians'}[x])).join(', '))+'. It is now published in the selected recipients’ NOOR AI dashboard. Email is not sent automatically.','success');
  const chosenSchool=role()==='creator'?targetSchoolId:null;
  $('eventForm').reset();
  if(chosenSchool&&$('eventSchool'))$('eventSchool').value=chosenSchool;
  const st=$('eventStart');if(st){const d=new Date(Date.now()+(isNotice?0:30*60000));d.setMinutes(d.getMinutes()-d.getTimezoneOffset());st.value=d.toISOString().slice(0,16);}
  if($('audience_all'))$('audience_all').checked=true;
  await loadEvents(isNotice);
 }catch(e){status('eventStatus',err(e),'error');}
 finally{if(send)send.disabled=false;}
}
async function loadEvents(isNotice){
 const box=$('eventsRows');if(!box)return;
 const targetSchoolId=eventSchoolId();
 if(!targetSchoolId){box.innerHTML=empty(role()==='creator'?'Choose a school above to view its notices or meetings.':'No active school workspace is selected.');return;}
 const name=isNotice?'school_notices':'calendar_events',cols=isNotice?'title,body,target_roles,starts_at,ends_at,is_active':'title,description,event_type,starts_at,ends_at,location,target_roles';
 let query=db().from(name).select(cols).eq('school_id',targetSchoolId);if(isNotice&&(role()==='student'||role()==='teacher'))query=query.eq('is_active',true).contains('target_roles',[role()]);const r=await query.order('starts_at',{ascending:false}).limit(200);
 const now=Date.now();const rows=(r.data||[]).filter(x=>{if(!isNotice||!['student','teacher'].includes(role()))return true;const start=x.starts_at?new Date(x.starts_at).getTime():0,end=x.ends_at?new Date(x.ends_at).getTime():Infinity;return Number.isFinite(start)&&start<=now&&end>now;});box.innerHTML=r.error?notice('eventsErr',err(r.error),'error'):table(['Start','Title / type','Details','Audience','Status'],rows.map(x=>'<tr><td>'+E(new Date(x.starts_at).toLocaleString())+'</td><td><b>'+E(x.title)+'</b><div class="acad-muted">'+E(isNotice?'Notice':x.event_type)+'</div></td><td>'+E(isNotice?x.body:x.description)+' '+E(x.location||'')+'</td><td>'+E((x.target_roles||[]).map(v=>({student:'Students',teacher:'Teachers',principal:'Principal',owner:'School owner',manager:'Manager',parent:'Parents / guardians'}[v]||v)).join(', '))+'</td><td>'+E(isNotice?(x.is_active?'Published':'Inactive'):'Published')+'</td></tr>'));
}
async function renderAudit(){
 $('view-audit-logs').innerHTML=shell('School leadership','Administrative Audit Logs','Only permissioned management can inspect school-specific administrative changes; secrets and passwords are not logged.','<section class="acad-panel">'+btn('refreshAudit','Refresh')+'<div id="auditRows"></div></section>');
 $('refreshAudit').onclick=loadAudit;await loadAudit();
}
async function loadAudit(){
 const box=$('auditRows');if(!(await permit('view_audit_logs'))){box.innerHTML=empty('Your role cannot view the audit log.');return;}
 const r=await db().from('administrative_audit_logs').select('action,reason,metadata,created_at').eq('school_id',sid()).order('created_at',{ascending:false}).limit(200);
 box.innerHTML=r.error?notice('auditError',err(r.error),'error'):table(['Time','Action','Reason','Context'],(r.data||[]).map(x=>'<tr><td>'+E(new Date(x.created_at).toLocaleString())+'</td><td>'+E(x.action)+'</td><td>'+E(x.reason||'—')+'</td><td><code>'+E(JSON.stringify(x.metadata||{}))+'</code></td></tr>'));
}
function renderView(id){
 const funcs={
 'teaching':()=>renderTeaching(),'weekly-plan':()=>renderWeekly(),'daily-report':()=>renderDaily(),
 'academic-monitoring':()=>renderMonitoring(),'notes':()=>renderStudentNotes(),
 'student-directory':()=>renderContextThen('student'),'teacher-directory':()=>renderContextThen('teacher'),
 'staff-management':()=>renderStaff(),'attendance':()=>role()==='teacher'&&window.NOOR_TEACHER_ATTENDANCE?.open?window.NOOR_TEACHER_ATTENDANCE.open():renderAttendance(),'schedules':()=>renderSchedules(),
 'meetings':()=>renderEvents(false),'notices':()=>renderEvents(true),'audit-logs':()=>renderAudit(),'management':()=>renderManagement()
 };
 if(!funcs[id])return false;const allowed=({'teaching':['teacher'],'weekly-plan':['teacher'],'daily-report':['teacher'],'notes':['student'],'academic-monitoring':['creator','owner','principal','manager'],'student-directory':['creator','owner','principal','manager'],'teacher-directory':['creator','owner','principal','manager'],'staff-management':['creator','owner','principal','manager'],'attendance':['teacher','creator','owner','principal','manager'],'schedules':['teacher','creator','owner','principal','manager'],'meetings':['student','teacher','creator','owner','principal','manager'],'notices':['student','teacher','creator','owner','principal','manager'],'audit-logs':['creator','owner','principal','manager'],'management':['creator','owner','principal','manager']})[id]||[];
 if(!allowed.includes(role())){msg('This section is not available for your role.','error');return true;}
 const perm=({'academic-monitoring':'view_academic_reports','student-directory':'view_students','teacher-directory':'view_teacher_activity','staff-management':'manage_staff','attendance':'view_attendance','schedules':'view_teacher_activity','meetings':'manage_meetings','notices':'manage_notices','audit-logs':'view_audit_logs','assessments':'manage_assessments'})[id];
 if(role()==='manager'&&perm)permit(perm).then(ok=>{if(!ok){msg('Your Manager role does not have this permission.','error');return;}funcs[id]();}).catch(e=>msg(err(e),'error'));
 else funcs[id]();
 return true;
}
async function renderContextThen(kind){await loadContext();await renderDirectory(kind);}
async function filterNavigation(){
 if(role()!=='manager'||!db())return;
 const r=await db().from('role_permissions').select('permission_key,is_allowed').eq('school_id',sid()).eq('role','manager'),grants=Object.fromEntries((r.data||[]).map(x=>[x.permission_key,x.is_allowed]));
 const map={'academic-monitoring':'view_academic_reports','student-directory':'view_students','teacher-directory':'view_teacher_activity','staff-management':'manage_staff','attendance':'view_attendance','schedules':'view_teacher_activity','meetings':'manage_meetings','notices':'manage_notices','audit-logs':'view_audit_logs','management':'view_students'};
 const any=Object.values(grants).some(Boolean);document.querySelectorAll('#mainNav button').forEach(b=>{if(b.dataset.view==='management'&&!any)b.remove();else if(map[b.dataset.view]&&!grants[map[b.dataset.view]])b.remove();});
}
function showOwnerCodes(){const raw=sessionStorage.getItem('noor.owner.codes');if(!raw)return;let d;try{d=JSON.parse(raw);}catch{return;}sessionStorage.removeItem('noor.owner.codes');const modal=document.createElement('div');modal.className='acad-code-overlay';const rows=[['School Number',d.school_number||d.school_id||'—','schoolNumber'],['Student Joining Code',d.student_join_code||'Not available','studentJoinCode'],['Staff Joining Code',d.staff_join_code||'Not available','staffJoinCode'],['School Secret Code (private; one-time display)',d.secret_code||'Not available','ownerCodeSecret']];modal.innerHTML='<section class="acad-panel acad-code-panel"><div class="eyebrow">SCHOOL SETUP</div><h2>Your school is created</h2><p>Share the Student Joining Code only with students and the Staff Joining Code only with staff. School Secret Code is private and is not a joining code.</p>'+rows.map(([label,value,id])=>'<label class="acad-label" for="'+id+'">'+label+'</label><input id="'+id+'" readonly value="'+E(value)+'"><button type="button" class="acad-btn alt" data-copy-code="'+id+'">Copy '+label+'</button>').join('')+'<div class="acad-actions" style="margin-top:18px"><button type="button" class="acad-btn" id="closeOwnerCodes">Continue to school dashboard</button></div></section>';document.body.appendChild(modal);modal.querySelectorAll('[data-copy-code]').forEach(b=>b.onclick=async()=>{const id=b.dataset.copyCode;try{await navigator.clipboard.writeText($(id).value);msg('Copied. Share only with the correct school role.','success');}catch{$(id).select();msg('Select and copy the code.');}});$('closeOwnerCodes').onclick=()=>modal.remove();}
window.NOOR_ACADEMIC={open:renderView,filterNavigation,showOwnerCodes,openCommunicationMode:renderEvents};
})();