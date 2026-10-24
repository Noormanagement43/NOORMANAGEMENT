# NOOR AI Implementation Tracker

Last updated: 2026-10-18 (current live verification; see the newest section at the end)

This tracker separates live database work from frontend features that are still prototypes or awaiting end-to-end tests.

## Dedicated project
- [x] Created and verified the separate Supabase project NOOR-AI (npzedchxfurcphvpjock) in the Mumbai region.
- [x] Confirmed project state ACTIVE_HEALTHY.
- [x] Connected the unified frontend to the project using a browser-safe publishable key.
- [!] Historical 2026-10-16 clean-advisor claim is superseded: see the 2026-10-18 security review at the end of this tracker.
- [!] Historical 2026-10-16 performance claim is superseded; the latest review found index and policy advisories and applied a reviewed index cleanup. See the latest section.
- [ ] Provision the first trusted Platform Creator account using a secure account-setup process.
- [ ] Create and verify the first school workspace and its Headmaster account.
- [ ] Add automated cross-school authorization tests before onboarding real schools.

## Database migrations verified live
- [x] Initial identity and school workspace schema: student_admin_workspace.
- [x] Profiles, schools, school directory, classes, sections, teacher class assignments and audit logs.
- [x] RLS enabled on all current public tables.
- [x] Student profile fields include full name, email, mobile, parent/guardian name, roll number, class, section and private avatar path.
- [x] Private student-photo bucket configured for image uploads.
- [x] Added and applied school_operations_foundation:
  - school settings and subject catalogue
  - attendance sessions and per-student attendance records
  - tasks and individual assignees
  - school notices and calendar/meeting events
  - notification event log
  - AI-generation usage ledger
- [x] Added and applied school_operations_policy_hardening:
  - school/class assignment checks for attendance
  - task access helper to avoid recursive RLS policy evaluation
  - task assignee validation and foreign-key indexes
- [x] Added and applied school_role_policy_hardening:
  - removed permissive legacy policies that allowed teachers to manage school-wide classes/sections
  - restricted class, section and teacher-assignment management to school leadership
  - consolidated overlapping profile-update policies
  - indexed remaining foreign-key paths flagged by the advisor
- [x] Verified the new tables are present and RLS-enabled.
- [ ] Mirror the live operational SQL into version-controlled migration files and verify a clean-database replay.
- [ ] Add automated tests for attendance, task access, role permissions and school isolation.

## Frontend / identity
- [x] Unified burgundy/rose, ivory and champagne-gold visual interface.
- [x] Student registration UI asks for student name, email/login, password, school, join code, roll number, class, section, mobile, parent/guardian name and student photo.
- [x] Student dashboard greeting uses the saved profile name (for example, Hello, first name).
- [x] Sign-in handler calls Supabase Auth and checks the database profile role/status before entering the workspace.
- [ ] Test a full registration and email-verification cycle with a real mailbox.
- [ ] Confirm photo upload and profile persistence with a real test account.
- [ ] Complete and verify the secure staff account provisioning/invitation flow.
- [ ] Finish production-quality, role-specific dashboards with database-backed data.

## Teacher / Headmaster / Manager / Creator operations
- [x] Database tables created for attendance, subjects, tasks, notices, calendar events, notification logging and AI usage tracking.
- [ ] Connect teacher attendance entry to the new tables and verify save/reload.
- [ ] Connect Headmaster class/section/teacher management and school notices.
- [ ] Connect teacher-to-student and Headmaster-to-teacher task assignment and status updates.
- [ ] Complete Manager's restricted permission set and verify every sensitive action server-side.
- [ ] Build Creator admin console for school provisioning, subscription/usage overview and account support.

## Task 3 — student progress and AI assessment
- [ ] Connect student dashboard to authorized attendance and marks records.
- [ ] Build attendance/marks calculations and school-branded PDF reports.
- [ ] Add syllabus uploads with server-side OCR, text review and correction.
- [ ] Add secure server-side AI paper generation, editable saved papers, PDF export and protected answer keys.
- [ ] Add usage limits and provider-cost tracking before enabling paid AI calls.

