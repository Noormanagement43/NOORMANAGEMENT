# Agent 2 — Principal Dashboard Progress

**Status: PARTIALLY IMPLEMENTED; full principal workflow remains blocked on verified backend data and role-specific E2E testing.**

## Work completed on the existing application

- Preserved the existing NOOR static application and its wine/ivory design system.
- Added an **Academic setup health** panel to the institution overview.
- The panel reports active academic group count, groups with a room assigned, and groups with a description. Values are computed from the signed-in institution's existing active `academic_groups` query; no sample figures are inserted.
- Added explicit empty-state copy when no active groups exist and resets the panel to unavailable indicators when the session is reset.
- Changed the sidebar footer from teacher-only wording to institution-administration wording and display the signed-in institution name after membership resolution.
- Added foundation tests for the panel and the source of its derived values.

## Data and authorization limits

- The existing principal dashboard Edge Function remains the source of top-level student/class/attendance metrics. This change does not bypass it or invent missing metrics.
- The setup panel only reflects the groups already returned to the signed-in user; frontend tenant filters are not security proof.
- No schema, RLS policy, Edge Function, or Supabase data was modified.
- Attendance details, timetable, assignments, notices, staff management, reports, and Creator workflows are still not verified as complete.
- The UI change is not considered secure or production-ready until staging role tests and cross-tenant RLS tests pass.

## Verification

The Agent 1 static CI passed on the earlier PR head (run 40080643681). The new Agent 2 panel tests were added afterward and must pass in the next CI run. No browser/E2E or live Supabase tests are claimed.
