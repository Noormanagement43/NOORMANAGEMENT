// Staging-only HTTP workload, no dependencies. Output contains aggregate metrics only.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
const production='ayrryemawwplguaauxij';
const scenarios={A:100,B:500,C:1000,D:5000,E:10000};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
export function validate(config,fixtures){
  const u=new URL(config.url);
  if(config.url!==u.origin||u.protocol!=='https:'||u.hostname!==`${config.projectRef}.supabase.co`||u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Exact HTTPS staging Supabase origin required');
  if(!/^[a-z]{20}$/.test(config.projectRef)||config.projectRef===production||config.projectRef==='npzedchxfurcphvpjock')throw Error('Production and obsolete projects are forbidden');
  if(config.authorized!==config.projectRef||fixtures.project_ref!==config.projectRef||fixtures.synthetic!==true)throw Error('Confirm the staging reference and synthetic fixture origin');
  if(!Number.isInteger(config.vus)||config.vus<1||config.vus>10000||!Number.isFinite(config.duration)||config.duration<1||config.duration>900)throw Error('Invalid workload bounds');
  if(config.vus>=5000&&config.highLoad!==config.projectRef)throw Error('High concurrency requires explicit infrastructure and budget acknowledgement');
  if(!Number.isFinite(config.rampMs)||config.rampMs<0||config.rampMs>1000)throw Error('Invalid ramp interval');
  if(!config.key?.startsWith('sb_publishable_'))throw Error('Use a staging publishable key, never a privileged key');
  const users=fixtures.users;
  if(!Array.isArray(users)||users.length<config.vus)throw Error('Supply one distinct synthetic account per virtual user');
  if(new Set(users.map(x=>x.email)).size!==users.length)throw Error('Synthetic accounts must be distinct');
  for(const user of users){
    if(!/@[^@]+\.test$/.test(user.email||'')||!user.password||!uuid(user.institution_id)||!uuid(user.membership_id)||!['student','teacher','principal'].includes(user.role))throw Error('Invalid synthetic user fixture');
    if(user.role==='teacher'&&config.scenario!=='A'){
      if(!uuid(user.group_id)||!/^\d{4}-\d{2}-\d{2}$/.test(user.date||'')||!Array.isArray(user.records)||!user.records.length||user.records.length>500||user.records.some(r=>!uuid(r.student_membership_id)||!['present','absent','late','leave'].includes(r.status)))throw Error('Teacher attendance fixture required');
    }
  }
  const selected=users.slice(0,config.vus);
  if(config.scenario==='B'&&!selected.some(u=>u.role==='teacher'))throw Error('Morning peak requires teachers');
  if(['C','D','E'].includes(config.scenario)&&(new Set(selected.map(u=>u.institution_id)).size<2||new Set(selected.map(u=>u.role)).size<3))throw Error('Mixed scenario requires multiple schools and all three roles');
  return selected;
}
export class Metrics{
  constructor(){this.ops={};this.count=0;this.errors=0;this.bytes=0;}
  record(name,ms,ok,bytes=0){const op=this.ops[name]??={requests:0,errors:0,bins:new Map()};op.requests++;if(!ok){op.errors++;this.errors++;}const bin=Math.ceil(ms);op.bins.set(bin,(op.bins.get(bin)||0)+1);this.count++;this.bytes+=bytes;}
  summary(seconds){const operations={};for(const [name,o]of Object.entries(this.ops)){
    const sorted=[...o.bins].sort((a,b)=>a[0]-b[0]);const percentile=p=>{let n=0;for(const [ms,count]of sorted){n+=count;if(n>=Math.ceil(o.requests*p))return ms;}return null;};
    operations[name]={requests:o.requests,errors:o.errors,error_rate:o.errors/o.requests,p50_ms:percentile(.5),p95_ms:percentile(.95),p99_ms:percentile(.99)};
  }return{requests:this.count,requests_per_second:this.count/seconds,error_rate:this.count?this.errors/this.count:null,response_bytes:this.bytes,network_bytes_per_second:this.bytes/seconds,operations};}
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function run(config,fixtures,fetcher=fetch){
  const users=validate(config,fixtures),metrics=new Metrics(),start=performance.now();let circuit=false;
  async function request(name,path,token,body){
    const begun=performance.now();let data=null,ok=false;
    try{
      const response=await fetcher(config.url+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:config.key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
      const text=await response.text();try{data=JSON.parse(text);}catch{}
      ok=response.ok&&data!==null;
      if(name==='login')ok=ok&&typeof data.access_token==='string'&&uuid(data.user?.id);
      if(name==='attendance')ok=ok&&uuid(data.session_id)&&data.count===body.p_records.length&&data.status==='completed';
      metrics.record(name,performance.now()-begun,ok,Buffer.byteLength(text));
    }catch{metrics.record(name,performance.now()-begun,false);}
    if(metrics.count>=100&&metrics.errors/metrics.count>.10)circuit=true;
    return ok?data:null;
  }
  await Promise.all(users.map(async(user,index)=>{
    await wait(index*config.rampMs);if(circuit)return;
    const auth=await request('login','/auth/v1/token?grant_type=password',null,{email:user.email,password:user.password});if(!auth)return;
    const token=auth.access_token,end=performance.now()+config.duration*1000;
    while(performance.now()<end&&!circuit){
      await request('membership',`/rest/v1/institution_memberships?select=id,role,status&institution_id=eq.${user.institution_id}&user_id=eq.${auth.user.id}&limit=1`,token);
      const owner=user.role==='teacher'?`&teacher_membership_id=eq.${user.membership_id}`:'';
      await request('timetable',`/rest/v1/teacher_timetable_periods?select=id,academic_group_id,period_number,start_time,end_time,subject_name&institution_id=eq.${user.institution_id}${owner}&order=id&limit=100`,token);
      if(user.role==='student')await request('student_attendance',`/rest/v1/attendance_records?select=attendance_status,marked_at&institution_id=eq.${user.institution_id}&student_membership_id=eq.${user.membership_id}&order=marked_at.desc,id.desc&limit=50`,token);
      if(user.role==='principal')await request('principal_groups',`/rest/v1/academic_groups?select=id,name,group_type&institution_id=eq.${user.institution_id}&order=id&limit=100`,token);
      if(user.role==='teacher'&&config.scenario!=='A')await request('attendance','/rest/v1/rpc/noor_save_class_register',token,{p_institution:user.institution_id,p_group:user.group_id,p_date:user.date,p_records:user.records});
      await wait(1000+index%1000);
    }
  }));
  const seconds=(performance.now()-start)/1000,summary=metrics.summary(seconds);
  const budgets=Object.entries(summary.operations).every(([name,o])=>o.error_rate<.01&&o.p95_ms<(name==='login'?1500:800));
  return{kind:'staging-http-workload',scenario:config.scenario,configured_vus:config.vus,authenticated_vus:summary.operations.login?summary.operations.login.requests-summary.operations.login.errors:0,elapsed_seconds:seconds,circuit_breaker:circuit,status:!circuit&&budgets?'PASS':'FAIL',...summary,limitations:['HTTP workload subset; not a full browser dashboard benchmark','No warm cache p95 or 200ms UI measurement','CPU, memory, DB connections, disk IO, Realtime stability and queue backlog require synchronized server telemetry','Load generator CPU, event-loop lag and network must be recorded; a saturated generator invalidates capacity conclusions']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const e=process.env,scenario=e.NOOR_LOAD_SCENARIO||'A';
  if(!scenarios[scenario])throw Error('Choose scenario A–E');
  const config={url:e.NOOR_STAGING_URL,projectRef:e.NOOR_STAGING_PROJECT_REF,authorized:e.NOOR_LOAD_AUTHORIZED,key:e.NOOR_STAGING_PUBLISHABLE_KEY,highLoad:e.NOOR_HIGH_LOAD_ACK,scenario,vus:scenarios[scenario],duration:Number(e.NOOR_LOAD_SECONDS||60),rampMs:Number(e.NOOR_LOAD_RAMP_MS||50)};
  const fixtures=JSON.parse(await readFile(e.NOOR_LOAD_FIXTURES,'utf8'));
  const report=await run(config,fixtures);await writeFile(e.NOOR_LOAD_OUTPUT||'load-results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,scenario,requests:report.requests}));if(report.status==='FAIL')process.exitCode=1;
}
