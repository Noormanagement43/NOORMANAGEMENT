# NOOR connection audit — 28 October 2026

## What the connected tools actually show

**Connected new Supabase project:** `ayrryemawwplguaauxij` (Noormanagement43's Project), healthy.

At audit time, before adding the new teacher timetable:
- `auth.users`: **2 accounts**
- `public.profiles`: **2 records**, with both `avatar_url = NULL`
- `public.institutions`: **0**
- `public.institution_memberships`: **0**
- `public.academic_groups`: **0**
- `public.class_sessions`: **0**
- `public.attendance_records`: **0**
- **14 public tables** (now 15, after the new teacher timetable migration). New schema uses `institution_id`, not the legacy `school_id`.
- No prior photo bucket was present.
- The Supabase app shows `principal-dashboard-preview`, `principal-dashboard-data`, and `noor-v2-ai` Edge Functions deployed, but these do not establish that the old data was imported.

**GitHub Pages root** was still configured at `config.js` to `https://npzedchxfurcphvpjock.supabase.co` — the *different* school-id Supabase backend. An Antigravity clone in a different Supabase project is not visible to this connected Supabase account. These results are directly inspected database metadata, not a guess.

## What has been built into the new project, not the old one

Applied successfully **to project ayrryemawwplguaauxij**:
1. `noor_v2_teacher_self_timetable_and_private_avatars` — adds teacher-owned weekly timetable with separate `teacher_timetable_periods`, active institute membership checks, row-level permissions for self creation/update/delete and read rights for active institute members. Teacher never needs principal period approval. Protects ownership and institution transfer, validates times and group foreign keys, rejects overlaps.
2. `noor_v2_school_class_section_parenting` — adds class-section parenting (section points to a class in its institution). School admins/principals use existing RLS.
3. Private `noor-profile-photos` Storage bucket (max 5 MB JPG/PNG/WebP), upload allowed only into the signed-in user's UUID folder; reading allowed to self and verified active same-institution leadership. Private profile reference constraint `avatar_url` must start with that user's ID. Existing two profile rows and names were not altered.

See exact applied SQL in `supabase/new-project/migrations`.

The new isolated browser workspace, **`/noor-v2.html`**, uses **only** `ayrryemawwplguaauxij` and its own publishable key. It provides new-project login/sign-up, verified account creation of an institution via its existing RPC, real class/section creation and editing for school leadership, teacher self-managed timetable (with broad subject icons), and personal photo editing with double account authentication. KPI values are database sourced; no fake school records are seeded.

## Important scope and cutover

The root legacy GitHub Pages app still uses `config.js` and the old `school_id` database. The last audit found zero institutions, zero memberships and zero classes in this connected new project. **Changing the root URL to the new database without a complete front-end/schema migration would break all of the legacy role dashboards and hide their historical data**. Consequently the legacy root configuration was not silently changed.

The new `/noor-v2.html` is a functional *new-backend workspace*, **not** a completed copy of the full old Teacher/Student/Principal SaaS features. Smart Notes, assignments, attendance, notifications, parent roles and management need compatible `institution_id` migrations and real-user tests before making it the public root app.

To verify an Antigravity clone, confirm whether the clone's destination Supabase project reference is **exactly** `ayrryemawwplguaauxij`. The connected project has no imported institutions at this time. Do not overwrite or delete any old school records as a workaround.

## Profile photo incident

The legacy app's signup and edited photos previously crossed a shared app identity path and could be rendered using a stale active account. New shared helper `noor-avatar-isolation.js` requires the displayed profile ID to equal the authenticated UID, re-verifies before the database write after upload, writes into a unique UUID path per person, updates only that person's profile and refuses stale UI contexts. The old UI's student and teacher uploads now use that helper, and the sign-in sequence aborts mismatched workspaces. The new backend independently enforces this at the Storage and Postgres row-level policy boundaries. **Live double-account device testing is still needed** before calling the original reported case fully resolved.

## Deployment and verification checklist
- [x] New project DDL applied; policy and empty-data counts inspected.
- [x] Private bucket created with per-user folder write policy.
- [x] Role-based `noor-v2.html` and user-owned timetable.
- [x] Subject icons: many disciplines, including Zoology, Anthropology, Botany, Microbiology, Psychology, Engineering and custom names with fallback initials.
- [ ] Login to new project as a real Principal and Teacher (there are currently zero memberships).
- [ ] Reproduce old photo incident on two authenticated devices and verify no cross-account avatar updates.
- [ ] Port the remaining legacy role workflows before changing the root `config.js`.
