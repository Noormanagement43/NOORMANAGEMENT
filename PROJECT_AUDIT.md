# NOOR project audit — 24 October 2026

## Scope and evidence

Reviewed the current main branch's index.html, README.md, and .github/workflows/pages.yml; inspected Supabase table metadata, migrations, public RLS policies, active Edge Functions, the institution-registration RPC definition, and Supabase security/performance advisor results. This is an evidence-based source/database configuration audit, not a full browser or multi-account penetration test.

## Agent checklist

Legend: COMPLETE AND VERIFIED = evidence confirms the item; PARTIAL = some implementation exists but full workflow is unverified/incomplete; NOT IMPLEMENTED = no implementation found in inspected repository/functions.

| Area | Status | Evidence / gap |
|---|---|---|
| Agent 1 — design foundation | PARTIAL | Burgundy/cream design tokens, responsive CSS, cards, dialogs, and navigation exist in index.html; no shared component/build system, language switcher, or complete accessibility test suite. |
| Agent 2 — Principal dashboard | PARTIAL | Authenticated principal-dashboard-data Edge Function checks the signed-in user and active institution membership and returns tenant-scoped metrics. No real tenant data exists to validate output end-to-end; the page still has preview navigation sections. |
| Agent 3 — Teacher dashboard | PARTIAL | Shared page loads academic groups visible through RLS; full teacher timetable, attendance marking, assignments, and student roster workflows are not connected. |
| Agent 4 — Student dashboard | PARTIAL | Role membership is recognized and group visibility is constrained by RLS, but there is no complete student dashboard, assignment/results view, or personal timetable workflow. |
| Agent 5 — Authentication and registration | PARTIAL | Supabase sign-in/sign-up and email confirmation redirect are present; institution self-registration RPC exists. Staff invitation/join-code flow, complete recovery flow, and hosted email-confirmation test remain unverified. |
| Agent 6 — database/security | PARTIAL | Four migrations are recorded; inspected public tables have RLS enabled and tenant-scoped policies. Security advisor warns about the exposed SECURITY DEFINER institution-registration RPC and disabled leaked-password protection. Production/staging environment identity is not proven, so no database changes were made during this audit. |
| Agent 7 — academic workflows | PARTIAL | Academic groups CRUD and principal metrics API exist. Timetable/session and attendance schema exists, but no records are present and the page does not yet implement complete attendance/timetable workflows. |
| Agent 8 — AI and email | NOT IMPLEMENTED | No Gemini, Jinni/Ask Noor, or Brevo integration found in inspected frontend or active Edge Function source. No credentials were exposed or configured. |
| Agent 9 — independent QA/release | PARTIAL | Static/source and database-policy inspections completed; no browser E2E, cross-tenant adversarial tests, accessibility audit, or successful Pages deployment could be verified from this audit. |

## Changes made during this audit

1. index.html: fixed the dashboard refresh path so non-administrator roles do not call the principal-only metrics endpoint. Their page now shows group-based figures only, marks attendance figures unavailable for that role, and labels timetable/attendance integration as incomplete instead of showing principal metrics as if available. The role label/avatar/greeting now derive from the active institution membership instead of a fake role selector.
2. README.md: replaced the generic project description with current implementation status, preview/deployment steps, configuration notes, and known security blockers.
3. This audit record documents verified implementation and outstanding work.

## Supabase state observed

- Project ID: ayrryemawwplguaauxij; region reported as ap-southeast-1.
- Migration history: 20261022115103 noor_project_foundation, 20261022121128 teacher_timetable_and_attendance, 20261022121802 editable_class_management, 20261022134552 index_foreign_keys_for_scale.
- Row counts at audit time: 2 Auth users, 0 institutions, 0 institution memberships, 0 academic groups, 0 class sessions, 0 attendance records.
- Active Edge Functions: principal-dashboard-data (JWT verification enabled) and principal-dashboard-preview (JWT verification disabled; inspected source serves a static HTML preview).
- RLS is enabled on the inspected academic tables. Policies use membership, academic-management, group-membership, and platform-admin helper functions. Policy presence alone is not proof of isolation; adversarial cross-tenant tests still need two seeded test tenants and distinct accounts.

## Security findings requiring owner/environment review

