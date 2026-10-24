# NOOR — Master Project Audit & Repair Log

**Audit date:** 2026-10-24  
**Repository:** `Noormanagement43/NOORMANAGEMENT` — `main`  
**Supabase project:** `ayrryemawwplguaauxij`

This report distinguishes code evidence from end-to-end verification. The Supabase project reports `ACTIVE_HEALTHY`, but the target has not been positively identified as development/staging. No database schema or data changes and no production deployment were performed during this audit turn.

## Agent 1–9 checklist

Status meanings: **COMPLETE AND VERIFIED** = narrow item has direct evidence; **PARTIAL** = implementation exists but feature/test coverage is incomplete; **NOT IMPLEMENTED** = no working implementation verified.

| Agent / requirement | Status | Evidence and remaining gap |
|---|---|---|
| 1 — UI foundation/design | PARTIAL | `index.html` has responsive burgundy/wine navigation, warm ivory canvas, cards, modal and mobile breakpoints. The app is still a single HTML file without a shared component system, route architecture or build/package setup. |
| 2 — Platform Creator | NOT IMPLEMENTED | No verified Creator dashboard or protected Creator route. `platform_roles` has zero rows in the current database snapshot. Creator access and non-self-assignability have not been proven with negative tests. |
| 3 — Principal dashboard | PARTIAL | Institution auth gate, self-service institution RPC, live academic-group read/edit/delete and `principal-dashboard-data` invocation exist. Complete principal workflows, notices, staff management, reports and browser tests are missing. |
| 4 — Teacher dashboard | PARTIAL | The page has class/group UI and institution-scoped reads. A dedicated teacher route, assigned-class filtering in UI, attendance marking workflow and verified teacher account journey are not complete. |
| 5 — Student dashboard/auth journeys | PARTIAL | The active `index.html` contains email/password sign-in, signup and campus onboarding. `auth.html` forwards to the active index auth gate. Student membership provisioning, student dashboard and secure staff invite redemption are not implemented. |
| 6 — Supabase/schema/RLS | PARTIAL | Public academic tables inspected have RLS enabled; policies use active-membership/academic-manager helpers. This is not proof of cross-tenant isolation. The registration RPC is SECURITY DEFINER in exposed `public` and triggers a Supabase security warning. Leaked-password protection is disabled. Environment type is unverified, so no schema/auth-setting changes were made. |
| 7 — Real academic workflows | PARTIAL | Class/section reads and edits use institution-scoped Supabase queries and the principal metrics function is invoked. Timetable now queries upcoming scheduled sessions from `class_sessions` using the active institution ID, a seven-day window and the institution timezone. Attendance records are still an explicit not-connected state. Assignments, student/staff records, notices, leave, results and reports are not complete in the active UI. |
| 8 — Gemini/Jinni/Brevo | NOT IMPLEMENTED | No verified end-to-end Gemini, Jinni/Ask Noor or Brevo integration/configuration was found. No API keys were added and no real emails were sent. |
| 9 — Independent QA/release | PARTIAL | Static regression tests and a non-deploying quality workflow exist. CI run success, browser/device testing, accessibility testing and authenticated cross-tenant tests remain unverified. Pages deployment is blocked by repository Pages permission/configuration. |

## Work completed in this repair

1. Removed sample student names, hard-coded timetable rows, attendance rows and sample dashboard metrics from `index.html`. The unauthenticated page now begins with explicit empty/loading states rather than fabricated live-looking records.
2. Removed the client-side role-preview selector. The topbar role label and greeting now come from the authenticated institution membership returned by Supabase.
3. Kept existing Supabase-backed class/section management; the UI checks the institution role before showing edit controls and filters reads/writes by the active institution ID. Database RLS remains the authoritative security boundary.
4. Added `tests/static-audit.test.mjs` to guard empty non-demo defaults, membership-derived role display, publishable-key-only frontend configuration, institution-scoped class CRUD, registration RPC validation/grants, the metrics function call, the legacy auth redirect, and institution-scoped timetable loading.
5. Added `.github/workflows/quality.yml` to run the static tests on pushes and pull requests. It does not deploy.
6. Added this audit report. The existing registration migration is retained at `supabase/migrations/20261024040000_register_institution_for_current_user.sql`.

## Test and environment evidence

### Checks performed during this audit

- Fetched current source from GitHub and evaluated static assertions against the updated `index.html`: sample data absent; role-preview selector absent; no service-role/secret key pattern; institution-scoped academic-group query present; institution registration RPC present; role label derived from membership.
- Supabase project status: `ACTIVE_HEALTHY`.
- Read-only row-count query returned: **2 auth users, 0 institution memberships, 0 institutions, 0 academic groups, 0 class sessions, 0 attendance records, 0 platform roles**.
- Inspected public schema: academic tables reviewed had RLS enabled.
- Supabase Security Advisor returned two warnings: authenticated callers can execute the SECURITY DEFINER registration RPC; leaked-password protection is disabled.
- `principal-dashboard-data` is ACTIVE with JWT verification enabled. `principal-dashboard-preview` is ACTIVE with JWT verification disabled and is a static demo endpoint; do not use it as a live-data source.
- The GitHub Pages workflow previously failed during Pages setup with `Resource not accessible by integration`. The public site has not been verified live.

### Not yet verified

- The Node test suite has been committed but a successful GitHub Actions run has not yet been observed in this audit.
- No authenticated login journey, email-confirmation journey, CRUD operation against real institution data, student/staff onboarding, Creator authorization, or cross-institution adversarial test has been executed.
- No automated accessibility or browser-responsiveness test has been run.
- No live Gemini/Brevo request has been made.

## Security blockers and decisions needed

1. **Environment identity:** confirm the connected Supabase project is an approved development/staging target before any schema/data or Auth-setting changes.
2. **Registration RPC:** `register_institution_for_current_user` validates `auth.uid()`, restricts institution type/name/slug, uses an empty search path and revokes anon/public execution. It nevertheless runs as SECURITY DEFINER in exposed `public` and grants execution to authenticated users. The intended self-service principal-registration policy needs explicit security review; do not blindly weaken RLS or remove the RPC.
3. **Leaked-password protection:** disabled per Supabase Security Advisor; enable only through an authorized project-owner change.
4. **Creator role:** no verified platform-owner membership/account or tests proving users cannot self-assign `platform_roles`. Do not treat any institution principal as the platform Creator.
5. **Preview Edge Function:** `principal-dashboard-preview` has `verify_jwt=false` and returns static sample UI. It is not used by the active dashboard. Review and disable/remove it only after confirming no intended preview depends on it.
6. **GitHub Pages:** Pages site setup fails because the integration lacks the required repository Pages permission/configuration. This repair did not attempt deployment.
7. **AI/email:** configure Gemini/Brevo only through server-side secret storage after approval. No credentials were available/used in this audit.

## Preview and deployment steps

- Static test command with Node.js 20+: `node --test tests/*.test.mjs`.
- Quality workflow: `.github/workflows/quality.yml`.
- Existing Pages workflow: `.github/workflows/pages.yml`; it will not produce a live URL until GitHub Pages is enabled/configured and the workflow has sufficient permission.
- Do not load real student data until Creator authorization, RLS tenant isolation and role-specific workflows have passed integration tests.
