import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS });
const enc = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const str = (v: unknown, max=500) => String(v ?? "").slice(0,max);

async function getAuthClient(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Please sign in to NOOR AI first.");
  const url = Deno.env.get("SUPABASE_URL");
  let keys: Record<string,string> = {};
  try { keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}"); } catch { keys = {}; }
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? keys.default ?? Object.values(keys)[0];
  if (!url || !key) throw new Error("NOOR AI Edge Function configuration is incomplete.");
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Your sign-in session is not valid. Sign in again.");
  const { data: profile, error: pe } = await client.from("profiles")
    .select("id,role,status,school_id,email,full_name").eq("id", data.user.id).maybeSingle();
  if (pe || !profile || profile.status !== "active") throw new Error("Your NOOR AI account is not active.");
  return { client, user: data.user, profile };
}

async function canManage(client: any, profile: any, schoolId: string, permission: string) {
  if (profile.role === "creator") return true;
  if (profile.school_id !== schoolId) return false;
  const { data: membership, error: me } = await client.from("school_memberships")
    .select("role,status").eq("school_id", schoolId).eq("user_id", profile.id).maybeSingle();
  if (me) return false;
  if (membership && (membership.status !== "active" || membership.role !== profile.role)) return false;
  if (["owner","principal"].includes(profile.role)) return true;
  if (profile.role !== "manager") return false;
  const { data: grant, error } = await client.from("role_permissions").select("is_allowed")
    .eq("school_id", schoolId).eq("role","manager").eq("permission_key",permission).maybeSingle();
  return !error && grant?.is_allowed === true;
}

async function recordEmailAttempt(client: any, schoolId: string, userId: string, recipient: string, subject: string,
  idempotencyKey: string, status: string, extra: Record<string,unknown> = {}) {
  const { data, error } = await client.from("school_email_delivery_logs").insert({
    school_id: schoolId, requested_by: userId, recipient_email: recipient, subject,
    provider: "brevo", idempotency_key: idempotencyKey, status, attempt_count: status === "queued" ? 0 : 1,
    last_attempt_at: status === "queued" ? null : new Date().toISOString(), ...extra,
  }).select("id,status").single();
  if (error) console.error("NOOR AI email audit record could not be written", error.code);
  return { data, error };
}

async function sendTest(req: Request, input: any) {
  const { client, user, profile } = await getAuthClient(req);
  const schoolId = str(input.school_id,80);
  if (!/^[0-9a-f-]{36}$/i.test(schoolId)) return reply(400,{error:"Select the active school workspace."});
  if (!await canManage(client,profile,schoolId,"manage_email_automation")) return reply(403,{error:"You are not authorised to test school email automation."});
  if (!user.email || !(user.email_confirmed_at || user.confirmed_at)) return reply(403,{error:"A verified sign-in email is required for the test."});
  const {data: school} = await client.from("schools").select("name").eq("id",schoolId).maybeSingle();
  const schoolName = str(school?.name || "NOOR AI school",180);
  const recipient = user.email;
  const subject = "NOOR AI email configuration test";
  const key = "test:"+user.id+":"+crypto.randomUUID();
  const providerKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("EMAIL_FROM");
  const senderName = Deno.env.get("EMAIL_FROM_NAME") || "NOOR AI";
  const log = await recordEmailAttempt(client,schoolId,user.id,recipient,subject,key,"queued");
  if (!providerKey || !senderEmail) {
    if (log.data?.id) {
      await client.from("school_email_delivery_logs").update({
        status:"failed",attempt_count:1,last_attempt_at:new Date().toISOString(),
        error_summary:"EMAIL_PROVIDER_NOT_CONFIGURED: set BREVO_API_KEY and EMAIL_FROM in Supabase Edge Function secrets.",
      }).eq("id",log.data.id);
    }
    return reply(503,{status:"failed",message:"Email provider is not configured. Add BREVO_API_KEY and EMAIL_FROM to Supabase Edge Function secrets, then test again.",error:"EMAIL_PROVIDER_NOT_CONFIGURED"});
  }
  if (log.error) return reply(500,{status:"failed",error:"The email attempt could not be safely logged; no message was sent."});
  const html = "<p>This is a test message from <strong>"+enc(schoolName)+"</strong> in NOOR AI.</p><p>The provider was called only after authentication, school scope and email permission were checked.</p><p>This confirms provider acceptance only when a provider message ID is returned; it does not prove inbox delivery.</p>";
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email",{
      method:"POST",
      headers:{"accept":"application/json","api-key":providerKey,"content-type":"application/json"},
      body:JSON.stringify({sender:{name:senderName,email:senderEmail},to:[{email:recipient,name:str(profile.full_name||recipient,120)}],subject,htmlContent:html,textContent:"NOOR AI email configuration test for "+schoolName+". This is a test message."})
    });
    const body = await response.text();
    let result: any = {}; try { result = JSON.parse(body); } catch { result = {}; }
    if (!response.ok) {
      const summary = "Brevo returned HTTP "+response.status+". Check sender verification, API key and provider limits.";
      await client.from("school_email_delivery_logs").update({status:"failed",attempt_count:1,last_attempt_at:new Date().toISOString(),error_summary:summary}).eq("id",log.data.id);
      return reply(502,{status:"failed",message:summary,error:"EMAIL_PROVIDER_REJECTED"});
    }
    const messageId = str(result.messageId || result.message_id || "",500) || null;
    await client.from("school_email_delivery_logs").update({
      status:"sent",attempt_count:1,last_attempt_at:new Date().toISOString(),accepted_at:new Date().toISOString(),
      provider_message_id:messageId,error_summary:null
    }).eq("id",log.data.id);
    return reply(200,{status:"sent",provider:"brevo",provider_message_id:messageId,message:"Email was accepted by the provider. Inbox delivery is not confirmed."});
  } catch {
    await client.from("school_email_delivery_logs").update({status:"failed",attempt_count:1,last_attempt_at:new Date().toISOString(),error_summary:"Provider request failed before a response was confirmed."}).eq("id",log.data.id);
    return reply(502,{status:"failed",error:"EMAIL_PROVIDER_REQUEST_FAILED",message:"The email provider could not be reached. The failed attempt was logged."});
  }
}

