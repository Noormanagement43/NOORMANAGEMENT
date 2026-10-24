# Agent 7 — Core Academic Workflow Progress

**Status: READ-ONLY PRINCIPAL TIMETABLE AND ATTENDANCE VIEWS CONNECTED IN SOURCE; runtime verification pending.**

## Changes

- Replaced the placeholder timetable panel with a read-only query against `class_sessions`, scoped to `membership.institution_id`, scheduled sessions, and future start times.
- Resolves linked class/course labels using additional institution-scoped reads and displays session time in the institution timezone where valid.
- Connected the attendance table to recent `attendance_records`, scoped to the active institution, then resolves session and class labels with institution-scoped queries.
- Uses DOM `textContent` for record labels/statuses rather than inserting database values as HTML.
- Added empty/error states; no demo sessions or attendance are fabricated.
- Teacher and student paths return before the administrator data refresh, so these new queries are only invoked by the administrator dashboard path.
- Added static checks for tenant filters, empty states, and role-path separation.

## Limits

- No attendance marking/editing, timetable CRUD, assignment, notice, result, leave, or report mutation workflows were added.
- No database schema or policy changes were made. The connected Supabase project was not positively identified as staging, so it was treated as potentially production.
- The existing RLS policy definitions appear tenant/role-scoped in read-only inspection, but cross-tenant and role tests remain required.
- The current quality workflow passed on this PR head (run 40082096128), including the Node static regression suite and frozen Deno type-check. Browser and live Supabase execution are not claimed.

## Required verification

In verified staging, test principal sessions and attendance reads with records from two institutions; prove that no cross-tenant rows are returned. Then test teacher/student accounts and confirm they cannot reach the administrator data path.
