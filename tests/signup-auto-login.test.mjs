import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync(new URL('../noor-canonical-onboarding.js',import.meta.url),'utf8');
function setup({duplicate=false,wrong=false,member=false,missingClass=false}={}){
 const institution='41000000-0000-4000-8000-000000000002',listeners={},els={},storage=new Map(),calls=[],messages=[];let entered=false,login=false,joined=member;
 for(const id of ['loginForm','ownerRegisterForm','registerForm','staffJoinForm'])els[id]={addEventListener:(_,fn)=>listeners[id]=fn,querySelector:()=>({disabled:false})};
 for(const[id,value]of Object.entries({studentEmail:'person@example.invalid',studentPassword:'password-123',studentConfirmPassword:'password-123',joinCode:'school-code',studentName:'Student',studentMobile:'',parentName:'Guardian',rollNumber:'12',loginEmail:''}))els[id]={value};
 els.schoolSelect={dataset:{institution}};
 const user={id:'own',email:'person@example.invalid'};
 const success={data:{user,session:{user}}};
 const db={auth:{signUp:async()=>{calls.push('signup');return duplicate?{error:{code:'user_already_exists',message:'User already registered'}}:success},signInWithPassword:async()=>{calls.push('login');return wrong?{error:{message:'Invalid login credentials'}}:success},getUser:async()=>({data:{user}})},rpc:async(name)=>{calls.push(name);if(name==='noor_join_selected_institution')joined=true;return{data:{}}}};
 const window={NOOR_ACCOUNT_CONTEXT:{enabled:()=>true,profile:async()=>({data:joined?{id:'own',institution_id:institution,status:'active',role:'student',class_id:member&&!missingClass?'existing-class':null}:null})},NOOR_SIGNUP_GROUPS:{validate:()=>({class_id:'chosen-class',section_id:null})}};
 vm.runInNewContext(code,{window,document:{getElementById:id=>els[id]},sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},localStorage:{removeItem(){}}});
 window.NOOR_CANONICAL_ONBOARDING.install({db,enter:async()=>{entered=true},showLogin:()=>{login=true},message:msg=>messages.push(msg),redirectTo:'https://noormanagement43.github.io/NOORMANAGEMENT/'});
 return{submit:()=>listeners.registerForm({preventDefault(){},stopImmediatePropagation(){}}),calls,messages,get entered(){return entered},get login(){return login}};
}
test('new signup saves selected class and enters dashboard automatically',async()=>{const x=setup();await x.submit();assert(x.entered);assert.deepEqual(x.calls,['signup','noor_join_selected_institution','noor_select_student_section']);});
test('duplicate email with correct existing password finishes school join without another signup error',async()=>{const x=setup({duplicate:true});await x.submit();assert(x.entered);assert.deepEqual(x.calls,['signup','login','noor_join_selected_institution','noor_select_student_section']);assert.equal(x.messages.length,0);});
test('duplicate email never overwrites an existing password or joins on wrong password',async()=>{const x=setup({duplicate:true,wrong:true});await x.submit();assert(!x.entered);assert(x.login);assert.deepEqual(x.calls,['signup','login']);assert.match(x.messages[0],/existing password/);});
test('existing school member is logged in without rejoining or changing class',async()=>{const x=setup({duplicate:true,member:true});await x.submit();assert(x.entered);assert.deepEqual(x.calls,['signup','login']);});

test('existing member with missing class can finish its same-school signup selection',async()=>{const x=setup({duplicate:true,member:true,missingClass:true});await x.submit();assert(x.entered);assert.deepEqual(x.calls,['signup','login','noor_select_student_section']);});