async function retryFailedEmail(req: Request, input: any) {
  const { client, user, profile } = await getAuthClient(req);
  const schoolId = str(input.school_id,80), emailId = str(input.email_id,80);
  if (!/^[0-9a-f-]{36}$/i.test(schoolId) || !/^[0-9a-f-]{36}$/i.test(emailId)) return reply(400,{error:"Invalid school or email record."});
  if (!await canManage(client,profile,schoolId,"manage_email_automation")) return reply(403,{error:"You are not authorised to retry school email."});
  const {data:log,error} = await client.from("school_email_delivery_logs").select("id,status,attempt_count").eq("school_id",schoolId).eq("id",emailId).maybeSingle();
  if (error || !log) return reply(404,{error:"Email log not found in this school."});
  if (log.status!=="failed") return reply(409,{error:"Only failed email attempts can be retried."});
  if (log.attempt_count>=3) return reply(409,{error:"Retry limit reached. Review the failure before creating a new approved message."});
  const update=await client.from("school_email_delivery_logs").update({status:"queued",error_summary:null}).eq("school_id",schoolId).eq("id",emailId).eq("status","failed");
  if (update.error) return reply(500,{error:"Could not safely requeue this email."});
  return reply(200,{status:"queued",message:"Failed email requeued. Select Process queue to attempt delivery."});
}

