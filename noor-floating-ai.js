/* NOOR floating AI launcher: one entry point to the existing verified assistant. */
(()=>{'use strict';
  const ID='noorFloatingAI';
  const STORAGE='noor.ai.launcher.position.v1';
  const clamp=(n,min,max)=>Math.min(Math.max(n,min),max);
  const button=document.createElement('button');
  button.type='button';
  button.id=ID;
  button.hidden=true;
  button.className='noor-floating-ai';
  button.setAttribute('aria-label','Open Your School Assistant');
  button.setAttribute('aria-haspopup','dialog');
  button.title='Your School Assistant';
  button.innerHTML='<span class="noor-floating-ai-icon" aria-hidden="true"><img src="./assets/school-assistant-avatar.webp?v=20261116-portrait-1" alt="" width="128" height="128"><i class="noor-floating-ai-indicator"></i></span>'+ 
    '<span class="noor-floating-ai-copy"><strong>AI</strong></span>';
  document.body.appendChild(button);

  let stored=null;
  let point=null;
  let drag=null;
  let blockNextClick=false;
  let viewSize='';
  function load(){
    try{
      const v=JSON.parse(localStorage.getItem(STORAGE)||'null');
      return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)?{x:clamp(v.x,0,1),y:clamp(v.y,0,1)}:null;
    }catch{return null;}
  }
  stored=load();
  function workspaceReady(){
    const w=document.getElementById('workspace');
    const a=window.NOOR_AI_APP;
    if(!w||w.classList.contains('hidden')||!a?.user?.id||a.profile?.status!=='active'||!window.NOOR_SECURE_AI?.open)return false;
    if(document.fullscreenElement)return false;
    if(window.NOOR_PLATFORM_ACCESS?.allowed&&!window.NOOR_PLATFORM_ACCESS.allowed('ai_assistant'))return false;
    return true;
  }
  function limits(){
    const vw=window.innerWidth,vh=window.innerHeight;
    const width=button.offsetWidth||174,height=button.offsetHeight||62;
    return {left:12,top:12,right:Math.max(12,vw-width-12),bottom:Math.max(12,vh-height-12),width,height,vw,vh};
  }
  function place(x,y){
    const b=limits();
    point={x:clamp(x,b.left,b.right),y:clamp(y,b.top,b.bottom)};
    button.style.left=point.x+'px';
    button.style.top=point.y+'px';
  }
  function defaultBottom(){
    if(window.innerWidth<=760){
      const nav=document.getElementById('noorMobileNav');
      const r=nav?.getBoundingClientRect();
      return r&&r.height>20?Math.max(92,r.height+19):26;
    }
    return document.getElementById('noorSoundQuickControl')?78:28;
  }
  function restore(){
    const b=limits();
    if(stored){
      place(b.left+stored.x*(b.right-b.left),b.top+stored.y*(b.bottom-b.top));
    }else{
      place(b.right,Math.max(b.top,b.vh-b.height-defaultBottom()));
    }
  }
  function save(){
    const b=limits();
    stored={x:(point.x-b.left)/Math.max(1,b.right-b.left),y:(point.y-b.top)/Math.max(1,b.bottom-b.top)};
    try{localStorage.setItem(STORAGE,JSON.stringify(stored));}catch{/* No persistence needed in private browsing. */}
  }
  function sync(){
    const visible=workspaceReady();
    if(!visible){
      button.hidden=true;
      button.removeAttribute('data-visible');
      viewSize='';
      return;
    }
    if(button.hidden){
      button.hidden=false;
      button.dataset.visible='true';
      restore();
      viewSize=window.innerWidth+'x'+window.innerHeight;
      return;
    }
    if(!drag){
      const size=window.innerWidth+'x'+window.innerHeight;
      if(size!==viewSize){restore();viewSize=size;}
    }
  }
  button.addEventListener('pointerdown',event=>{
    if(!workspaceReady()||(event.pointerType==='mouse'&&event.button!==0))return;
    blockNextClick=false;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:point?.x||0,top:point?.y||0,moved:false};
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)>7)drag.moved=true;
    if(drag.moved){
      event.preventDefault();
      button.classList.add('is-dragging');
      place(drag.left+dx,drag.top+dy);
    }
  });
  function finish(event){
    if(!drag||drag.id!==event.pointerId)return;
    const moved=drag.moved;
    drag=null;
    button.classList.remove('is-dragging');
    if(button.hasPointerCapture?.(event.pointerId))button.releasePointerCapture(event.pointerId);
    if(moved){
      save();
      blockNextClick=true;
      window.setTimeout(()=>{blockNextClick=false;},350);
    }
  }
  button.addEventListener('pointerup',finish);
  button.addEventListener('pointercancel',finish);
  button.addEventListener('click',event=>{
    if(blockNextClick){event.preventDefault();blockNextClick=false;return;}
    if(!workspaceReady())return;
    window.NOOR_SECURE_AI.open();
  });
  button.addEventListener('keydown',event=>{
    if(!event.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    const step=event.shiftKey?40:20;
    const dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;
    const dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
    place((point?.x||0)+dx,(point?.y||0)+dy);
    save();
  });
  const w=document.getElementById('workspace');
  if(w)new MutationObserver(sync).observe(w,{attributes:true,attributeFilter:['class','style']});
  window.addEventListener('noor:view-changed',sync);
  window.addEventListener('resize',sync);
  window.visualViewport?.addEventListener('resize',sync);
  window.addEventListener('storage',event=>{
    if(event.key===STORAGE){stored=load();if(!button.hidden)restore();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  window.setInterval(sync,2000);
  sync();
  window.NOOR_FLOATING_AI=Object.freeze({refresh:sync});
})();
