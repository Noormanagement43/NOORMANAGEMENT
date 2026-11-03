/**
 * NOOR customer-facing MCP.
 * Stateless Streamable HTTP / JSON-RPC; no server-side MCP session is issued.
 * Each request is authenticated as a NOOR user and database access uses that user's JWT.
 * Read-only tools only until write actions have audited, idempotent, role-scoped workflows.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import {
  isAllowedOrigin, isJsonRpcRequest, isUuid, isoDate, parseAllowedOrigins,
  parseBearerToken, SUPPORTED_PROTOCOL_VERSIONS,
} from "./security.ts";

const VERSION = "1.1.0";
const MAX_BODY_BYTES = 64 * 1024;
const allowedOrigins = parseAllowedOrigins(Deno.env.get("NOOR_MCP_ALLOWED_ORIGINS"));
const baseHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Mcp-Protocol-Version",
  "Vary": "Origin",
};

type JsonRpcId = string | number;
type JsonRpcRequest = {
  jsonrpc: "2.0"; id?: JsonRpcId; method: string; params?: Record<string, unknown>;
};

function headersFor(req: Request): Headers {
  const headers = new Headers(baseHeaders);
  const origin = req.headers.get("Origin");
  if (origin && isAllowedOrigin(origin, allowedOrigins)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  const headers = headersFor(req);
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}
function rpcError(req: Request, id: JsonRpcId | null, code: number, message: string, status = 200) {
  return json(req, { jsonrpc: "2.0", id, error: { code, message } }, status);
}
function corsDenied() {
  return new Response("Origin is not allowed.", { status: 403, headers: { "Vary": "Origin" } });
}
async function readLimitedBody(req: Request): Promise<string> {
  const declared = Number(req.headers.get("Content-Length") || "0");
  if (declared > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(merged);
}
async function getUserClient(req: Request) {
  const token = parseBearerToken(req.headers.get("Authorization"));
  if (!token) throw new Error("AUTH_REQUIRED");
  const url = Deno.env.get("SUPABASE_URL");
  let key = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!key) {
    try { key = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || ""; } catch { key = ""; }
  }
  if (!url || !key) throw new Error("BACKEND_NOT_CONFIGURED");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("INVALID_SESSION");
  return { db, user: data.user };
}

async function resolveMembership(db: any, userId: string, institutionId?: string) {
  let query = db.from("institution_memberships").select("id,institution_id,role,status")
    .eq("user_id", userId).eq("status", "active").limit(21);
  if (institutionId) query = query.eq("institution_id", institutionId);
  const { data, error } = await query;
  if (error) throw new Error("Could not verify your active institution membership.");
  const memberships = data || [];
  if (memberships.length > 20) throw new Error("Too many institution memberships; contact your administrator.");
  if (!memberships.length) throw new Error("No active membership was found for this institution.");
  if (!institutionId && memberships.length > 1) throw new Error("You belong to multiple institutions. Supply institution_id to select one.");
  const membership = memberships[0];
  const { data: institution, error: institutionError } = await db.from("institutions")
    .select("id,name,institution_type,status").eq("id", membership.institution_id).maybeSingle();
  if (institutionError || !institution || institution.status !== "active") {
    throw new Error("The selected institution is not active or could not be verified.");
  }
  return { membership, institution };
}

async function listMyInstitutions(db: any, userId: string) {
  const { data: memberships, error } = await db.from("institution_memberships")
    .select("institution_id,role,status").eq("user_id", userId).eq("status", "active").limit(21);
  if (error) throw new Error("Could not load your institution memberships.");
  if ((memberships || []).length > 20) throw new Error("Too many institution memberships; contact your administrator.");
  const ids = [...new Set((memberships || []).map((m: any) => m.institution_id))];
  if (!ids.length) return { institutions: [] };
  const { data: institutions, error: institutionError } = await db.from("institutions")
    .select("id,name,institution_type,country_code,timezone,default_language,status")
    .in("id", ids).eq("status", "active");
  if (institutionError) throw new Error("Could not load institution details.");
  const byId = new Map((institutions || []).map((i: any) => [i.id, i]));
  return {
    institutions: (memberships || []).flatMap((m: any) => {
      const institution = byId.get(m.institution_id);
      return institution ? [{ ...institution, your_role: m.role }] : [];
    }),
  };
}

async function attendanceCount(db: any, institutionId: string, status: string, from?: string, to?: string, studentMembershipId?: string) {
  let query = db.from("attendance_records").select("id", { count: "exact", head: true })
    .eq("institution_id", institutionId).eq("attendance_status", status);
  if (from) query = query.gte("marked_at", from + "T00:00:00.000Z");
  if (to) query = query.lt("marked_at", new Date(new Date(to + "T00:00:00.000Z").getTime() + 86400000).toISOString());
  if (studentMembershipId) query = query.eq("student_membership_id", studentMembershipId);
  const { count, error } = await query;
  if (error) throw new Error("Attendance data could not be read under your current permissions.");
  return count || 0;
}

async function getAttendanceSummary(db: any, userId: string, args: Record<string, unknown>) {
  const allowedArgs = new Set(["institution_id", "from_date", "to_date"]);
  if (Object.keys(args).some((key) => !allowedArgs.has(key))) throw new Error("Unsupported attendance filter.");
  const institutionId = args.institution_id;
  if (institutionId !== undefined && !isUuid(institutionId)) throw new Error("institution_id must be a valid UUID.");
  const from = args.from_date === undefined ? null : isoDate(args.from_date);
  const to = args.to_date === undefined ? null : isoDate(args.to_date);
  if (args.from_date !== undefined && !from) throw new Error("from_date must use YYYY-MM-DD.");
  if (args.to_date !== undefined && !to) throw new Error("to_date must use YYYY-MM-DD.");
  if (from && to && from > to) throw new Error("from_date cannot be after to_date.");

  const { membership, institution } = await resolveMembership(db, userId, institutionId as string | undefined);
  const role = String(membership.role || "");
  const leaders = new Set(["principal", "school_admin", "university_admin", "academic_admin"]);
  const isStudent = role === "student" || role === "university_student";
  if (!isStudent && !leaders.has(role)) {
    throw new Error("Available to students for their own records and institution leaders for aggregate records. Teacher-specific class scoping is not enabled yet.");
  }
  const ownStudentId = isStudent ? membership.id : undefined;
  const [present, absent, late, leave] = await Promise.all(
    ["present", "absent", "late", "leave"].map((status) =>
      attendanceCount(db, institution.id, status, from || undefined, to || undefined, ownStudentId)),
  );
  const total = present + absent + late + leave;
  return {
    institution: { id: institution.id, name: institution.name, type: institution.institution_type },
    scope: isStudent ? "your_own_attendance" : "institution_aggregate",
    period: { from_date: from, to_date: to, timezone: "UTC" },
    counts: { present, absent, late, leave, total },
    attendance_percentage: total ? Math.round(((present + late) / total) * 10000) / 100 : null,
    note: "Aggregate counts only; no student names or personally identifying records are returned.",
  };
}

const TOOLS = [
  {
    name: "noor_list_my_institutions",
    description: "List active institutions connected to the authenticated NOOR user and the user's role in each.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "noor_get_attendance_summary",
    description: "Get the authenticated student's own attendance or aggregate attendance for an institution leader. Optional date filters use YYYY-MM-DD and UTC calendar boundaries.",
    inputSchema: {
      type: "object",
      properties: {
        institution_id: { type: "string", format: "uuid", description: "Required when the user belongs to multiple institutions." },
        from_date: { type: "string", format: "date", description: "Optional inclusive UTC start date." },
        to_date: { type: "string", format: "date", description: "Optional inclusive UTC end date." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

async function callTool(db: any, userId: string, name: string, args: Record<string, unknown>) {
  if (name === "noor_list_my_institutions") {
    if (Object.keys(args).length) throw new Error("This tool does not accept arguments.");
    return listMyInstitutions(db, userId);
  }
  if (name === "noor_get_attendance_summary") return getAttendanceSummary(db, userId, args);
  throw new Error("Unknown NOOR tool.");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (!isAllowedOrigin(origin, allowedOrigins)) return corsDenied();

  const enabled = Deno.env.get("NOOR_MCP_ENABLED") === "true";
  if (!enabled) return new Response("NOOR MCP is disabled.", { status: 404, headers: { "Vary": "Origin" } });

  if (req.method === "OPTIONS") {
    if (!origin) return new Response(null, { status: 204, headers: baseHeaders });
    return new Response(null, { status: 204, headers: headersFor(req) });
  }
  if (req.method === "GET" || req.method === "DELETE") {
    return new Response(null, { status: 405, headers: { ...Object.fromEntries(headersFor(req)), "Allow": "POST, OPTIONS" } });
  }
  if (req.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { "Allow": "POST, OPTIONS" } });

  const contentType = (req.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return new Response("Content-Type must be application/json.", { status: 415 });
  const accept = (req.headers.get("Accept") || "").toLowerCase();
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    return new Response("Accept must include application/json and text/event-stream.", { status: 406 });
  }

  let raw: string;
  try { raw = await readLimitedBody(req); } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return new Response("Request body too large.", { status: 413 });
    return new Response("Invalid UTF-8 request body.", { status: 400 });
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    return json(req, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON." } }, 400);
  }
  if (!isJsonRpcRequest(parsed)) return rpcError(req, null, -32600, "Invalid JSON-RPC request.", 400);
  const rpc = parsed as JsonRpcRequest;

  const protocolHeader = req.headers.get("MCP-Protocol-Version");
  if (protocolHeader && !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolHeader as typeof SUPPORTED_PROTOCOL_VERSIONS[number])) {
    return rpcError(req, rpc.id ?? null, -32600, "Unsupported MCP protocol version.", 400);
  }
  if (rpc.method !== "initialize" && !protocolHeader) {
    return rpcError(req, rpc.id ?? null, -32600, "MCP-Protocol-Version header is required after initialize.", 400);
  }

  let context: Awaited<ReturnType<typeof getUserClient>>;
  try { context = await getUserClient(req); } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    const status = message === "AUTH_REQUIRED" || message === "INVALID_SESSION" ? 401 : 503;
    return json(req, { error: message === "AUTH_REQUIRED" ? "Bearer token required." : message === "INVALID_SESSION" ? "Invalid or expired session." : "MCP authentication is temporarily unavailable." }, status);
  }

  if (rpc.method.startsWith("notifications/")) {
    if (rpc.id !== undefined) return rpcError(req, rpc.id, -32600, "Notifications must not include an id.", 400);
    return new Response(null, { status: 202, headers: headersFor(req) });
  }
  if (rpc.id === undefined) return rpcError(req, null, -32600, "A JSON-RPC request id is required.", 400);

  if (rpc.method === "initialize") {
    const requested = String(rpc.params?.protocolVersion || "");
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(requested as typeof SUPPORTED_PROTOCOL_VERSIONS[number])) {
      return rpcError(req, rpc.id, -32602, "Unsupported protocol version. Supported versions: " + SUPPORTED_PROTOCOL_VERSIONS.join(", "), 400);
    }
    return json(req, {
      jsonrpc: "2.0", id: rpc.id,
      result: {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "noor-mcp", version: VERSION },
        instructions: "NOOR customer-facing MCP. Every tool runs as the authenticated NOOR user and is restricted by active institution membership and Supabase RLS. This release is read-only.",
      },
    }, 200, { "MCP-Protocol-Version": requested });
  }
  if (rpc.method === "ping") return json(req, { jsonrpc: "2.0", id: rpc.id, result: {} });
  if (rpc.method === "tools/list") return json(req, { jsonrpc: "2.0", id: rpc.id, result: { tools: TOOLS } });

  if (rpc.method === "tools/call") {
    const name = String(rpc.params?.name || "");
    const rawArgs = rpc.params?.arguments;
    if (rawArgs !== undefined && (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs))) {
      return rpcError(req, rpc.id, -32602, "Tool arguments must be a JSON object.");
    }
    try {
      const result = await callTool(context.db, context.user.id, name, (rawArgs || {}) as Record<string, unknown>);
      return json(req, { jsonrpc: "2.0", id: rpc.id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: false } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      return json(req, { jsonrpc: "2.0", id: rpc.id, result: { content: [{ type: "text", text: message }], isError: true } });
    }
  }
  return rpcError(req, rpc.id, -32601, "Method not found.", 404);
});
