import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const URL='https://ayrryemawwplguaauxij.supabase.co';
export async function handle(req:Request):Promise<Response>{
 const response=(status:number,x:unknown)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return response(405,{error:'POST required'});
 const token=req.headers.get('x-noor-worker-token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return response(401,{error:'Unauthorized'});
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(Deno.env.get('SUPABASE_URL')!==URL||!key)return response(503,{error:'Worker unavailable'});
 const db=createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const authorized=await db.rpc('noor_validate_worker_token',{p_token:token});
 if(authorized.error||authorized.data!==true)return response(401,{error:'Unauthorized'});
 const prepared=await db.rpc('noor_creator_prepare_reminders');
 if(prepared.error)return response(503,{error:'Reminder preparation unavailable'});
 const brevo=Deno.env.get('BREVO_API_KEY')||Deno.env.get('brevo');
 const sender=Deno.env.get('EMAIL_FROM')||Deno.env.get('BREVO_FROM_EMAIL');
 if(!brevo||!sender||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))return response(503,{error:'Verified email sender is not configured'});
 const ready=await fetch('https://api.brevo.com/v3/senders',{headers:{'api-key':brevo},signal:AbortSignal.timeout(10000)});
 if(!ready.ok)return response(503,{error:'Sender verification unavailable'});
 const senders=await ready.json();
 if(!senders.senders?.some((s:{email:string,active:boolean})=>s.email?.toLowerCase()===sender.toLowerCase()&&s.active))return response(503,{error:'Sender is not verified'});
 const claim=await db.rpc('noor_creator_claim_mail');if(claim.error)return response(503,{error:'Queue unavailable'});
 let accepted=0,failed=0;
 for(const item of claim.data||[]){
 let status='skipped',code='RECIPIENT_UNAVAILABLE',provider_id:null|string=null;
 if(item.eligible){try{
 const sent=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':brevo,'Content-Type':'application/json'},body:JSON.stringify({sender:{email:sender,name:'NOOR Management'},to:[{email:item.email}],subject:item.title,textContent:item.body,headers:{IdempotencyKey:item.id}}),signal:AbortSignal.timeout(20000)});
 if(sent.ok){const result=await sent.json();provider_id=String(result.messageId||'').slice(0,200);status='accepted';code='PROVIDER_ACCEPTED';accepted++;}
 else{status=(sent.status===429||sent.status>=500)&&item.attempts<4?'queued':'failed';code='PROVIDER_REJECTED';await sent.body?.cancel();failed++;}
 }catch{status=item.attempts<4?'queued':'failed';code='DELIVERY_UNAVAILABLE';failed++;}}
 await db.from('noor_creator_deliveries').update({email_status:status,error_code:code,provider_id,retry_at:new Date(Date.now()+Math.min(60,2**item.attempts)*60000).toISOString()}).eq('id',item.id).eq('email_status','sending');
 }
 return response(200,{processed:claim.data?.length||0,accepted_by_provider:accepted,failed_or_retry:failed});
}
if(import.meta.main)Deno.serve(handle);
