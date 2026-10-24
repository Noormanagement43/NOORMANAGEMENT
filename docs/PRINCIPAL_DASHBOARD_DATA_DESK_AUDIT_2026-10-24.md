# Principal Dashboard Data Desk — Implementation & Release Notes
Date: 2026-10-24

## Implemented on this branch

- Added `principal-data-desk.js` as an additive view inside the existing Principal Studio; no framework rewrite or existing dashboard replacement.
- Added live directory views for active students and teachers/staff, searchable by name and paginated in 25-row pages.
- Added an institution-school-scoped class and section list.
- Added an attendance register with date, status, student-name search, and paginated attendance rows. Supported statuses: Present, Absent, Late, Leave.
- Included permission/network/general error states, empty states, accessible labels, keyboard focus, responsive layout, safe text rendering, and a manual refresh.
- Directory and attendance tables are read-only. Existing authorized management screens remain the mutation path; this avoids duplicating/weakening existing authorization rules.
- Added static regression tests for script wiring, principal gating, query scoping, pagination, attendance filters, errors, safe rendering, and absence of mutation methods/privileged keys.

## Validation boundary

This is **not** a claim that authenticated production data flows or cross-tenant isolation have passed browser/E2E tests. The available environment cannot currently establish which of the two incompatible backend targets is intended for the deployed app.

### Backend target mismatch — release blocker

- The repository's current `config.js` points at Supabase project ref `npzedchxfurcphvpjock`.
- The available connected Supabase integration exposes a different project, ref `ayrryemawwplguaauxij`, URL `https://ayrryemawwplguaauxij.supabase.co`.
- The available project's schema uses `institutions`, `institution_memberships`, `academic_groups`, `class_sessions`, and `attendance_records` with `institution_id` and membership roles.
- Current `main`'s application shell and principal dashboard use the older `school_id` model (`profiles`, `classes`, `sections`, `attendance_sessions`, `school_notices`, and related legacy tables).
- Changing the app configuration to the available project without a coordinated auth/schema migration would be unsafe and likely break existing sign-in and dashboard flows. This branch intentionally leaves `config.js`, database schema/data, Supabase functions, and secrets unchanged.

### Security/release gates observed in the available Supabase project

- The active `principal-dashboard-preview` Edge Function has JWT verification disabled (`verify_jwt=false`). Retire it or secure it after confirming impact; this branch does not alter deployment settings.
- Supabase's Security Advisor reports leaked-password protection disabled.
- Security Advisor also flags `public.register_institution_for_current_user(...)` as an authenticated-callable SECURITY DEFINER RPC. Review the intended invocation model and restrict execution/schema exposure where appropriate.
- Applied migrations are reported as `20261022115103_noor_project_foundation`, `20261022121128_teacher_timetable_and_attendance`, `20261022121802_editable_class_management`, and `20261022134552_index_foreign_keys_for_scale`. The repository's default branch did not contain the first three source migrations at their expected filenames during inspection; reconcile migration source before schema releases.
- The available project had no verified development/staging branch, and its business tables were empty at inspection time. No test data was inserted.

## Checks

- Static test coverage is added in `tests/principal-data-desk.test.mjs`; the repository's existing `quality.yml` runs `node --test tests/*.test.mjs` on pull requests.
- CI is required before treating this branch as verified. If the static suite passes, that only validates source-level contracts; it does not establish live RLS authorization or browser behavior.
- Still required in a verified staging environment: authenticated principal browser flows, correct project config, positive/negative tenant-isolation tests, Teacher attendance write → Principal attendance read, CRUD persistence and relationship validation, responsive browser checks, and deployment/security review.
- No Supabase schema/data, Auth settings, Edge Function deployments, or secrets were changed as part of this branch.
