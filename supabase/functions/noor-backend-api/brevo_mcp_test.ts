const assert = Object.assign((v: unknown) => {if(!v) throw Error('Assertion failed');}, {equal: (a: unknown,b: unknown)=>{if(a!==b)throw Error('Values differ');},deepEqual:(a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Structures differ');}});
import {probeBrevoMcp,resolveMcpToken,BREVO_MCP_URL} from './brevo-mcp.ts';
Deno.test('secret aliases support user spelling; conflicts fail closed',()=>{
 assert.equal(resolveMcpToken({'Brivo MCB':'private'}).token,'private');
 assert.equal(resolveMcpToken({BREVO_MCP_TOKEN:'a',brivo_mcb:'b'}).conflict,true);
 assert.equal(resolveMcpToken({brevo:'REST',SUPABASE_SERVICE_ROLE_KEY:'private'}).detected,false);
});
Deno.test('missing/conflicting credentials make no requests',async()=>{
 const noFetch=()=>{throw Error('Network forbidden');};
 assert.equal((await probeBrevoMcp({},noFetch)).error,'MCP_SECRET_NOT_FOUND');
 assert.equal((await probeBrevoMcp({BREVO_MCP_TOKEN:'a',brivo_mcb:'b'},noFetch)).error,'SECRET_ALIAS_CONFLICT');
});
for (const sse of [false,true]) Deno.test('handshake and listing only, session forwarded, sanitized '+sse,async()=>{
 const calls: string[]=[];
 const r=await probeBrevoMcp({'Brivo MCB':'PRIVATE'},async(url,opts)=>{
  assert.equal(url,BREVO_MCP_URL);assert.equal(opts!.redirect,'error');assert.equal((opts!.headers as Record<string,string>).Authorization,'Bearer PRIVATE');
  const b=JSON.parse(opts!.body as string);calls.push(b.method);
  if(b.method!=='initialize') assert.equal((opts!.headers as Record<string,string>)['Mcp-Session-Id'],'SESSION');
  if(b.method==='notifications/initialized')return new Response(null,{status:202});
  const value={jsonrpc:'2.0',id:b.id,result:b.method==='initialize'?{protocolVersion:'2025-03-26'}:{tools:[{name:'private_tool',description:'DO NOT EXPOSE'}]}};
  return new Response(sse?`event: message\ndata: ${JSON.stringify(value)}\n\n`:JSON.stringify(value),{headers:{'content-type':sse?'text/event-stream':'application/json','Mcp-Session-Id':'SESSION'}});
 });
 assert.deepEqual(calls,['initialize','notifications/initialized','tools/list']);
 assert.equal(r.tools_list_successful,true);assert.equal(r.tool_count,1);
 assert(!JSON.stringify(r).includes('PRIVATE'));assert(!JSON.stringify(r).includes('DO NOT EXPOSE'));
});
Deno.test('provider auth errors are sanitized',async()=>{
 const r=await probeBrevoMcp({BREVO_MCP_TOKEN:'private'},async()=>new Response('credential private',{status:401}));
 assert.equal(r.error,'HTTP_401');assert.equal(r.authentication_successful,false);assert(!JSON.stringify(r).includes('private'));
});
Deno.test('HTTP success with RPC error is not a valid connection',async()=>{
 const r=await probeBrevoMcp({BREVO_MCP_TOKEN:'private'},async()=>Response.json({jsonrpc:'2.0',id:1,error:{message:'private'}}));
 assert.equal(r.error,'RPC_ERROR');assert.equal(r.handshake_successful,false);
});
