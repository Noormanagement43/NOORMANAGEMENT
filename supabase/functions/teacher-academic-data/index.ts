import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const allowedOrigins = new Set([
  "https://noormanagement43.github.io",
  "http://localhost:4173",
  "http://localhost:8080",
]);
const teacherRoles = new Set(["teacher", "faculty"]);
const studentRoles = new Set(["student", "university_student"]);
const attendanceStatuses = new Set(["present", "absent", "late", "leave"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}
function asText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
function dateKey(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.getUTCFullYear() + "-" + String(next.getUTCMonth() + 1).padStart(2, "0") + "-" + String(next.getUTCDate()).padStart(2, "0");
}
function localTimeToIso(date: string, hour: number, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, 0, 0);
  let guess = target;
  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const read = (name: string) => Number(parts.find((item) => item.type === name)?.value ?? 0);
    const seen = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
    const delta = target - seen;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess).toISOString();
}
function dayBounds(date: string, timezone: string): { start: string; end: string } {
  return {
    start: localTimeToIso(date, 0, timezone),
    end: localTimeToIso(nextDate(date), 0, timezone),
  };
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The teacher data request failed.";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json(null, { error: "Origin is not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: headersFor(origin) });
  if (req.method !== "POST") return json(origin, { error: "Use POST." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(origin, { error: "Sign-in required." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json(origin, { error: "Teacher data service is not configured on this environment." }, 503);
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: userError } = await authClient.auth.getUser();
  if (userError || !userResult.user) return json(origin, { error: "Your session is invalid or expired." }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json(origin, { error: "A JSON object is required." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json(origin, { error: "A valid JSON body is required." }, 400);
  }

  const action = asText(body.action, 40);
  const institutionId = body.institution_id;
  const membershipId = body.membership_id;
  if (!isUuid(institutionId) || !isUuid(membershipId)) {
    return json(origin, { error: "A valid institution and active membership are required." }, 400);
  }
  if (!["dashboard", "sessions_for_date", "roster", "save_attendance"].includes(action)) {
    return json(origin, { error: "Unsupported teacher data action." }, 400);
  }

  // Privileged access stays server-side. Every request is tied to the validated JWT user,
  // active institution membership, assigned group, and (for attendance) assigned session.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [membershipResult, institutionResult] = await Promise.all([
    admin.from("institution_memberships")
      .select("id,institution_id,user_id,role,status,joined_at")
      .eq("id", membershipId).eq("institution_id", institutionId)
      .eq("user_id", userResult.user.id).eq("status", "active").maybeSingle(),
    admin.from("institutions").select("id,name,timezone,status,institution_type")
      .eq("id", institutionId).eq("status", "active").maybeSingle(),
  ]);
  if (membershipResult.error || institutionResult.error) {
    return json(origin, { error: "Could not verify institution membership." }, 500);
  }
  const membership = membershipResult.data;
  const institution = institutionResult.data;
  if (!membership || !institution || !teacherRoles.has(membership.role)) {
    return json(origin, { error: "An active teacher/faculty membership in this institution is required." }, 403);
  }
  const timezone = typeof institution.timezone === "string" && institution.timezone ? institution.timezone : "UTC";

  try {
    const [assignedResult, homeRoomResult] = await Promise.all([
      admin.from("academic_group_memberships").select("group_id")
        .eq("institution_id", institutionId).eq("membership_id", membershipId)
        .eq("status", "active").in("group_role", ["teacher", "faculty"]).limit(500),
      admin.from("academic_groups").select("id")
        .eq("institution_id", institutionId).eq("homeroom_teacher_membership_id", membershipId)
        .eq("is_active", true).limit(500),
    ]);
    if (assignedResult.error || homeRoomResult.error) throw new Error("Assigned classes could not be verified.");
    const groupIds = [...new Set([
      ...(assignedResult.data ?? []).map((row) => row.group_id),
      ...(homeRoomResult.data ?? []).map((row) => row.id),
    ])];
    const groupsResult = groupIds.length
      ? await admin.from("academic_groups")
        .select("id,name,code,group_type,description,room_label,capacity,academic_year_id")
        .eq("institution_id", institutionId).eq("is_active", true).in("id", groupIds)
        .order("name").limit(500)
      : { data: [], error: null };
    if (groupsResult.error) throw new Error("Assigned classes could not be loaded.");
    const groups = groupsResult.data ?? [];
    const validGroupIds = new Set(groups.map((group) => group.id));

    async function getSession(sessionId: unknown, groupId: unknown) {
      if (!isUuid(sessionId) || !isUuid(groupId) || !validGroupIds.has(groupId)) {
        throw new Error("Choose a class and session assigned to your account.");
      }
      const result = await admin.from("class_sessions")
        .select("id,institution_id,academic_group_id,course_id,teacher_membership_id,title,room_label,starts_at,ends_at,session_status")
        .eq("id", sessionId).eq("institution_id", institutionId)
        .eq("academic_group_id", groupId).eq("teacher_membership_id", membershipId).maybeSingle();
      if (result.error) throw new Error("Session access could not be verified.");
      if (!result.data || result.data.session_status === "cancelled") {
        throw new Error("That timetable session is unavailable or is not assigned to you.");
      }
      return result.data;
    }
    async function getRoster(groupId: string) {
      const groupMembers = await admin.from("academic_group_memberships")
        .select("membership_id").eq("institution_id", institutionId).eq("group_id", groupId)
        .eq("group_role", "student").eq("status", "active").limit(1000);
      if (groupMembers.error) throw new Error("The active student roster could not be loaded.");
      const ids = [...new Set((groupMembers.data ?? []).map((row) => row.membership_id))];
      if (!ids.length) return [];
      const members = await admin.from("institution_memberships")
        .select("id,user_id,role,status,joined_at").eq("institution_id", institutionId)
        .in("id", ids).eq("status", "active").in("role", ["student", "university_student"]).limit(1000);
      if (members.error) throw new Error("Student memberships could not be loaded.");
      const userIds = [...new Set((members.data ?? []).map((row) => row.user_id).filter(Boolean))];
      const profiles = userIds.length
        ? await admin.from("profiles").select("id,full_name,avatar_url").in("id", userIds).limit(1000)
        : { data: [], error: null };
      if (profiles.error) throw new Error("Student names could not be loaded.");
      const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
      return (members.data ?? []).map((member) => {
        const profile = profileById.get(member.user_id);
        return {
          membership_id: member.id,
          full_name: profile?.full_name || "Student",
          avatar_url: profile?.avatar_url || null,
        };
      }).sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    async function getCourses(courseIds: string[]) {
      const uniqueIds = [...new Set(courseIds.filter(Boolean))];
      if (!uniqueIds.length) return new Map<string, { title: string; course_code: string | null }>();
      const result = await admin.from("courses").select("id,title,course_code")
        .eq("institution_id", institutionId).in("id", uniqueIds).limit(500);
      if (result.error) throw new Error("Subject information could not be loaded.");
      return new Map((result.data ?? []).map((course) => [course.id, { title: course.title, course_code: course.course_code }]));
    }

    if (action === "dashboard") {
      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const until = new Date(Date.now() + 14 * 86400000).toISOString();
      const sessionsResult = await admin.from("class_sessions")
        .select("id,academic_group_id,course_id,title,room_label,starts_at,ends_at,session_status")
        .eq("institution_id", institutionId).eq("teacher_membership_id", membershipId)
        .neq("session_status", "cancelled").gte("starts_at", from).lte("starts_at", until)
        .order("starts_at", { ascending: true }).limit(500);
      if (sessionsResult.error) throw new Error("Your timetable could not be loaded.");
      const sessions = sessionsResult.data ?? [];
      const sessionIds = sessions.map((row) => row.id);
      const courseMap = await getCourses(sessions.map((row) => row.course_id).filter(Boolean));
      const decoratedSessions = sessions.map((session) => ({
        ...session,
        class_name: groups.find((group) => group.id === session.academic_group_id)?.name ?? "Class unavailable",
        subject_name: session.course_id ? courseMap.get(session.course_id)?.title ?? session.title : session.title,
      }));
      const [profileResult, groupRosterResult, attendanceResult] = await Promise.all([
        admin.from("profiles").select("id,full_name,avatar_url,preferred_language,timezone,created_at")
          .eq("id", userResult.user.id).maybeSingle(),
        groupIds.length
          ? admin.from("academic_group_memberships").select("group_id,membership_id")
            .eq("institution_id", institutionId).in("group_id", groupIds)
            .eq("group_role", "student").eq("status", "active").limit(5000)
          : Promise.resolve({ data: [], error: null }),
        sessionIds.length
          ? admin.from("attendance_records")
            .select("id,session_id,student_membership_id,attendance_status,marked_at,updated_at")
            .eq("institution_id", institutionId).in("session_id", sessionIds)
            .order("marked_at", { ascending: false }).limit(5000)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profileResult.error || groupRosterResult.error || attendanceResult.error) {
        throw new Error("Some dashboard records could not be read. Check institution setup and permissions.");
      }
      const distinctStudents = new Set((groupRosterResult.data ?? []).map((row) => row.membership_id));
      const statusCounts: Record<string, number> = { present: 0, absent: 0, late: 0, leave: 0 };
      for (const record of attendanceResult.data ?? []) {
        if (record.attendance_status in statusCounts) statusCounts[record.attendance_status] += 1;
      }
      return json(origin, {
        institution: { id: institution.id, name: institution.name, timezone, institution_type: institution.institution_type },
        membership: { id: membership.id, role: membership.role, joined_at: membership.joined_at },
        profile: profileResult.data ?? { full_name: userResult.user.email?.split("@")[0] ?? "Teacher", avatar_url: null },
        groups: groups.map((group) => ({
          ...group,
          student_count: (groupRosterResult.data ?? []).filter((row) => row.group_id === group.id).length,
        })),
        sessions: decoratedSessions,
        attendance: attendanceResult.data ?? [],
        metrics: {
          student_count: distinctStudents.size,
          group_count: groups.length,
          session_count: sessions.length,
          attendance_count: (attendanceResult.data ?? []).length,
          status_counts: statusCounts,
        },
        capabilities: {
          assignments: false,
          submissions: false,
          notices: false,
          assessments: false,
          correction_audit: "Attendance corrections are recorded in the attendance notes field; the current schema does not provide an immutable audit table.",
        },
      });
    }

    if (action === "sessions_for_date") {
      const groupId = body.group_id;
      const date = asText(body.attendance_date, 10);
      if (!isUuid(groupId) || !validGroupIds.has(groupId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json(origin, { error: "Choose an assigned class and valid date." }, 400);
      }
      const bounds = dayBounds(date, timezone);
      const result = await admin.from("class_sessions")
        .select("id,academic_group_id,course_id,title,room_label,starts_at,ends_at,session_status")
        .eq("institution_id", institutionId).eq("teacher_membership_id", membershipId)
        .eq("academic_group_id", groupId).neq("session_status", "cancelled")
        .gte("starts_at", bounds.start).lt("starts_at", bounds.end)
        .order("starts_at", { ascending: true }).limit(100);
      if (result.error) throw new Error("Scheduled sessions could not be loaded for that date.");
      const courseMap = await getCourses((result.data ?? []).map((row) => row.course_id).filter(Boolean));
      return json(origin, {
        sessions: (result.data ?? []).map((session) => ({
          ...session,
          subject_name: session.course_id ? courseMap.get(session.course_id)?.title ?? session.title : session.title,
        })),
        timezone,
      });
    }

    if (action === "roster") {
      const groupId = body.group_id;
      if (!isUuid(groupId) || !validGroupIds.has(groupId)) return json(origin, { error: "Choose a class assigned to you." }, 403);
      const sessionId = body.session_id;
      const attendanceDate = asText(body.attendance_date, 10);
      let session = null;
      let attendance = [];
      if (sessionId) {
        session = await getSession(sessionId, groupId);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate) || dateKey(session.starts_at, timezone) !== attendanceDate) {
          return json(origin, { error: "Selected session does not match the chosen date in the institution timezone." }, 400);
        }
        const existing = await admin.from("attendance_records")
          .select("id,session_id,student_membership_id,attendance_status,marked_at,updated_at,notes")
          .eq("institution_id", institutionId).eq("session_id", session.id).limit(1000);
        if (existing.error) throw new Error("Saved attendance could not be reloaded.");
        attendance = existing.data ?? [];
      }
      const roster = await getRoster(groupId);
      return json(origin, { group_id: groupId, session, students: roster, attendance, timezone });
    }

    if (action === "save_attendance") {
      const groupId = body.group_id;
      const session = await getSession(body.session_id, groupId);
      const attendanceDate = asText(body.attendance_date, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate) || dateKey(session.starts_at, timezone) !== attendanceDate) {
        return json(origin, { error: "The session does not match the chosen attendance date." }, 400);
      }
      const rawMarks = body.marks;
      if (!Array.isArray(rawMarks) || rawMarks.length < 1 || rawMarks.length > 500) {
        return json(origin, { error: "Attendance requires a non-empty class roster of at most 500 students." }, 400);
      }
      const marks: Array<{ student_membership_id: string; status: string; notes: string }> = [];
      const seen = new Set<string>();
      for (const entry of rawMarks) {
        if (!entry || typeof entry !== "object" || !isUuid(entry.student_membership_id) ||
          !attendanceStatuses.has(entry.status) || typeof entry.notes !== "string" || entry.notes.length > 1000) {
          return json(origin, { error: "Each student must have a valid attendance status and a note no longer than 1000 characters." }, 400);
        }
        if (seen.has(entry.student_membership_id)) return json(origin, { error: "Duplicate student entries were rejected." }, 400);
        seen.add(entry.student_membership_id);
        marks.push({
          student_membership_id: entry.student_membership_id,
          status: entry.status,
          notes: entry.notes.trim(),
        });
      }
      const roster = await getRoster(groupId);
      const rosterIds = new Set(roster.map((student) => student.membership_id));
      if (rosterIds.size !== seen.size || [...seen].some((id) => !rosterIds.has(id))) {
        return json(origin, { error: "The submitted marks do not match the current active roster. Reload the class before saving." }, 409);
      }

      const existingResult = await admin.from("attendance_records")
        .select("id,session_id,student_membership_id,attendance_status,marked_at,updated_at,notes")
        .eq("institution_id", institutionId).eq("session_id", session.id).limit(1000);
      if (existingResult.error) throw new Error("Existing attendance could not be checked before saving.");
      const existingByStudent = new Map((existingResult.data ?? []).map((record) => [record.student_membership_id, record]));
      const reason = asText(body.correction_reason, 500);
      const changedExisting = marks.filter((mark) => {
        const prior = existingByStudent.get(mark.student_membership_id);
        return prior && (prior.attendance_status !== mark.status || (prior.notes ?? "") !== mark.notes);
      });
      if (changedExisting.length && reason.length < 5) {
        return json(origin, { error: "A correction reason of at least five characters is required when changing saved attendance.", correction_required: true }, 400);
      }

      const failures: Array<{ student_membership_id: string; error: string }> = [];
      let saved = 0;
      let unchanged = 0;
      for (const mark of marks) {
        const prior = existingByStudent.get(mark.student_membership_id);
        if (prior && prior.attendance_status === mark.status && (prior.notes ?? "") === mark.notes) {
          unchanged += 1;
          continue;
        }
        const nowIso = new Date().toISOString();
        let notes = mark.notes || null;
        if (prior) {
          const correctionLine = "[Correction " + nowIso + "] " + prior.attendance_status + " -> " + mark.status +
            "; reason: " + reason + "; recorded by teacher membership " + membership.id.slice(0, 8) + ".";
          notes = [notes, correctionLine].filter(Boolean).join("\n").slice(-1000) || null;
          const updated = await admin.from("attendance_records").update({
            attendance_status: mark.status,
            marked_by: userResult.user.id,
            marked_at: nowIso,
            notes,
          }).eq("id", prior.id).eq("institution_id", institutionId).eq("updated_at", prior.updated_at)
            .select("id").maybeSingle();
          if (updated.error || !updated.data) {
            failures.push({ student_membership_id: mark.student_membership_id, error: "This record changed since it was loaded. Reload and review before correcting it." });
          } else {
            saved += 1;
          }
        } else {
          const inserted = await admin.from("attendance_records").insert({
            institution_id: institutionId,
            session_id: session.id,
            student_membership_id: mark.student_membership_id,
            attendance_status: mark.status,
            marked_by: userResult.user.id,
            marked_at: nowIso,
            notes,
          }).select("id").maybeSingle();
          if (inserted.error || !inserted.data) {
            failures.push({
              student_membership_id: mark.student_membership_id,
              error: inserted.error?.code === "23505"
                ? "A record already exists for this session and student. Reload the roster."
                : "This student's attendance could not be saved.",
            });
          } else {
            saved += 1;
          }
        }
      }
      return json(origin, {
        saved,
        unchanged,
        failures,
        partial: failures.length > 0,
        message: failures.length
          ? "Some rows were not saved. Reload the roster to review the current database state."
          : "Attendance writes completed. Reload the roster to verify the saved records.",
      });
    }

    return json(origin, { error: "Unsupported teacher data action." }, 400);
  } catch (error) {
    return json(origin, { error: errorMessage(error) }, 400);
  }
});