async function processQueue(req: Request, input: any) {
  const { client, user, profile } = await getAuthClient(req);
  const schoolId = str(input.school_id,80);
  if (!/^[0-9a-f-]{36}$/i.test(schoolId)) return reply(400,{error:"Select the active school workspace."});
  if (!await canManage(client,profile,schoolId,"manage_email_automation")) return reply(403,{error:"You are not authorised to process school email."});
  const {data:rows,error} = await client.from("school_email_delivery_logs")
    .select("id,recipient_email,subject,body_html,attempt_count,idempotency_key")
    .eq("school_id",schoolId).eq("status","queued").lt("attempt_count",3).order("created_at").limit(20);
  if (error) return reply(500,{error:"Could not read the authorised email queue."});
  const providerKey=Deno.env.get("BREVO_API_KEY"), senderEmail=Deno.env.get("EMAIL_FROM");
  const senderName=Deno.env.get("EMAIL_FROM_NAME")||"NOOR AI";
  if (!providerKey || !senderEmail) {
    for (const row of rows||[]) await client.from("school_email_delivery_logs").update({
      status:"failed",attempt_count:Math.min(3,(row.attempt_count||0)+1),last_attempt_at:new Date().toISOString(),
      error_summary:"EMAIL_PROVIDER_NOT_CONFIGURED: set BREVO_API_KEY and EMAIL_FROM in Supabase Edge Function secrets."
    }).eq("school_id",schoolId).eq("id",row.id).eq("status","queued");
    return reply(503,{status:"failed",processed:0,failed:(rows||[]).length,message:"Email provider is not configured. Queue rows were marked failed instead of being reported as sent."});
  }
  let accepted=0,failed=0;
  for (const row of rows||[]) {
    const nextAttempt=(row.attempt_count||0)+1;
    const claim=await client.from("school_email_delivery_logs").update({
      status:"retrying",attempt_count:nextAttempt,last_attempt_at:new Date().toISOString(),error_summary:null
    }).eq("school_id",schoolId).eq("id",row.id).eq("status","queued").select("id").maybeSingle();
    if (claim.error || !claim.data) continue; // another worker claimed this row or RLS rejected the claim
    try {
      const bodyHtml=str(row.body_html||"",18000);
      const response=await fetch("https://api.brevo.com/v3/smtp/email",{
        method:"POST",headers:{"accept":"application/json","api-key":providerKey,"content-type":"application/json"},
        body:JSON.stringify({sender:{name:senderName,email:senderEmail},to:[{email:row.recipient_email}],subject:str(row.subject,250),
          htmlContent:bodyHtml||"<p>"+enc(str(row.subject,250))+"</p>",textContent:bodyHtml.replace(/<[^>]*>/g," ").slice(0,4000)||str(row.subject,250)})
      });
      const raw=await response.text();let result:any={};try{result=JSON.parse(raw);}catch{result={};}
      if(!response.ok) {
        failed++;
        await client.from("school_email_delivery_logs").update({status:nextAttempt>=3?"failed":"failed",error_summary:"Brevo returned HTTP "+response.status+". Check verified sender, API access and provider limits."})
          .eq("school_id",schoolId).eq("id",row.id);
      } else {
        accepted++;
        await client.from("school_email_delivery_logs").update({status:"sent",provider_message_id:str(result.messageId||result.message_id||"",500)||null,
          accepted_at:new Date().toISOString(),error_summary:null}).eq("school_id",schoolId).eq("id",row.id);
      }
    } catch {
      failed++;
      await client.from("school_email_delivery_logs").update({status:"failed",error_summary:"Email provider request failed before a successful response was confirmed."})
        .eq("school_id",schoolId).eq("id",row.id);
    }
  }
  return reply(200,{status:failed?"partial":"processed",processed:accepted+failed,accepted_by_provider:accepted,failed,message:"Accepted means the provider accepted the request; inbox delivery is not confirmed. At most 20 queued emails were processed in this request."});
}