1. SECURITY ADVISOR WARNING — institution registration RPC. public.register_institution_for_current_user(p_name, p_slug, p_type) is SECURITY DEFINER and callable by authenticated users. The function checks auth.uid(), validates name/slug/type, and blocks registration if the user already has an active institution membership. This is a plausible self-service onboarding design, but SECURITY DEFINER means its grants and owner privileges deserve explicit review. Do not simply remove this RPC because the current UI depends on it; review grants, function ownership, search path, and tests in verified staging.
2. Leaked-password protection disabled. Enable Supabase Auth's compromised-password protection after checking current project Auth configuration.
3. Unauthenticated preview Edge Function. principal-dashboard-preview has verify_jwt=false. The inspected source appears to serve static preview HTML rather than live tenant data, but the endpoint should be retired or protected if it is no longer intentionally public.
4. Creator access. The inspected frontend has no Creator dashboard or creator-only route. Do not create a Creator account or grant platform privileges through public signup. Provision platform roles through a trusted owner-controlled process only.
5. Deployment/environment. The GitHub Pages workflow exists, but deployment success and the current live site were not verified. The Supabase project must be confirmed as the intended development/staging target before any schema/data mutation.

## Current verification update — 24 October 2026

Since the initial audit snapshot below, the following work has been committed:

- Fixed a duplicate `const labels` declaration in `index.html` `refreshData()`. After the fix, both non-empty inline scripts pass JavaScript syntax parsing.
- Replaced the obsolete standalone `auth.html` form with a redirect to the integrated `index.html` authentication gate.
- Removed the duplicate `.github/workflows/deploy-pages.yml`; `.github/workflows/pages.yml` is the single Pages deployment workflow.
- Expanded `README.md` with the current feature status and security/release blockers.
- Added static regression tests at `tests/static-audit.test.mjs`, run by `.github/workflows/quality.yml`.

A prior Pages run (40061910701) completed both build and deploy jobs successfully. The newest run following these commits must still be checked before claiming the latest revision is deployed. Static tests are in progress as of the latest inspection; their final result should be verified from Actions.

The database had 2 Auth users, 0 institutions and 0 active institution memberships at the time of inspection. Therefore, real multi-role dashboard and tenant-isolation tests still require authorized staging fixtures. The active `principal-dashboard-preview` function remains a blocker because it has `verify_jwt=false` and serves a hard-coded demo dashboard; it was not changed because the Supabase target was not positively verified as staging.

## Checks actually performed

- Fetched and reviewed the current index.html, README.md, and Pages workflow from main.
- Confirmed the Supabase migration history listed above.
- Inspected verbose schema metadata for public tables and RLS-enabled flags.
- Queried pg_policies for public-table RLS policies.
- Read the registration RPC definition and active Edge Function source/configuration.
- Ran Supabase security and performance advisors. Security warnings: exposed SECURITY DEFINER registration RPC and leaked-password protection disabled. Performance advisor reported unused indexes; with empty tables and no real workload, do not drop them just to silence the advisory.
- Confirmed the database has no institution or academic records for realistic workflow testing.
- Updated role-aware frontend behavior and documentation. Parsed both inline JavaScript blocks from the committed index.html with the JavaScript Function parser after catching and fixing a duplicate const declaration. This is a syntax check only, not a live browser workflow test.

## Remaining blockers / release criteria

- Add isolated staging fixtures for at least two institutions, with principal, teacher, and student accounts; test read/write attempts across tenants.
- Verify RLS for every exposed table and test register_institution_for_current_user grants/authorization.
- Complete staff joining/invitations, password recovery, creator-only access, and institution settings.
- Build real teacher/student dashboards and attendance/timetable/assignment/results/notices/leave/report workflows.
- Add Gemini/Ask Noor and Brevo server-side integrations only after required secrets are configured in Edge Function secrets; no API keys belong in frontend files.
- Run browser tests at desktop/mobile widths, keyboard/screen-reader accessibility checks, and auth email-confirmation test.
- Confirm GitHub Pages Actions success and verify the deployed URL before release.

## Deployment steps (not executed automatically)

1. Review the latest commits on main.
2. In GitHub repository Settings → Pages, select GitHub Actions if automatic enablement is not permitted.
3. Run the Deploy NOOR to GitHub Pages workflow and wait for both build and deploy jobs to succeed.
4. Confirm the actual deployed URL, then test sign-up/email confirmation/sign-in and institution onboarding.
5. Complete staging security and functional tests before any production release.
