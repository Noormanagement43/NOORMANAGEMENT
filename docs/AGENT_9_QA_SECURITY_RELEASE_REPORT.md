# NOOR — Agent 9 Independent QA / Security / Release Report

**Review date:** 2026-10-24  
**Reviewed ref:** `agent9/qa-repair-2026-10-24`  
**Decision:** **NO-GO for production; conditional GO for a controlled local/staging preview only after the blockers below are resolved.**  
**Scope limitation:** This review includes repository source, GitHub Actions results from earlier commits, and read-only Supabase metadata/SQL/Edge Function inspection. The connected Supabase project could not be positively identified as development or staging, so no project mutation was performed. Browser E2E and adversarial tenant tests were not run.

## Executive summary

The repository's application entry point is a single `index.html` file containing styling, a teacher-oriented dashboard, client-side interactions, and Supabase browser-client calls. The dashboard uses the NOOR burgundy/ivory palette and responsive CSS. The page now presents empty/loading states rather than pre-populated sample student, attendance, timetable, and KPI values.

The repository remains a single-file static frontend without a conventional `src/` application layout. Agent 1 added dependency-free Node checks; later work added role-aware empty-state shells, live institution-scoped timetable/attendance reads, auth recovery UX, and server-side Gemini/Brevo function source. The live Supabase project reports four applied migrations and RLS enabled on all inspected public tables, but migration SQL is not reviewable at the expected repository path and cross-tenant negative tests remain unrun.

## Findings

### QA-001 — High: Role authorization is not independently proven
- **Module:** Dashboard role preview / authorization
- **Evidence:** Read-only inspection shows RLS enabled on all 14 inspected public tables and institution/role predicates in core policies. The `principal-dashboard-data` function verifies the user, active membership, institution, and administrator role. However, no separate test identities were available for negative tests; frontend role checks alone are not a security boundary.
- **Reproduction:** In verified staging, attempt SELECT/INSERT/UPDATE/DELETE across two institutions with principal, teacher, student, and unrelated authenticated accounts.
- **Expected:** Every unauthorized cross-tenant or role-inappropriate operation is denied by RLS/server checks.
- **Actual:** Policy source looks scoped on static inspection, but no adversarial request test has proved the behavior. A separate public demo function is also active without JWT verification (QA-007).
- **Impact:** Tenant isolation and role boundaries remain unproven.
- **Recommended fix:** Run cross-tenant negative tests and verify every table, RPC, view, and function against least-privilege identities.
- **Status:** OPEN — Blocker for production approval.

### QA-002 — High: Applied migration history is not backed by reviewable migration source in this repository
- **Module:** Supabase schema, migrations, RLS, institution registration
- **Evidence:** Supabase reports four applied migrations (`noor_project_foundation`, `teacher_timetable_and_attendance`, `editable_class_management`, `index_foreign_keys_for_scale`). The expected SQL source files were not found at the inspected repository paths. Read-only policy inspection was possible directly against the connected project.
- **Expected:** Every applied migration and privileged function is version-controlled and can be reproduced in staging.
- **Actual:** Live policy definitions are inspectable, but the matching migration SQL and a verified staging environment are not available in this repository review.
- **Impact:** Schema drift and future migration safety cannot be independently reviewed or reproduced.
- **Recommended fix:** Recover/commit the exact applied migration source without replaying it against the current project; verify migration history and schema drift in staging before any schema changes.
- **Status:** OPEN — Blocker for production approval.

### QA-003 — Medium: Static validation exists; latest changes still need a fresh full CI run
- **Module:** Build / CI / test automation
- **Evidence:** Agent 1 added a root `package.json`, Node built-in tests, and a static inline-JavaScript syntax validator. A Deno type-check job was added for new Edge Function source. An earlier GitHub Actions run passed Node syntax/foundation checks before the newest auth/data/function additions.
- **Reproduction:** Attempt to locate package scripts and run the documented lint, type-check, unit, E2E and production build commands.
- **Expected:** Reproducible static checks in CI, with separate browser and backend security testing.
- **Actual:** `npm run check` and `npm test` are defined without third-party Node dependencies. A prior run passed both steps, but the current expanded test suite and Deno type-check have not yet been confirmed green on the latest PR head. No browser E2E suite exists.
- **Impact:** Regressions cannot be caught by a reproducible automated pipeline.
- **Recommended fix:** Confirm the new validation workflow passes, then add browser smoke/E2E tests and staging security tests. If the app has a separate source repo/branch, link that source and review it too.
- **Status:** PARTIALLY ADDRESSED — earlier static CI passed; latest CI and runtime tests pending.

