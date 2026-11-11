/* NOOR multi-channel dispatch. Server-only credentials. */
import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const REF='ayrryemawwplguaauxij',ORIGIN='https://noormanagement43.github.io';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANAGE=['principal','school_admin','university_admin','academic_admin'];
const ROLES=['student','staff','manager','parent'],MODES=['in_app','email'];
type Dict=Record<string,unknown>;
const str=(x:unknown,max:number)=>typeof x==='string'?x.trim().slice(0,max):'';
const obj=(x:unknown):x is Dict=>!!x&&typeof x==='object'&&!Array.isArray(x);
function list(x:unknown,allowed:string[]):string[]{
 if(!Array.isArray(x)||!x.length||x.length>allowed.length||!x.every(v=>typeof v==='string'&&allowed.includes(v))||new Set(x).size!==x.length)
  throw Error('Invalid selection');
 return x as string[];
}
export async function senderVerified(email:string,key:string,fetcher:typeof fetch=fetch):Promise<boolean>{
 if(!MAIL.test(email))return false;
 const r=await fetcher('https://api.brevo.com/v3/senders',{method:'GET',headers:{'api-key':key,accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!r.ok){await r.body?.cancel().catch(()=>{});return false;}
 const data=await r.json();
 return Array.isArray(data?.senders)&&data.senders.some((s:{email?:string,active?:boolean,verified?:boolean})=>
  String(s.email||'').toLowerCase()===email&&(s.active===true||s.verified===true));
}
export async function handle(req:Request):Promise<Response>{
 const origin=req.headers.get('origin'),headers:Record<string,string>={
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'
 };
 if(origin===ORIGIN)headers['Access-Control-Allow-Origin']=origin;
 const reply=(code:number,payload:unknown)=>new Response(payload===null?null:JSON.stringify(payload),{status:code,headers});
 if(origin&&origin!==ORIGIN)return reply(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return reply(204,null);
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 const bearer=req.headers.get('authorization');
 if(!bearer||!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(bearer))return reply(401,{error:'Sign in to your school first'});
 const url=Deno.env.get('SUPABASE_URL');
 let anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
 if(!anon){try{anon=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||'';}catch{}}
 if(url!=='https://'+REF+'.supabase.co'||!anon)return reply(503,{error:'Backend configuration incomplete'});
 let data:Dict;
 try{
  if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw Error();
  const raw=await req.text();if(raw.length>25000)throw Error();
  const parsed=JSON.parse(raw);if(!obj(parsed))throw Error();data=parsed;
 }catch{return reply(400,{error:'Invalid message request'});}
 if(data.action!=='dispatch')return reply(400,{error:'Unsupported action'});
 const school=str(data.institution_id,50),requestKey=str(data.request_key,50);
 if(!UUID.test(school)||!UUID.test(requestKey))return reply(400,{error:'Invalid school or message reference'});
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:bearer}}});
 const auth=await client.auth.getUser(bearer.slice(7)).catch(()=>null);
 if(!auth?.data?.user||auth.error)return reply(401,{error:'School session expired'});
 const uid=auth.data.user.id;
 const membership=await client.from('institution_memberships').select('role,status').eq('institution_id',school).eq('user_id',uid).eq('status','active').maybeSingle();
 if(membership.error||!membership.data||!MANAGE.includes(membership.data.role))return reply(403,{error:'Principal or school leadership required'});
 const inst=await client.from('institutions').select('name').eq('id',school).eq('status','active').maybeSingle();
 if(inst.error||!inst.data)return reply(403,{error:'School not available'});
 let recipients:string[],channels:string[];
 try{recipients=list(data.audience,ROLES);channels=list(data.channels,MODES);}catch{return reply(400,{error:'Choose recipients and channel'});}
 const kind=str(data.kind,20),title=str(data.title,180),message=str(data.body,20000);
 const meeting=kind==='meeting'?str(data.starts_at,50):null;
 if(!['notice','meeting','email'].includes(kind)||!title||!message||message.length>20000||
  (kind==='meeting'&&(!meeting||!Number.isFinite(Date.parse(meeting)))))
  return reply(400,{error:'Title, message or meeting time missing'});
 const srv=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!srv)return reply(503,{error:'Server service credentials unavailable'});
 const service=createClient(url,srv,{auth:{persistSession:false,autoRefreshToken:false}});
 let email:string|null=null,senderName:string|null=null,replyTo:string|null=null;
 if(channels.includes('email')){
  const brevo=Deno.env.get('BREVO_API_KEY')||Deno.env.get('brevo')||'';
  if(!brevo)return reply(503,{error:'BREVO_API_KEY_MISSING'});
  const principal=(auth.data.user.email||'').trim().toLowerCase();
  const fallback=(Deno.env.get('EMAIL_FROM')||'').trim().toLowerCase();
  try{
   if(await senderVerified(principal,brevo)){
    email=principal;senderName='Principal · '+str(inst.data.name,80);
   }else if(await senderVerified(fallback,brevo)){
    email=fallback;senderName=str(inst.data.name,80)+' · School Office';replyTo=MAIL.test(principal)?principal:null;
   }else return reply(503,{error:'BREVO_SENDER_NOT_VERIFIED',hint:'Verify principal email or EMAIL_FROM in Brevo first.'});
  }catch{return reply(503,{error:'BREVO_UNAVAILABLE'});}
 }
 const saved=await service.rpc('noor_enqueue_communication',{
  p_institution:school,p_sender:uid,p_request_key:requestKey,p_kind:kind,
  p_title:title,p_body:message,p_audience:recipients,p_channels:channels,
  p_starts_at:meeting?new Date(meeting).toISOString():null,
  p_sender_email:email,p_sender_name:senderName,p_reply_to_email:replyTo
 });
 if(saved.error){console.error('NOOR communication error',saved.error.code||'unknown');return reply(503,{error:'School message could not be saved'});}
 return reply(200,{...saved.data,email_status:channels.includes('email')?'queued_for_brevo':'not_requested',
  sender_mode:channels.includes('email')?(replyTo?'verified_sender_principal_reply_to':'verified_principal_sender'):null,
  email_delivered:false,school_scoped:true});
}
if(import.meta.main)Deno.serve(handle);
