# NOOR — Intelligent School & University Operating System

NOOR is a work-in-progress multi-tenant school and university operations platform. Supabase is the current backend.

## Current implementation status

- The hosted frontend is a single-file static application in `index.html`.
- Supabase Auth sign-in/sign-up, active institution membership lookup, institution onboarding RPC, and live academic-group CRUD are present.
- Principal/academic-administrator dashboard metrics are fetched from the authenticated `principal-dashboard-data` Edge Function.
- The GitHub Pages workflow is defined in `.github/workflows/pages.yml`.
- Teacher/student-specific attendance, timetable, assignment, results, notices, leave, and staff/student management workflows are not complete. The navigation items for these sections are not evidence of working workflows.
- Gemini/Jinni (Ask Noor) and Brevo integrations are not present in the current frontend or active Edge Functions inspected during the audit.
- Creator/platform-owner dashboard and creator-only access flow are not implemented in the current frontend.
- Current database counts at audit time: 2 Auth users, 0 institutions, 0 institution memberships, 0 academic groups, 0 class sessions, and 0 attendance records. Therefore live business workflows cannot yet be verified with real tenant data.

## Run / preview

The current frontend has no build step or package manifest. Open `index.html` directly for a static UI preview, or use the GitHub Pages workflow after Pages is enabled for the repository.

### Supabase configuration

The current frontend uses the Supabase publishable key, which is intended for browser use. Never put a service-role/secret key in `index.html`. The Supabase project must have its hosted Auth redirect URL allowlist configured for the deployed NOOR URL (currently the signup redirect is set to `https://noormanagement43.github.io/NOORMANAGEMENT/`).

### Deployment

1. Push a change to `main` or manually run the **Deploy NOOR to GitHub Pages** workflow.
2. In GitHub repository settings, ensure Pages is configured to use **GitHub Actions** if the workflow cannot enable it automatically.
3. Confirm the workflow's build and deploy jobs succeed.
4. Open the deployment URL from the workflow run and test sign-in, email confirmation, institution registration, and authorized data access. Do not treat a successful commit as proof of deployment.

## Audit record

See [PROJECT_AUDIT.md](PROJECT_AUDIT.md) for the evidence-based checklist, security findings, executed checks, and remaining blockers.

## Security notes

- RLS is enabled on the inspected public tables and policies use institution membership/academic-management helper functions.
- The `register_institution_for_current_user` RPC is SECURITY DEFINER and is intentionally used for authenticated self-service institution registration. It validates `auth.uid()`, input, and prevents users with an active membership from registering another institution; nevertheless, Supabase's security advisor flags the exposed SECURITY DEFINER RPC for review.
- Supabase's security advisor also reports leaked-password protection is disabled. Enable it in Auth settings after reviewing the project's operational requirements.
- The active `principal-dashboard-preview` Edge Function has JWT verification disabled and serves a static preview page. It did not appear to return live database records in the inspected source, but should be reviewed and retired or protected if no longer needed.
- Do not deploy to production or change the database schema until the target project is positively identified as the intended development/staging environment and authorization is confirmed.
