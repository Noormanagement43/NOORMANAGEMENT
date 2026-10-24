# NOOR — Current Project Audit Checklist

Audit date: 2026-10-24  
Repository branch: `main`  
Scope: evidence-based review of files and Supabase metadata accessible during this session. This is not a claim that every workflow has been exercised.

Status key:
- **COMPLETE AND VERIFIED** — direct implementation/deployment evidence exists for the specific item.
- **PARTIAL** — some implementation exists, but acceptance tests are incomplete.
- **NOT IMPLEMENTED / BLOCKED** — no working implementation evidence, or a security/configuration dependency blocks release.

| Agent / area | Status | Evidence and remaining work |
|---|---|---|
| Agent 1 — shared UI/design | PARTIAL | Existing burgundy/ivory responsive styling in `index.html`; full mobile/browser/accessibility matrix not run. |
| Agent 2 — Principal dashboard | PARTIAL | Authenticated live metric function and academic-group CRUD exist; no seeded staging institution or full E2E run. |
| Agent 3 — Teacher dashboard | PARTIAL | Teacher navigation/UI exists; complete real attendance, timetable, assignment workflows not verified. |
| Agent 4 — Student dashboard | NOT IMPLEMENTED / BLOCKED | No complete, verified student-specific live dashboard workflow evidenced. |
| Agent 5 — Authentication/registration | PARTIAL | Main page uses Supabase sign-in/sign-up and protected institution-registration RPC. Password reset and the separate legacy auth page were not properly integrated; legacy page now redirects to the main auth gate. Confirm-email and error paths still need E2E tests. |
| Agent 6 — Supabase/schema/RLS | PARTIAL | Core tables have RLS enabled and policy predicates use private helper functions. Cross-tenant adversarial tests not run; security advisor reports a SECURITY DEFINER registration RPC warning and disabled leaked-password protection. |
| Agent 7 — academic/live data | PARTIAL | Live groups and principal metrics connected. Attendance/timetable/assignments/results/notices/leave/report workflows are not all wired and verified. |
| Agent 8 — Gemini/Jinni/Brevo | NOT IMPLEMENTED / BLOCKED | No verified server-side AI/email integration or configured credentials evidenced. |
| Agent 9 — QA/release | PARTIAL | Latest Pages workflow run 40061910701 has successful build and deploy jobs. JavaScript syntax check was previously run. No browser E2E, accessibility, multi-role, or cross-tenant suite evidence. |

## Direct environment findings

- Applied Supabase migrations reported by the project: `20261022115103`, `20261022121128`, `20261022121802`, `20261022134552`.
- A repository migration exists at `supabase/migrations/20261024040000_register_institution_for_current_user.sql`; verify its applied status separately before replaying elsewhere.
- Database counts at audit time: 2 Auth users, 0 institutions, 0 institution memberships. Therefore live dashboard values will remain empty until a legitimate institution is registered and data is entered.
- `principal-dashboard-data`: ACTIVE, `verify_jwt=true`.
- `principal-dashboard-preview`: ACTIVE, `verify_jwt=false`; its handler returns a hard-coded demo dashboard. This is a security/release blocker requiring review and retirement/protection in a verified staging/release process. It was not changed here because the target environment was not positively verified as staging.
- Security advisor findings: (1) authenticated users can execute the SECURITY DEFINER institution-registration RPC; (2) leaked-password protection is disabled. Do not remove legitimate onboarding grants without a reviewed replacement.
- Latest observed GitHub Pages workflow: run 40061910701; build and deploy jobs both succeeded. This verifies workflow completion, not a full browser acceptance test.

## Changes made in this audit pass

- Redirected the obsolete, nonfunctional standalone `auth.html` page to the single integrated auth gate in `index.html`, avoiding two conflicting sign-in implementations.
- Removed the duplicate Pages workflow so one workflow owns deployment and concurrent deploys are less likely.
- Replaced the minimal README with verified status, migration inventory, blockers, and release gates.
