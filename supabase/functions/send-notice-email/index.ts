import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://noormanagement43.github.io",
  "http://localhost:4173",
  "http://localhost:8080",
]);
const adminRoles = new Set(["principal", "school_admin", "university_admin", "academic_admin"]);

function headersFor(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function json(origin: string | null, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}
function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json(null, { error: "Origin is not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: headersFor(origin) });
  if (req.method !== "POST") return json(origin, { error: "Use POST." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(origin, { error: "Sign-in required." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL")?.trim().toLowerCase();
  const senderName = Deno.env.get("BREVO_SENDER_NAME")?.trim() || "NOOR";
  if (!supabaseUrl || !supabaseKey) return json(origin, { error: "Supabase function environment is not configured." }, 500);
  if (!brevoKey || !senderEmail || !validEmail(senderEmail)) return json(origin, { error: "Email delivery is not configured on this environment." }, 503);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) return json(origin, { error: "Your session is invalid or expired." }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(origin, { error: "A JSON object is required." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json(origin, { error: "A valid JSON body is required." }, 400);
  }

  const institutionId = typeof body.institution_id === "string" ? body.institution_id : "";
  const recipientEmail = typeof body.recipient_email === "string" ? body.recipient_email.trim().toLowerCase() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(institutionId)) return json(origin, { error: "A valid institution_id is required." }, 400);
  if (!validEmail(recipientEmail)) return json(origin, { error: "A valid recipient email is required." }, 400);
  if (!subject || subject.length > 120 || /[\r\n]/.test(subject)) return json(origin, { error: "Subject must be between 1 and 120 characters on one line." }, 400);
  if (!message || message.length > 5000) return json(origin, { error: "Message must be between 1 and 5000 characters." }, 400);

  const { data: membership, error: membershipError } = await supabase
    .from("institution_memberships")
    .select("institution_id, role, status")
    .eq("institution_id", institutionId)
    .eq("user_id", userResult.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership || !adminRoles.has(membership.role)) {
    return json(origin, { error: "An active institution administrator membership is required." }, 403);
  }
  const { data: institution, error: institutionError } = await supabase
    .from("institutions").select("id,name,status").eq("id", institutionId).eq("status", "active").maybeSingle();
  if (institutionError || !institution) return json(origin, { error: "The institution is unavailable to this account." }, 403);

  // Limit delivery to addresses already recorded for this institution's membership/invitation lifecycle.
  const { data: recipientMembership, error: recipientError } = await supabase
    .from("institution_memberships").select("id")
    .eq("institution_id", institutionId).eq("invited_email", recipientEmail)
    .in("status", ["invited", "active"]).limit(1).maybeSingle();
  if (recipientError || !recipientMembership) return json(origin, { error: "Recipient must belong to an invitation or membership record for this institution." }, 403);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "api-key": brevoKey },
      signal: controller.signal,
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: recipientEmail }],
        subject,
        textContent: message,
        tags: ["noor-institution-notice"],
      }),
    });
    if (!response.ok) return json(origin, { error: "Email provider could not accept the message. Check sender configuration and try again." }, 502);
    const result = await response.json().catch(() => ({}));
    return json(origin, { accepted: true, message_id: typeof result.messageId === "string" ? result.messageId : null });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return json(origin, { error: timedOut ? "Email request timed out. Try again later." : "Email provider is temporarily unavailable." }, timedOut ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
});
