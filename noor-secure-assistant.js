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
 '<div id="noorAIConnectionTools" style="display:flex;gap:8px;padding:0 16px"><button type="button" id="noorAITestConnection" class="btn light">Check AI connection</button><button type="button" id="noorAIManagerPlan" class="btn light">Manager + brain draft</button></div>'+
 '<form class="noor-ai-v2-form" id="noorAIForm"><label for="noorAIPrompt" class="sr-only">Ask NOOR AI</label><textarea id="noorAIPrompt" maxlength="3000" rows="2" placeholder="Ask about classes, learning plans, notices…"></textarea><button type="submit" id="noorAISend">Send ↗</button></form><p id="noorAIState" class="noor-ai-v2-state" role="status">API credentials are stored on the server, never inside this browser.</p></section>';
 document.body.append(modal);
 modal.querySelector('#noorAIClose').onclick=close;
 modal.querySelector('#noorAITestConnection').onclick=testConnection;
 modal.querySelector('#noorAIManagerPlan').onclick=()=>{if(isBusy||!modal.querySelector('#noorAIPrompt').value.trim())return;modal.dataset.aiAction='manager_plan';modal.querySelector('#noorAIForm').requestSubmit()};
 modal.addEventListener('click',e=>{if(e.target===modal)close()});
 modal.querySelectorAll('[data-ai-suggestion]').forEach(b=>b.onclick=()=>{modal.querySelector('#noorAIPrompt').value=b.dataset.aiSuggestion;modal.querySelector('#noorAIPrompt').focus()});
 modal.querySelector('#noorAIForm').addEventListener('submit',send);
 modal.querySelector('#noorAIPrompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();modal.querySelector('#noorAIForm').requestSubmit()}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close()});
 return modal;
}
function open(){
 if(!ready()){A().toast?.('Sign in to your active school first to use AI.','info');return;}
 const dlg=ensure();const actor=A().user?.id;if(dlg.dataset.accountId!==actor){dlg.querySelector('#noorAIMessages').textContent='';dlg.dataset.accountId=actor||'';}const role=A().profile?.role,leader=['principal','owner','manager'].includes(role),canProbe=leader||role==='teacher';dlg.querySelector('#noorAIConnectionTools').style.display=canProbe?'flex':'none';dlg.querySelector('#noorAIManagerPlan').style.display=leader?'':'none';dlg.hidden=false;document.body.classList.add('noor-ai-open');dlg.querySelector('#noorAIPrompt').focus();
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
  const a=A(),actor=a.user.id,institution=a.schoolId,action=dlg.dataset.aiAction||'chat_assist';delete dlg.dataset.aiAction;
  const result=await a.db.functions.invoke('noor-v2-ai',{body:{action,message,institution_id:institution}});
  if(A().user?.id!==actor||A().schoolId!==institution){reply.remove();own.remove();return;}
  if(result.error){let detail;try{detail=await result.error.context?.json()}catch{}throw Error(detail?.error||result.data?.error||result.error.message)}
  if(result.data?.error)throw Error(result.data.error);
  const answer=typeof result.data?.response==='string'?result.data.response.trim():'';
  if(!answer)throw Error('The AI service returned no answer.');
  reply.textContent=(result.data?.plan?'Manager plan:\n'+result.data.plan+'\n\nBrain draft:\n':'')+answer;state.textContent='Draft generated. No external actions were executed.';
 }catch(error){
  reply.textContent='AI is not available right now. '+(error?.message||'Please verify the Supabase Edge Function and server-side GEMINI_API_KEY.')+' No key should be entered in the browser.';
  state.textContent='AI connection requires a deployed Edge Function and a server-side secret.';
 }finally{isBusy=false;sendBtn.disabled=false;log.scrollTop=log.scrollHeight}
}
async function testConnection(){
 const dlg=ensure(),button=dlg.querySelector('#noorAITestConnection'),status=dlg.querySelector('#noorAIState');
 button.disabled=true;status.textContent='Checking provider credentials and model access…';
 try{const app=A(),r=await app.db.functions.invoke('noor-v2-ai',{body:{action:'probe',institution_id:app.schoolId}});
  if(r.error){let info;try{info=await r.error.context?.json()}catch{}throw Error(info?.error||r.error.message)}
  if(r.data?.error)throw Error(r.data.error);
  const label=x=>!x?.key_saved?'not configured':x.verified?'API verified':x.code||'not verified';
  const p=r.data?.providers||{};status.textContent='Gemini: '+label(p.gemini)+' · Groq: '+label(p.groq)+' · OpenAI: '+label(p.openai)+' · Brevo API: '+label(p.brevo)+'. Generation and email delivery were not tested.';
 }catch(e){status.textContent='Connection check: '+(e?.message||'Unavailable')}finally{button.disabled=false}
}
function mountSettings(container){
 if(!container||!ready())return;
 const panel=document.createElement('section');panel.className='panel';
 panel.innerHTML='<div class="panelhead"><div><h3>NOOR AI workspace</h3><p>Ask for academic help or create a draft. Connected AI services use your school permissions.</p></div></div><button type="button" class="btn" data-noor-open-ai>Open AI workspace</button>';
 panel.querySelector('[data-noor-open-ai]').onclick=open;container.replaceChildren(panel);
}
window.NOOR_SECURE_AI={open,close,mountSettings};
})();
