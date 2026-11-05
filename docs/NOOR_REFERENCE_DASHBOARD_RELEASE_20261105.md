# NOOR reference dashboard and separate class results

All work targets Noormanagement43/NOORMANAGEMENT and Supabase ayrryemawwplguaauxij. Existing records and features are preserved.

## Implemented

- Principal/Manager share the reference-inspired burgundy/ivory overview, own identity and rectangular portrait. Greeting follows the trusted membership role. School-admin memberships render as Manager; principal remains Principal. Teacher recurring timetable is read from canonical saved periods and daily lesson/topic rows; scheduled time is not misrepresented as proof of teaching.
- Separate sidebar page: Principal/Manager **Class Performance & Attendance**, Teacher **My Class Performance**, Student **All Over Class Result**, Parent **My Child’s Class Result**. No class-results table is appended beneath the Principal overview.
- Class/section and date-range filters; three reference-style left summary cards (Total Students, Class Average, Average Attendance). No Top Performers card. Small private student avatars, roll numbers when saved, shared-rank medals, green/teal/gold marks bars and separate circular attendance indicators. Missing data is never filled with sample scores.
- Each permitted student row has Subject Marks: own profile/roll/class, total earned/possible marks, and actual subject-level aggregates. Lab/practical appears only when graded as a subject. Class-level assessments also appear in the relevant section's own student results. Grade/status bands are clearly indicative; no unsupported official grading policy, academic term or school-year metadata is invented.
- Classes & Sections includes saved school chart type and per-section colour controls. Navy/pink attendance series default to actual section names. Line/bar use recorded attendance; Ogive is correctly a cumulative marks distribution on the class-results page.
- Principal operations use canonical school tables: notices/meetings/calendar create/edit, school task create/edit/complete/archive, teacher daily lesson diary, roster search, staff check-in recording, pause/reactivate and teacher class-access management. Timetable period timing remains Principal-controlled; teachers own their period details. Joining notifications use the existing membership-joined audit events.
- Joining-code Settings reuses the already secured canonical APIs. Fixed a real signup TDZ caused by reusing the outer `kind` variable; regression test exercises both Student and Teacher signup callbacks.
- Own profile-photo uploads now use the destination private profile bucket and `avatar_url` reference rather than missing legacy `avatar_path` columns. Private avatar reads explicitly permit leadership, assigned teachers, and verified linked guardians, preserving school isolation.
- Parent email registration is separate from privileged school membership. Leadership explicitly links a verified parent email to an active child. Parent/student responses contain only own/linked children plus class aggregates and own ranks; classmates' identified marks/attendance are not disclosed. Unlinking the last child suspends the parent membership; explicit authorized relinking restores it. No identity/role/guardian relationship is inferred from editable metadata.

## Applied database changes

Additive snapshots in `supabase/new-project`: reference_dashboard_performance, principal_operations, verified_guardian_class_comparison, teacher_class_access, revoke_guardian_link, reactivate_verified_guardian_link, scoped_student_profile_photos, class_subject_marks_and_roll_numbers, class_parent_group_result_scope. They document applied migrations and are not scripts to run again unchanged.

## Verification and limits

- Node regression tests and JS/inline-script parsing are run before release.
- Live synthetic SQL rollback covers existing timetable/sections plus real score averages, subject totals, class-level Lab marks, principal/assigned-teacher detail access, student/guardian private responses, unassigned section and cross-school denial, guardian link/unlink/relink, class-access validation, private avatar scope, staff/task permissions and preferences. All synthetic users and records are rolled back; remaining test users = zero.
- Security advisor reports no new security findings; the pre-existing leaked-password-protection warning remains.
- AI-generated images are explicitly sample-data design previews, not live application screenshots or database evidence. No sample students/grades from those images are inserted into production.
- A real signed-in user walkthrough, physical phone/laptop visual review, actual photo upload and delivered verification/recovery email are separate from automated/mock/SQL verification. SMTP/inbox delivery is not established by this release. Existing broader teacher/student workflows are preserved; their full completion is not claimed here.
