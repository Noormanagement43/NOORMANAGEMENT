# NOOR AI Supabase migrations

Project: `npzedchxfurcphvpjock` (Mumbai region). Do not point these changes at Cozy & Co or another project.

## Applied on the existing project

The existing schema was inspected before additive migrations were applied. The following migration names are recorded/applied on the live NOOR AI Supabase project:

- `student_admin_workspace`
- `school_operations_foundation`
- `school_operations_policy_hardening`
- `school_role_policy_hardening`
- `academic_smart_notes_and_school_management`
- `school_management_invites_and_permission_hardening`
- `academic_permission_and_secret_stability_fixes`
- `noor_role_membership_and_profile_guard_hardening`
- `invitation_lifecycle_and_assessment_security`
- `assessment_context_and_invitation_update_fixes`
- `assessment_history_and_regrading_permissions`
- `private_syllabus_source_uploads`
- `schedule_audit_payload_and_school_name_guard`
- `membership_aware_authorization_helpers`
- `staff_invitation_profile_completion`
- `public_authenticated_management_rpc_wrappers`
- `schedule_teacher_assignment_guard`
- `user_sound_preferences` (Ticket 07 — personal Sound & Feel controls)

The first academic/management schema migrations were applied before the current source-parity pass; their exact SQL bodies are not yet mirrored one-to-one in this folder. The schedule teacher assignment guard is mirrored as `20261015193122_schedule_teacher_assignment_guard.sql`, with a non-destructive function rollback under `supabase/rollback/`. The latest assessment-history and private-upload SQL files are available here. Do **not** treat this folder as a blank-project bootstrap until all earlier applied migration bodies have been checked into version control. Existing records must be kept.

## Source and deployment rule

1. Inspect the live migration history before running anything.
2. Apply only the next unapplied migration in the dedicated NOOR AI project.
3. Back up important data and test on a non-production project before destructive changes.
4. Do not expose service-role keys, AI provider keys, secret-code hashes or invitation token hashes to the browser.
5. The database is authoritative for role/membership access; frontend navigation alone is not security.
6. Preserve old academic rows when a membership is removed. A rollback should revert code or revoke a feature, not drop historical tables.

## External server-side secrets

The deployed Edge Function is `noor-ai-academic-assistant`. Configure these through Supabase Edge Function Secrets, not `config.js` or GitHub browser code:

- `AI_PROVIDER_API_KEY` — required to generate notes/weekly plans/reports or run image OCR.
- `AI_PROVIDER_MODEL` — optional; function default is `gpt-4o-mini`.
- `AI_PROVIDER_CHAT_COMPLETIONS_URL` — optional for a compatible provider endpoint.
- `AI_INPUT_COST_PER_1K_USD`, `AI_OUTPUT_COST_PER_1K_USD` — optional rate configuration for estimated usage costs.

The function intentionally reports a configuration error when no provider key is configured. That is safer than pretending AI output has been generated.


## Ticket 07 applied migrations
The following versions are recorded in the live project and their SQL source is checked in:
- `20261015202058_ticket07_secure_school_identity_and_membership_isolation.sql`
- `20261015202237_ticket07_verified_signup_and_school_approval_guard.sql`
- `20261015203107_ticket07_owner_onboarding_and_rpc_hardening.sql`
- `20261015203803_ticket07_protect_school_verification_and_leadership_memberships.sql`

The database test smoke script is `supabase/tests/ticket07_security.sql`. The private platform-admin allow-list intentionally has no client-facing RLS policy or direct table grants. Bootstrap a trusted platform administrator only from the Supabase SQL Editor under project-owner access after verifying the Auth account; never from public signup.


## School Command Centre additions (18 October 2026)

The live NOOR AI project has the following additive Command Centre migrations mirrored in this repository:
- `20261018104846_school_command_centre.sql` — dashboard preferences, task metadata/history/comments/attachments, automation rules/runs, templates, delivery logs and reminders. Existing schools, profiles, tasks, events and academic tables are reused.
- `20261018105400_enable_school_task_reminders_scheduler.sql` — pg_cron task reminder scheduler.
- `20261018105712_school_command_centre_automation_engine.sql` — idempotent rule evaluation, email/notification/task actions and school-local date windows.
- `20261018110225_school_command_centre_recurring_tasks_and_calendar_filters.sql` — recurring task instances and class/section/subject/teacher calendar context checks.
- `20261018111303_school_task_attachment_storage.sql` — private attachment bucket and school/task-scoped Storage policies.

The active scheduler jobs are `noor-cc-task-reminders`, `noor-cc-automation-rules`, and `noor-cc-recurring-tasks` (each runs every minute). Queue processing is idempotent; queued work is not described as delivered until the provider returns a successful response.

### Command Centre server-side secrets

Set these in Supabase **Edge Function Secrets**, never in `config.js` or client code:
- `BREVO_API_KEY` and `EMAIL_FROM` (verified sender); `EMAIL_FROM_NAME` is optional.
- `AI_PROVIDER_API_KEY` is optional for AI-assisted School Intelligence. Without it, the endpoint returns database-derived signals and does not claim an AI summary was generated.

Use the Email Automation page to send a test only to the signed-in verified account. Provider acceptance is not proof of inbox delivery. Fee Management remains planned; no fake financial metrics or payment tables are created.
