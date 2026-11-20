# NOOR: Principal and Manager workspace UI (2026-11-16)

## Requested navigation

Principal (owner/principal): Dashboard, Analytics, Student, Teacher, Manager Activities, Feature Control, Notice, Settings. This is the full primary navigation. The Manager Activities page uses verified manager history in read-only mode and does not mount the attendance/marks editor. Legacy Notice/Meeting links continue to open the school inbox, although the main sidebar has a single Notice item.

Manager: Dashboard, Class & Section, Periods & Timetable, Attendance, Marks & Assessments, Students, Teachers & Access, Manager Operations, Calendar, Notices, Settings. The shared manager operations workspace still supports enrollment-scoped attendance and manual marks with an audit trail.

## Shared UI controls

- Main login password visibility is now an inline, accessible eye button.
- Search fields get an accessible clear-X button. Clearing dispatches native `input` and `change` events to keep search results synchronized, including dynamically created inputs.
- Creator and school Feature Control switches show a green ON/red OFF track with a sliding thumb. Existing saving and server authorization rules are retained.

## Access caveat

The Principal/Manager change primarily updates navigation and UI routing. Server-side Supabase RLS and RPC permissions are not modified here, and UI-only routing is not a security boundary. School membership checks, role-based authorization and operation audit logs still need live verification before claiming new server-enforced Manager exclusivity.

## Verification

`node --test tests/*.test.mjs` from the repository root. Also perform interactive tests on phone and desktop for password-eye, search clearing, Creator and Principal feature switches, and Manager period editing.
