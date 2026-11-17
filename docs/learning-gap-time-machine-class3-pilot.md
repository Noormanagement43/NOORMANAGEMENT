# NOOR Learning Gap Time Machine — Class 3 Mathematics MVP

## Audit & integration
The active backend uses `institutions`, `institution_memberships`, `academic_groups`, `academic_group_memberships`, teacher-scoped `noor_class_performance`, `noor_weekly_quizzes`, and `noor_quiz_attempts`. The initial active project had **no reviewed quiz attempts** at audit time, so there is no real historical gap data to display yet.

The migration creates a school-scoped concept map, teacher-approved quiz-question mapping, immutable individual question evidence, cautious mastery estimates, reviewable observed gap findings, teacher-assigned micro-practice and event chronology. Existing sidebar/navigation are not modified. Entry cards appear in Class 3 teacher, student, parent and principal workspaces. No student records or synthetic marks are seeded.

## Protected rollout
- Feature key: `learning_gap_time_machine`, **OFF by default** in the Creator feature catalog, as a deliberate production safety gate.
- Apply the reviewed SQL migration and verify Postgres RLS + teacher/student/parent boundaries in a test environment.
- Creator then enables the key for one pilot institution; Principal can further disable through existing feature controls.
- Assigned Class 3 teachers use **Create Class 3 concept map**. The map starts as suggestions, not approved curriculum.
- Teachers review actual Maths quiz questions and map each question to an appropriate concept, explicitly approving that concept.
- Reviewed quiz attempts are ingested by an idempotent trigger; a diagnostic is a separate assessment source. A single test or a single incorrect question is **insufficient** to confirm any learning gap.
- Teacher confirms a supported finding, edits a short lesson, assigns practice. Student completes the task; real time-stamped events are added.

## Safeguards & non-goals
- All 11 new public tables use RLS and authenticated SELECT-only grants; write operations use checked RPCs. AI audit logs have no end-user SELECT policy.
- Teacher/student/parent permissions depend on verified *active* school memberships, section assignments, or explicit guardian link; never trust a browser-selected institution ID.
- Recommendations are **deterministic teacher-reviewed curriculum examples**, not external AI-generated content. The generic AI engine is not extended in this MVP, and no provider is called or charged.
- Status **Not Enough Evidence** is authoritative when less than three scored items or two distinct assessment sources exist. Prerequisite graph links are possible causes, not confirmed diagnoses.
- No retroactive timeline fabrication, cross-student leaderboards, automated consequential decisions, or medical/psychological claims.
- Parent summary is read-only and currently renders simple English text; English/Urdu/Telugu/Hindi localisation and advanced provider-assisted diagnostic generation are subsequent phases.
- Student practice completion is an acknowledgement; it does **not** automatically certify mastery. Teacher must gather reassessment evidence and review any resolution.
- Browser-level unit tests are static smoke tests and **not** live RLS or authenticated end-to-end tests; do not claim production readiness on their basis.

## Checks and rollback
- Run `node --test tests/noor-learning-gap-time-machine.test.mjs` and existing `node --test tests/*.test.mjs`.
- Run SQL verification under authenticated student, wrong-school, wrong-section teacher, school principal, and linked/unlinked guardian sessions, using a rollback transaction and realistic fixtures.
- Test a real teacher-approved Maths quiz, map a question, review submission, confirm idempotency, record a separate diagnostic and assign a recovery activity.
- Confirm no existing teacher quiz, student progress, creator controls, mobile layout or attendance functionality regresses.
- To disable without data loss: turn the Creator/school feature key OFF. To roll back UI: revert the PR's HTML hook and the two client assets. **Never drop evidence or historical tables automatically**; only use a reviewed migration rollback after export/retention approval.
- Supabase migrations are additive; record migration history carefully and review environment readiness before applying to production.

## Additional guardrails completed in PR
- The UI checks effective Creator/school feature access and remains hidden while OFF; every write RPC is independently blocked when OFF.
- Teacher reassessment is a separate, dated evidence source with before/after mastery, idempotent historical quiz ingestion, and a dedicated teacher action. Resolving a gap requires completed practice and a scored reassessment, not simply marking an item complete.
- Principal insights use a school-scoped aggregate RPC (no student details in default response).
- Rollback-only staging test script: `supabase/tests/learning-gap-time-machine-rls.sql` checks wrong-school and wrong-section access, self-only student access, linked-only guardian access, no client evidence inserts, and the insufficient-evidence rule. This test **has been committed but not executed on a staging database**.
