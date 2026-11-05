# Institution workspaces and joining — 2026-11-05

Implemented in the existing NOOR app and destination project ayrryemawwplguaauxij:

- Two large School / University cards, responsive class/stream cards and custom child sections. Existing classes/sections are preserved. School Class 1–10 and University BiPC/HEC/MPC/CS starter buttons add only missing names in the selected area. Custom programme names, renaming and archive/restore are supported without a fixed section-count limit.
- `academic_groups.education_path` separates school and university structure inside the same institution. Existing rows were classified from their institution type. Initial student section selection remains membership-authorized and same-school/parent validated.
- Institution-scoped labs with editable descriptions/practical-work instructions. This feature stores lab definitions, not a full assignment/submission/grading subsystem. Authorized leadership manages labs; members can read their own institution's labs.
- Student and Staff/Management signup search schools by name, select a suggestion, then supply the correct code and profile/email/password. No typed School ID is required. Search is a deliberately public, bounded, name/type/slug-only RPC; it never exposes contacts, memberships or codes. Duplicate names can be distinguished by public school slug.
- Settings uses actual destination RPCs to save independent Student/Staff/Management joining codes. Blank fields preserve saved hashes, replacements invalidate old codes, and codes expire after 30 days. Existing code values cannot be recovered from hashes; leadership can set replacements. Values are not logged or returned by status RPCs.
- Management codes assign `school_admin`; only active principal/school_admin/university_admin can set them. Generic code rotation remains restricted to teacher/student. Admission checks the selected group against the role attached to the server-verified code. Rejected joins leave no membership. Wrong pending codes can be corrected without recreating the account. Existing linked accounts continue email/password sign-in; joining codes do not replace passwords.
- Existing principal-defined timings and teacher-owned recurring timetable / separate daily lesson-topic behavior are preserved.
- Active browser configuration and JS/HTML Supabase destinations reference ayrryemawwplguaauxij only; no old project URL or old-project fallback was found in that scan. Historical documentation is not a runtime database connection.

## Database migration history

1. institution_workspaces_and_editable_join_codes
2. restrict_generic_code_rotation_roles
3. isolate_public_school_name_discovery

`supabase/new-project/institution_workspaces_and_join_codes.sql` is a consolidated snapshot of applied changes, not an idempotent script to rerun. Discovery lives in a dedicated non-exposed schema with narrowly granted usage/execute; anonymous users receive no usage on the general private schema.

## Verification

- 130 Node regression tests pass; modified JavaScript and inline index scripts parse successfully.
- Live synthetic database rollback checks cover prior class/section/timetable isolation plus code saving/status, duplicate-code rollback, hash-only storage, old-code replacement, role/school mismatch denial, teacher management-code denial, successful teacher/admin admission, lab tenant isolation and student-write denial, bounded anonymous search and anonymous code-write denial. All test records rolled back; remaining synthetic Auth users: zero.
- Security advisor: no new findings. Existing leaked-password-protection-disabled warning remains.

Real-user signup, inbox delivery, authenticated dashboard browser layout and actual lab/code entry by the owner still require a real-session walkthrough. Local browser rendering was unavailable in the execution container; mocked tests are not a substitute for that walkthrough. Supabase Auth SMTP/actual recovery-email delivery remains a separate outstanding account configuration.
