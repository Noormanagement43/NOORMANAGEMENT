import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const staff=fs.readFileSync(new URL('../noor-staff-panel.js',import.meta.url),'utf8');
test('staff highest-first sorting keeps unknown metrics last and preserves row identities',()=>{
 const window={addEventListener(){}};vm.runInNewContext(staff,{window});const api=window.NOOR_STAFF_PANEL;
 const rows=[{id:'unknown',full_name:'A',attendance:null,logged:0,completed:0},{id:'low',full_name:'B',attendance:50,logged:4,completed:4},{id:'high',full_name:'C',attendance:100,logged:4,completed:1},{id:'zero',full_name:'D',attendance:0,logged:2,completed:0}];
 assert.equal(api.sortRows(rows).map(t=>t.id).join(','),'high,low,zero,unknown');
 assert.equal(api.sortRows(rows,'progress').map(t=>t.id).join(','),'low,high,zero,unknown');
 assert.equal(rows[0].id,'unknown');
});
function setup(){
 const listeners={},keys={},observers=[];let focused;
 function el(){const classes=new Set();return {classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x)},style:{},setAttribute(k,v){this[k]=v},addEventListener(k,v){this[k]=v},focus(){focused=this},append(){},prepend(){},querySelectorAll(){return[]}};}
 const sidebar=el(),menu=el(),main=el(),workspace=el(),body=el();workspace.querySelector=()=>main;workspace.addEventListener=(k,v)=>listeners[k]=v;sidebar.contains=t=>t===sidebar;
 const created=[],phone={matches:true,addEventListener(k,f){this.change=f}},document={body,getElementById:id=>({sidebar,mobileMenu:menu,workspace})[id],createElement(){const e=el();created.push(e);return e},querySelector:()=>null,addEventListener:(k,v)=>keys[k]=v};
 vm.runInNewContext(fs.readFileSync(new URL('../noor-mobile-drawer.js',import.meta.url),'utf8'),{document,matchMedia:()=>phone,MutationObserver:class{constructor(fn){observers.push(fn)}observe(){}}});
 const target={closest:()=>null};const swipe=(x,y,ex,ey,t=target)=>{listeners.touchstart({touches:[{clientX:x,clientY:y}],target:t});listeners.touchend({changedTouches:[{clientX:ex,clientY:ey}]});};
 return {sidebar,menu,main,workspace,body,created,phone,keys,listeners,swipe,observers,get focused(){return focused}};
}
test('phone edge swipe opens; left swipe closes; Escape and backdrop restore content access',()=>{
 const x=setup();assert.equal(x.sidebar.inert,true);x.swipe(20,150,120,153);assert.equal(x.menu['aria-expanded'],'true');assert.equal(x.main.inert,true);assert.equal(x.body.style.overflow,'hidden');
 x.swipe(180,150,70,152,x.sidebar);assert.equal(x.menu['aria-expanded'],'false');assert.equal(x.main.inert,false);
 x.swipe(20,150,120,153);x.keys.keydown({key:'Escape',preventDefault(){}});assert.equal(x.menu['aria-expanded'],'false');
 x.swipe(20,150,120,153);x.created[0].onclick();assert.equal(x.sidebar.classList.contains('open'),false);
});
test('vertical scrolling, table controls, non-edge swipes and desktop swipes do not open navigation',()=>{
 const x=setup();x.swipe(20,100,90,220);assert.equal(x.menu['aria-expanded'],'false');x.swipe(90,100,200,105);assert.equal(x.menu['aria-expanded'],'false');x.swipe(20,100,130,105,{closest:()=>({})});assert.equal(x.menu['aria-expanded'],'false');x.phone.matches=false;x.swipe(20,100,130,105);assert.equal(x.menu['aria-expanded'],'false');
});
test('resizing to desktop restores content and makes sidebar accessible',()=>{const x=setup();x.swipe(20,100,130,105);x.phone.matches=false;x.phone.change();assert.equal(x.main.inert,false);assert.equal(x.sidebar.inert,false);assert.equal(x.created[0].hidden,true);});