## Task 4 — notifications and email
- [x] Notification event table exists for queued/sent/failed/skipped events.
- [ ] Configure a trusted email provider and server-side secrets.
- [ ] Send guardian absence emails only after attendance is saved; test delivery and logs.
- [ ] Add teacher absence alerts, notices, meeting invitations and in-app notifications.
- [ ] Never label a queued event as sent without provider confirmation.

## Deployment and safety
- [x] GitHub Pages deployment is live at https://noormanagement43.github.io/NOORMANAGEMENT/.
- [!] The 2026-10-16 security check is a historical snapshot, not the current status. See the latest section below.
- [ ] Resolve performance-advisor foreign-key index warnings for the full schema.
- [ ] Run end-to-end tests before treating the website as production-ready.
- [ ] Never commit Supabase service-role keys, passwords or AI/email provider secrets.
- [ ] Do not enter real student or guardian data until account provisioning, authorization and persistence tests pass.

Current honest status: the dedicated database and operational schema foundations are live. The website still needs end-to-end workflow wiring and verification; this is not yet a production-ready school SaaS.



## Task 5 + Task 6 integration update — 16 October 2026

This work extends the existing NOOR AI application and its existing Supabase project `npzedchxfurcphvpjock`; it does not create a second app or project.

### Implemented in the current codebase

- New teacher views: **My Teaching & Smart Notes**, **Weekly Teaching Plan**, **Today's Teaching Report**, **My Schedule**, and **Assessments & Marks**.
- Smart Notes supports rough notes, reviewed OCR text, AI-generated draft notes, class/year/subject context, teacher approval before publish, saved drafts, and print/save-as-PDF.
- Multiple JPG/PNG/WebP syllabus images can be uploaded with limits (8 per request, 4 MB each, 12 MB total). Original files are stored in the private `noor-syllabus-source` bucket with school/context metadata and restricted storage policies.
- Weekly plans distinguish a saved plan from actual teaching completion. Daily reports have a draft/submitted/reviewed/returned status, local recovery, server autosave, version/revision trail, review feedback, and a teacher-facing notification stream.
- Syllabus units/progress support chapter/lesson/topic status and optional teacher-reported percentages. Management summaries use saved records and label percentages as reported indicators.
- Published Smart Notes have a student view restricted to approved notes for the student's class/section. Internal reports, draft notes and review remarks are not student-facing.
- Assessment/test metadata and assessment-result tables now store actual marks, grades, and feedback; student views only read their own saved results and management can see authorized student results.
- Management navigation now includes the School Management Portal, Student Directory, Teacher Directory, Academic Monitoring, Attendance, Assessments & Marks, Schedules & Extra Classes, Meetings, Notices, Staff & Access, and Audit Logs. The Management role chooser exposes exactly Principal, School Creator/Owner, and Manager; selecting a role by itself does not grant it.
- Secure owner onboarding is mediated by a verified-email server RPC. School codes are random; the secret code is stored only as a hash and displayed once after creation/rotation. School invites use single-use token hashes, email matching and expiry. Existing membership removal preserves academic history; a trusted RPC handles reactivation.
- Manager grants default to denied. The Manager permission matrix is Owner-controlled. Profile role/school/email fields are protected by database guardrails; membership gates limit school-specific records after removal.
- A JWT-protected Edge Function `noor-ai-academic-assistant` handles AI generation/OCR server-side and logs token/cost estimates. No provider key is in frontend code.

### Database work applied to the existing NOOR AI project

Applied additive migrations include `academic_smart_notes_and_school_management`, `school_management_invites_and_permission_hardening`, `academic_permission_and_secret_stability_fixes`, `noor_role_membership_and_profile_guard_hardening`, `invitation_lifecycle_and_assessment_security`, `assessment_context_and_invitation_update_fixes`, `assessment_history_and_regrading_permissions`, and `private_syllabus_source_uploads`.

