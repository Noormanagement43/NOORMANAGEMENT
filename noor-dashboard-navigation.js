/* NOOR dashboard navigation search: searches only real, accessible workspace destinations.
   No fake students, private data, or placeholder search results. */
(()=>{'use strict';
 const input=document.getElementById('noorReferenceNavSearch');
 const output=document.getElementById('noorReferenceSearchResults');
 const nav=document.getElementById('mainNav');
 if(!input||!output||!nav)return;
 let matches=[];
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 function entries(){
  return [...nav.querySelectorAll('button[data-view]')].filter(b=>!b.disabled).map(b=>({id:b.dataset.view,title:(b.textContent||'').trim()})).filter(x=>x.id&&x.title);
 }
 function close(){output.hidden=true;output.replaceChildren();matches=[];}
 function show(){
  const q=input.value.trim().toLowerCase();
  if(!q){close();return;}
  matches=entries().filter(x=>x.title.toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){output.innerHTML='<div class="noor-ref-search-none">No matching workspace page. Try “Attendance” or “Calendar”.</div>';output.hidden=false;return;}
  output.innerHTML=matches.map(x=>'<button type="button" role="option" data-ref-route="'+escape(x.id)+'">'+escape(x.title)+'</button>').join('');
  output.hidden=false;
 }
 function navigate(id){
  const allowed=entries().some(x=>x.id===id);
  if(!allowed)return;
  close();input.value='';
  window.NOOR_AI_APP?.openView?.(id);
 }
 input.addEventListener('input',show);
 input.addEventListener('focus',()=>{if(input.value.trim())show()});
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape')close();
  if(event.key==='Enter'){
   event.preventDefault();if(matches[0])navigate(matches[0].id);
   else window.NOOR_AI_APP?.toast?.('No matching page in your authorised workspace.','info');
  }
 });
 output.addEventListener('click',event=>{const b=event.target.closest('[data-ref-route]');if(b)navigate(b.dataset.refRoute)});
 document.addEventListener('click',event=>{if(!event.target.closest('.noor-ref-search'))close()});
 nav.addEventListener('click',close);
})();