# NOOR: Moving safely to the new Supabase project

Status: migration is NOT complete. Existing GitHub Pages credentials must stay in place until the replacement backend is compatible and verified.

## Connected projects
- Current GitHub Pages frontend uses Supabase project npzedchxfurcphvpjock. The connected tools do not provide read access to its historical school records.
- New connected project ayrryemawwplguaauxij uses institution-oriented tables: institutions, institution_memberships, academic_groups, class_sessions, attendance_records. It has no active institutions or memberships as of the most recent audit.
- Current frontend still queries schools, profiles.school_id, school_memberships, classes, sections, school_notices, noor_teacher_periods, teacher_assignments and many more original-school tables. Simply replacing URL/key will break sign-in and pages.

## Preparations already completed
- New project Edge Function noor-v2-ai is deployed and JWT-verifying. It authorizes via active institution memberships and checks the institution is active.
- The Gemini secret is read server-side only. Default model gemini-2.5-flash; optionally override with GEMINI_MODEL.
- Authentication and AI cannot be verified with a real institution member until the new project has properly on-boarded institutions and memberships.

## Migration work required before cutover
1. Secure an original database backup/export with owner authorization: schools, profiles, memberships, joining codes, class-section structure, teacher periods, attendance, notes, assignments, results, notices, file references.
2. Approve a single canonical schema and migration mapping; choose how old school_id links become institution_id and memberships. RLS must always isolate schools.
3. Rebuild onboarding and principal/teacher/student/parent permissions on the new project with signed-in role testing.
4. Move structure and people first, then timetable and attendance, then assignments/notes/marks/notices and file storage. Preserve historical student records.
5. Deploy corresponding v2 notification and email backends, plus secure Brevo secrets and delivery logs.
6. Test end to end as real principal, teacher and student users (including join/pause/reactivate, live attendance and period ticks, note and assignment publishing, marks, parent read-only, school notices).
7. Only then switch public config.js SUPABASE_URL and publishable key, with old project retained for rollback.

## Gemini setup link
https://supabase.com/dashboard/project/ayrryemawwplguaauxij/settings/functions
Open Edge Functions -> Secrets, create GEMINI_API_KEY and optionally GEMINI_MODEL, then Save.
To set up Brevo later, store BREVO_API_KEY and EMAIL_FROM there. Never paste keys in chat, GitHub, a school form or browser localStorage.

## Known blockers
- Old database content currently cannot be verified with the new connected account.
- Current site expects a different database schema. The v2 function is deployed but not wired to the old-schema website.
- New database has no institution memberships; provider key status and actual AI replies are not yet verified.