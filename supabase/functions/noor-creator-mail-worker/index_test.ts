import {handle} from './index.ts';
Deno.test('creator email worker rejects browser-style requests before dispatch',async()=>{const r=await handle(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer fake'}}));if(r.status!==401)throw Error('Expected worker credential rejection');});
Deno.test('creator email worker never sends mail on GET',async()=>{const r=await handle(new Request('https://example.invalid'));if(r.status!==405)throw Error('Expected POST restriction');});
