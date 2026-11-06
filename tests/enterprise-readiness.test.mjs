import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from '../scripts/build-static.mjs';
import { validate, Metrics, run } from '../scripts/load-test.mjs';
const code=await readFile(new URL('../noor-shared-timetable.js',import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const config={url:'https://abcdefghijklmnopqrst.supabase.co',projectRef:'abcdefghijklmnopqrst',authorized:'abcdefghijklmnopqrst',key:'sb_publishable_staging',scenario:'A',vus:1,duration:1,rampMs:0};
const fixtures={project_ref:config.projectRef,synthetic:true,users:[{email:'student@noor.example.test',password:'fixture-only',institution_id:id(1),membership_id:id(2),role:'student'}]};
test('load guard refuses production, old project, redirects, missing acknowledgement and privileged keys',()=>{
  for(const patch of [{projectRef:'ayrryemawwplguaauxij',url:'https://ayrryemawwplguaauxij.supabase.co'},{projectRef:'npzedchxfurcphvpjock',url:'https://npzedchxfurcphvpjock.supabase.co'},{url:'https://example.com'},{url:config.url+'?redirect=1'},{url:config.url+':443'},{authorized:''},{key:'sb_secret_forbidden'},{vus:10000},{duration:NaN}])assert.throws(()=>validate({...config,...patch},fixtures));
  assert.equal(validate(config,fixtures).length,1);
});
test('synthetic origin, distinct identities and valid teacher records are required',()=>{
  assert.throws(()=>validate(config,{...fixtures,synthetic:false}));
  assert.throws(()=>validate(config,{...fixtures,users:[{...fixtures.users[0],email:'real@example.com'}]}));
  assert.throws(()=>validate({...config,vus:2},{...fixtures,users:[fixtures.users[0],fixtures.users[0]]}));
  assert.throws(()=>validate({...config,scenario:'B'},{...fixtures,users:[{...fixtures.users[0],role:'teacher'}]}));
});
test('latency percentiles and failures are computed from actual requests',()=>{
  const m=new Metrics();for(let i=1;i<=100;i++)m.record('read',i,i!==100,10);
  const r=m.summary(2);assert.equal(r.requests_per_second,50);assert.equal(r.operations.read.p50_ms,50);assert.equal(r.operations.read.p95_ms,95);assert.equal(r.operations.read.p99_ms,99);assert.equal(r.error_rate,.01);assert.equal(r.response_bytes,1000);
});
test('mock transport smoke validates workload and emits no credentials or student records',async()=>{
  const paths=[];const fetcher=async(url,options)=>{paths.push(new URL(url).pathname);assert.equal(options.redirect,'error');return new Response(JSON.stringify(url.includes('/auth/')?{access_token:'mock-only-token',user:{id:id(3)}}:[]),{status:200});};
  const r=await run(config,fixtures,fetcher);assert.equal(r.status,'PASS');assert(paths.includes('/rest/v1/attendance_records'));assert.equal(r.authenticated_vus,1);const serialized=JSON.stringify(r);for(const secret of ['fixture-only','mock-only-token','student@'])assert(!serialized.includes(secret));
});
test('attendance without a complete server acknowledgement fails the workload',async()=>{
  const user={...fixtures.users[0],role:'teacher',group_id:id(4),date:'2026-11-06',records:[{student_membership_id:id(5),status:'present'}]};
  const fetcher=async(url)=>new Response(JSON.stringify(url.includes('/auth/')?{access_token:'mock',user:{id:id(3)}}:url.includes('/rpc/')?{session_id:id(6),count:0,status:'completed'}:[]));
  const r=await run({...config,scenario:'B'},{...fixtures,users:[user]},fetcher);assert.equal(r.status,'FAIL');assert.equal(r.operations.attendance.errors,1);
});
test('deployment packages runtime assets and excludes SQL, archives and private files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'noor-build-'));
  try{for(const folder of ['assets','sounds','supabase','tests','docs'])await mkdir(join(root,folder));
    for(const file of ['index.html','config.js','style.css','assets/photo.webp','sounds/tone.js','.env','dump.sql','backup.zip','create-noor-zip.js','supabase/function.ts','tests/test.js','docs/report.html'])await writeFile(join(root,file),'fixture');
    await build(root,join(root,'dist'));const entries=await readdir(join(root,'dist'));assert.deepEqual(entries.sort(),['assets','config.js','index.html','sounds','style.css']);assert.equal(await readFile(join(root,'dist/assets/photo.webp'),'utf8'),'fixture');await assert.rejects(()=>build(root,root));
  }finally{await rm(root,{recursive:true,force:true});}
});
function timetable(){
  const queries=[],listeners={},channels=[],timers=new Map();let next=0,authCallback;
  const app={user:{id:'u'},schoolId:'s',profile:{institution_id:'s'}};
  const db={auth:{getUser:async()=>({data:{user:app.user}}),onAuthStateChange(cb){authCallback=cb;return{data:{subscription:{unsubscribe(){}}}};}},from(table){const filters=[],q={select(){return q},eq(...args){filters.push(args);return q},order(){return q},single:async()=>({data:{id:'s',status:'active',timezone:'Asia/Kolkata'}}),range:async(offset)=>{queries.push({table,filters,offset});return{data:table==='teacher_timetable_periods'?Array.from({length:offset?1:500},(_,i)=>({id:String(offset+i),academic_group_id:'g',weekday:1,start_time:'09:00',end_time:'10:00'})):[]};},then(resolve){resolve({data:table==='institution_memberships'?[{id:'m',institution_id:'s',role:'teacher',status:'active'}]:[]});}};return q;},channel(){const c={on(){return c},subscribe(cb){c.status=cb;return c}};channels.push(c);return c;},removeChannel(c){c.removed=true;}};app.db=db;
  const window={NOOR_AI_APP:app,NOOR_CONFIG:{SUPABASE_URL:'https://ayrryemawwplguaauxij.supabase.co'},NOOR_SCHOOL_STRUCTURE:{fetchGroups:async()=>[{id:'g',is_active:true,group_type:'class',name:'Class'}]},dispatchEvent(){},addEventListener(name,cb){listeners[name]=cb;}};
  runInNewContext(code,{window,Intl,Date,Math,document:{hidden:false,addEventListener(){}},navigator:{onLine:true},CustomEvent:class{},setTimeout(cb){const id=++next;timers.set(id,cb);return id;},clearTimeout(id){timers.delete(id);}});
  return{api:window.NOOR_SHARED_TIMETABLE,queries,channels,timers,app,signOut(){authCallback('SIGNED_OUT',null);}};
}
test('timetable loads past 500 records, filters teacher and deduplicates concurrent reads',async()=>{
  const x=timetable();const [a,b]=await Promise.all([x.api.load(),x.api.load()]);assert.equal(a.error,null);assert.equal(a.data.length,501);assert.equal(b.data.length,501);const q=x.queries.filter(q=>q.table==='teacher_timetable_periods');assert.equal(q.length,2);assert.deepEqual(q.map(q=>q.offset),[0,500]);assert(q.every(q=>q.filters.some(([key,v])=>key==='teacher_membership_id'&&v==='m')));
});
test('realtime fallback stops after recovery and logout removes channels and timers',()=>{
  const x=timetable();x.api.subscribe();x.api.subscribe();assert.equal(x.channels.length,1);x.channels[0].status('CHANNEL_ERROR');assert.equal(x.timers.size,1);x.channels[0].status('SUBSCRIBED');assert.equal(x.timers.size,1); // one debounced recovery refresh
  x.signOut();assert(x.channels[0].removed);assert.equal(x.timers.size,0);
});
test('school switch uses a fresh request scope and removes old subscription',()=>{
  const x=timetable();x.api.subscribe();x.app.schoolId='other';x.api.subscribe();assert.equal(x.channels.length,2);assert(x.channels[0].removed);x.api.stop();assert(x.channels[1].removed);
});
