# NOOR — Intelligent School & University Operating System

NOOR is an institution-scoped school/university workspace. The current repository uses a static HTML frontend and Supabase for authentication, academic data and protected server-side metrics.

## Current implementation status

- Active UI entry: `index.html`
- Legacy auth entry: `auth.html` redirects to the active sign-in gate in `index.html`
- Supabase migrations: `supabase/migrations/`
- Static regression tests: `tests/static-audit.test.mjs`
- Evidence-based audit and blockers: `docs/PROJECT_AUDIT_2026-10-24.md`

The active dashboard uses explicit empty states rather than presenting sample student/attendance/timetable rows as live data. Class/section CRUD and upcoming timetable reads use the authenticated institution scope. Attendance detail workflows, dedicated Creator/Student dashboards, secure staff invitation redemption, Gemini/Jinni and Brevo are not complete yet.

## Run static checks

Requires Node.js 20 or newer:

```sh
node --test tests/*.test.mjs
```

GitHub Actions runs the same checks through `.github/workflows/quality.yml`. A successful CI run must be observed before considering the suite CI-verified.

## Local UI preview

You can serve the static files without installing app dependencies:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/index.html` in a browser. Authentication/email confirmation depends on Supabase Auth URL allow-list settings. The configured signup redirect is the intended GitHub Pages URL; do not expect a local preview to receive confirmation redirects unless the matching localhost URL is explicitly configured in Supabase.

## GitHub Pages deployment

Workflow: `.github/workflows/pages.yml`.

The latest observed Pages deployment (run `40080635935`) completed successfully, but it published commit `1338880c`, which is older than the current `main` branch. The Pages workflow is now **manual-only** (`workflow_dispatch`) to avoid deploying each code change automatically. Do not run it until the release gate is approved; the current branch has not been confirmed as the deployed version.

## Security and release notes

- Never put Supabase service-role/secret keys, Gemini keys or Brevo keys in frontend code.
- Do not load real student data until Creator authorization, role-specific permissions and cross-institution RLS tests pass.
- The connected Supabase project is healthy but has not been positively identified as development/staging. Do not apply further schema/data changes until its environment is verified.
- Review the SECURITY DEFINER registration RPC warning and enable leaked-password protection through an authorized project-owner change.
