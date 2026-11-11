/* Internal scheduled NOOR Brevo email worker. No browser-accessible sending endpoint. */
import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const URL='https://ayrryemawwplguaauxij.supabase.co',mail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recipientRoles=(roles:string[],role:string)=>
 (roles.includes('student')&&['student','university_student'].includes(role))||
 (roles.includes('staff')&&['teacher','faculty','staff'].includes(role))||
 (roles.includes('manager')&&['school_admin','university_admin','academic_admin','finance_admin'].includes(role))||
 (roles.includes('parent')&&role==='parent');
type QueueItem={queue_id:number,campaign_id:string,institution_id:string,recipient_user_id:string,title:string,body:string,kind:string,starts_at:string|null,sender_email:string|null,sender_name:string|null,reply_to_email:string|null,attempts:number};
export async function handle(req:Request):Promise<Response>{
 const res=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return res(405,{error:'Method not allowed'});
 const token=req.headers.get('x-noor-worker-token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return res(401,{error:'Unauthorized'});
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(Deno.env.get('SUPABASE_URL')!==URL||!key)return res(503,{error:'Worker unavailable'});
 const db=createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await db.rpc('noor_validate_worker_token',{p_token:token});
 if(auth.error||auth.data!==true)return res(401,{error:'Unauthorized'});
 const brevo=Deno.env.get('BREVO_API_KEY')||Deno.env.get('brevo')||'';
 if(!brevo)return res(503,{error:'Brevo not configured'});
 const claimed=await db.rpc('noor_claim_mail_batch',{p_limit:50});
 if(claimed.error)return res(503,{error:'Queue unavailable'});
 const rows=(claimed.data||[]) as QueueItem[],campaigns=new Map<string,QueueItem[]>();
 for(const row of rows){const x=campaigns.get(row.campaign_id)||[];x.push(row);campaigns.set(row.campaign_id,x);}
 let accepted=0,failed=0,retry=0;
 async function state(row:QueueItem,status:'accepted'|'failed'|'skipped'|'queued',msgid?:string,code?:string){
  const patch:Record<string,unknown>={status,updated_at:new Date().toISOString(),claimed_until:null,error_code:code||null};
  if(msgid)patch.provider_message_id=msgid;
  if(status==='queued')patch.retry_at=new Date(Date.now()+Math.min(120,2**Math.min(7,row.attempts))*60*1000).toISOString();
  const q=await db.from('noor_email_queue').update(patch).eq('id',row.queue_id).eq('status','sending');
  if(q.error)throw q.error;
 }
 const emailFor=async(row:QueueItem,validRoles:string[])=>{
  const m=await db.from('institution_memberships').select('role,status').eq('institution_id',row.institution_id).eq('user_id',row.recipient_user_id).eq('status','active').maybeSingle();
  if(m.error||!m.data||!recipientRoles(validRoles,m.data.role))return null;
  const user=await db.auth.admin.getUserById(row.recipient_user_id);
  const u=user.data?.user;
  if(user.error||!u?.email_confirmed_at||!mail.test(u.email||''))return null;
  return u.email!.trim().toLowerCase();
 };
 for(const [campaignId,items] of campaigns){
  try{
   const c=await db.from('noor_school_campaigns').select('audience,channels,created_by').eq('id',campaignId).eq('institution_id',items[0].institution_id).single();
   if(c.error||!c.data||!c.data.channels.includes('email'))throw Error('Invalid campaign');
   const approved:Array<{item:QueueItem,email:string}>=[];
   for(const item of items){
    const email=await emailFor(item,c.data.audience);
    if(!email){await state(item,'skipped',undefined,'MEMBERSHIP_OR_EMAIL_UNAVAILABLE');failed++;continue;}
    approved.push({item,email});
   }
   if(!approved.length){await db.rpc('noor_refresh_campaign_counts',{p_campaign:campaignId});continue;}
   const top=items[0];
   if(!top.sender_email||!mail.test(top.sender_email))throw Error('Sender unavailable');
   // Queue claims use service_role, so recheck current authority immediately
   // before contacting Brevo, even when dispatch was authorized earlier.
   const school=await db.from('institutions').select('status').eq('id',top.institution_id).maybeSingle();
   const sender=await db.from('institution_memberships').select('role,status').eq('institution_id',top.institution_id).eq('user_id',c.data.created_by).maybeSingle();
   if(school.error||sender.error)throw Error('Current authorization unavailable');
   if(school.data?.status!=='active'||sender.data?.status!=='active'||!['principal','school_admin','university_admin','academic_admin'].includes(sender.data?.role)){
    for(const x of approved){await state(x.item,'skipped',undefined,'SCHOOL_OR_SENDER_INACTIVE');failed++;}
    await db.rpc('noor_refresh_campaign_counts',{p_campaign:campaignId});
    continue;
   }
   const payload:Record<string,unknown>={
    sender:{email:top.sender_email,name:top.sender_name||'NOOR School Office'},
    subject:top.title,
    textContent:top.body+(top.kind==='meeting'&&top.starts_at?'\n\nMeeting date: '+new Date(top.starts_at).toISOString():''),
    messageVersions:approved.map(x=>({to:[{email:x.email}]})),
    tags:['noor-school','school-'+items[0].institution_id.slice(0,8)],
    headers:{IdempotencyKey:campaignId+'-'+approved.map(x=>x.item.queue_id).join('-').slice(0,80)}
   };
   if(top.reply_to_email&&mail.test(top.reply_to_email))payload.replyTo={email:top.reply_to_email};
   const response=await fetch('https://api.brevo.com/v3/smtp/email',{
    method:'POST',headers:{'api-key':brevo,accept:'application/json','Content-Type':'application/json'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)
   });
   if(!response.ok){
    await response.body?.cancel().catch(()=>{});
    const transient=response.status===429||response.status>=500;
    for(const x of approved){const again=transient&&x.item.attempts<4;await state(x.item,again?'queued':'failed',undefined,transient?'BREVO_RETRY':'BREVO_REJECTED');if(again)retry++;else failed++;}
   }else{
    const result=await response.json();
    const ids=Array.isArray(result.messageIds)?result.messageIds:[result.messageId];
    for(let i=0;i<approved.length;i++){
     await state(approved[i].item,'accepted',String(ids[i]||'').slice(0,200),'BREVO_ACCEPTED');accepted++;
    }
   }
  }catch{
   for(const item of items){
    const again=item.attempts<4;
    try{await state(item,again?'queued':'failed',undefined,'DELIVERY_UNAVAILABLE');if(again)retry++;else failed++;}catch{}
   }
  }
  try{await db.rpc('noor_refresh_campaign_counts',{p_campaign:campaignId});}catch{}
 }
 // Accepted by Brevo does NOT mean delivered to the inbox.
 return res(200,{processed:rows.length,accepted_by_provider:accepted,failed_or_skipped:failed,retry_scheduled:retry});
}
if(import.meta.main)Deno.serve(handle);
