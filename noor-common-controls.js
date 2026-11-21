/* Universal search clearing. Preserve each input's native input/change handlers. */
(function(){
 'use strict';
 const selector=[
  'input[type="search"]',
  'input[placeholder*="search" i]',
  'input[placeholder*="find" i]',
  'input[aria-label*="search" i]',
  'input[name*="search" i]',
  'input[class*="search" i]',
  'input[id*="search" i]',
  'input[data-search]',
  'input[data-filter-search]',
  '[role="search"] input'
 ].join(',');
 const ignored=new Set(['password','file','hidden','button','submit','reset','checkbox','radio']);
 function enhance(input){
  if(!input||input.dataset.noorSearchClear==='ready'||input.dataset.noorSearchClear==='false'||ignored.has(input.type)||input.classList.contains('noor-search-clear-skip')||!input.parentElement)return;
  input.dataset.noorSearchClear='ready';
  const wrap=document.createElement('span');
  wrap.className='noor-input-clear-wrap'+(input.classList.contains('field-inline')?' noor-field-inline-clear-wrap':'');
  input.parentNode.insertBefore(wrap,input);
  wrap.appendChild(input);
  const button=document.createElement('button');
  button.type='button';button.className='noor-clear-search';
  button.setAttribute('aria-label','Clear search');button.title='Clear search';button.textContent='×';
  wrap.appendChild(button);
  const update=()=>{button.hidden=!String(input.value||'').length;};
  button.addEventListener('mousedown',event=>event.preventDefault());
  button.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();
   if(!input.value)return;
   input.value='';
   input.dispatchEvent(new Event('input',{bubbles:true}));
   input.dispatchEvent(new Event('change',{bubbles:true}));
   update();input.focus();
  });
  input.addEventListener('input',update);
  input.addEventListener('change',update);
  update();
 }
 function scan(root){
  if(!root||root.nodeType!==1)return;
  if(root.matches(selector))enhance(root);
  root.querySelectorAll(selector).forEach(enhance);
 }
 function init(){
  scan(document.documentElement);
  const observer=new MutationObserver(records=>records.forEach(record=>{
   if(record.type==='childList')record.addedNodes.forEach(scan);
   else if(record.type==='attributes')scan(record.target);
  }));
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['type','placeholder','aria-label','name','class','data-search','data-filter-search']});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
