import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: CORS });
    }

    const action = String(body.action || "status").toLowerCase();

    if (action === "status") {
      return new Response(JSON.stringify({ status: "ready", model: "gemini-1.5-flash", version: "2.0" }), { status: 200, headers: CORS });
    }

    // 1. Question Paper Generation
    if (action === "paper") {
      const { topic, subject_name, paper_type, difficulty, question_count, marks_per_question } = body;
      const prompt = `You are the NOOR Management AI examination engine.
Generate a balanced examination question paper for subject "${subject_name || "General Science"}" on topic "${topic || "Curriculum Overview"}".
Paper Type: ${paper_type || "Weekly Test"}.
Difficulty: ${difficulty || "balanced"}.
Total Questions: ${question_count || 10}.
Marks per Question: ${marks_per_question || 2}.

Return ONLY valid JSON (no markdown formatting, no backticks):
{
  "title": "${subject_name || "Assessment"} - ${paper_type || "Test"}",
  "total_marks": ${(question_count || 10) * (marks_per_question || 2)},
  "questions": [
    {
      "number": 1,
      "text": "Question text here",
      "marks": ${marks_per_question || 2},
      "answer": "Complete standard answer / marking criteria"
    }
  ]
}`;
      const res = await callGemini(prompt);
      return new Response(JSON.stringify({ output: res }), { status: 200, headers: CORS });
    }

    // 2. Hierarchical Curriculum Node Generation
    if (action === "curriculum_nodes") {
      const { subject, grade_level, syllabus_theme } = body;
      const prompt = `You are the NOOR AI Curriculum Architect.
Generate structured, hierarchical learning nodes for Grade ${grade_level || "10"} subject "${subject || "Mathematics"}" under theme "${syllabus_theme || "Annual Curriculum"}".
Return ONLY valid JSON (no markdown, no backticks):
{
  "subject": "${subject}",
  "grade": "${grade_level}",
  "nodes": [
    {
      "unit_number": 1,
      "title": "Unit Title",
      "chapters": [
        {
          "name": "Chapter Title",
          "learning_objectives": ["Objective 1", "Objective 2"],
          "estimated_periods": 6,
          "difficulty": "Moderate"
        }
      ]
    }
  ]
}`;
      const res = await callGemini(prompt);
      return new Response(JSON.stringify({ output: res }), { status: 200, headers: CORS });
    }

    // 3. Live Insights & Performance Analysis
    if (action === "insights") {
      const { attendance_data, performance_logs, school_name } = body;
      const prompt = `You are the NOOR Management AI Co-Pilot analyzing real institutional records for "${school_name || "School"}".
Attendance Summary: ${JSON.stringify(attendance_data || {})}
Performance Logs: ${JSON.stringify(performance_logs || {})}
Generate concise, evidence-based recommendations and trend observations (max 150 words).
Return ONLY JSON:
{
  "summary": "Key operational summary",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "trend_signal": "Stable / High / Requires Attention"
}`;
      const res = await callGemini(prompt);
      return new Response(JSON.stringify({ output: res }), { status: 200, headers: CORS });
    }

    // 4. Cartoon & Educational Media Generation Prompts
    if (action === "cartoon_media" || action === "media_prompt") {
      const { topic, grade_level, style } = body;
      const prompt = `Generate a detailed visual prompt for creating a colorful, friendly cartoon/illustrative educational graphic for Grade ${grade_level || "5"} students on topic "${topic}".
Include character visual ideas, playful analogies, and vivid educational diagrams.
Return ONLY JSON:
{
  "topic": "${topic}",
  "visual_concept": "Summary of illustration concept",
  "art_style": "${style || "Colorful 2D educational storybook cartoon style"}",
  "prompt_text": "Detailed prompt description for image generator",
  "educational_takeaway": "Key learning point depicted"
}`;
      const res = await callGemini(prompt);
      return new Response(JSON.stringify({ output: res }), { status: 200, headers: CORS });
    }

    // 5. Interactive Student-Teacher Assistant
    if (action === "chat_assist") {
      const { message, role, context } = body;
      const prompt = `You are NOOR AI, the co-pilot for NOOR Management SaaS.
User Role: ${role || "Teacher"}.
Academic Context: ${context || "General School Operation"}.
User Question: "${message}".
Provide a helpful, polite, and educational response.`;
      const res = await callGeminiText(prompt);
      return new Response(JSON.stringify({ response: res }), { status: 200, headers: CORS });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: CORS });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), { status: 500, headers: CORS });
  }
});

async function callGemini(prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in Supabase Edge Functions environment variables.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini API returned status ${res.status}`);
  }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || "";
  const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    return { raw_content: raw };
  }
}

async function callGeminiText(prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in Supabase Edge Functions environment variables.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || "";
}
