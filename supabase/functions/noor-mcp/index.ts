/**
 * NOOR customer-facing MCP (stateless Streamable HTTP / JSON-RPC).
 * Authentication: Supabase user access token in Authorization: Bearer <JWT>.
 * Every database query uses the caller's JWT, preserving Supabase RLS.
 * Initial tools are read-only. Never use a service-role key here.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const VERSION = "1.0.0";
const PROTOCOL_VERSIONS = ["2025-03-26", "2024-11-05"];
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, mcp-protocol-version, mcp-session-id, mcp-transport",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": Deno.env.get("NOOR_MCP_ALLOWED_ORIGIN") || "*",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Vary": "Origin",
};

type JsonRpcId = string | number | null;
type JsonRpcRequest = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});
const rpcError = (id: JsonRpcId, code: number, message: string) =>
  json({ jsonrpc: "2.0", id, error: { code, message } });

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}
async function getUserClient(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
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
  if (!memberships.length) throw new Error("No active membership was found for this institution.");
  if (!institutionId && memberships.length > 1) throw new Error("You belong to multiple institutions. Supply institution_id to select one.");
  if (memberships.length > 20) throw new Error("Too many institution memberships; contact your administrator.");
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
    .select("institution_id,role,status").eq("user_id", userId).eq("status", "active").limit(20);
  if (error) throw new Error("Could not load your institution memberships.");
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
  const isStudent = role === "student";
  if (!isStudent && !leaders.has(role)) {
    throw new Error("Available to students for their own records and institution leaders for aggregate records. Teacher-specific class scoping is not enabled yet.");
  }
  const ownStudentId = isStudent ? membership.id : undefined;
  const [present, absent, late, leave] = await Promise.all(
    ["present", "absent", "late", "leave"].map(status =>
      attendanceCount(db, institution.id, status, from || undefined, to || undefined, ownStudentId)),
  );
  const total = present + absent + late + leave;
  return {
    institution: { id: institution.id, name: institution.name, type: institution.institution_type },
    scope: isStudent ? "your_own_attendance" : "institution_aggregate",
    period: { from_date: from, to_date: to },
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
    description: "Get the authenticated student's own attendance or aggregate attendance for an institution leader. Optional date filters use YYYY-MM-DD.",
    inputSchema: {
      type: "object",
      properties: {
        institution_id: { type: "string", format: "uuid", description: "Required when the user belongs to multiple institutions." },
        from_date: { type: "string", format: "date", description: "Optional inclusive start date." },
        to_date: { type: "string", format: "date", description: "Optional inclusive end date." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

async function callTool(db: any, userId: string, name: string, args: Record<string, unknown>) {
  if (name === "noor_list_my_institutions") return listMyInstitutions(db, userId);
  if (name === "noor_get_attendance_summary") return getAttendanceSummary(db, userId, args);
  throw new Error("Unknown NOOR tool.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST for stateless MCP requests." }, 405);

  let rpc: JsonRpcRequest;
  try {
    const raw = await req.text();
    if (raw.length > 64000) return json({ error: "Request body too large." }, 413);
    rpc = JSON.parse(raw);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON." } }, 400);
  }
  if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") return rpcError(rpc.id ?? null, -32600, "Invalid JSON-RPC request.");
  if (rpc.method === "notifications/initialized" || rpc.method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  let context: Awaited<ReturnType<typeof getUserClient>>;
  try {
    context = await getUserClient(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    const status = message === "AUTH_REQUIRED" || message === "INVALID_SESSION" ? 401 : 503;
    return json({ error: message === "AUTH_REQUIRED" ? "Bearer token required." : message }, status);
  }

  const id = rpc.id ?? null;
  if (rpc.method === "initialize") {
    const requested = String(rpc.params?.protocolVersion || "");
    return json({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "noor-mcp", version: VERSION },
        instructions: "NOOR customer-facing MCP. Every tool runs as the authenticated NOOR user and is restricted by institution membership and Supabase RLS. Initial release exposes read-only tools only.",
      },
    });
  }
  if (rpc.method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (rpc.method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });

  if (rpc.method === "tools/call") {
    const name = String(rpc.params?.name || "");
    const args = rpc.params?.arguments && typeof rpc.params.arguments === "object"
      ? rpc.params.arguments as Record<string, unknown> : {};
    try {
      const result = await callTool(context.db, context.user.id, name, args);
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: false } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: message }], isError: true } });
    }
  }
  return rpcError(id, -32601, "Method not found.");
});
