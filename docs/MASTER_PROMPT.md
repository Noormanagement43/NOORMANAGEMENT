# NOOR AI — Unified SaaS Master Prompt (Tasks 1 + 2 + 3)

Act as a senior SaaS architect, full-stack engineer, security engineer, data architect, product designer and QA lead. Build **NOOR AI**, a secure multi-tenant school-management SaaS. Implement the phases in the same repository and shared database; do not create disconnected modules or replace existing features.

## 0. Non-negotiable delivery rules

1. Inspect the existing repository, current frontend, authentication, schema, RLS policies, migrations and deployment workflow before editing anything. Report what exists and reuse it.
2. Create a safe development branch and additive migrations. Preserve unrelated working functionality. Never overwrite production data or a working module without a backup and migration plan.
3. Build working end-to-end functions, not only static screens. A preview can use labelled sample data, but production claims must be backed by database and security tests.
4. Keep one consistent design system across the landing page, Creator, Principal, Manager, Teacher and Student views. The default theme must match the first NOOR AI page: **burgundy/rose, warm ivory and champagne-gold accents**. Add workspace-wide theme presets (Classic Rose, Lavender Bloom, Sage & Champagne, Midnight Plum & Gold), custom accent colour, typography and comfortable/compact density. A change must apply consistently throughout the product, not separately to each page.
5. Use a custom designer-style **N monogram** as the logo mark. The NOOR AI wordmark may appear beside it; do not substitute SHT or another random logo. Use the actual school name/logo for school-branded papers and reports.
6. Clearly separate demo/sample values from real records. No fake live statistics, fabricated marks, invented OCR output, or claim that an AI provider is connected when it is not.
7. Store AI and privileged secrets only in server-side environment variables/Supabase Edge Function secrets. Never ask the user to paste a secret into chat or commit it to GitHub. Never expose Supabase service-role/secret keys in browser code or `NEXT_PUBLIC_` environment variables.

## 1. Product and role model

Use one shared multi-tenant application with separate, role-aware dashboards:

- **Creator / Platform Owner:** explicitly provisioned trusted account with platform-level oversight and growth reporting across schools.
- **Principal:** manages one authorised school and its staff, classes, subjects, students, assessments and school reports.
- **Manager:** receives only the school areas and operations granted by the Principal/Creator; permissions are configurable and revocable.
- **Teacher:** has an individual profile, assigned classes, sections, subjects and their own classroom workspace.
- **Student:** has an individual profile and a student-friendly read-only academic dashboard. Students cannot change official attendance, marks or academic history.

Management users must be able to inspect, edit or report on authorised student/teacher records through their own permissions; they must never need to log in as another person or share credentials. Teacher/student accounts exist for their own dashboards where the school chooses to provide them. The preview role selector is only a prototype convenience and must not become production authentication.

A school joining code may assist approved onboarding, but it is not a substitute for individual authenticated accounts. Generate strong codes securely, store only a verifier/hash where appropriate, expire/rotate/revoke codes, rate-limit attempts and never allow public users to grant themselves Creator privileges. Require server-side membership and role checks for every protected operation.

## 2. Shared brand, navigation and design

- Premium, calm, modern, accessible, mobile-responsive UI; consistent spacing, typography, buttons, modals, forms, tables and loading/error/empty states.
- Default burgundy/rose, warm ivory, champagne-gold theme matching the original first-page direction.
- Global theme controls available in Settings: Classic Rose, Lavender Bloom, Sage & Champagne, Midnight Plum & Gold, custom accent colour, typography and density.
- Theme changes persist per user/workspace as required and apply to all dashboards, reports and paper previews.
- Logo mark is a designer-style **N** monogram.
- School name, uploaded school logo, academic year, timezone and calendar come from saved school configuration.
- Responsive desktop, tablet and mobile layouts, visible keyboard focus, accessible contrast, labels and validation messages.

## 3. Task 1 — authentication, onboarding, school structure and workflows

### Authentication and onboarding

