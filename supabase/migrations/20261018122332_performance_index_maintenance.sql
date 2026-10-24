-- Add covering indexes for application foreign keys flagged by Supabase's advisor.
-- These are non-unique indexes; business constraints and RLS policies are unchanged.
create index if not exists idx_calendar_events_subject on public.calendar_events (subject_id);
create index if not exists idx_calendar_events_teacher on public.calendar_events (teacher_id);
create index if not exists idx_noor_platform_admins_created_by on public.noor_platform_admins (created_by);
create index if not exists idx_school_automation_rules_created_by on public.school_automation_rules (created_by);
create index if not exists idx_school_automation_runs_rule on public.school_automation_runs (rule_id);
create index if not exists idx_school_dashboard_preferences_user on public.school_dashboard_preferences (user_id);
create index if not exists idx_school_email_delivery_logs_requested_by on public.school_email_delivery_logs (requested_by);
create index if not exists idx_school_email_delivery_logs_rule on public.school_email_delivery_logs (rule_id);
create index if not exists idx_school_email_delivery_logs_template on public.school_email_delivery_logs (template_id);
create index if not exists idx_school_email_templates_created_by on public.school_email_templates (created_by);
create index if not exists idx_school_task_attachments_task on public.school_task_attachments (task_id);
create index if not exists idx_school_task_attachments_uploaded_by on public.school_task_attachments (uploaded_by);
create index if not exists idx_school_task_comments_author on public.school_task_comments (author_id);
create index if not exists idx_school_task_comments_task on public.school_task_comments (task_id);
create index if not exists idx_school_task_reminders_notification on public.school_task_reminders (notification_event_id);
create index if not exists idx_school_task_reminders_recipient on public.school_task_reminders (recipient_profile_id);
create index if not exists idx_school_task_reminders_task on public.school_task_reminders (task_id);
create index if not exists idx_school_task_status_history_actor on public.school_task_status_history (actor_id);
create index if not exists idx_school_task_status_history_task on public.school_task_status_history (task_id);

-- Remove only exact duplicate non-unique indexes verified against pg_get_indexdef.
-- Keep the equivalent index with the preferred/canonical name in each group.
drop index if exists public.academic_report_reviews_reviewer_idx;
drop index if exists public.noor_attendance_records_marked_by_idx;
drop index if exists public.noor_attendance_sessions_taken_by_idx;
drop index if exists public.invites_creator_idx;
drop index if exists public.invites_school_idx;
drop index if exists public.invites_school_idx2;
drop index if exists public.memberships_user_fk_idx;
drop index if exists public.notes_year_idx;
drop index if exists public.notes_class_idx;
drop index if exists public.notes_section_idx;
drop index if exists public.notes_subject_idx;
drop index if exists public.progress_unit_idx;
drop index if exists public.progress_teacher_idx;
drop index if exists public.schedule_class_idx;
drop index if exists public.schedule_completed_by_idx;
drop index if exists public.schedule_section_idx;
drop index if exists public.schedule_subject_idx;