### QA-004 — Medium: Only a limited dashboard journey is implemented in the reviewed frontend
- **Module:** Creator, Principal, Teacher, Student, auth and academic workflows
- **Evidence:** The Principal view now has live academic setup health indicators plus institution-scoped timetable and attendance read queries. Teacher and Student roles have separate empty-state shells that return before administrator data loading. Assignments, notices, results, staff management, Creator routes, and mutations are still not connected.
- **Reproduction:** Sign in and activate My Classes, Attendance, Assignments, Students, Timetable, Announcements, Settings, or change the role preview.
- **Expected:** Each route and workflow is implemented and guarded by actual role authorization.
- **Actual:** Core dashboard views remain inside one HTML file; Teacher/Student shells deliberately show unavailable states instead of fabricating records, and many navigation items remain preview-only.
- **Impact:** Product requirements are not met end-to-end.
- **Recommended fix:** Implement each workflow against verified tenant-scoped schema and policies; otherwise label it as roadmap/mock-only in the product.
- **Status:** OPEN.

### QA-005 — Medium: Gemini/Brevo source is added but integrations are not deployed or operationally verified
- **Module:** Gemini / Ask Noor / Brevo
- **Evidence:** `supabase/functions/ask-noor/index.ts` and `supabase/functions/send-notice-email/index.ts` now exist in the PR. They require server-side environment secrets and are not deployed to Supabase.
- **Expected:** Authenticated, role/institution-scoped requests, secrets kept server-side, safe input limits, provider timeouts, quotas, and tests.
- **Actual:** Source implements auth and institution checks, but no provider secrets, persistent rate limit, Deno lockfile, provider-mocked test, or staging deployment is available. No real email was sent.
- **Impact:** AI/email must not be represented as live. Uncontrolled provider usage would create cost and abuse risk.
- **Recommended fix:** Generate/commit the Deno lockfile, add persistent quotas/idempotency, configure secrets in verified staging, test with mock providers and a non-production sender, and deploy only after explicit approval.
- **Status:** PARTIALLY IMPLEMENTED — source only.

### QA-006 — Medium: Authentication recovery and accessibility still need browser verification
- **Module:** Accessibility / responsive UI
- **Evidence:** Explicit focus-visible/reduced-motion styles and password reveal/reset/resend flows now exist. Password recovery listens for `PASSWORD_RECOVERY` and calls `updateUser` after matching-password validation.
- **Expected:** Recovery links, email confirmation, expired sessions, keyboard focus, screen readers, and mobile layouts all work end-to-end.
- **Actual:** Only source-level checks are available; no browser/device or live Auth tests have run.
- **Impact:** Authentication recovery or keyboard interactions may still fail at runtime.
- **Recommended fix:** Test confirmation/reset links and the full keyboard flow in staging, then run an accessibility scan and mobile/tablet/desktop browser matrix.
- **Status:** OPEN pending runtime tests.

### QA-007 — High: Public demo Edge Function has JWT verification disabled
- **Module:** Supabase Edge Functions / data exposure
- **Evidence:** Read-only Supabase function metadata reports `principal-dashboard-preview` as ACTIVE with `verify_jwt=false`. Its source serves hard-coded profile details, attendance metrics, teacher records, notices, and sample schedules.
- **Expected:** Public demos must be clearly non-sensitive and not confused with authenticated institution data; private dashboards must require JWT and server-side authorization.
- **Actual:** The function is publicly callable without JWT and returns a full demo HTML dashboard containing a hard-coded sample identity and fabricated school data.
- **Impact:** Misleading public surface and potential exposure of hard-coded personal-looking data; deployment configuration is not aligned with a secure release.
- **Recommended fix:** In verified staging/release, confirm dependencies and retire the function or require JWT and remove hard-coded identity/sample data. Do not modify the current project until its environment is verified.
- **Status:** OPEN — High release blocker.

### QA-008 — Medium: Supabase leaked-password protection is disabled
- **Module:** Supabase Auth configuration
- **Evidence:** Supabase Security Advisor reports `auth_leaked_password_protection` as WARN.
- **Expected:** Compromised-password protection should be enabled and tested with the configured sign-up/reset policy.
- **Actual:** The setting is currently disabled in the connected project.
- **Impact:** Users may select passwords known to be compromised.
- **Recommended fix:** Enable in a verified environment after owner review and run sign-up/reset regression tests.
- **Status:** OPEN.

