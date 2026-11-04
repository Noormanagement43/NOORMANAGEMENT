import { handle, readBody, PROJECT_REF } from './index.ts';
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }
const endpoint = 'https://example.invalid/functions/v1/noor-backend-api';
const request = (body: unknown, path = '') => new Request(endpoint + path, { method: 'POST', headers: { authorization: 'Bearer test.user.jwt', 'content-type': 'application/json' }, body: JSON.stringify(body) });

Deno.test('HTTP boundary rejects foreign origin, missing JWT and unsupported methods', async () => {
 assert((await handle(new Request(endpoint, { method: 'POST', headers: { origin: 'https://noormanagement43.github.io.attacker.invalid' } }))).status === 403);
 assert((await handle(new Request(endpoint, { method: 'POST' }))).status === 401);
 assert((await handle(new Request(endpoint))).status === 405);
 const preflight = await handle(new Request(endpoint, { method: 'OPTIONS', headers: { origin: 'https://noormanagement43.github.io' } }));
 assert(preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === 'https://noormanagement43.github.io');
});
Deno.test('body reader rejects oversized chunked input and non-object JSON', async () => {
 for (const value of [[],null,'text']) {
  let denied = false;
  try { await readBody(request(value)); } catch { denied = true; }
  assert(denied,'Non-object JSON accepted');
 }
 const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(25*1024)); controller.close(); } });
 let denied = false;
 try { await readBody(new Request(endpoint,{ method:'POST',headers:{'content-type':'application/json'},body:stream })); } catch { denied = true; }
 assert(denied,'Unbounded streaming body accepted');
});
Deno.test('authenticated status reveals booleans only; MCP never advertises external execution', async () => {
 const names = ['SUPABASE_URL','SUPABASE_ANON_KEY','GEMINI_API_KEY','OPENAI_API_KEY','ANTHROPIC_API_KEY','BREVO_API_KEY'];
 const previous = names.map(n => Deno.env.get(n));
 const previousFetch = globalThis.fetch;
 try {
  Deno.env.set('SUPABASE_URL',`https://${PROJECT_REF}.supabase.co`);
  Deno.env.set('SUPABASE_ANON_KEY','test-public-key');
  Deno.env.set('GEMINI_API_KEY','test-secret-must-never-appear');
  globalThis.fetch = async (input) => {
   const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
   assert(url.endsWith('/auth/v1/user'),'Unexpected network request: '+url);
   return new Response(JSON.stringify({ id:'41000000-0000-4000-8000-000000000001',email:'test@example.invalid',aud:'authenticated',role:'authenticated' }),{status:200,headers:{'content-type':'application/json'}});
  };
  const response = await handle(request({action:'status'}));
  assert(response.status===200);
  const text = await response.text();
  assert(!text.includes('test-secret-must-never-appear'),'Provider key leaked');
  const status = JSON.parse(text);
  assert(status.provider_secrets_present.gemini===true && status.external_task_execution_enabled===false && status.mcp.external_oauth_ready===false);
  const init = await handle(request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}},'/mcp'));
  assert((await init.json()).result.serverInfo.name==='noor-internal-gateway');
  const listed = await handle(request({jsonrpc:'2.0',id:2,method:'tools/list'},'/mcp'));
  const toolList = (await listed.json()).result.tools;
  assert(toolList.length===3 && toolList.every((t:{name:string})=>!t.name.includes('send')));
  const invalid = await handle(request({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'noor_draft_task',arguments:{institution_id:'attacker-filter'}}},'/mcp'));
  assert((await invalid.json()).error.code===-32602);
 } finally {
  globalThis.fetch = previousFetch;
  names.forEach((n,i)=>previous[i]===undefined?Deno.env.delete(n):Deno.env.set(n,previous[i]!));
 }
});
