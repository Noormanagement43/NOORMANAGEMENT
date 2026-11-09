import {checkBrevoEmailReadiness} from './brevo-email.ts';
function ok(value:unknown,msg='assertion failed'){if(!value)throw Error(msg);}
Deno.test('Brevo readiness never sends and missing secrets fail closed',async()=>{
 let calls=0;const r=await checkBrevoEmailReadiness({},async()=>{calls++;throw Error('should not fetch')});
 ok(calls===0);ok(!r.delivery_ready&&!r.api_key_present&&r.reason==='BREVO_API_KEY_MISSING'&&r.email_sent===false);
});
Deno.test('Brevo account may authenticate but delivery is blocked without configured sender',async()=>{
 const seen:string[]=[];const result=await checkBrevoEmailReadiness({brevo:'secret'},async(url,opts)=>{
  seen.push(String(url));ok(opts?.method==='GET');ok((opts?.headers as Record<string,string>)['api-key']==='secret');return new Response(null,{status:200});
 });
 ok(result.account_authenticated&&result.reason==='EMAIL_FROM_MISSING'&&!result.delivery_ready&&!result.email_sent);
 ok(seen.length===1&&seen[0]==='https://api.brevo.com/v3/account');
});
Deno.test('verified sender detection does not return sender email or secrets',async()=>{
 const result=await checkBrevoEmailReadiness({brevo:'SECRET',EMAIL_FROM:'safe@example.invalid'},async(url)=>{
  if(String(url).endsWith('/account'))return new Response('',{status:200});
  return Response.json({senders:[{email:'safe@example.invalid',active:true,name:'Demo'}, {email:'private@example.invalid',active:true}]});
 });
 ok(result.delivery_ready&&result.sender_registered&&result.sender_verified&&result.email_sent===false);
 ok(!JSON.stringify(result).includes('SECRET')&&!JSON.stringify(result).includes('example.invalid'));
});
Deno.test('invalid credentials and unverified sender fail closed',async()=>{
 const invalid=await checkBrevoEmailReadiness({BREVO_API_KEY:'bad',EMAIL_FROM:'safe@example.invalid'},async()=>new Response(null,{status:401}));
 ok(!invalid.delivery_ready&&invalid.reason==='BREVO_API_KEY_REJECTED');
 const unverified=await checkBrevoEmailReadiness({brevo:'secret',EMAIL_FROM:'safe@example.invalid'},async(url)=>
  String(url).endsWith('/account')?new Response(null,{status:200}):Response.json({senders:[{email:'safe@example.invalid',active:false}]}));
 ok(unverified.sender_registered&&!unverified.sender_verified&&!unverified.delivery_ready);
});
