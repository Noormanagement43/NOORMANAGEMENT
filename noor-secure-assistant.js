/* App-only help. Navigation uses verified membership and existing secure screens;
   chat content and school records are never sent to an external model. Optional
   Groq explanations use a fixed public help topic and verified role only. */
(()=>{'use strict';
const app=()=>window.NOOR_AI_APP||{},E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roles={faculty:'teacher',school_admin:'manager',university_admin:'principal',academic_admin:'principal',university_student:'student'};
const normalize=r=>roles[r]||r;
const topics={
 periods:{label:'My periods',match:/period|timetable|time table|schedule|weekly.*class/i,steps:'Choose My Periods to view your schedule. To create or change a period, choose Edit Timetable, select the day, time slot, class, section and subject, then review and save.'},
 marks:{label:'Marks & annual reports',match:/marks?|annual|report|result|progress|exam.*score|number|nambar/i,steps:'Choose your class and section, then View results. Open Annual Report beside the correct student. Choose Annual Marks Report → Add / Upload Marks. Select the academic year, subject and assessment, enter the actual marks, then review and save.'},
 attendance:{label:'Attendance',match:/attend|present|absent|late|leave|hazri/i,steps:'Choose your class, section and date. Tap one circle for each student: Present, Absent, Late or Leave. Review all students, then choose Save attendance.'},
 notes:{label:'Class notes',match:/note|homework|today.*work/i,steps:'Open Class Notes or Today’s Note. Teachers choose their class and subject, add the instructions or picture, then review and publish. Students can view notes shared with their class.'},
 tests:{label:'Tests & assignments',match:/test|quiz|assignment|paper/i,steps:'Open Assignments & Smart Notes, then Assignments. Choose your class, subject and test settings. Review generated questions before publishing. Students should complete and submit their assigned paper.'},
 analytics:{label:'Analytics',match:/analytic|insight|weak|performance/i,steps:'Open Live Analytics. Use the available class, subject and date filters to view insights based on saved school records.'},
 notices:{label:'Notices & meetings',match:/notice|meeting|email|message/i,steps:'Open Notices & Meetings. Staff with permission can choose the message type, recipients and channel. Review the recipients and content before sending.'},
 calendar:{label:'School calendar',match:/calendar|holiday|event/i,steps:'Open the School Calendar and choose a date to view events and holidays for your school.'},
 students:{label:'Students',match:/student|pupil|roll|class|section/i,steps:'Open Students or My Class, choose an available class and section, then search by name or roll number. Open the correct student’s record.'},
 staff:{label:'Staff',match:/staff|teacher|manager/i,steps:'Open Staff to find your school’s teachers and their available details. Manager access and activity are under Manager.'},
 settings:{label:'Profile & settings',match:/setting|profile|photo|password|theme|language|logo/i,steps:'Open Settings. Choose the relevant profile or appearance option, make your changes and save. School branding is available only to authorised school leadership.'},
 support:{label:'Help & suggestions',match:/help|support|problem|broken|error|bug|suggest|complaint/i,steps:'Open Help & Suggestions. Describe the problem and the page where it happened, then submit it to NOOR support.'}
};
function routeFor(topic,role){role=normalize(role);const lead=['principal','manager','owner'].includes(role);
 if(topic==='settings')return 'settings';if(topic==='support')return role==='creator'?null:'help-support';
 if(role==='creator')return null;
 if(topic==='periods')return role==='student'?'student-schedule':role==='teacher'||role==='parent'?'schedules':lead?'staff-management':null;
 if(topic==='marks')return role==='student'?'student-progress':role==='teacher'?'teacher-classroom':lead?'class-performance':null;
 if(topic==='attendance')return role==='student'?'student-attendance':role==='teacher'?'attendance':lead?'class-performance':null;
 if(topic==='students')return role==='teacher'?'teacher-classroom':lead?'student-directory':null;
 if(topic==='staff')return lead?'staff-management':null;
 if(topic==='notes')return role==='student'?'student-learning':role==='teacher'?'today-note':null;
 if(topic==='tests')return role==='student'?'student-homework':role==='teacher'?'teacher-resources':null;
 if(topic==='analytics')return ['student','teacher'].includes(role)||lead?'live-analytics':null;
 if(topic==='notices')return role==='teacher'?'notifications':['student','parent'].includes(role)||lead?'notices':null;
 if(topic==='calendar')return 'school-calendar';return null;
}
function resolveRequest(text,role){const topic=Object.keys(topics).find(k=>topics[k].match.test(String(text).slice(0,2000)));return topic&&routeFor(topic,role)?topic:null;}
function guidance(topic,role){role=normalize(role);if(role==='student')return ({marks:'Open Progress to view your own published marks and progress reports. Choose the available subject or test. Your teacher controls when results are published.',periods:'Open My Period Schedule to see the timetable shared with your class. Students cannot edit teaching periods.',attendance:'Open My Attendance to view your recorded attendance. Contact your class teacher if a mark needs correction.',tests:'Open Assignments to view work assigned to your class. Complete and submit your paper; teachers control its questions and marking.',students:'Your account can view your own records only.'})[topic]||topics[topic].steps;
 if(['principal','manager','owner'].includes(role)&&topic==='periods')return 'Open Staff, choose the teacher and All Periods to view the schedule. Teachers manage their own periods.';
 if(['principal','manager','owner'].includes(role)&&topic==='attendance')return 'Open Class Performance, choose the class and section, then View results to inspect recorded attendance. Managers with attendance-entry permission can use Manager → Attendance.';
 return topics[topic].steps;}
function scopeKey(){const a=app(),r=normalize(a.profile?.role);return a.user?.id&&a.profile?.status==='active'&&(a.schoolId||r==='creator')?JSON.stringify([a.user.id,a.schoolId||'platform',r]):null;}
const prefix='noor.app-help.v1:';let activeScope=null,chats=[],selected=null,dialog=null,watch=null,previousFocus=null,verified=false,serial=0;
function load(){try{const x=JSON.parse(sessionStorage.getItem(prefix+activeScope)||'[]');chats=Array.isArray(x)?x.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).slice(0,20):[];}catch{chats=[];}selected=chats[0]?.id||null;}
function persist(){if(activeScope!==scopeKey())return;try{sessionStorage.setItem(prefix+activeScope,JSON.stringify(chats.slice(0,20)));}catch{}}
function current(){return chats.find(c=>c.id===selected);}
function fresh(){const chat={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),title:'New chat',messages:[]};chats.unshift(chat);chats=chats.slice(0,20);selected=chat.id;persist();render();}
function close(){serial++;verified=false;clearInterval(watch);watch=null;if(dialog){dialog.close();dialog.remove();dialog=null;}document.body.classList.remove('noor-ai-open');if(previousFocus?.isConnected)previousFocus.focus();}
async function verify(scope){const a=app(),uid=a.user?.id,sid=a.schoolId;const auth=await a.db.auth.getUser();if(auth.error||auth.data?.user?.id!==uid||scope!==scopeKey())throw Error('Your session changed. Sign in again.');
 if(normalize(a.profile.role)==='creator'){const r=await a.db.rpc('noor_creator_identity');if(r.error||r.data!==true)throw Error('Platform access could not be verified.');}
 else{const r=await a.db.from('institution_memberships').select('role,status').eq('institution_id',sid).eq('user_id',uid).eq('status','active').maybeSingle();if(r.error||!r.data||normalize(r.data.role)!==normalize(a.profile.role))throw Error('Your active school membership could not be verified.');}
 if(scope!==scopeKey())throw Error('Your school changed. Reopen help.');
}
function available(){return Object.keys(topics).filter(t=>routeFor(t,app().profile?.role));}
function add(role,text,topic=null){let c=current();if(!c){fresh();c=current();}c.messages.push({role,text:String(text).slice(0,2000),topic:topics[topic]?topic:null});c.messages=c.messages.slice(-80);if(role==='user'&&c.title==='New chat')c.title=text.slice(0,42);persist();render();}
function render(){if(!dialog||activeScope!==scopeKey())return;const role=app().profile.role,c=current();
 dialog.querySelector('[data-history]').innerHTML=chats.map(x=>'<div class="nh-history-row"><button type="button" data-chat="'+E(x.id)+'" aria-current="'+(x.id===selected)+'">'+E(x.title)+'</button><button type="button" data-delete="'+E(x.id)+'" aria-label="Delete chat: '+E(x.title)+'">×</button></div>').join('')||'<p class="nh-muted">No previous chats</p>';
 const area=dialog.querySelector('[data-messages]');area.innerHTML=(c?.messages.length?c.messages.map(m=>'<article class="nh-message '+(m.role==='user'?'nh-user':'nh-assistant')+'"><small>'+E(m.role==='user'?'You':'NOOR Assistant')+'</small><p>'+E(m.text)+'</p>'+(m.role!=='user'&&topics[m.topic]&&routeFor(m.topic,role)?'<div class="nh-actions"><button type="button" data-how="'+E(m.topic)+'">Show me how</button><button type="button" data-open="'+E(m.topic)+'">Open it for me ↗</button></div>':'')+'</article>').join(''):'<div class="nh-welcome"><span aria-hidden="true">✦</span><h2>How can I help you use your app?</h2><p>Find a page, follow simple steps, or open it directly.</p><div class="nh-starters">'+available().slice(0,6).map(t=>'<button type="button" data-topic="'+t+'">'+E(topics[t].label)+'</button>').join('')+'</div></div>');
 area.scrollTop=area.scrollHeight;dialog.querySelector('[data-context]').textContent=(app().school?.name||'NOOR Management')+' · '+normalize(role);dialog.querySelector('[data-send]').disabled=!verified;
}
async function explain(topic){
 if(!topics[topic]||!verified||!routeFor(topic,app().profile.role))return;
 const scope=activeScope,chat=current(),token=serial,role=app().profile.role;
 const fallback=guidance(topic,role);add('assistant',fallback);const message=current()?.messages.at(-1);
 if(!chat||!app().db?.functions?.invoke)return;
 try{const result=await app().db.functions.invoke('noor-v2-ai',{body:{action:'app_help',institution_id:app().schoolId,help_topic:topic}});
 if(result.error||typeof result.data?.response!=='string')return;
 if(token!==serial||scope!==scopeKey()||selected!==chat.id||!chats.includes(chat)||!chat.messages.includes(message))return;
 message.text=result.data.response.slice(0,2000);persist();render();
 }catch{/* Fixed help remains available when the provider or budget is unavailable. */}
}
function ask(text){if(!verified||activeScope!==scopeKey())return close();text=String(text).trim().slice(0,2000);if(!text)return;add('user',text);const topic=resolveRequest(text,app().profile.role);
 if(!topic){add('assistant','I can help you use this app. Try “open my timetable”, “view my marks”, “take attendance” or choose a help topic. I can only open pages permitted for your role.');return;}
 add('assistant','I can help with '+topics[topic].label.toLowerCase()+'. Would you like me to show you how, or open it for you?',topic);
}
async function pickMarks(scope){
 const a=app(),uid=a.user.id,sid=a.schoolId;await verify(scope);
 let groups;
 if(normalize(a.profile.role)==='teacher'){const c=await window.NOOR_TEACHER_DATA.context();groups=await window.NOOR_TEACHER_DATA.assignments(c);}
 else{const all=await window.NOOR_SCHOOL_STRUCTURE.fetchGroups(a.db,sid);groups=all.filter(g=>g.is_active&&['class','section'].includes(g.group_type)).map(g=>({group_id:g.id,class_label:g.parent_group_id?(all.find(p=>p.id===g.parent_group_id)?.name||'Class')+' · '+g.name:g.name}));}
 if(scope!==scopeKey()||!dialog)throw Error('Your school changed. Reopen help.');
 if(!groups.length)throw Error('No permitted class or section is linked to your account.');
 close();const d=document.createElement('dialog');d.id='noorHelpMarks';d.className='nh-marks-picker';d.setAttribute('aria-label','Find annual marks entry');d.innerHTML='<header><h2>Open annual marks entry</h2><button type="button" data-dismiss aria-label="Close">×</button></header><p>Choose a class and section, then the correct student. You will enter and save marks yourself.</p><label>Class / Section<select data-help-group>'+groups.map(g=>'<option value="'+E(g.group_id)+'">'+E(g.class_label)+'</option>').join('')+'</select></label><button type="button" data-load-students>Find students</button><p role="status"></p><div data-help-students></div>';document.body.append(d);d.showModal();let version=0;
 const guard=()=>scope===scopeKey()&&a.user?.id===uid&&a.schoolId===sid&&d.isConnected;
 const timer=setInterval(()=>{if(!guard())d.close();},500);d.addEventListener('close',()=>{version++;clearInterval(timer);d.remove();});d.querySelector('[data-dismiss]').onclick=()=>d.close();
 d.querySelector('[data-help-group]').onchange=()=>{version++;d.querySelector('[data-help-students]').replaceChildren();};
 const status=d.querySelector('[role=status]'),load=d.querySelector('[data-load-students]');
 load.onclick=async()=>{const n=++version,group=d.querySelector('select').value;load.disabled=true;status.textContent='Loading your permitted students…';d.querySelector('[data-help-students]').replaceChildren();try{
 await verify(scope);if(!guard()||n!==version)return;if(!groups.some(g=>g.group_id===group))throw Error('Choose an available class.');
 const today=window.NOOR_SHARED_TIMETABLE.schoolDay(a.school?.timezone),r=await a.db.rpc('noor_class_performance',{p_institution:sid,p_group:group,p_from:today,p_to:today});if(r.error)throw r.error;if(!guard()||n!==version)return;
 const people=r.data?.students||[];status.textContent=people.length?'Select a student to open their marks-entry form.':'No permitted students found in this class.';
 const area=d.querySelector('[data-help-students]');area.innerHTML=people.map((p,i)=>'<button type="button" data-person="'+i+'"><b>'+E(p.name)+'</b><small>Roll '+E(p.roll_number||'—')+'</small></button>').join('');
 area.onclick=async e=>{const b=e.target.closest('[data-person]');if(!b||!guard())return;try{await verify(scope);if(!guard()||n!==version)return;const person=people[Number(b.dataset.person)];if(!person)throw Error('Student selection is unavailable.');if(!window.NOOR_ANNUAL_REPORTS?.openMarks)throw Error('Marks entry is unavailable. Refresh the app.');d.close();await window.NOOR_ANNUAL_REPORTS.openMarks({...person,class_label:groups.find(g=>g.group_id===group).class_label},group);}catch(error){if(d.isConnected)status.textContent=error.message;else a.toast?.(error.message,'error');}};
 }catch(error){if(guard()&&n===version)status.textContent=error.message;}finally{if(guard())load.disabled=false;}};
}
async function follow(topic){if(!topics[topic]||!verified)return;const scope=activeScope;try{await verify(scope);if(scope!==activeScope||!dialog)return;const role=app().profile.role,route=routeFor(topic,role);if(!route)throw Error('This page is not available for your role.');if(window.NOOR_PLATFORM_ACCESS&&(!window.NOOR_PLATFORM_ACCESS.allowed('ai_assistant')||!window.NOOR_PLATFORM_ACCESS.allowed(route)))throw Error('This feature is disabled for your account.');
 const request=current()?.messages.filter(m=>m.role==='user').at(-1)?.text||'';if(topic==='marks'&&['teacher','principal','manager','owner'].includes(normalize(role))){await pickMarks(scope);return;}add('assistant',guidance(topic,role));close();if(topic==='periods'&&normalize(role)==='teacher'&&/create|make|bana|edit|add|set/i.test(request)&&window.NOOR_TEACHER_REFERENCE?.editTimetable){await window.NOOR_TEACHER_REFERENCE.editTimetable();}else app().openView(route);
 }catch(e){if(dialog&&scope===activeScope)add('assistant',e.message);}}
