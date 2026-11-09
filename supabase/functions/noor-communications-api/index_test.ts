import {handle,senderVerified} from './index.ts';
function yes(x:unknown,msg='assertion failed'){if(!x)throw Error(msg)}
Deno.test('message dispatch fails closed without a JWT',async()=>{
 const req=new Request('https://example.test/functions/v1/noor-communications-api',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 const r=await handle(req);yes(r.status===401);
});
Deno.test('wrong-site origin is rejected before any backend reads',async()=>{
 const req=new Request('https://example.test',{method:'POST',headers:{origin:'https://unrelated.example',authorization:'Bearer invalidtokenxxxxxxxxxxxxxxxxxxxx'},body:'{}'});
 const r=await handle(req);yes(r.status===403);
});
Deno.test('sender must actually be registered and active in Brevo',async()=>{
 const request=async(_url:string,init?:RequestInit)=>{
  yes(init?.method==='GET');return Response.json({senders:[{email:'principal@example.invalid',active:true},{email:'other@example.invalid',active:false}]});
 };
 yes(await senderVerified('principal@example.invalid','test-key',request as typeof fetch));
 yes(!(await senderVerified('other@example.invalid','test-key',request as typeof fetch)));
 yes(!(await senderVerified('fake@example.invalid','test-key',request as typeof fetch)));
});
Deno.test('status checks never issue Brevo email sends',async()=>{
 let calls=0;const request=async(_url:string,init?:RequestInit)=>{
  calls++;yes(init?.method==='GET');return Response.json({senders:[]});
 };
 await senderVerified('principal@example.invalid','test-key',request as typeof fetch);
 yes(calls===1);
});
