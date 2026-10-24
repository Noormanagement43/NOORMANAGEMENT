# NOOR — Intelligent School & University Operating System

NOOR is a web-based campus workspace for schools and universities. The current application is a static HTML/CSS/JavaScript frontend backed by Supabase Auth, PostgreSQL/RLS, and Edge Functions.

## Preview

- Live Pages preview: https://noormanagement43.github.io/NOORMANAGEMENT/
- Repository: https://github.com/Noormanagement43/NOORMANAGEMENT
- Supabase project is configured in the frontend with a publishable key only. Never put a service-role or secret key in browser code.

## Run locally

Because this is currently a static app, serve the repository root with any local static HTTP server, then open `index.html`. Do not open it as a `file://` URL because browser module/CDN and redirect behavior may differ.

## Verified implementation inventory

### COMPLETE AND VERIFIED (limited to evidence listed)
- The `main` branch contains the NOOR dashboard, embedded sign-in/onboarding UI, Supabase migration files, and a GitHub Pages workflow.
- `index.html` contains Supabase Auth sign-in/sign-up calls, institution onboarding through `register_institution_for_current_user`, authenticated membership resolution, live academic-group CRUD, and calls to the authenticated `principal-dashboard-data` Edge Function.
- Supabase reports RLS enabled on the inspected public tables; policy definitions are institution-scoped for core academic data.
- `principal-dashboard-data` is ACTIVE with JWT verification enabled.
- The latest checked Pages workflow run (2026-10-24, run 40061910701) completed both build and deploy jobs successfully.
- Inline JavaScript syntax was checked in the preceding implementation pass. This is not a substitute for browser E2E tests.

### PARTIAL
- Principal dashboard: live metrics and academic group CRUD are connected, but full end-to-end tests with a real institution and multiple roles have not been run.
- Auth: the main `index.html` flow is wired to Supabase, but confirmation, password reset, duplicate signup, expired sessions, and all redirects still need end-to-end verification.
- Tenant security: core RLS policies exist, but cross-tenant penetration tests have not been run. A security advisor warning remains for the institution-registration SECURITY DEFINER RPC.
- Teacher/student/Creator workspaces: navigation and UI elements exist, but their role-specific live workflows are not verified as complete.
- Accessibility/responsiveness: responsive styles and some semantic labels exist; no automated accessibility scan or device/browser matrix has been run.
- Release: Pages deployment workflow succeeded, but a separate live HTTP/browser smoke test should still be run after each deploy.

### NOT IMPLEMENTED OR BLOCKED (not evidenced as working)
- Complete verified Creator/platform-owner dashboard and protected owner provisioning.
- Complete live Teacher and Student dashboards and role-specific data workflows.
- Fully integrated staff invite/join code lifecycle and authorization tests.
- Verified timetable, assignment, leave, results, notices, reports, and all requested academic workflows.
- Gemini/Jinni/Ask Noor and Brevo integrations; configuration and credentials were not verified and no secrets should be added to frontend code.
- Full automated unit, integration, RLS isolation, browser E2E, accessibility, and performance test suites.
- Production security closure: the deployed `principal-dashboard-preview` Edge Function is configured with JWT verification disabled and serves a hard-coded demo dashboard. It must be reviewed and retired or protected in a verified staging/release process before production use. Do not assume its public output is private.
- Supabase Auth leaked-password protection is currently reported disabled by the security advisor; this is an account-level setting and has not been changed here.

## Supabase migration inventory

The database currently reports these applied migrations:
- `20261022115103_noor_project_foundation`
- `20261022121128_teacher_timetable_and_attendance`
- `20261022121802_editable_class_management`
- `20261022134552_index_foreign_keys_for_scale`

The repository also includes `supabase/migrations/20261024040000_register_institution_for_current_user.sql`. Confirm its migration history/state before relying on it in another environment; do not blindly replay against production.

## Security and release rules

- Never expose Supabase service-role keys, Gemini API keys, or Brevo API keys in the frontend or Git.
- Keep privileged actions server-side and enforce tenant authorization through RLS and authenticated Edge Functions.
- Do not self-assign Creator/platform-owner roles from public signup.
- Do not claim live data is populated when there are no institution memberships or records.
- Do not deploy schema changes to production until the target environment is verified and the migration is reviewed.
- Do not send real email or create paid resources without authorization.

## Next release gates

1. Review/retire the public demo Edge Function in a verified environment.
2. Resolve the SECURITY DEFINER RPC advisor warning with a reviewed least-privilege design; preserve legitimate onboarding behavior.
3. Enable leaked-password protection in Supabase Auth settings.
4. Create a staging institution and run real sign-in, email confirmation, onboarding, class CRUD, role authorization, and cross-tenant isolation tests.
5. Add and run browser E2E, accessibility, and responsive tests.
6. Verify the deployed site in a browser and confirm email links return to the intended hosted route.
