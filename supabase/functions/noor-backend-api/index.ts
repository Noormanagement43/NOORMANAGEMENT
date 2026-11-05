import { probeBrevoMcp } from './brevo-mcp.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

export const PROJECT_REF = 'ayrryemawwplguaauxij';
const ORIGIN = 'https://noormanagement43.github.io';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 24 * 1024;
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26'];
type Dict = Record<string, unknown>;
export class InputError extends Error {}
function object(value: unknown): Dict {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('JSON object required');
 return value as Dict;
}
function uuid(value: unknown): string {
 if (typeof value !== 'string' || !UUID.test(value)) throw new InputError('Valid UUID required');
 return value;
}
function string(value: unknown, max: number, min = 1): string {
 if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new InputError('Invalid text field');
 return value.trim();
}
export async function readBody(req: Request): Promise<Dict> {
 const length = req.headers.get('content-length');
 if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) throw new InputError('Request too large');
 if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new InputError('application/json required');
 const reader = req.body?.getReader();
 if (!reader) throw new InputError('JSON body required');
 let size = 0;
 const chunks: Uint8Array[] = [];
 try {
  while (true) {
   const { done, value } = await reader.read();
   if (done) break;
   size += value.byteLength;
   if (size > MAX_BYTES) { await reader.cancel(); throw new InputError('Request too large'); }
   chunks.push(value);
  }
 } finally { reader.releaseLock(); }
 const bytes = new Uint8Array(size);
 let offset = 0;
 for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 try { return object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
 catch { throw new InputError('Valid JSON object required'); }
}
const tools = [
 { name: 'noor_check_brevo_connection', description: 'Check server-side Brevo MCP authentication and tool discovery. Returns sanitized connection flags only. Does not read contacts or send messages.', inputSchema: { type: 'object', properties: { institution_id: { type: 'string', format: 'uuid' } }, required: ['institution_id'], additionalProperties: false }, annotations: { readOnlyHint: true } },
 { name: 'noor_ask_brain', description: 'Generate an academic draft with the configured brain provider. Sends your prompt to that provider and consumes AI quota; does not execute school or external actions.', inputSchema: { type: 'object', properties: { institution_id: { type: 'string', format: 'uuid' }, message: { type: 'string', minLength: 1, maxLength: 3000 } }, required: ['institution_id','message'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
 { name: 'noor_manager_plan', description: 'Ask the configured OpenAI manager for a proposed plan and the primary brain for a draft. Sends your prompt to both providers and consumes two AI quota units. Does not execute external actions.', inputSchema: { type: 'object', properties: { institution_id: { type: 'string', format: 'uuid' }, message: { type: 'string', minLength: 1, maxLength: 3000 } }, required: ['institution_id','message'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
 { name: 'noor_list_connections', description: 'List provider registrations for an authorised institution. Registration does not imply OAuth connection.', inputSchema: { type: 'object', properties: { institution_id: { type: 'string', format: 'uuid' } }, required: ['institution_id'], additionalProperties: false }, annotations: { readOnlyHint: true } },
 { name: 'noor_list_task_drafts', description: 'List saved workflow drafts. These tasks have not executed.', inputSchema: { type: 'object', properties: { institution_id: { type: 'string', format: 'uuid' } }, required: ['institution_id'], additionalProperties: false }, annotations: { readOnlyHint: true } },
 { name: 'noor_draft_task', description: 'Save a durable task draft only. Does not send messages, execute code or call a provider.', inputSchema: { type: 'object', properties: { institution_id: { type: 'string', format: 'uuid' }, connection_id: { type: 'string', format: 'uuid' }, operation: { type: 'string', enum: ['ai.generate','github.read','gmail.draft','brevo.draft','supabase.report'] }, payload: { type: 'object' }, idempotency_key: { type: 'string', minLength: 8, maxLength: 120 } }, required: ['institution_id','connection_id','operation','payload','idempotency_key'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
];

// Exporting the handler permits HTTP-level auth/validation tests without opening a port.
export async function handle(req: Request): Promise<Response> {
 const origin = req.headers.get('origin');
 const headers: Record<string,string> = {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,mcp-protocol-version',
  'Access-Control-Expose-Headers': 'mcp-protocol-version',
 };
 if (origin === ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
 const send = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status, headers });
 if (origin && origin !== ORIGIN) return send(403, { error: 'Origin not allowed' });
 if (req.method === 'OPTIONS') return send(204, null);
 if (req.method !== 'POST') return send(405, { error: 'POST required' });
 const token = req.headers.get('authorization');
 if (!token || !/^Bearer [A-Za-z0-9._~-]{1,8192}$/.test(token)) return send(401, { error: 'NOOR user session required' });
 const url = Deno.env.get('SUPABASE_URL');
 let key = Deno.env.get('SUPABASE_ANON_KEY');
 if (!key) { try { key = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default; } catch { /* fail closed */ } }
 // A copied deployment must not silently operate against another database.
 if (url !== `https://${PROJECT_REF}.supabase.co` || !key) return send(503, { error: 'Destination project configuration missing' });
 const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
 let verified: Awaited<ReturnType<typeof db.auth.getUser>>;
 try { verified = await db.auth.getUser(token.slice(7)); } catch { return send(503, { error: 'Authentication service unavailable' }); }
 if (verified.error || !verified.data.user) return send(401, { error: 'Session invalid or expired' });
 const userId = verified.data.user.id;
 let body: Dict;
 try { body = await readBody(req); } catch (e) { return send(400, { error: e instanceof InputError ? e.message : 'Invalid request' }); }

 // All school data access runs under the user's JWT, never a service-role key.
 async function action(name: string, input: Dict): Promise<unknown> {
  if (name === 'status') return {
   project_ref: PROJECT_REF, service: 'noor-backend-api', version: '1.1.0',
   provider_secrets_present: { gemini: !!(Deno.env.get('GEMINI_API_KEY')||Deno.env.get('gemini')), openai: !!(Deno.env.get('OPENAI_API_KEY')||Deno.env.get('chatgpt')), groq: !!(Deno.env.get('GROQ_API_KEY')||Deno.env.get('groq')), anthropic: !!Deno.env.get('ANTHROPIC_API_KEY'), brevo: !!(Deno.env.get('BREVO_API_KEY')||Deno.env.get('brevo')) },
   oauth_connections_verified: false, external_task_execution_enabled: false,
   mcp: { transport: 'stateless-streamable-http', authentication: 'NOOR user JWT', external_oauth_ready: false },
  };
  if (name === 'join') {
   const result = await db.rpc('noor_join_institution', { p_institution: uuid(input.institution_id), p_code: string(input.code, 64, 64) });
   if (result.error) throw result.error;
   return { membership_id: result.data };
  }
  const institution = uuid(input.institution_id);
  const membership = await db.from('institution_memberships').select('id,role,status').eq('institution_id', institution).eq('user_id', userId).eq('status','active').maybeSingle();
  if (membership.error) throw membership.error;
  if (!membership.data || !['principal','school_admin','university_admin','academic_admin'].includes(membership.data.role)) throw { code: '42501' };
  const inst = await db.from('institutions').select('id').eq('id', institution).eq('status', 'active').maybeSingle();
  if (inst.error) throw inst.error;
  if (!inst.data) throw { code: '42501' };
  if (name === 'brevo.mcp.check') return await probeBrevoMcp(Deno.env.toObject());
  if (name === 'ai.assist' || name === 'ai.plan') {
   const generated = await db.functions.invoke('noor-v2-ai', { body: { action: name === 'ai.plan' ? 'manager_plan' : 'chat_assist', institution_id: institution, message: string(input.message,3000) } });
   if (generated.error || generated.data?.error) throw { code: 'AI_UNAVAILABLE' };
   return generated.data;
  }
  if (name === 'connections.list' || name === 'tasks.list') {
   const table = name === 'connections.list' ? 'noor_connections' : 'noor_workflow_jobs';
   // Bounded feeds. For the next page, pass both timestamp and UUID from next_cursor.
   let query = db.from(table).select('*').eq('institution_id', institution).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51);
   if (input.cursor) {
    const cursor = object(input.cursor);
    const before = string(cursor.created_at, 40);
    if (!/^\d{4}-\d\d-\d\dT[0-9:.+-]+Z?$/.test(before) || !Number.isFinite(Date.parse(before))) throw new InputError('Invalid cursor');
    query = query.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${uuid(cursor.id)})`);
   }
   const result = await query;
   if (result.error) throw result.error;
   const rows = (result.data || []).slice(0,50);
   const last = rows.at(-1);
   return { rows, next_cursor: result.data?.length === 51 && last ? { created_at: last.created_at, id: last.id } : null };
  }
  const calls: Record<string, () => { name: string; args: Dict }> = {
   'connections.register': () => ({ name: 'noor_register_connection', args: { p_institution: institution, p_provider: string(input.provider,50), p_label: string(input.label,120) } }),
   'tasks.draft': () => ({ name: 'noor_draft_workflow', args: { p_institution: institution, p_connection: uuid(input.connection_id), p_operation: string(input.operation,40), p_payload: object(input.payload), p_idempotency_key: string(input.idempotency_key,120,8) } }),
   'members.status': () => ({ name: 'noor_set_member_status', args: { p_institution: institution, p_membership: uuid(input.membership_id), p_status: string(input.status,20) } }),
   'join_codes.rotate': () => ({ name: 'noor_rotate_join_code', args: { p_institution: institution, p_role: string(input.role,20) } }),
  };
  if (!Object.hasOwn(calls,name)) throw new InputError('Unknown action');
  const call = calls[name]();
  const result = await db.rpc(call.name,call.args);
  if (result.error) throw result.error;
  return { result: result.data, ...(name === 'tasks.draft' ? { state: 'draft', executed: false } : {}) };
 }

 const mcp = new URL(req.url).pathname.endsWith('/mcp');
 if (mcp) {
  // Internal NOOR JWT endpoint. OAuth discovery/consent must be implemented before
  // advertising this as a ChatGPT/Gemini/Claude customer connection.
  const id = body.id;
  const rpcError = (code: number, message: string) => send(200, { jsonrpc: '2.0', id: typeof id === 'string' || typeof id === 'number' ? id : null, error: { code, message } });
  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string' || (id !== undefined && typeof id !== 'string' && (typeof id !== 'number' || !Number.isFinite(id)))) return rpcError(-32600, 'Invalid Request');
  const protocol = req.headers.get('mcp-protocol-version');
  if (protocol && !PROTOCOLS.includes(protocol)) return send(400, { error: 'Unsupported MCP protocol version' });
  if (body.method === 'notifications/initialized' && id === undefined) return send(202, null);
  if (id === undefined) return rpcError(-32600,'Request ID required');
  const rpc = (result: unknown) => send(200, { jsonrpc: '2.0', id, result });
  try {
   const params = body.params === undefined ? {} : object(body.params);
   if (body.method === 'initialize') {
    const version = typeof params.protocolVersion === 'string' && PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
    headers['Mcp-Protocol-Version'] = version;
    return rpc({ protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: 'noor-internal-gateway', version: '1.1.0' }, instructions: 'Internal JWT connection. AI tools generate drafts through configured providers; workflow tools save drafts only. External school-app actions and OAuth are not enabled.' });
   }
   if (body.method === 'ping') return rpc({});
   if (body.method === 'tools/list') return rpc({ tools });
   if (body.method !== 'tools/call') return rpcError(-32601,'Method not found');
   const map: Record<string,string> = { noor_check_brevo_connection: 'brevo.mcp.check', noor_ask_brain: 'ai.assist', noor_manager_plan: 'ai.plan', noor_list_connections: 'connections.list', noor_list_task_drafts: 'tasks.list', noor_draft_task: 'tasks.draft' };
   if (typeof params.name !== 'string' || !Object.hasOwn(map,params.name)) return rpcError(-32602,'Unknown tool');
   const result = await action(map[params.name],object(params.arguments));
   return rpc({ content: [{ type: 'text', text: JSON.stringify(result) }] });
  } catch (e) {
   if (e instanceof InputError) return rpcError(-32602,e.message);
   return rpc({ isError: true, content: [{ type: 'text', text: 'Operation denied or unavailable. Check institution permissions and input.' }] });
  }
 }
 try { return send(200, await action(string(body.action,60),body)); }
 catch (e) {
  if (e instanceof InputError) return send(400,{ error: e.message });
  const code = (e as { code?: string })?.code;
  if (code === '42501') return send(403,{ error: 'Active institution leadership required' });
  if (code === '54000') return send(429,{ error: 'Rate limit exceeded' });
  if (code?.startsWith('22') || code?.startsWith('23')) return send(400,{ error: 'Invalid operation or conflicting record' });
  console.error('NOOR backend operation failed',code || 'unknown');
  return send(503,{ error: 'Backend operation unavailable' });
 }
}
if (import.meta.main) Deno.serve(handle);
