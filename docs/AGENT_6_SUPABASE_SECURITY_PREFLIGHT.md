# Agent 6 — Supabase Security Preflight

**Environment decision: READ-ONLY ONLY.** The connected Supabase project is active, but the available project metadata does not positively identify it as development or staging, and there are no Supabase development branches. No schema, data, Auth settings, Edge Functions, or secrets were modified.

## Project and migration inventory

- Project ref: `ayrryemawwplguaauxij` (project name: `Noormanagement43's Project`; region: `ap-southeast-1`; PostgreSQL 17.11).
- Applied migrations reported by Supabase: `20261022115103_noor_project_foundation`, `20261022121128_teacher_timetable_and_attendance`, `20261022121802_editable_class_management`, `20261022134552_index_foreign_keys_for_scale`.
- The repository contains `supabase/migrations/20261024040000_register_institution_for_current_user.sql`; the three earlier applied migration sources were not found at their expected filenames in the default branch during this pass. Do not reconstruct or replay those migrations from guesses.
- The project has no Supabase development branches available for a safe staging mutation.
- The inspected public tables all report RLS enabled. This is a positive baseline, but RLS being enabled does not itself prove every policy is correct.

## Findings

### SEC-1 — High: Public demo Edge Function is active without JWT verification

- `principal-dashboard-preview` is ACTIVE and has `verify_jwt=false`.
- Its source returns a complete HTML demo dashboard with hard-coded profile details, attendance totals, class counts, teacher records, notices, and sample schedules.
- This is not a verified live dashboard and should not be exposed as if it were private institution data.
- **Action required:** In a positively identified staging/release process, confirm no client or external consumer depends on it, then retire it or protect it with authentication and remove hard-coded identity/sample records. No change was made because the target environment is not verified as staging.

### SEC-2 — High: Leaked-password protection is disabled

- Supabase Security Advisor reports `auth_leaked_password_protection` as WARN.
- **Action required:** Enable the setting after owner review and verify sign-up/password-reset behavior in staging. This is an Auth project setting; it was not changed.

### SEC-3 — Medium: Institution registration is a SECURITY DEFINER RPC callable by authenticated users

- `public.register_institution_for_current_user(text,text,text)` is owned by `postgres`, is `SECURITY DEFINER`, has an empty search path, and is executable by `authenticated` but not listed as executable by `anon` in its ACL.
- Source checks `auth.uid()`, validates the name/slug/type, rejects users who already have an active institution membership, and creates a principal membership. This appears consistent with self-service principal onboarding, but the Security Advisor warning is real and should be explicitly accepted or mitigated.
- **Action required:** Review whether self-service institution creation is intended. If retained, document the threat model, consider abuse/rate controls, and preserve the explicit signed-in-user check. Do not switch to SECURITY INVOKER blindly because the function's inserts and onboarding behavior would change.

### SEC-4 — Medium: Tenant-isolation behavior has not been penetration-tested

- Public table metadata reports RLS enabled.
- Read-only policy inspection shows tenant-scoped helper predicates for core academic reads/writes and separate role checks for academic management; UPDATE policies inspected include both `USING` and `WITH CHECK`.
- The helper functions in the `private` schema are SECURITY DEFINER, owned by `postgres`, use an empty search path, and qualify their referenced objects. They still need adversarial tests against actual roles and two separate institutions.
- **Action required:** Run negative cross-tenant SELECT/INSERT/UPDATE/DELETE tests in staging for principal, teacher, faculty, student, and unaffiliated authenticated accounts.

### SEC-5 — Positive finding: principal dashboard data function enforces JWT and administrator role

- `principal-dashboard-data` is ACTIVE with `verify_jwt=true`.
- Its source calls `auth.getUser()`, resolves the current user's active institution membership, rejects ambiguous unqualified memberships, limits access to principal/school_admin/university_admin/academic_admin roles, and scopes metrics queries to the resolved institution.
- The browser must still handle errors and empty states; this review did not exercise real tokens or attempt cross-tenant requests.

## Key and API review

- The frontend uses a Supabase publishable key. No service-role key was found in the inspected frontend source; publishable keys are expected to be public and must rely on RLS.
- No service-role key, secret, or production credential was added to Git.
- Supabase changelog review noted the Data API exposure default change scheduled to be enforced on 2026-10-30. Newly added public tables should have explicit exposure/grant decisions and RLS review; this audit did not change table exposure.

## Verification performed

- Listed the connected project and branches.
- Read applied migration inventory and public table metadata.
- Read Security Advisor findings.
- Read-only SQL inspection of public RLS policies and relevant helper/RPC definitions.
- Read Edge Function source and deployment metadata for both principal functions.
- No mutation, deployment, test-user creation, or live email was performed.

## Release gate

**NO-GO for production until SEC-1 is retired/protected, SEC-2 is resolved, SEC-3 has an explicit owner-approved decision, and cross-tenant role tests pass in verified staging.** The current connected project was treated as potentially production because its environment could not be verified.