- Use Next.js/React/TypeScript and Supabase unless the inspected repository has a documented reason for another compatible stack.
- Use Supabase Auth, unique case-insensitive usernames, secure password handling, verified email where appropriate, login by username/email, password reset, logout, session refresh/revocation strategy, rate limiting and generic login errors.
- Resolve usernames securely on the server; never trust a role, school ID, user ID or permissions supplied by the browser.
- Provision Creator access only through a trusted setup process. Prevent public registration from selecting Creator/Platform Owner.
- Principal/school registration fields: school name/logo, official email, phone, address, Principal name, username and password. Create a unique school workspace and pending/verified onboarding flow.
- Teacher registration: name, photo where appropriate, username, contact details, school invite/joining code, requested subjects/classes and password. Management approval may be required before access is granted.
- Student enrolment: name, username, school, class, section, roll number and appropriate parent/guardian fields. Collect only necessary child data and protect it carefully.

### School structure

- School management can add, edit and archive academic years, classes (e.g. 1–12), sections (e.g. A/B/C), subjects and curriculum/syllabus records.
- Do not hardcode an exhaustive fixed list of grades, sections or subjects. Support school-configurable values including English, Mathematics, Science, Social Studies, Urdu, Telugu, Hindi, Computer Science and future additions.
- Enforce a unique roll number within its appropriate school/class/section scope as defined by school policy. Validate enrollment and transfers in server-side transactions.
- Deactivating a student or transferring them must preserve historical attendance, marks, reports and audit history under the school's retention policy.

### Task and calendar workflow

- Users can create, edit, complete and archive their own personal tasks/goals, with title, description, due date, priority, category, status, optional attachment and reminder.
- Teacher assignments can target authorised classes, sections or individual students.
- Management can send school-wide tasks to selected staff, departments or all authorised staff. Maintain one status per assignee; one response must not count for the whole group.
- Distinguish acknowledgement, in-progress work, submitted completion and management approval. Allow request-changes with a reason and resubmission.
- Preserve appropriate history for assigned school tasks and approvals. Personal task deletion and school-accountability records must follow different policies.

## 4. Task 2 — Teacher Dashboard and classroom management

### Teacher dashboard

Every teacher must have a unique profile, display name, photo where provided, username, assigned school, assigned subjects, assigned classes/sections, class-teacher designation, attendance summary, upcoming tests and pending work. Show only authorised assignments.

A prominent **My Class** card must automatically show saved class-teacher assignments on later logins. For teachers assigned to multiple classes, show all assigned classes and provide one-tap access. Persist assignments in PostgreSQL/Supabase, not merely in local storage. When an assignment is changed or revoked, server/database access checks must deny the old class immediately; handle token/session freshness safely.

### Teacher edit permissions

- Teachers need a usable Edit option for permitted student fields, including roll number, class/section and subject assignments, and they must be able to maintain their assigned syllabus/notes used by the question generator.
- Provide explicit school-policy controls for teacher edits. The school may grant direct edit rights or require Principal/Manager approval for class transfers or sensitive fields. Where a permission is disabled, show a clear request-to-management path.
- Check permissions on every server-side mutation and database policy, not only by disabling a UI button. Log who changed what, old/new values, time, school and reason where appropriate.
- Enforce duplicate roll-number checks and transactional transfer logic. Keep historic records tied to their original class/enrollment context.

### Roll-number-wise attendance

- Show class/section, date, roll number, name/photo, Present, Absent, approved Leave, and any school-configured status such as Late.
- Sort by roll number. Include clear status indicators, mobile-friendly controls, explicit **Save Attendance**, present/absent/leave/late/unmarked counts and an unsaved-changes warning.
- Never silently mark every student present. Do not save duplicate records for the same student/enrollment and school-calendar date. Use a unique database constraint and transaction/upsert logic that follows the approved correction path.
- Allow corrections only to authorised users and maintain an attendance correction audit trail.
- Respect school timezone, school calendar, holidays, academic year and date rules. Define which statuses are included in the attendance percentage denominator.

### Student management and progress

