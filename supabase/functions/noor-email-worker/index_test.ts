import {handle} from './index.ts';
function assert(v:unknown,msg='Assertion failed'):asserts v{if(!v)throw Error(msg)}
for(const scenario of ['active','school-paused','sender-paused','sender-revoked','sender-demoted','lookup-error','feature-disabled','billing-paused']){
 Deno.test('queued delivery rechecks current school and sender: '+scenario,async()=>{
  const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','BREVO_API_KEY'];
  const original=names.map(x=>Deno.env.get(x)),oldFetch=globalThis.fetch;
  let sends=0;const states:string[]=[];
  try{
   Deno.env.set('SUPABASE_URL','https://ayrryemawwplguaauxij.supabase.co');
   Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-service');Deno.env.set('BREVO_API_KEY','test-only');
   globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(String(input));
    if(url.hostname==='api.brevo.com'){sends++;return Response.json({messageId:'test-only-id'});}
    if(url.pathname.endsWith('/rpc/noor_validate_worker_token'))return Response.json(true);
    if(url.pathname.endsWith('/rpc/noor_claim_mail_batch'))return Response.json([{queue_id:1,campaign_id:'campaign',institution_id:'school',recipient_user_id:'11111111-1111-4111-8111-111111111111',title:'Test',body:'Test',kind:'notice',starts_at:null,sender_email:'office@example.invalid',sender_name:'Office',reply_to_email:null,attempts:1}]);
    if(url.pathname.endsWith('/rpc/noor_refresh_campaign_counts'))return Response.json(null);
    if(url.pathname.endsWith('/noor_school_campaigns')){assert(url.searchParams.get('institution_id')==='eq.school');return Response.json({created_by:'sender',audience:['student'],channels:['email']});}
    if(url.pathname.endsWith('/noor_institute_billing'))return Response.json([{paused:scenario==='billing-paused'}]);
    if(url.pathname.endsWith('/noor_feature_overrides'))return Response.json([]);
    if(url.pathname.endsWith('/noor_feature_defaults'))return Response.json({enabled:scenario!=='feature-disabled'});
    if(url.pathname.endsWith('/institutions')){assert(url.searchParams.get('id')==='eq.school');return Response.json([{status:scenario==='school-paused'?'suspended':'active'}]);}
    if(url.pathname.endsWith('/institution_memberships')){
     assert(url.searchParams.get('institution_id')==='eq.school');
     if(url.searchParams.get('user_id')==='eq.11111111-1111-4111-8111-111111111111')return Response.json([{role:'student',status:'active'}]);
     assert(url.searchParams.get('user_id')==='eq.sender','Must authorize campaign creator');
     if(scenario==='lookup-error')return Response.json({message:'Unavailable'},{status:500});
     return Response.json([{role:scenario==='sender-demoted'?'teacher':'principal',status:scenario==='sender-paused'?'suspended':scenario==='sender-revoked'?'revoked':'active'}]);
    }
    if(url.pathname.endsWith('/auth/v1/admin/users/11111111-1111-4111-8111-111111111111'))return Response.json({id:'11111111-1111-4111-8111-111111111111',email:'recipient@example.invalid',email_confirmed_at:'2026-11-01T00:00:00Z'});
    if(url.pathname.endsWith('/noor_email_queue')&&init?.method==='PATCH'){const patch=JSON.parse(String(init.body));states.push(patch.status);return new Response(null,{status:204});}
    throw Error('Unexpected request');
   };
   const response=await handle(new Request('https://example.invalid',{method:'POST',headers:{'x-noor-worker-token':'a'.repeat(64)},body:'{}'}));
   assert(response.status===200);
   assert(sends===(scenario==='active'?1:0),'Inactive or unverified authority must never send');
   assert(states.includes(scenario==='active'?'accepted':scenario==='lookup-error'?'queued':'skipped'),'Expected delivery disposition');
  }finally{globalThis.fetch=oldFetch;names.forEach((name,i)=>original[i]===undefined?Deno.env.delete(name):Deno.env.set(name,original[i]!));}
 });
}
Deno.test('worker fails closed without internal token',async()=>{
 const req=new Request('https://example.test/functions/v1/noor-email-worker',{method:'POST',body:'{}'});
 const res=await handle(req);
 if(res.status!==401)throw Error('Missing worker token was accepted');
});
Deno.test('worker rejects malformed token before reading service role key',async()=>{
 const req=new Request('https://example.test/functions/v1/noor-email-worker',{method:'POST',headers:{'x-noor-worker-token':'fake'},body:'{}'});
 const res=await handle(req);if(res.status!==401)throw Error('Malformed token was accepted');
});
