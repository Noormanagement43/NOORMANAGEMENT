import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const allowedOrigins = new Set([
  "https://noormanagement43.github.io",
  "http://localhost:4173",
  "http://localhost:8080",
]);
const allowedRoles = new Set([
  "principal", "school_admin", "university_admin", "academic_admin",
  "teacher", "faculty", "student", "university_student", "staff", "finance_admin",
]);

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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json(null, { error: "Origin is not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: headersFor(origin) });
  if (req.method !== "POST") return json(origin, { error: "Use POST." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(origin, { error: "Sign-in required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
  if (!supabaseUrl || !supabaseKey) return json(origin, { error: "Supabase function environment is not configured." }, 500);
  if (!geminiKey) return json(origin, { error: "Ask Noor is not configured on this environment." }, 503);
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) return json(origin, { error: "Configured model name is invalid." }, 500);

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
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(institutionId)) {
    return json(origin, { error: "A valid institution_id is required." }, 400);
  }
  if (prompt.length < 5 || prompt.length > 4000) return json(origin, { error: "Prompt must be between 5 and 4000 characters." }, 400);

  const { data: membership, error: membershipError } = await supabase
    .from("institution_memberships")
    .select("institution_id, role, status")
    .eq("institution_id", institutionId)
    .eq("user_id", userResult.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership || !allowedRoles.has(membership.role)) {
    return json(origin, { error: "An active institution membership is required." }, 403);
  }
  const { data: institution, error: institutionError } = await supabase
    .from("institutions").select("id,status").eq("id", institutionId).eq("status", "active").maybeSingle();
  if (institutionError || !institution) return json(origin, { error: "The institution is unavailable to this account." }, 403);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are Ask Noor, an educational assistant for a school and university workspace. Give clear, age-appropriate academic guidance. You do not have access to institution records, grades, attendance, or private student data; never claim otherwise. Do not ask users to provide passwords, tokens, or unnecessary sensitive personal information. If asked to reveal private records, explain that this service cannot access them." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
      }),
    });
    if (!response.ok) return json(origin, { error: "The AI provider could not complete this request. Try again later." }, 502);
    const payload = await response.json();
    const answer = (payload?.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => typeof part.text === "string" ? part.text : "")
      .filter(Boolean).join("\n").trim();
    if (!answer) return json(origin, { error: "The AI provider returned no answer. Try rephrasing your question." }, 502);
    return json(origin, { answer, model, source: "gemini" });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return json(origin, { error: timedOut ? "The AI request timed out. Try again." : "The AI provider is temporarily unavailable." }, timedOut ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
});