- Add student directly only if policy permits; otherwise submit an enrollment request to management.
- School management can add/edit students, transfer class/section, deactivate enrolment, view history and maintain retention rules.
- Every student row has **View Progress**: attendance percentage and counts, subject-wise saved marks, test history, trend over time and authorised teacher feedback.
- Never fabricate values for missing marks. Missing scores remain “Not recorded” unless an explicitly documented school policy says otherwise. Cancelled tests are excluded from normal scoring/averages.
- Teacher can access only students of the authorised school/classes and only relevant subjects or functions according to role policy.

## 5. Task 3 — Student Dashboard, reports and AI test paper generator

### Student dashboard

- Individual account and profile, unique username, school name/logo, class, section, roll number and permitted parent/guardian information.
- Show attendance percentage and counts, subject-wise marks, test results/history, upcoming published/assigned assessments, relevant teacher feedback and progress summary.
- A prominent **My Progress** button opens the detailed student report from the same underlying saved records visible to authorised teachers.
- Students can read their own official records but cannot alter attendance, marks, class placement, assessment status or academic history.

### Academic reports and PDF

- Calculate attendance percentage using a documented formula: present days divided by eligible marked days under the school's attendance policy; explicitly document how approved leave, holidays, cancelled school days and unmarked records are handled.
- Display recorded subject marks, max marks, test results by date and available feedback. Do not treat missing scores as zero unless the school's explicit policy requires it.
- Generate downloadable/printable PDF reports using NOOR AI brand styling, actual saved school logo/name, student identity/class/section/roll, attendance summary, subject marks, test history and generation date.
- Add a note that the report is generated from recorded school data. Restrict official report access and downloads to permitted roles. Never replace a missing logo with a random image.

### AI Test Paper Generator

Provide **Generate Test Paper** inside the Teacher Dashboard. Automatically populate school name/logo from authorised school settings.

Required inputs:
- Class/section, subject, topic/chapter, exam title, date, total marks, duration, difficulty (Easy/Medium/Hard/Mixed), question types (MCQ, short, long, fill-in-the-blanks, true/false), language and number of questions.
- Multiple syllabus images or supported document uploads with clear upload guidance. Enforce MIME type and size limits and use controlled Supabase Storage paths.
- Run OCR/document extraction through a configurable service, return extracted text for teacher review/edit before the model call, and identify unreadable/low-confidence uploads. If source text is unreadable, ask for a clearer upload rather than inventing syllabus content.
- Begin with one configurable AI provider. Call it only from a secured server/Edge Function using server-side secrets. Validate requests, enforce quotas/rate limits, set timeouts and handle provider errors safely.
- Generate age-appropriate, syllabus-grounded questions respecting class level, language, requested question count/types, and total marks. Verify the sum of marks in code. Detect duplicate/ambiguous questions where feasible. Do not claim perfect accuracy.
- Provide a fully editable paper preview: edit/regenerate one question, add/remove questions, change marks/instructions, rebalance/validate total marks, preview final layout, save a draft and download/print PDF.
- Paper output uses the correct saved school name/logo, exam title, class, subject, date, duration, maximum marks, student name/roll fields if required, page numbers and consistent headers/footers.
- A separate answer key/marking scheme is generated only when requested. Keep it teacher/admin-only until explicitly published.
- Store each test paper with school ID, teacher ID, class, subject, creation/update time, status, version and source/approved syllabus reference. Students see only papers specifically assigned/published to them.

## 6. Shared database, API and security architecture

Extend the existing schema rather than creating a separate disconnected database. Use migrations and meaningful foreign keys/checks/unique constraints/indexes. Suitable entities include:

- `profiles`, `schools`, `school_memberships`, `school_join_codes`
- `academic_years`, `classes`, `sections`, `subjects`, `syllabus_resources`
- `teacher_assignments`, `student_enrollments`, `enrollment_history`
- `attendance_sessions`, `attendance_records`, `attendance_audit`
- `assessments`, `marks`, `teacher_feedback`, `progress_snapshots` where justified
- `test_papers`, `test_paper_questions`, `test_paper_versions`, `answer_keys`, `paper_publications`
- `tasks`, `task_assignees`, `task_events`, `task_reviews`, `calendar_events`
- `audit_logs`, `notification_preferences`, `school_settings`