async function testRule(req: Request, input: any) {
  const { client, profile } = await getAuthClient(req);
  const schoolId = str(input.school_id,80), ruleId = str(input.rule_id,80);
  if (!/^[0-9a-f-]{36}$/i.test(schoolId) || !/^[0-9a-f-]{36}$/i.test(ruleId)) return reply(400,{error:"Invalid school or rule identifier."});
  if (!await canManage(client,profile,schoolId,"manage_email_automation")) return reply(403,{error:"You are not authorised to test school automation rules."});
  const {data:rule,error:ruleError} = await client.from("school_automation_rules")
    .select("id,name,trigger_type,action_type,action_config,conditions,timezone,is_enabled")
    .eq("school_id",schoolId).eq("id",ruleId).maybeSingle();
  if (ruleError || !rule) return reply(404,{error:"Automation rule not found in the authorised school."});
  const now=new Date();
  let timezone=str(rule.timezone||"Asia/Kolkata",100);
  try { new Intl.DateTimeFormat("en-US",{timeZone:timezone}).format(now); } catch { timezone="Asia/Kolkata"; }
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const dateParts:any=Object.fromEntries(parts.map((p:any)=>[p.type,p.value]));
  const today=dateParts.year+"-"+dateParts.month+"-"+dateParts.day;
  const afterHour=new Date(now.getTime()+60*60*1000).toISOString();
  const plus3=new Date(now.getTime()+3*86400000).toISOString().slice(0,10);
  let matches: any[]=[];
  if (rule.trigger_type==="task_deadline_approaching" || rule.trigger_type==="task_overdue") {
    const {data,error}=await client.from("school_tasks").select("id,title,due_at,status")
      .eq("school_id",schoolId).in("status",["open","in_progress","blocked"]).not("due_at","is",null).order("due_at").limit(1000);
    if(error)return reply(500,{error:"Could not test the rule because task data could not be read completely."});
    matches=(data||[]).filter((t:any)=>rule.trigger_type==="task_deadline_approaching"
      ? new Date(t.due_at).getTime()>now.getTime()&&new Date(t.due_at).getTime()<=new Date(afterHour).getTime()
      : new Date(t.due_at).getTime()<now.getTime()).map((t:any)=>({id:t.id,title:t.title,deadline:t.due_at,status:t.status}));
  } else if(rule.trigger_type==="daily_report_due") {
    const [schedules,reports]=await Promise.all([
      client.from("teacher_schedule_entries").select("id,teacher_id,class_id,section_id,status,topic")
        .eq("school_id",schoolId).eq("schedule_date",today).eq("status","scheduled").limit(1500),
      client.from("daily_teaching_reports").select("id,teacher_id,report_status")
        .eq("school_id",schoolId).eq("report_date",today).in("report_status",["submitted","reviewed","approved"]).limit(1500)
    ]);
    if(schedules.error||reports.error)return reply(500,{error:"Could not test this rule because teaching-report records could not be read completely."});
    const completed=new Set((reports.data||[]).map((x:any)=>x.teacher_id));
    const unique=new Map<string,any>();
    for(const t of schedules.data||[])if(!completed.has(t.teacher_id)&&!unique.has(t.teacher_id))unique.set(t.teacher_id,{id:t.teacher_id,title:"Daily teaching report pending",schedule_id:t.id});
    matches=Array.from(unique.values());
  } else if(rule.trigger_type==="exam_approaching") {
    const {data,error}=await client.from("school_assessments").select("id,title,assessment_date,status")
      .eq("school_id",schoolId).gte("assessment_date",today).lte("assessment_date",plus3).order("assessment_date").limit(500);
    if(error)return reply(500,{error:"Could not test the rule because assessment records could not be read completely."});
    matches=(data||[]).map((x:any)=>({id:x.id,title:x.title,date:x.assessment_date,status:x.status}));
  } else if(rule.trigger_type==="syllabus_milestone_missed") {
    const [units,progress]=await Promise.all([
      client.from("syllabus_units").select("id,title,planned_completion_on,class_id,section_id,subject_id")
        .eq("school_id",schoolId).eq("is_active",true).not("planned_completion_on","is",null).lt("planned_completion_on",today).limit(1500),
      client.from("syllabus_progress").select("syllabus_unit_id,progress_status").eq("school_id",schoolId).eq("progress_status","completed").limit(3000)
    ]);
    if(units.error||progress.error)return reply(500,{error:"Could not test the rule because syllabus records could not be read completely."});
    const complete=new Set((progress.data||[]).map((x:any)=>x.syllabus_unit_id));
    matches=(units.data||[]).filter((x:any)=>!complete.has(x.id)).map((x:any)=>({id:x.id,title:x.title,planned_completion_on:x.planned_completion_on}));
  }
  return reply(200,{
    status:"dry_run",rule_id:rule.id,rule_name:rule.name,trigger_type:rule.trigger_type,action_type:rule.action_type,
    enabled:rule.is_enabled,reporting_timezone:timezone,run_at:now.toISOString(),match_count:matches.length,
    matches:matches.slice(0,10),
    message:"Dry-run only. No email, notification, task or official school record was created or changed."
  });
}

