/* NOOR AI Assistant: shared teacher/principal/student chat backed ONLY by server-side Supabase Edge Function.
   Never requests, reads, or stores API secrets in the public browser. */
(()=>{'use strict';
const A=()=>window.NOOR_AI_APP||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let isBusy=false;
function ready(){const a=A();return !!(a.db&&a.user&&a.schoolId&&a.profile?.status==='active'&&['principal','owner','teacher','student','manager'].includes(a.profile?.role));}
function ensure(){
 let modal=document.getElementById('noorAIModal');
 if(modal)return modal;
 modal=document.createElement('div');modal.id='noorAIModal';modal.className='noor-ai-v2-backdrop';modal.hidden=true;
 modal.innerHTML='<section class="noor-ai-v2-dialog" role="dialog" aria-modal="true" aria-label="NOOR AI Assistant">'+
 '<header class="noor-ai-v2-heading"><div class="noor-ai-v2-orb" aria-hidden="true">✦</div><div><small>NOOR SCHOOL MANAGEMENT</small><h2>NOOR AI Assistant</h2><p>Private academic help · secured through your school account</p></div><button type="button" id="noorAIClose" aria-label="Close Assistant">✕</button></header>'+
 '<div class="noor-ai-v2-chips" aria-label="Suggested prompts"><button data-ai-suggestion="Plan a clear 40-minute lesson with a short quiz.">✦ Lesson plan</button><button data-ai-suggestion="Suggest supportive ways to improve student engagement.">◈ Teaching ideas</button><button data-ai-suggestion="Write a polite draft school announcement for parents to review.">▤ Notice draft</button></div>'+
 '<div class="noor-ai-v2-messages" id="noorAIMessages" role="log" aria-live="polite"><p class="noor-ai-v2-reply">Welcome to NOOR AI. Ask a question about school management, teaching or learning. AI suggestions should be reviewed before use.</p></div>'+
 '<form class="noor-ai-v2-form" id="noorAIForm"><label for="noorAIPrompt" class="sr-only">Ask NOOR AI</label><textarea id="noorAIPrompt" maxlength="3000" rows="2" placeholder="Ask about classes, learning plans, notices…"></textarea><button type="submit" id="noorAISend">Send ↗</button></form><p id="noorAIState" class="noor-ai-v2-state" role="status">API credentials are stored on the server, never inside this browser.</p></section>';
 document.body.append(modal);
 modal.querySelector('#noorAIClose').onclick=close;
 modal.addEventListener('click',e=>{if(e.target===modal)close()});
 modal.querySelectorAll('[data-ai-suggestion]').forEach(b=>b.onclick=()=>{modal.querySelector('#noorAIPrompt').value=b.dataset.aiSuggestion;modal.querySelector('#noorAIPrompt').focus()});
 modal.querySelector('#noorAIForm').addEventListener('submit',send);
 modal.querySelector('#noorAIPrompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();modal.querySelector('#noorAIForm').requestSubmit()}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close()});
 return modal;
}
function open(){
 if(!ready()){A().toast?.('Sign in to your active school first to use AI.','info');return;}
 const dlg=ensure();dlg.hidden=false;document.body.classList.add('noor-ai-open');dlg.querySelector('#noorAIPrompt').focus();
}
function close(){const d=document.getElementById('noorAIModal');if(d)d.hidden=true;document.body.classList.remove('noor-ai-open')}
async function send(e){
 e.preventDefault();if(isBusy||!ready())return;
 const dlg=ensure(),inp=dlg.querySelector('#noorAIPrompt'),message=inp.value.trim();
 if(!message)return;
 inp.value='';const log=dlg.querySelector('#noorAIMessages'),state=dlg.querySelector('#noorAIState'),sendBtn=dlg.querySelector('#noorAISend');
 const own=document.createElement('p');own.className='noor-ai-v2-reply user';own.textContent=message;log.append(own);
 const reply=document.createElement('p');reply.className='noor-ai-v2-reply';reply.textContent='Thinking…';log.append(reply);log.scrollTop=log.scrollHeight;
 isBusy=true;sendBtn.disabled=true;state.textContent='Contacting the secure NOOR AI service…';
 try{
  const a=A(),result=await a.db.functions.invoke('noor-ai',{body:{action:'chat_assist',message,role:a.profile.role}});
  if(result.error)throw result.error;
  if(result.data?.error)throw Error(result.data.error);
  const answer=typeof result.data?.response==='string'?result.data.response.trim():'';
  if(!answer)throw Error('The AI service returned no answer.');
  reply.textContent=answer;state.textContent='Answered via the secured school service.';
 }catch(error){
  reply.textContent='AI is not available right now. '+(error?.message||'Please verify the Supabase Edge Function and server-side GEMINI_API_KEY.')+' No key should be entered in the browser.';
  state.textContent='AI connection requires a deployed Edge Function and a server-side secret.';
 }finally{isBusy=false;sendBtn.disabled=false;log.scrollTop=log.scrollHeight}
}
function createLauncher(){
 if(document.getElementById('noorAISafeLauncher'))return;
 const b=document.createElement('button');b.id='noorAISafeLauncher';b.type='button';b.className='noor-ai-v2-launcher';b.setAttribute('aria-label','Open NOOR AI assistant');b.innerHTML='<span aria-hidden="true">✦</span><b>NOOR AI</b>';b.onclick=open;document.body.append(b);
 function sync(){b.hidden=!ready()||document.getElementById('workspace')?.classList.contains('hidden')}
 sync();
 const target=document.getElementById('workspace');if(target)new MutationObserver(sync).observe(target,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);
}
window.NOOR_SECURE_AI={open,close};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createLauncher,{once:true});else createLauncher();
})();