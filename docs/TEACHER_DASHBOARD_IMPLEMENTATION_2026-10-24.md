# NOOR Teacher Dashboard implementation record — 24 October 2026

## Change location

- Working branch: \`agent9/qa-repair-2026-10-24-v2\`
- Pull request: [#4 — NOOR role dashboards, live academic reads, auth recovery, and security QA](https://github.com/Noormanagement43/NOORMANAGEMENT/pull/4)
- This remains a **draft**. Nothing was merged into \`main\`, and no Supabase function/schema/data was deployed or mutated during this work.

## Code added / changed

- \`teacher-dashboard.js\`: responsive Teacher workspace with burgundy / warm ivory / blush styling, light/dark theme control, profile and supported employment metadata, assigned groups, timetable, attendance summary, attendance chart, recent saved attendance activity, student roster, navigation and honest unsupported-feature states.
- \`supabase/functions/teacher-academic-data/index.ts\`: server-side data boundary for dashboard reads, date-specific session lookup, assigned-group roster reads and attendance writes. It validates the JWT user, active teacher/faculty membership, active institution, assigned group/session, active student roster, four allowed statuses, duplicate entries and correction reason. The service-role secret is read only from server environment variables and is not placed in browser code.
- \`index.html\`: exposes the existing signed-in Supabase client and active membership to the module, dispatches session lifecycle events and loads the module.
- \`.github/workflows/quality.yml\`: includes the new Edge Function in the Deno type-check command.
- \`tests/teacher-dashboard.test.mjs\`: adds source-level regression checks for membership/session scoping, roles, attendance state validation, correction gating, read-back logic, unsupported schema features and presentation safeguards.

## Backend facts confirmed by read-only inspection

The connected Supabase project exposed as available in this session is \`ayrryemawwplguaauxij\` (URL \`https://ayrryemawwplguaauxij.supabase.co\`). Its applied migration history includes the NOOR foundation, teacher timetable/attendance, editable academic groups, and foreign-key indexing migrations. The inspected schema uses institution-scoped \`institution_memberships\`, \`academic_groups\`, \`academic_group_memberships\`, \`courses\`, \`class_sessions\`, and \`attendance_records\`.

- Attendance statuses supported by the database are \`present\`, \`absent\`, \`late\`, and \`leave\`.
- A unique constraint on session + student membership blocks duplicate attendance records.
- Attendance read/write RLS policies restrict teacher operations to sessions assigned to the authenticated active teacher membership, while permitted academic administrators can read institution-level records.
- Teacher session timestamps are timezone-aware; the feature renders times using the institution's timezone and validates the selected local attendance date against the selected session.
- The inspected academic tables contained no rows at inspection time. No demo school or synthetic student data was added.

## Important product limits intentionally surfaced

The connected schema inspected here has no assignment, submission, learning-resource, assessment, notice or notification tables. The dashboard does not fabricate those records and marks those features as unavailable until a schema and authorization path are added.

The current profile/membership schema does not contain an employee ID or qualification field. These are disclosed as not configured rather than inferred.

Attendance corrections require a reason and confirmation. The endpoint appends a correction explanation to the attendance notes and checks \`updated_at\` before updating, to reduce accidental concurrent overwrites. The existing schema has no immutable attendance-correction audit table; notes are **not** equivalent to an immutable audit log. The endpoint reports per-student failures and duplicate conflicts, but its multi-record save is not a single database transaction. Read-back must be inspected after any partial result.

## Verification status

- Read-only inspection of the connected project schema, applied migrations, RLS policies, table constraints and security-advisor findings was performed.
- A source-contract check across the changed index, module, Edge Function and workflow passed 34/34 authored assertions; frontend and inline JavaScript syntax parsing also passed. These are local source checks, not the Node test runner or Deno type-check.
- The new Node regression test file and Deno type-check were **not executed by a new GitHub Actions run in this session**. Existing successful Actions runs on earlier commits do not verify these latest changes.
- No authenticated teacher credentials/test account were available for a browser E2E. Save-and-reload and Principal dashboard reflection are therefore **not claimed as runtime verified**.

## Release blockers before production

1. **Project mismatch:** current \`main/config.js\` points at \`npzedchxfurcphvpjock\`, which was not available through the connected Supabase integration. This feature branch's modern auth page points at \`ayrryemawwplguaauxij\`. The intended live target must be reconciled before merge so NOOR does not silently switch backends.
2. **Deployment pending:** \`teacher-academic-data\` is source-only in this PR. It must be deployed to the intended development/staging project, with JWT verification enabled and \`SUPABASE_SERVICE_ROLE_KEY\` available only as a server-side secret, then reviewed via the deployed function settings. Do not deploy against an unverified production project.
3. **Runtime acceptance pending:** create/authorize a staging teacher, assigned groups, active student memberships and scheduled sessions; run authenticated attendance save → reload; then confirm the allowed Principal dashboard sees those same institution-scoped rows. Also test duplicate, stale-update, cross-institution and unauthorized-session rejection.
4. **Existing security gates remain:** read-only inspection found active \`principal-dashboard-preview\` configured with \`verify_jwt=false\`, leaked-password protection disabled, and a Supabase advisor warning for the authenticated-callable SECURITY DEFINER institution-registration function. These were not modified here and should be resolved before a production release.
5. **Schema work remains:** assignments/resources/notices/assessments and an immutable correction audit trail need reviewed data models and policies before those workflows can be implemented safely.

Do not describe attendance as production-working, Principal reflection as tested, or this draft as release-ready until the checks above are completed.
