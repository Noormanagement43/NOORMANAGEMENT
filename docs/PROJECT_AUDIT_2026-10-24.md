# NOOR Project Audit & Repair Status
Audit date: 2026-10-24
Repository: Noormanagement43/NOORMANAGEMENT (main)
Supabase project ref: ayrryemawwplguaauxij

## Evidence-based checklist

| Area | Status | Evidence / blocker |
|---|---|---|
| Repository and design foundation | PARTIAL | Static HTML pages exist with burgundy/ivory styling and responsive CSS; no package manifest or automated test setup found in inspected root files. |
| Principal dashboard | PARTIAL | Supabase Edge Function `principal-dashboard-data` is active, JWT verification enabled, checks current user and active admin membership, and scopes queries by institution. Existing `principal-dashboard-preview` is unauthenticated and contains hard-coded demo identity and metrics; do not use it as a live-data endpoint. |
| Teacher dashboard | PARTIAL | `index.html` contains teacher-oriented UI, but has hard-coded sample counts, timetable and student attendance rows. It is not safe to present those as live records. |
| Student dashboard | NOT VERIFIED | No separately verified student dashboard route or end-to-end student workflow established in this audit. |
| Authentication and registration UI | PARTIAL | `auth.html` has form validation and journeys, but its own submit handlers explicitly say Supabase Auth is not connected; no sign-in/signup request is made. |
| Supabase schema and migrations | PARTIAL | Four migrations exist: `noor_project_foundation`, `teacher_timetable_and_attendance`, `editable_class_management`, `index_foreign_keys_for_scale`. Public tables inspected have RLS enabled; policy semantics and cross-tenant behavior still require tests. |
| Tenant isolation | PARTIAL | Principal data function passes the caller's JWT through Supabase client, resolves active membership, restricts the selected institution, and filters data by institution ID. This is code evidence, not proof all RLS policies are correct. |
| Creator authorization | NOT VERIFIED | No end-to-end test proving privileged platform roles cannot be self-assigned or accessed by unauthorized users. |
| AI (Gemini / Jinni) | NOT VERIFIED | No verified configured live integration or credential-backed test in this audit. |
| Brevo email | NOT VERIFIED | No verified configured live integration or email test; no real emails sent. |
| QA/accessibility/responsiveness | PARTIAL | Responsive CSS and basic labels are present in HTML; automated browser, keyboard, screen-reader, and cross-tenant security tests were not available/executed. |
| Deployment | NOT VERIFIED | GitHub Pages workflow exists, but no deployment run/result was verified in this audit. No production deployment was initiated. |

## Security findings observed
1. Supabase Security Advisor reports `public.register_institution_for_current_user(p_name text, p_slug text, p_type text)` is a SECURITY DEFINER function executable by authenticated users. Review its implementation and grants; do not change grants/function behavior until the intended institution-registration authorization model is confirmed and tested.
2. Supabase Auth leaked-password protection is disabled according to Security Advisor.
3. The active `principal-dashboard-preview` Edge Function has `verify_jwt=false` and returns a static HTML page with hard-coded demo profile and school metrics. It should not be used for real institutional data. Disable/remove only after confirming no preview depends on it.
4. `index.html` includes hard-coded sample student names and figures. These are mock data and must not be described as live.
5. `auth.html` does not connect its login/signup/join forms to Supabase; its own user-facing messages disclose that no request is sent.

## Environment safety
The Supabase project reports ACTIVE_HEALTHY, but this does not establish that it is a development/staging environment. No schema/data mutations or deployments were made during this audit.

## Next implementation gates
- Verify target environment is development/staging before schema or auth-setting changes.
- Review all relevant RLS policies and security-definer function body/grants; test cross-institution access using separate authenticated users.
- Connect auth UI to Supabase Auth and enforce verification/role assignment server-side.
- Replace hard-coded dashboard records with authenticated, institution-scoped queries and explicit empty/error/loading states.
- Add repeatable automated tests and verify GitHub Pages workflow run before describing a preview URL as deployed.
- Configure server-side Gemini/Brevo secrets only through the appropriate secret manager; never place them in frontend files.
