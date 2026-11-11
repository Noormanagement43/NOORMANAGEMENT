import {handle} from './index.ts';
Deno.test('worker fails closed without internal token',async()=>{
 const req=new Request('https://example.test/functions/v1/noor-email-worker',{method:'POST',body:'{}'});
 const res=await handle(req);
 if(res.status!==401)throw Error('Missing worker token was accepted');
});
Deno.test('worker rejects malformed token before reading service role key',async()=>{
 const req=new Request('https://example.test/functions/v1/noor-email-worker',{method:'POST',headers:{'x-noor-worker-token':'fake'},body:'{}'});
 const res=await handle(req);if(res.status!==401)throw Error('Malformed token was accepted');
});
