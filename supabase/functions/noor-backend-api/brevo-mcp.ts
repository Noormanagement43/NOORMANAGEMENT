// Server-only, fixed-endpoint MCP handshake. No tools/call or customer data access.
export const BREVO_MCP_URL = 'https://mcp.brevo.com/v1/brevo/mcp';
type Env = Record<string, string>;
export function resolveMcpToken(env: Env) {
 const names = Object.keys(env).filter(n => /^(?:brevo|brivo)(?:mcp|mcb)(?:token|key|apikey)?$/.test(n.toLowerCase().replace(/[ _-]/g, '')));
 const values = [...new Set(names.map(n => env[n]).filter(Boolean))];
 return { detected: values.length > 0, conflict: values.length > 1, token: values.length === 1 ? values[0] : undefined };
}
async function boundedText(response: Response): Promise<string> {
 const reader = response.body?.getReader();
 if (!reader) throw new Error('EMPTY_RESPONSE');
 const decoder = new TextDecoder(); let text = '', size = 0;
 try { while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > 1024*1024) throw new Error('RESPONSE_LIMIT'); text += decoder.decode(value,{stream:true}); } return text + decoder.decode(); }
 finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}
export async function probeBrevoMcp(env: Env, request: typeof fetch = fetch) {
 const secret = resolveMcpToken(env);
 const result = { secret_detected: secret.detected, environment_matched: !!secret.token, authentication_successful: false, handshake_successful: false, tools_list_successful: false, tool_count: 0, external_actions_enabled: false, error: '' };
 if (secret.conflict) return {...result,error:'SECRET_ALIAS_CONFLICT'};
 if (!secret.token) return {...result,error:'MCP_SECRET_NOT_FOUND'};
 const signal = AbortSignal.timeout(45000);
 let session: string | null = null;
 let version = '2025-03-26';
 async function rpc(method: string, id?: number, params?: unknown) {
  const headers: Record<string,string> = {Authorization:`Bearer ${secret.token}`,Accept:'application/json, text/event-stream','Content-Type':'application/json'};
  if (session) headers['Mcp-Session-Id'] = session;
  if (method !== 'initialize') headers['MCP-Protocol-Version'] = version;
  const response = await request(BREVO_MCP_URL,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(id===undefined?{}:{id}),method,...(params===undefined?{}:{params})}),signal,redirect:'error'});
  if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP_${response.status}`); }
  if (method==='initialize') session=response.headers.get('Mcp-Session-Id');
  if (id===undefined) { await response.body?.cancel(); return null; }
  const text = await boundedText(response);
  const payloads = response.headers.get('content-type')?.includes('text/event-stream') ? text.replace(/\r\n/g,'\n').split('\n\n').map(e=>e.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')).filter(Boolean) : [text];
  for (const payload of payloads) { const data=JSON.parse(payload); if (data.id===id && data.jsonrpc==='2.0') { if (data.error || !data.result) throw new Error('RPC_ERROR'); return data.result; } }
  throw new Error('INVALID_MCP_RESPONSE');
 }
 try {
  const initialized = await rpc('initialize',1,{protocolVersion:version,capabilities:{},clientInfo:{name:'noor-backend',version:'1.2.0'}});
  if (!['2025-03-26','2025-06-18','2025-11-25'].includes(initialized.protocolVersion)) throw new Error('UNSUPPORTED_PROTOCOL');
  version=initialized.protocolVersion;
  result.authentication_successful=true; result.handshake_successful=true;
  await rpc('notifications/initialized');
  const listed=await rpc('tools/list',2,{});
  if (!Array.isArray(listed.tools)) throw new Error('INVALID_TOOL_LIST');
  result.tools_list_successful=true; result.tool_count=listed.tools.length;
  return result;
 } catch (e) {
  const message=e instanceof Error?e.message:'';
  return {...result,error:/^HTTP_\d{3}$/.test(message)||['RPC_ERROR','INVALID_MCP_RESPONSE','INVALID_TOOL_LIST','UNSUPPORTED_PROTOCOL','RESPONSE_LIMIT'].includes(message)?message:'MCP_CONNECTION_FAILED'};
 }
}
