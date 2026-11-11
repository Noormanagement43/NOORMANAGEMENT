/* Public password recovery: email ownership is proved by Supabase OTP before any password change. */
import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const PROJECT='https://ayrryemawwplguaauxij.supabase.co';
const ORIGIN='https://noormanagement43.github.io';
const RESET=ORIGIN+'/NOORMANAGEMENT/forgot-password.html';
const PUBLIC_KEY='sb_publishable_2e16MAulIE1locqlRov9iQ_VWtCjwOG';
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function handle(req:Request,dependencies?:{env:(name:string)=>string|undefined;client:typeof createClient;request:typeof fetch}):Promise<Response>{
 const env=dependencies?.env||((name:string)=>Deno.env.get(name));
 const request=dependencies?.request||fetch;
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(req.headers.get('origin')!==ORIGIN)return response(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response(405,{error:'Method not allowed'});
 // The public API key identifies this application; durable limits protect this pre-login endpoint.
 if(req.headers.get('apikey')!==PUBLIC_KEY)return response(401,{error:'Application key required'});
 const raw=await req.text();if(raw.length>1024)return response(413,{error:'Request too large'});
 let email:string;try{email=String(JSON.parse(raw).email||'').trim().toLowerCase();}catch{return response(400,{error:'Invalid request'});}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return response(400,{error:'Enter a valid email'});
 const service=env('SUPABASE_SERVICE_ROLE_KEY'),brevo=env('BREVO_API_KEY')||env('brevo');
 if(env('SUPABASE_URL')!==PROJECT||!service||!brevo)return response(503,{error:'Recovery email is temporarily unavailable'});
 const db=(dependencies?.client||createClient)(PROJECT,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const limit=await db.rpc('noor_auth_recovery_limit',{p_email:await hash(email),p_ip:await hash(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown')});
 if(limit.error)return response(503,{error:'Recovery email is temporarily unavailable'});
 if(limit.data!==true)return response(429,{error:'Wait before requesting another recovery email'});
 try{
  // Only a registered, active sender from the same Brevo account can send recovery emails.
  const senders=await request('https://api.brevo.com/v3/senders',{headers:{'api-key':brevo,accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!senders.ok)throw Error('Sender unavailable');
  const data=await senders.json();const active=(data.senders||[]).filter((s:{email?:string;active?:boolean;verified?:boolean})=>s.email&&(s.active===true||s.verified===true));
  const configured=env('EMAIL_FROM')?.trim().toLowerCase();
  const sender=configured?active.find((s:{email:string})=>s.email.toLowerCase()===configured):active.find((s:{email:string})=>s.email.toLowerCase()==='noormanagement43@gmail.com')||(active.length===1?active[0]:null);
  if(!sender)throw Error('Verified sender unavailable');
  const link=await db.auth.admin.generateLink({type:'recovery',email,options:{redirectTo:RESET}});
  // Identical response for an unknown email. Never return tokens or user existence.
  if(link.error){if(link.error.code==='user_not_found'||link.error.status===404)return response(200,{requested:true});throw Error('Recovery unavailable');}
  const properties=link.data?.properties;if(!properties?.email_otp||!properties?.hashed_token)throw Error('Recovery unavailable');
  // Direct first-party link avoids the project's incorrect localhost fallback entirely.
  const url=RESET+'#type=recovery&token_hash='+encodeURIComponent(properties.hashed_token);
  const sent=await request('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':brevo,'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{email:sender.email,name:'NOOR School Management'},to:[{email}],subject:'Your NOOR password reset code',textContent:'Your NOOR verification code: '+properties.email_otp+'\n\nEnter this code on the password reset page, or open:\n'+url+'\n\nIf you did not request this, ignore this email. Never share your code.',tags:['noor-password-recovery']}),signal:AbortSignal.timeout(20000)});
  if(!sent.ok){await sent.body?.cancel();throw Error('Email provider unavailable');}
  await sent.body?.cancel();return response(200,{requested:true});
 }catch{return response(503,{error:'Recovery email could not be sent. Please retry shortly.'});}
}
if(import.meta.main)Deno.serve(req=>handle(req));
