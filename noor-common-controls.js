/* Compact search clear controls; preserve each existing input's native input/change handlers. */
(function(){
 'use strict';
 const selector='input[type="search"],input[placeholder*="search" i],input[aria-label*="search" i]';
 function enhance(input){
  if(input.dataset.noorSearchClear==='ready'||input.type==='password'||!input.parentElement)return;
  input.dataset.noorSearchClear='ready';
  const wrap=document.createElement('span');wrap.className='noor-input-clear-wrap';
  input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
  const button=document.createElement('button');button.type='button';button.className='noor-clear-search';
  button.setAttribute('aria-label','Clear search');button.title='Clear search';button.textContent='×';
  wrap.appendChild(button);
  const update=()=>{button.hidden=!input.value;};
  button.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();
   input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
   input.dispatchEvent(new Event('change',{bubbles:true}));update();input.focus();
  });
  input.addEventListener('input',update);update();
 }
 function scan(root){
  if(root.nodeType!==1)return;
  if(root.matches(selector))enhance(root);
  root.querySelectorAll(selector).forEach(enhance);
 }
 function init(){
  scan(document.documentElement);
  const observer=new MutationObserver(records=>{
   records.forEach(record=>record.addedNodes.forEach(scan));
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