All school records must include the proper tenant/school context, ownership/assignment links and timestamps. Enforce required uniqueness in the database, not only in the form.

Use Supabase Row Level Security for every exposed table containing private or school information. Policies must enforce authenticated identity, school membership, role, class assignment, subject assignment and ownership. Verify both `USING` and `WITH CHECK` on updates where relevant. Do not base privileges on user-editable metadata. Views must not accidentally bypass RLS. Protect storage buckets and serve private files through authorised access or expiring signed URLs.

Create validated server actions/API endpoints for account setup, assignments, roster changes, attendance, marks, enrollment transfers, report generation, syllabus upload/extraction, paper generation and publication. Use runtime validation (such as Zod), transaction-safe constraints, rate limiting, audit events, and least-privilege access. Service-role credentials remain server-only. Avoid unaudited, broad `SECURITY DEFINER` functions.

## 7. Global Settings and editing

- Unified theme selector and typography settings apply across all roles, screens, form controls, tables, modal states, generated paper previews and reports.
- Principal/Creator can configure school logo/name, academic calendar, timezone, subjects, classes, sections, teacher permissions and student enrollment rules according to authority.
- Teacher can edit own permitted profile; assigned syllabus/notes; student roll/class/subject details only if explicitly allowed by current school policy. Transfers can require management approval.
- All changes survive logout/login because production state is persisted in the shared database; browser local storage is only acceptable for UI preferences, never as an authorization source or source of truth for class assignment/official records.

## 8. Acceptance tests and delivery evidence

Test and record results for:

1. Existing authentication and routes still work after integration.
2. Role-specific dashboard routing and denied direct URL/API access.
3. Username uniqueness and secure recovery flow.
4. Creator sees authorised platform scope; Principal and Manager cannot cross their grant; teachers cannot open unassigned classes or another school; students cannot open another student's private records.
5. Teacher assignment persists after logout/login and access disappears when assignment is revoked.
6. Roll number uniqueness, permitted edit policy, transfer approval, historical record preservation and audit records.
7. Attendance save, reload persistence, duplicate prevention, counts, unsaved warning, correction history, timezone/calendar handling and unmarked students.
8. Student progress matches saved attendance/marks, missing/cancelled marks are handled correctly, student modifications are denied by the server and RLS.
9. PDFs use the correct saved school logo and student information; authorised users only.
10. Multiple syllabus uploads, file-size/type validation, OCR review/edit step and unreadable-source handling.
11. AI questions are grounded in the reviewed source, age appropriate and free from obvious duplicates; total marks and question count are validated; teachers can edit/save/download; answer keys stay protected.
12. Task creation/edit/deletion, per-assignee statuses, review/change-request workflow and audit trail.
13. Theme changes persist and remain consistent across every role; mobile/responsive and keyboard-accessibility checks.
14. Run production build, lint/typecheck, migration checks, Supabase advisors/security review and explicit RLS tests with separate test identities and multiple school tenants.

Deliver: changed files, schema/migrations, API routes, RLS policy summary, local environment example without secrets, setup instructions, test logs, known limitations and deployment steps. Do not claim a feature is integrated, live, secure or tested until that evidence exists.

## 9. Incremental implementation plan

- Phase 0: Inspect repository/database, take backups, map existing features, and propose a no-break migration plan.
- Phase 1: Authentication, school membership, role provisioning, RLS and onboarding.
- Phase 2: Classes/sections/subjects/academic years, teacher assignments and editable roster controls.
- Phase 3: Teacher dashboard, roll-number attendance, student management and progress retrieval.
- Phase 4: Student dashboard, reports and PDF generation.
- Phase 5: Syllabus upload/OCR review, AI paper generation, editable paper, answer-key separation and publication.
- Phase 6: Shared task/workflow system, global theme/settings, final security and acceptance tests.

At every phase, reuse the same data model and repository, test the working flow and report any missing configuration. Never present a browser-only prototype as a live SaaS backend.