## Test matrix

| Area | Status | Evidence / limitation |
|---|---|---|
| Repository entry point | PARTIAL / inspected | `index.html` fetched and statically reviewed |
| Shared design tokens | PARTIAL / inspected | CSS variables include wine, cream, rose, ink and muted colors in the HTML |
| Creator dashboard | NOT VERIFIED | No dedicated route/source found |
| Principal dashboard | PARTIAL | Live setup health, scheduled-session reads, and recent attendance reads are in source; browser/RLS tests pending |
| Teacher dashboard | PARTIAL | Safe role shell exists; assigned classes/timetable/attendance data remain disconnected |
| Student dashboard | PARTIAL | Safe learning-space shell exists; student data workflows remain disconnected |
| Login / signup / recovery | PARTIAL | Sign-in/up, password reveal/reset/resend, recovery callback and update flow exist; live Auth not exercised |
| Institution creation | PARTIAL | Client calls an RPC; RPC implementation/permissions unavailable |
| Staff join code | NOT IMPLEMENTED / NOT FOUND | No join-code workflow identified in reviewed source |
| Membership checks | PARTIAL | Client queries active membership; server-side policy not verified |
| Tenant isolation | NOT TESTED | RLS enabled on inspected public tables; no two-institution negative tests or verified staging project |
| Attendance marking/correction | NOT IMPLEMENTED / NOT FOUND | Table preview only; no tested mutation workflow |
| Timetable / attendance reads | PARTIAL | Institution-scoped reads added; runtime results not verified. Assignments/notices/mutations remain incomplete |
| Gemini / Brevo | SOURCE ADDED, NOT DEPLOYED | Server-side function source exists; secrets, quotas, Deno lockfile, provider tests and staging deployment pending |
| Responsive CSS | PARTIAL / static only | Breakpoints present; no real device/browser testing |
| Keyboard / screen reader | NOT TESTED | Browser tooling unavailable |
| Static syntax / foundation tests | EARLIER PASS; LATEST PENDING | Run 40080643681 passed before later additions; latest full suite has not been confirmed |
| Production deployment | NOT PERFORMED | Explicitly not authorized |

## Commands and checks actually executed

1. GitHub repository lookup for `Noormanagement43/NOORMANAGEMENT` — **PASS**; default branch reported as `main`.
2. Fetch `README.md` — **PASS**; README describes project as work in progress.
3. Fetch `index.html` — **PASS**; static HTML/CSS/JavaScript inspected.
4. Initial root `package.json` fetch — **NOT FOUND (404)**; Agent 1 subsequently added `package.json` plus dependency-free checks on the working branch.
5. Fetch conventional paths `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `vite.config.js`, `supabase/migrations`-related search terms — **NOT FOUND / no matching code search results**.
6. GitHub code searches for policy/RPC/dashboard function/Gemini/Brevo terms — **no matching results returned**. This is not proof that remote Supabase resources do not exist.
7. GitHub Actions run 40080643681 — **PASS** for inline JavaScript syntax and foundation tests on an earlier PR head. Current expanded Node tests and Deno type-check — **PENDING**. Browser, SQL, E2E and security penetration tests — **NOT RUN**.

## Release / recovery instructions

1. Do not deploy this revision to production.
2. Confirm that the intended app source is in this repository and branch; if a separate repository contains the full app, link it and repeat this review there.
3. Obtain a positively identified development/staging Supabase project before any schema or data changes.
4. Review migrations, RLS, grants, RPCs and Edge Functions in source control; test cross-tenant reads and writes with separate institution identities.
5. Confirm the new static validation workflow passes; then add browser E2E and RLS isolation tests and preserve CI logs.
6. Complete and verify all role-specific journeys and live academic workflows.
7. Configure Gemini/Brevo only in a staging secret store; do not commit keys or send real emails during QA.
8. Capture staging screenshots and accessibility results across mobile, tablet and desktop.
9. Release only after all Blocker/High findings are closed and the product owner explicitly approves deployment.

## Overall decision

**NO-GO for production.** The repository supports a styled, single-page frontend preview and contains a Supabase client integration attempt, but role enforcement, tenant isolation, server functions, migrations, core workflows, AI/email integrations, and automated/runtime tests are not sufficiently evidenced. No production deployment or database mutation was performed.