async function schoolInsights(req: Request, input: any) {
  const { client, user, profile } = await getAuthClient(req);
  const schoolId = str(input.school_id,80);
  if (!/^[0-9a-f-]{36}$/i.test(schoolId)) return reply(400,{error:"Select the active school workspace."});
  const allowed = profile.role === "creator"
    ? true
    : await canManage(client,profile,schoolId,"view_academic_reports") ||
      await canManage(client,profile,schoolId,"manage_tasks") ||
      await canManage(client,profile,schoolId,"manage_meetings");
  if (!allowed) return reply(403,{error:"You are not authorised to view school intelligence."});
  const now = new Date(), today = now.toISOString().slice(0,10);
  const plus7 = new Date(now.getTime()+7*86400000).toISOString();
  const plus30 = new Date(now.getTime()+30*86400000).toISOString();
  const [tasksQ,eventsQ,examsQ,reportsQ,teachersQ,unitsQ,progressQ,sessionsQ] = await Promise.all([
    client.from("school_tasks").select("id,title,status,priority,due_at,created_at").eq("school_id",schoolId).in("status",["open","in_progress","blocked"]).order("due_at").limit(500),
    client.from("calendar_events").select("id,title,event_type,starts_at,status").eq("school_id",schoolId).eq("status","scheduled").gte("starts_at",now.toISOString()).lte("starts_at",plus30).order("starts_at").limit(100),
    client.from("school_assessments").select("id,title,assessment_type,assessment_date,status").eq("school_id",schoolId).gte("assessment_date",today).lte("assessment_date",plus30.slice(0,10)).order("assessment_date").limit(100),
    client.from("daily_teaching_reports").select("id,teacher_id,report_date,report_status,topic_taught").eq("school_id",schoolId).eq("report_date",today).limit(1000),
    client.from("profiles").select("id",{count:"exact",head:true}).eq("school_id",schoolId).eq("role","teacher").eq("status","active"),
    client.from("syllabus_units").select("id,title,subject_id,class_id").eq("school_id",schoolId).eq("is_active",true).limit(1500),
    client.from("syllabus_progress").select("syllabus_unit_id,progress_status,teacher_reported_percentage").eq("school_id",schoolId).limit(1500),
    client.from("attendance_sessions").select("id,class_id,section_id,attendance_date,status").eq("school_id",schoolId).eq("attendance_date",today).limit(1000)
  ]);
  const queryErrors = [tasksQ,eventsQ,examsQ,reportsQ,teachersQ,unitsQ,progressQ,sessionsQ].filter(x=>x.error);
  if (queryErrors.length) return reply(500,{error:"Some authorised school records could not be read. No summary was generated from incomplete data."});
  const tasks = tasksQ.data || [], events = eventsQ.data || [], exams = examsQ.data || [];
  const overdue = tasks.filter((t:any)=>t.due_at && t.due_at < now.toISOString());
  const reports = reportsQ.data || [], teachers = teachersQ.count || 0;
  const submitted = reports.filter((r:any)=>["submitted","reviewed","approved"].includes(r.report_status));
  const sessions = sessionsQ.data || [];
  const units = unitsQ.data || [], progress = progressQ.data || [];
  const progressMap = new Map(progress.map((p:any)=>[p.syllabus_unit_id,p]));
  const notCompleted = units.filter((unit:any)=>progressMap.get(unit.id)?.progress_status !== "completed");
  const incompleteAttendance = sessions.filter((s:any)=>s.status === "draft");
  let markedAttendanceCount = 0;
  if (sessions.length) {
    const att = await client.from("attendance_records").select("id",{count:"exact",head:true})
      .eq("school_id",schoolId).in("session_id",sessions.map((s:any)=>s.id));
    if (att.error) return reply(500,{error:"Attendance data could not be read completely; no summary was generated."});
    markedAttendanceCount = att.count || 0;
  }
  const facts: any[] = [];
  facts.push({type:"fact",title:"Overdue open tasks",detail:overdue.length+" task(s) have a deadline before "+now.toLocaleString()+".",sources:overdue.slice(0,10).map((t:any)=>t.id)});
  facts.push({type:"fact",title:"Attendance completeness",detail:sessions.length+" attendance session(s) exist for "+today+"; "+incompleteAttendance.length+" remain in draft; "+markedAttendanceCount+" attendance record(s) are saved.",sources:sessions.map((s:any)=>s.id).slice(0,10)});
  facts.push({type:"fact",title:"Daily teaching reports",detail:submitted.length+" report(s) are marked submitted/reviewed out of "+reports.length+" report record(s) saved today; "+teachers+" active teacher account(s) exist. This is a gap indicator, not proof that every teacher was scheduled to report.",sources:reports.map((r:any)=>r.id).slice(0,10)});
  facts.push({type:"fact",title:"Syllabus tracking",detail:units.length+" active syllabus unit(s); "+notCompleted.length+" do not currently have a completed progress record.",sources:notCompleted.slice(0,10).map((u:any)=>u.id)});
  facts.push({type:"fact",title:"Upcoming events and exams",detail:events.length+" calendar event(s) and "+exams.length+" assessment(s) are scheduled in the next 30 days.",sources:[...events.slice(0,5).map((e:any)=>e.id),...exams.slice(0,5).map((e:any)=>e.id)]});
  const recommendations: string[] = [];
  if (overdue.length) recommendations.push("Review the "+overdue.length+" overdue task(s) and reassign or reschedule only after a human confirms the cause.");
  if (incompleteAttendance.length) recommendations.push("Ask the relevant class staff to complete or explicitly correct the "+incompleteAttendance.length+" draft attendance session(s).");
  if (notCompleted.length) recommendations.push("Ask the academic coordinator to review the "+notCompleted.length+" unit(s) without completed progress records before declaring syllabus coverage behind schedule.");
  if (events.some((e:any)=>new Date(e.starts_at).getTime() < now.getTime()+7*86400000) || exams.some((e:any)=>e.assessment_date<=plus7.slice(0,10))) recommendations.push("Review events and assessments in the next 7 days and confirm preparation owners.");
  if (!recommendations.length) recommendations.push("No immediate rule-based issue was identified in the queried records; continue routine review. This is not a guarantee that the school has no outstanding issues.");
  const period = "Today "+today+"; upcoming events, assessments and deadlines through "+plus30.slice(0,10)+". School timezone configured by dashboard: Asia/Kolkata.";
  let summary = "Verified database signals were calculated for the selected school. Review the counts and cited record IDs below; recommendations are for human review.";
  let aiUsed = false;
  const aiKey = Deno.env.get("AI_PROVIDER_API_KEY");
  if (aiKey) {
    const model = Deno.env.get("AI_PROVIDER_MODEL") || "gpt-4o-mini";
    const endpoint = Deno.env.get("AI_PROVIDER_CHAT_COMPLETIONS_URL") || "https://api.openai.com/v1/chat/completions";
    try {
      const response = await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+aiKey},
        body:JSON.stringify({model,temperature:0.1,max_tokens:700,
          messages:[{role:"system",content:"You are the NOOR AI school operations analyst. Use only verified records in the supplied JSON. Do not invent data, causes, student or staff judgments, or numbers. Separate facts from recommendations. No disciplinary or consequential decisions. Return JSON only with keys summary (string) and recommendations (array of strings)."},
          {role:"user",content:"Reporting period: "+period+"\nVerified facts with supporting source IDs: "+JSON.stringify(facts)+"\nExisting recommendations: "+JSON.stringify(recommendations)}]})});
      if (response.ok) {
        const raw:any=await response.json();const content=str(raw?.choices?.[0]?.message?.content,6000);
        const parsed=JSON.parse(content);
        if (typeof parsed.summary==="string" && Array.isArray(parsed.recommendations)) {
          summary=parsed.summary.slice(0,3000);recommendations.splice(0,recommendations.length,...parsed.recommendations.filter((x:any)=>typeof x==="string").map((x:string)=>x.slice(0,500)).slice(0,8));aiUsed=true;
        }
      }
    } catch (e) { console.warn("AI intelligence summary unavailable; verified facts retained.",String(e).slice(0,120)); }
  }
  return reply(200,{school_id:schoolId,generated_at:new Date().toISOString(),period,ai_used:aiUsed,summary,facts,recommendations});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:CORS});
  if (req.method !== "POST") return reply(405,{error:"POST required."});
  try {
    const raw=await req.text();
    if(raw.length>60000)return reply(413,{error:"Request is too large."});
    let input:any;try{input=JSON.parse(raw);}catch{return reply(400,{error:"Invalid JSON request body."});}
    const action=str(input.action,40);
    if(action==="send_test")return await sendTest(req,input);
    if(action==="process_queue")return await processQueue(req,input);
    if(action==="retry_failed_email")return await retryFailedEmail(req,input);
    if(action==="test_rule")return await testRule(req,input);
    if(action==="school_insights")return await schoolInsights(req,input);
    return reply(400,{error:"Unsupported school automation action."});
  } catch (e) {
    const message=e instanceof Error?e.message:"Request failed.";
    const status=/sign in|session/i.test(message)?401:/not active/i.test(message)?403:500;
    return reply(status,{error:message});
  }
});
