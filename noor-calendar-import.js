/* Single-school calendar: principal-approved PDF / Google .ics imports, no silent closure guesses. */
(()=>{
'use strict';
const A=()=>window.NOOR_AI_APP||{};
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const leadership=()=>['owner','principal','manager','creator'].includes(A().profile?.role);
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const weekday=/^(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\b/i;
const dateOK=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;};
const ISO=(year,month,day)=>{const v=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');return dateOK(v)?v:null;};
const monthNum=x=>MONTHS.findIndex(m=>m.startsWith(String(x).toLowerCase().replace(/\.$/,'').slice(0,3)))+1;
function lineDate(text,context){
 let m;
 if((m=text.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/)))return {date:ISO(m[1],m[2],m[3]),label:text.replace(m[0],'').trim()};
 if((m=text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|\d{2})\b/))){const y=Number(m[3])<100?2000+Number(m[3]):m[3];return {date:ISO(y,m[2],m[1]),label:text.replace(m[0],'').trim()};}
 if((m=text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})[,]?\s+(20\d{2})\b/i))){const mo=monthNum(m[2]);if(mo)return {date:ISO(m[3],mo,m[1]),label:text.replace(m[0],'').trim()};}
 if((m=text.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i))){const mo=monthNum(m[1]);if(mo)return {date:ISO(m[3],mo,m[2]),label:text.replace(m[0],'').trim()};}
 if(context?.month&&context?.year&&(m=text.match(/^\s*(\d{1,2})(?:[.)-]|\s+(?=Mon|Tue|Wed|Thu|Fri|Sat|Sun))/i))){
  return {date:ISO(context.year,context.month,m[1]),label:text.slice(m[0].length).trim()};
 }
 return null;
}
function category(t){
 const s=String(t).toLowerCase();
 if(/\b(special\s+working|working\s+day|school\s+open|classes\s+resume|instructional\s+day)\b/.test(s))return 'working';
 if(/\b(holiday|vacation|break|closed|school\s+closed|non[\s-]?working|no\s+classes)\b/.test(s))return 'holiday';
 return 'review';
}
function parseLines(lines){
 const out=[],context={year:null,month:null},seen=new Set();
 for(const raw of lines){
  const t=String(raw||'').replace(/\s+/g,' ').trim();if(!t)continue;
  const monthHeading=t.match(/^\s*([a-z]{3,9})\s+(20\d{2})\s*$/i);
  if(monthHeading){const mo=monthNum(monthHeading[1]);if(mo){context.month=mo;context.year=Number(monthHeading[2]);continue;}}
  const parsed=lineDate(t,context);if(!parsed?.date)continue;
  const title=parsed.label.replace(/^[|,:;\s-]+|[|,:;\s-]+$/g,'').replace(weekday,'').replace(/^[|,:;\s-]+/,'').slice(0,180)||'Calendar date';
  const kind=category(title);
  const key=parsed.date+'|'+title.toLowerCase();
  if(seen.has(key))continue;seen.add(key);
  out.push({date:parsed.date,title,kind,selected:true});
  if(out.length>=220)break;
 }
 return out;
}
/* OCR runs in the browser. Images are never uploaded to external AI services. */
let ocrLoader;
async function ocrLibrary(){
 if(window.Tesseract?.createWorker)return window.Tesseract;
 if(!ocrLoader)ocrLoader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
  script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';
  script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(Error('OCR library is unavailable'));
  script.onerror=()=>reject(Error('OCR library could not load. Check internet and retry.'));
  document.head.appendChild(script);
 });
 return ocrLoader;
}
function pdfTextLines(content){
 const groups=new Map();
 for(const item of content.items||[]){
  if(!item.str?.trim())continue;
  const y=Math.round((item.transform?.[5]||0)/3)*3,x=item.transform?.[4]||0;
  if(!groups.has(y))groups.set(y,[]);
  groups.get(y).push({x,word:item.str.trim()});
 }
 return [...groups.keys()].sort((a,b)=>b-a).map(y=>groups.get(y).sort((a,b)=>a.x-b.x).map(a=>a.word).join(' '));
}
async function parsePdf(file,progress=()=>{},language='eng'){
 if(file.size>10*1024*1024)throw Error('PDF must be 10 MB or smaller.');
 if(!['eng','hin','tel','urd'].includes(language))throw Error('Choose a supported OCR language.');
 const url='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
 let lib;
 try{lib=await import(url+'pdf.min.mjs');}catch(_){throw Error('PDF reader could not load. Check internet connection and retry.');}
 lib.GlobalWorkerOptions.workerSrc=url+'pdf.worker.min.mjs';
 const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 if(pdf.numPages>30)throw Error('Upload no more than 30 PDF pages.');
 const all=[],needsOcr=[];
 for(let p=1;p<=pdf.numPages;p++){
  progress('Reading page '+p+' / '+pdf.numPages+'…');
  const page=await pdf.getPage(p),lines=pdfTextLines(await page.getTextContent());
  all[p-1]=lines;
  // Mixed PDFs are supported: only pages without a usable selectable-text layer need OCR.
  if(lines.join(' ').replace(/\s/g,'').length<35)needsOcr.push(p);
  page.cleanup?.();
 }
 if(needsOcr.length){
  if(needsOcr.length>12)throw Error('This scan has '+needsOcr.length+' image-only pages. Split it into 12-page PDFs to protect your device memory.');
  progress('Scanned pages detected. Starting local OCR…');
  const tess=await ocrLibrary();
  const worker=await tess.createWorker(language==='eng'?'eng':['eng',language],undefined,{
   logger:x=>{if(x.status==='recognizing text')progress('Reading scanned text… '+Math.round((x.progress||0)*100)+'%');}
  });
  try{
   for(let i=0;i<needsOcr.length;i++){
    const n=needsOcr[i];progress('OCR page '+(i+1)+' / '+needsOcr.length+'…');
    const page=await pdf.getPage(n),viewport=page.getViewport({scale:1.8});
    // Upper bound on pixels avoids accidental memory exhaustion on huge architectural PDFs.
    if(viewport.width*viewport.height>12000000)throw Error('PDF page dimensions exceed the safe OCR limit.');
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw Error('Your browser cannot prepare this scanned page.');
    await page.render({canvasContext:context,viewport}).promise;
    const {data}=await worker.recognize(canvas);
    all[n-1]=String(data?.text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    canvas.width=0;canvas.height=0;page.cleanup?.();
   }
  }finally{await worker.terminate();}
 }
 const lines=all.flat();
 const rows=parseLines(lines);
 if(!rows.length)throw Error('No reliable dated events found. Try clearer scans or enter dates manually. No holidays were guessed.');
 return rows.map(x=>({...x,ocr:needsOcr.length>0}));
}
function unfoldIcs(text){return text.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);}
function parseIcs(text){
 const lines=unfoldIcs(text),events=[];let ev=null;
 for(const l of lines){
  if(l==='BEGIN:VEVENT'){ev={};continue;}
  if(l==='END:VEVENT'){if(ev?.date&&ev?.title)events.push({date:ev.date,title:ev.title.slice(0,180),kind:category(ev.title),selected:true});ev=null;continue;}
  if(!ev)continue;
  const col=l.indexOf(':');if(col<0)continue;
  const key=l.slice(0,col).split(';')[0].toUpperCase(),val=l.slice(col+1);
  if(key==='DTSTART'){const m=val.match(/^(\d{4})(\d{2})(\d{2})/);if(m)ev.date=ISO(m[1],m[2],m[3]);}
  if(key==='SUMMARY')ev.title=val.replace(/\\n/gi,' ').replace(/\\,/g,',').replace(/\\;/g,';');
 }
 if(!events.length)throw Error('No valid dated events found in this Google Calendar export.');
 const seen=new Set();return events.filter(e=>{const key=e.date+'|'+e.title.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,220);
}
function localNoonISO(day,zone){
 const base=Date.UTC(Number(day.slice(0,4)),Number(day.slice(5,7))-1,Number(day.slice(8,10)),12),partsOf=t=>{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t));
  const g=k=>Number(parts.find(p=>p.type===k)?.value||0);return Date.UTC(g('year'),g('month')-1,g('day'),g('hour'));
 };let guess=base;for(let i=0;i<3;i++)guess+=base-partsOf(guess);return new Date(guess).toISOString();
}
async function verifyLeader(){
 const a=A();if(!a.schoolId||!a.user?.id||!leadership())throw Error('Only the principal or authorized school management can import a calendar.');
 const auth=await a.db.auth.getUser();if(auth.error||auth.data?.user?.id!==a.user.id)throw Error('Session expired. Sign in again.');
 const r=await a.db.from('institution_memberships').select('role,status').eq('institution_id',a.schoolId).eq('user_id',a.user.id).eq('status','active').maybeSingle();
 if(r.error||!r.data||!['principal','school_admin','university_admin','academic_admin'].includes(r.data.role))throw Error('An active school principal/management membership is required.');
 return a;
}
async function persist(rows){
 const a=await verifyLeader(),school=a.schoolId,user=a.user.id,zone=a.school?.timezone||'Asia/Kolkata',selected=rows.filter(x=>x.selected);
 if(!selected.length)throw Error('Select at least one date to import.');
 if(selected.length>220)throw Error('Import 220 dates or fewer.');
 for(const x of selected){if(!dateOK(x.date)||!['holiday','working'].includes(x.kind)||!x.title.trim())throw Error('Review every selected date, title and Holiday/Working category first.');}
 const types=new Map();for(const x of selected){const set=types.get(x.date)||new Set();set.add(x.kind);types.set(x.date,set);}
 if([...types.values()].some(s=>s.size>1))throw Error('A date cannot be approved as both Holiday and Working. Resolve the conflict first.');
 const from=selected.map(x=>x.date).sort()[0],to=selected.map(x=>x.date).sort().at(-1),min=new Date(from+'T00:00:00Z').toISOString(),max=new Date(to+'T23:59:59Z').toISOString();
 const existing=await a.db.from('noor_calendar_events').select('title,kind,starts_at').eq('institution_id',school).gte('starts_at',min).lte('starts_at',max).limit(1000);
 if(existing.error)throw existing.error;
 let saved=0,duplicates=0;
 for(const item of selected){
  if(a.schoolId!==school||a.user?.id!==user)throw Error('School changed during upload. Import stopped.');
  if(item.kind==='working'){
   const found=await a.db.from('noor_calendar_day_overrides').select('day,created_by').eq('institution_id',school).eq('day',item.date).maybeSingle();
   if(found.error)throw found.error;
   const payload={is_working:true,title:item.title.trim(),source:item.source==='google'?'google':'pdf',updated_at:new Date().toISOString()};
   const result=found.data?await a.db.from('noor_calendar_day_overrides').update(payload).eq('institution_id',school).eq('day',item.date):await a.db.from('noor_calendar_day_overrides').insert({institution_id:school,day:item.date,created_by:user,...payload});
   if(result.error)throw Error('Working day '+item.date+': '+result.error.message);saved++;continue;
  }
  const prev=(existing.data||[]).find(x=>x.kind==='holiday'&&x.title.trim().toLowerCase()===item.title.trim().toLowerCase()&&x.starts_at&&new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x.starts_at))===item.date);
  if(prev){duplicates++;continue;}
  const noon=localNoonISO(item.date,zone);
  const inserted=await a.db.from('noor_calendar_events').insert({institution_id:school,academic_group_id:null,created_by:user,title:item.title.trim(),kind:'holiday',description:'School calendar import · reviewed and approved',starts_at:noon,ends_at:noon});
  if(inserted.error)throw Error('Holiday '+item.date+': '+inserted.error.message);
  saved++;(existing.data||[]).push({kind:'holiday',title:item.title,starts_at:noon});
 }
 return {saved,duplicates};
}
function open(){
 if(!leadership())return;
 document.getElementById('nscImportDialog')?.remove();
 const dlg=document.createElement('dialog');dlg.id='nscImportDialog';dlg.className='nsc-import-dialog';dlg.style.cssText='width:min(930px,95vw);max-height:89vh;overflow:auto;border:1px solid #e7cad6;border-radius:18px;padding:22px;background:var(--paper,#fff);color:var(--ink,#381e2b);box-shadow:0 25px 80px #25102055';
 dlg.innerHTML='<header style="display:flex;justify-content:space-between;gap:12px"><div><h2 style="font:800 19px Manrope;margin:0">Import school calendar</h2><p style="font-size:12px;color:var(--muted)">Upload a school PDF or a Google Calendar .ics export. Dates are reviewed before publishing to the existing shared calendar.</p></div><button type="button" id="nscImportClose" class="btn light">Close</button></header>'+
 '<div class="field"><label for="nscImportFile">Calendar PDF / Google Calendar .ics</label><input id="nscImportFile" type="file" accept=".pdf,application/pdf,.ics,text/calendar" style="width:100%;padding:13px;border:1px dashed #c99dae;border-radius:11px"></div><div class="field"><label for="nscOcrLanguage">Language for scanned PDF text (OCR)</label><select id="nscOcrLanguage"><option value="eng">English</option><option value="hin">Hindi + English</option><option value="tel">Telugu + English</option><option value="urd">Urdu + English</option></select></div>'+
 '<p style="font-size:11px;color:var(--muted)">Only approved dates are saved. Scanned PDFs are read by local OCR. All extracted dates must be reviewed and approved. Public festival references are not automatically school closures. Private school data stays in your institution.</p>'+
 '<p role="status" id="nscImportMsg" style="font-size:12px"></p><div id="nscImportPreview"></div>';
 document.body.append(dlg);dlg.showModal?.();if(!dlg.open)dlg.setAttribute('open','');
 dlg.querySelector('#nscImportClose').onclick=()=>dlg.close();dlg.addEventListener('close',()=>dlg.remove(),{once:true});
 let rows=[],locked=false;
 const msg=(text,error=false)=>{const x=dlg.querySelector('#nscImportMsg');x.textContent=text;x.style.color=error?'#a11c38':'#427456';};
 function render(){
  const t=dlg.querySelector('#nscImportPreview');
  if(!rows.length){t.innerHTML='';return;}
  t.innerHTML='<p><b>'+rows.length+' detected dates</b> — choose the correct date type, correct any text, and deselect unrelated rows.</p>'+
  '<div style="max-height:49vh;overflow:auto;border:1px solid var(--line,#e8d2d9);border-radius:12px"><table class="table" style="min-width:660px"><thead><tr><th>Include</th><th>Date</th><th>Event / Reason</th><th>Classification</th></tr></thead><tbody>'+
  rows.map((x,i)=>'<tr><td><input aria-label="Include date '+i+'" type="checkbox" data-i="'+i+'" data-k="selected" '+(x.selected?'checked':'')+'></td><td><input aria-label="Date '+i+'" type="date" data-i="'+i+'" data-k="date" value="'+E(x.date)+'"></td><td><input aria-label="Title '+i+'" type="text" maxlength="180" data-i="'+i+'" data-k="title" value="'+E(x.title)+'" style="min-width:220px"></td><td><select aria-label="Type '+i+'" data-i="'+i+'" data-k="kind"><option value="review" '+(x.kind==='review'?'selected':'')+'>Needs review</option><option value="holiday" '+(x.kind==='holiday'?'selected':'')+'>Holiday / Closed</option><option value="working" '+(x.kind==='working'?'selected':'')+'>Working day / Open</option></select></td></tr>').join('')+'</tbody></table></div>'+
  '<div class="row" style="justify-content:flex-end;gap:9px;margin-top:15px"><button type="button" class="btn light" id="nscAddImportRow">+ Add missing date</button><button type="button" class="btn" id="nscPublishImport">Approve & Import</button></div>';
  t.querySelectorAll('[data-k]').forEach(el=>el.onchange=()=>{const row=rows[Number(el.dataset.i)];row[el.dataset.k]=el.type==='checkbox'?el.checked:el.value;});
  t.querySelector('#nscAddImportRow').onclick=()=>{rows.push({date:new Date().toISOString().slice(0,10),title:'',kind:'review',selected:true});render();};
  t.querySelector('#nscPublishImport').onclick=async()=>{if(locked)return;locked=true;const b=t.querySelector('#nscPublishImport');b.disabled=true;msg('Validating school membership and saving approved dates…');try{const result=await persist(rows);msg(result.saved+' dates saved; '+result.duplicates+' duplicates skipped. Your shared calendar and attendance reports will use these dates.');window.NOOR_SCHOOL_CALENDAR?.open?.();}catch(err){msg('Import stopped: '+err.message,true);}finally{locked=false;b.disabled=false;}};
 }
 dlg.querySelector('#nscImportFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;msg('Reading '+file.name+' …');rows=[];render();
  try{const googleFile=/\.ics$/i.test(file.name);rows=(googleFile?parseIcs(await file.text()):await parsePdf(file,status=>msg(status),dlg.querySelector('#nscOcrLanguage').value)).map(r=>({...r,source:googleFile?'google':'pdf'}));
   if(!rows.length)throw Error('No reliable dated entries were detected. Try a text-based PDF or add school events manually.');
   msg('Dates extracted. Check each holiday and working-day classification before publishing.');render();
  }catch(err){msg(err.message,true);}
 };
}
window.NOOR_CALENDAR_IMPORT=Object.freeze({open,parseLines,parseIcs,lineDate});
})();