async function open(){if(dialog){dialog.querySelector('textarea')?.focus();return;}const scope=scopeKey();if(!scope){app().toast?.('Sign in to an active account to use app help.','info');return;}if(window.NOOR_PLATFORM_ACCESS&&!window.NOOR_PLATFORM_ACCESS.allowed('ai_assistant')){app().toast?.('App assistant is disabled for this account.','info');return;}
 activeScope=scope;verified=false;previousFocus=document.activeElement;const token=++serial;dialog=document.createElement('dialog');dialog.id='noorAIModal';dialog.className='nh-dialog';dialog.setAttribute('aria-label','NOOR app assistant');dialog.innerHTML='<div class="nh-shell"><aside class="nh-sidebar"><header><b>NOOR Assistant</b><button type="button" data-history-close aria-label="Hide chat history">×</button></header><button type="button" class="nh-new" data-new>＋ New chat</button><small class="nh-muted">YOUR CHATS</small><nav data-history aria-label="Chat history"></nav><button type="button" class="nh-delete-all" data-clear>Delete previous chats</button><p class="nh-muted">History stays in this browser session, separately for each account and school.</p></aside><main class="nh-main"><header class="nh-top"><button type="button" data-history-toggle aria-label="Toggle chat history" aria-expanded="false">☰</button><div><b>App Help</b><small data-context></small></div><button type="button" data-close aria-label="Close assistant">×</button></header><div class="nh-messages" data-messages role="log" aria-label="Conversation" aria-live="polite"><p>Verifying your school access…</p></div><form class="nh-composer"><label class="nh-sr" for="nhPrompt">Ask about your app</label><div><textarea id="nhPrompt" rows="2" maxlength="2000" placeholder="Ask about your app…" required></textarea><button type="submit" data-send disabled aria-label="Send message">↑</button></div><small>App help only. Records open securely in your school’s pages.</small></form><div class="nh-confirm" hidden><p data-confirm-text></p><button type="button" data-confirm-delete>Delete</button><button type="button" data-cancel-delete>Cancel</button></div></main></div>';
 document.body.append(dialog);document.body.classList.add('noor-ai-open');dialog.showModal();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});let pendingDelete=null;
 dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||activeScope!==scopeKey())return;if(b.hasAttribute('data-close'))return close();if(!verified)return;
 if(b.hasAttribute('data-new')){fresh();dialog.classList.remove('nh-history-open');dialog.querySelector('[data-history-toggle]').setAttribute('aria-expanded','false');dialog.querySelector('textarea').value='';dialog.querySelector('textarea').focus();}
 if(b.dataset.chat){selected=chats.find(c=>c.id===b.dataset.chat)?.id||null;render();dialog.classList.remove('nh-history-open');dialog.querySelector('[data-history-toggle]').setAttribute('aria-expanded','false');}
 if(b.dataset.delete||b.hasAttribute('data-clear')){pendingDelete=b.dataset.delete||'all';const box=dialog.querySelector('.nh-confirm');box.hidden=false;box.querySelector('[data-confirm-text]').textContent=pendingDelete==='all'?'Delete all previous chats for this account and school?':'Delete this chat?';box.querySelector('[data-confirm-delete]').focus();}
 if(b.hasAttribute('data-cancel-delete')){pendingDelete=null;dialog.querySelector('.nh-confirm').hidden=true;}
 if(b.hasAttribute('data-confirm-delete')&&pendingDelete){chats=pendingDelete==='all'?[]:chats.filter(c=>c.id!==pendingDelete);if(!current())selected=chats[0]?.id||null;pendingDelete=null;persist();render();dialog.querySelector('.nh-confirm').hidden=true;}
 if(b.hasAttribute('data-history-toggle')||b.hasAttribute('data-history-close')){const visible=b.hasAttribute('data-history-close')?false:!dialog.classList.contains('nh-history-open');dialog.classList.toggle('nh-history-open',visible);dialog.querySelector('[data-history-toggle]').setAttribute('aria-expanded',String(visible));}
 if(b.dataset.topic)ask(topics[b.dataset.topic].label);if(b.dataset.how)explain(b.dataset.how);if(b.dataset.open)follow(b.dataset.open);
 });
 const form=dialog.querySelector('form'),input=dialog.querySelector('textarea');form.onsubmit=e=>{e.preventDefault();if(!verified)return;ask(input.value);input.value='';input.focus();};input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}};
 watch=setInterval(()=>{if(scope!==scopeKey()||window.NOOR_PLATFORM_ACCESS&&!window.NOOR_PLATFORM_ACCESS.allowed('ai_assistant'))close();},500);
 try{await verify(scope);if(token!==serial||!dialog||scope!==scopeKey())return;verified=true;load();render();input.focus();}catch(e){if(token===serial&&dialog){dialog.querySelector('[data-messages]').textContent=e.message;}}
}
function mountSettings(container){container?.replaceChildren();}
window.NOOR_SECURE_AI=Object.freeze({open,close,mountSettings,resolveRequest,routeFor,guidance,scopeKey});
})();