Tables added/extended include academic years, syllabus units and progress, smart notes, weekly lesson plans, daily reports, report revisions/reviews, memberships, permission grants, invitations, teacher schedules, extra classes, administrative audit logs, assessments, assessment results, and private syllabus upload metadata. RLS is enabled on new tenant data and source files. Server-side constraints validate school/year/class/section/subject/assessment context and marks limits. No school/user academic history was dropped.

### Validation performed and not yet complete

- The schema was inspected before changes and the database migrations/RPCs/Edge Function were applied to the dedicated NOOR AI project.
- The frontend source is integrated into the existing app and published via GitHub Pages.
- **Full acceptance testing with real user accounts is not yet possible**: there were no provisioned school/teacher/student Auth records at the time of this change. A verified Owner must create the first school, configure its academic year/classes/subjects, assign teachers, and run the workflows with test accounts.
- Set `AI_PROVIDER_API_KEY` as a Supabase Edge Function secret before AI generation/OCR can run. Optional `AI_PROVIDER_MODEL`, `AI_PROVIDER_CHAT_COMPLETIONS_URL`, `AI_INPUT_COST_PER_1K_USD`, and `AI_OUTPUT_COST_PER_1K_USD` are server-side configuration only.
- OCR currently accepts image files only (JPG/PNG/WebP); direct PDF/DOC/DOCX extraction remains unimplemented. PDF output is browser print/save-as-PDF; tabular download is CSV, not native XLSX. Real email delivery remains unconfigured; notification rows are in-app/queued records, not proof of an email being sent.
- Multi-school switching for one identity is not implemented; invitation acceptance rejects a user already attached to a different primary school. The requested "Master Key" is intentionally not a universal bypass credential; an actual recovery-key setup/rotation UI remains unimplemented.
- Migration-source parity is still being backfilled: the latest assessment and private-upload SQL is checked into `supabase/migrations/`, but the first live schema migrations still need their exact source bodies mirrored before a fresh-project bootstrap is reproducible. See `supabase/migrations/README.md` and the non-destructive rollback guidance.

**Status: implemented foundation, not final production acceptance.** Never treat generated notes as approved until a teacher reviews them; never treat an unreported class as zero teaching activity or syllabus percentage as proof of student learning.


## Task 5 + Task 6 patch verification — 16 October 2026

This section records the latest concrete follow-up changes. The production-facing site remains a working foundation until authenticated end-to-end acceptance tests can run.

### Latest frontend changes
- [x] Fixed pre-existing JavaScript parse errors in teacher directory/profile rendering; academic.js now passes a JavaScript syntax parse check.
- [x] Smart Notes and weekly-plan generated output now have editable text areas; teacher edits are stored in the existing JSONB note/plan records and restored when reopening them.
- [x] Teacher subject choices now respond to class/section and are filtered against active teacher assignments.
- [x] Academic Monitoring now filters by academic year and reports active teacher count, report-submission coverage, records/classes/subjects in scope, and reported issues. No-submission count is shown only when the filters allow a meaningful school-wide comparison.
- [x] Monthly saved-report trends are shown from actual dated report records; syllabus units are deduplicated by curriculum-unit ID in the summary.
- [x] CSV exports include readable school/year/teacher/class/section/subject labels and teaching fields.
- [x] Management schedule creation now targets an explicitly selected active teacher with a matching active class/section/subject assignment.
- [x] Teacher directory search includes saved school-membership username and employee ID fields where present.
- [x] Workspace entry now checks an existing school membership's status and role; an inactive/removed membership is refused, while historical data is preserved.
- [x] These existing-app changes were synced to the GitHub Pages branch.

### Latest database / AI changes
- [x] Applied schedule_teacher_assignment_guard to the existing NOOR AI Supabase project. The shared academic-context trigger now also verifies active teacher assignment when inserting/updating a regular schedule or extra-class record.
- [x] Checked in the applied schedule guard SQL and a non-destructive rollback function under supabase/migrations/ and supabase/rollback/.
- [x] Redeployed noor-ai-academic-assistant as version 2 with JWT verification still enabled; Smart Notes usage is now logged under smart_notes instead of the generic other feature bucket.
- [x] Re-ran the Supabase Security Advisor after the database policy/function changes; it returned no findings at the time of the check.

