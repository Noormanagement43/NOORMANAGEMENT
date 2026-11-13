/* One phone drawer for every role. Swipes never consume register/table gestures. */
(()=>{'use strict';
 const sidebar=document.getElementById('sidebar'),menu=document.getElementById('mobileMenu'),workspace=document.getElementById('workspace');
 if(!sidebar||!menu||!workspace)return;
 const phone=matchMedia('(max-width:1024px)'),main=workspace.querySelector('.main');
 const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='noor-nav-backdrop';backdrop.setAttribute('aria-label','Close navigation');backdrop.hidden=true;workspace.append(backdrop);
 const close=document.createElement('button');close.type='button';close.className='noor-nav-close';close.textContent='×';close.setAttribute('aria-label','Close navigation');sidebar.prepend(close);
 menu.setAttribute('aria-controls','sidebar');menu.setAttribute('aria-label','Open navigation');
 let active=false,start=null,previousOverflow='';
 function sync(){
  const open=phone.matches&&sidebar.classList.contains('open')&&!workspace.classList.contains('hidden');
  backdrop.hidden=!open;close.hidden=!phone.matches;menu.setAttribute('aria-expanded',String(open));sidebar.inert=phone.matches&&!open;
  if(open===active)return;
  active=open;
  if(open){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';if(main)main.inert=true;close.focus();}
  else{document.body.style.overflow=previousOverflow;if(main)main.inert=false;if(phone.matches&&!workspace.classList.contains('hidden'))menu.focus();}
 }
 function hide(){sidebar.classList.remove('open');sync();}
 close.onclick=hide;backdrop.onclick=hide;
 new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});
 new MutationObserver(()=>{if(workspace.classList.contains('hidden'))hide();sync();}).observe(workspace,{attributes:true,attributeFilter:['class']});
 phone.addEventListener('change',()=>{hide();sync();});
 document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();hide();}if(e.key==='Tab'){const items=[...sidebar.querySelectorAll('button:not([disabled]),a[href],input,select,[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 workspace.addEventListener('touchstart',e=>{
  start=null;if(!phone.matches||e.touches.length!==1||document.querySelector('dialog[open],.overlay.show'))return;
  const t=e.touches[0],inside=sidebar.contains(e.target);
  if(active&&!inside&&e.target!==backdrop)return;
  if(!active&&(t.clientX>48||e.target.closest('input,textarea,select,button,a,[contenteditable],.tablewrap,.nst-scroll,.ta-register-scroll')))return;
  start={x:t.clientX,y:t.clientY,open:active};
 },{passive:true});
 workspace.addEventListener('touchend',e=>{if(!start)return;const s=start;start=null;const t=e.changedTouches[0];if(!t)return;const dx=t.clientX-s.x,dy=t.clientY-s.y;if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return;if(s.open&&dx<0)hide();else if(!s.open&&dx>0){sidebar.classList.add('open');sync();}},{passive:true});
 workspace.addEventListener('touchcancel',()=>{start=null;},{passive:true});
 sidebar.addEventListener('click',e=>{if(e.target.closest('[data-view]'))hide();});
 sync();
})();