### Checks completed vs. remaining
- [x] JavaScript syntax parse check for the current academic.js.
- [x] Read-back of schema/trigger/function state after applying the schedule assignment migration.
- [x] Confirmed the schedule database trigger rejects a future schedule write unless the teacher has an active matching assignment (guard installed; no seeded records were available for a positive/negative insert test).
- [ ] Run authenticated positive and negative workflow tests with real, separate Owner, Principal/Manager, Teacher and Student accounts across two test schools.
- [ ] Test upload/OCR/AI generation, server autosave, submit, review/return/resubmit, PDF print and CSV downloads with populated school/class/subject records.
- [ ] Verify the configured server AI key is present and real provider calls succeed. The Edge Function is deployed, but a valid AI_PROVIDER_API_KEY and provider usage have not been confirmed.
- [ ] Complete full migration-source parity and a clean-database replay. Earlier schema/management migrations still need their exact original SQL mirrored one-to-one; this live project must not be treated as a fully reproducible blank-project bootstrap yet.

**Status remains: implemented and deployed improvements, not final production acceptance.** The application still has no provisioned school/teacher/student data in this project. Browser print/save-as-PDF is used; a server-rendered PDF and native XLSX export are not implemented. OCR supports image uploads only (JPG/PNG/WebP), and email notifications are queued/in-app records until an email provider is configured and delivery is verified.


## Ticket 07 — Production-grade school identity and data isolation (16 Oct 2026)

### Implemented and applied to the existing NOOR AI Supabase project
- [x] Added school address, official email, contact phone, school verification status, account status, verified-by/at fields and owner user ID. Existing UUID school IDs remain internal identifiers and are guarded against mutation.
- [x] Added a private platform-admin allow-list. The legacy `creator` profile label no longer grants global school access by itself; platform access requires an explicit row in `private.platform_admins` plus an active `creator` profile.
- [x] Tightened shared authorization helpers so non-platform users need an explicit active school membership whose role matches the profile. No more “no membership row means allow” fallback.
- [x] School-owned reads and management helpers now require a verified, active school and a matching active membership. Teacher access also requires an active class/section/subject assignment.
- [x] Student signup remains role-fixed to student and only activates membership when the school is verified/active, the code matches, class and section are valid, and Auth email is confirmed. Otherwise the profile stays pending with no active membership.
- [x] Added school identity/context validation, scoped username/employee-ID uniqueness, student admission/roll uniqueness in school/year/class/section context, and indexes for new foreign keys.
- [x] Added database guards for immutable school IDs/creator, platform-only school verification and official-email attestation, protected code rotation, membership identity, membership role changes and leadership membership status.
- [x] Owner registration now records official address/email/contact and creates a pending school. Access stays restricted until platform administration independently verifies the official email and approves the school.
- [x] Existing password login and recovery continue to use Supabase Auth; the UI now checks platform allow-list status and strict membership before exposing the workspace. Pending/unverified users see a restricted status screen.
- [x] Added executable database smoke tests at `supabase/tests/ticket07_security.sql`.
- [x] Synced the updated existing `index.html` to the GitHub Pages branch.

### Live checks actually run
- [x] Database smoke-test DO block executed successfully: no-auth platform-admin check, random school/class permission checks, anonymous RPC privilege checks, RLS coverage, and uniqueness-index presence.
- [x] RLS catalog query: 35 public base tables, 0 with RLS disabled.
- [x] Security Advisor after changes: no WARN/ERROR findings. One INFO finding remains because `private.platform_admins` intentionally has RLS enabled with no client policies and no direct client grants.
- [x] Public owner-creation, invitation-acceptance and platform-status RPC wrappers are invoker-based; anonymous EXECUTE is denied.
- [x] JavaScript syntax check passed for both inline script blocks in the updated main branch.
- [x] Verified all four Ticket 07 migrations are recorded in the live Supabase migration history.

### Not yet proven / production blockers
- [ ] The 2026-10-16 zero-record statement is stale. The 2026-10-18 check found some setup records, but no verified active school and no separate multi-role/multi-school test matrix. Cross-school tests, role-promotion attempts, removal/re-login and invitation expiry/reuse remain unproven.
- [ ] The first Platform Creator account must be bootstrapped securely by the project owner: create and verify the account through Supabase Auth, then set its profile role to `creator` and insert its Auth user ID into `private.platform_admins` using the Supabase SQL Editor under trusted project-owner access. Never expose this bootstrap to public signup or frontend code.
- [ ] The school “Mark email verified” control records an authorised human attestation after independent verification; it is not an automatic email challenge. A real email verification provider/workflow is still required for fully automated proof.
- [ ] Supabase Auth dashboard settings for email confirmations, password policy, rate limits and JWT/session lifetime still need an explicit production review; those settings were not readable/changed through the available connector.
- [ ] Clean-database replay of the full historical migration chain and real browser/API/storage end-to-end tests remain outstanding. This is not yet a production acceptance sign-off.

**Status: security hardening deployed and smoke-tested; real multi-account acceptance tests are blocked until a trusted Platform Creator is provisioned and two test schools have data.**


## Task 7 — Appearance, notice delivery path and 2026-10-18 re-audit

### Implemented and checked
- [x] Added the Appearance Studio with eight account-level themes, text-size and reduced-motion choices.
- [x] Added `user_theme_preferences` with a unique user key, RLS enabled and SELECT/INSERT/UPDATE policies restricted to `auth.uid()`.
- [x] Added Appearance Studio assets to the Pages deployment allow-list and added a Playwright theme smoke test.
- [x] Added notice creation/open shortcuts to the School Command Centre and Creator Master Control Centre.
- [x] Added School Notices links to student and parent/guardian navigation.
- [x] Scoped student/teacher notice queries to active notices aimed at their role and within the publish/expiry window; the existing database read policy also enforces the school/role/time boundary.
- [x] Expanded “Everyone at school” notice targeting to include school owners and parent/guardian role accounts.
- [x] Ran static JavaScript parse checks for both inline app scripts and the main application, academic, Command Centre, theme and sound modules.
- [x] Added covering indexes for 19 application foreign keys flagged by the performance advisor and removed 17 exact duplicate, non-unique indexes after comparing their actual index definitions. The latest advisor no longer reports unindexed foreign keys or duplicate indexes.
- [x] Confirmed that all 46 public base tables have RLS enabled.

### Current findings and remaining release gates
- [ ] Enable leaked-password protection in Supabase Auth dashboard settings; this setting is not manageable through the currently connected database tools.
- [ ] Complete the browser test matrix with separate Creator, Owner/Principal, restricted Manager, Teacher, Student and Parent/Guardian accounts and at least two schools.
- [ ] Reconcile Supabase's applied migration history with SQL files in this repository. The database currently has more applied migration records than matching migration source files; clean-project replay is not proven.
- [ ] Review multiple permissive-policy advisories. The current overlapping policies include intentional Creator-versus-school-role access paths; do not delete them without preserving equivalent checks and testing each role.
- [ ] Review the two SECURITY DEFINER-function advisories. The currently inspected functions have explicit Creator checks and are used by the frontend; keep those checks and test authorization before changing their grants.
- [ ] Review remaining unused-index notices after meaningful production-like data and query workload exist; do not delete indexes solely because a new, low-volume database has no scans.
- [x] GitHub Actions run `39127205044` passed the deployed Appearance Studio smoke test (8 themes/8 distinct palettes, text size and reduced-motion settings) and sound-engine smoke test (40 mapped sounds, asset loading, mute and preference persistence).
- [ ] Configure and test the email provider/sender before treating an in-app notice as an email.

**Status after the 2026-10-18 review:** account-level themes and notice entry points are implemented; FK-index and duplicate-index alerts were resolved. The product is still not production-accepted until Auth configuration, migration-source parity and real multi-account/multi-school tests are complete.
