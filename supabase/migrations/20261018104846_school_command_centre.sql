-- NOOR AI School Command Centre. Additive extension of existing school records.
-- Applied to dedicated project npzedchxfurcphvpjock as migration school_command_centre.
begin;
alter table public.school_tasks
 add column if not exists starts_at timestamptz,
 add column if not exists checklist jsonb not null default '[]'::jsonb,
 add column if not exists links jsonb not null default '[]'::jsonb,
 add column if not exists recurrence jsonb,
 add column if not exists reminder_at timestamptz,
 add column if not exists completed_at timestamptz,
 add column if not exists cancelled_at timestamptz,
 add column if not exists idempotency_key text;
alter table public.school_tasks drop constraint if exists school_tasks_status_check;
alter table public.school_tasks add constraint school_tasks_status_check check(status=any(array['open','in_progress','blocked','completed','cancelled','archived']));
create unique index if not exists school_tasks_school_idempotency_uq on public.school_tasks(school_id,idempotency_key) where idempotency_key is not null;
create index if not exists school_tasks_school_due_status_idx on public.school_tasks(school_id,status,due_at);
create index if not exists school_tasks_school_reminder_idx on public.school_tasks(school_id,reminder_at) where reminder_at is not null;
alter table public.task_assignees drop constraint if exists task_assignees_status_check;
alter table public.task_assignees add constraint task_assignees_status_check check(status=any(array['assigned','in_progress','submitted','approved','changes_requested','completed']));
alter table public.calendar_events add column if not exists status text not null default 'scheduled',add column if not exists recurrence jsonb,add column if not exists reminder_minutes integer[] not null default '{}';
alter table public.calendar_events drop constraint if exists calendar_events_status_check;
alter table public.calendar_events add constraint calendar_events_status_check check(status=any(array['scheduled','completed','cancelled']));
create index if not exists calendar_events_school_start_idx on public.calendar_events(school_id,starts_at,status);

create table if not exists public.school_dashboard_preferences(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade,scope text not null default 'personal' check(scope in ('personal','school')),
 layout_json jsonb not null default '{"widgets":["student_count","staff_count","attendance","tasks","upcoming","reports","syllabus","notices","intelligence"],"sizes":{},"dateRange":"7d"}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((scope='personal' and user_id is not null) or (scope='school' and user_id is null)),check(jsonb_typeof(layout_json)='object')
);
create unique index if not exists school_dashboard_preferences_personal_uq on public.school_dashboard_preferences(school_id,user_id) where scope='personal';
create unique index if not exists school_dashboard_preferences_school_uq on public.school_dashboard_preferences(school_id) where scope='school';

create table if not exists public.school_task_status_history(
 id bigint generated always as identity primary key,school_id uuid not null references public.schools(id) on delete cascade,
 task_id uuid not null references public.school_tasks(id) on delete cascade,actor_id uuid references public.profiles(id) on delete set null,
 old_status text,new_status text not null,note text,created_at timestamptz not null default now()
);
create index if not exists school_task_status_history_task_idx on public.school_task_status_history(school_id,task_id,created_at desc);
create table if not exists public.school_task_comments(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 task_id uuid not null references public.school_tasks(id) on delete cascade,author_id uuid not null references public.profiles(id) on delete restrict,
 comment text not null check(char_length(trim(comment)) between 1 and 5000),created_at timestamptz not null default now()
);
create index if not exists school_task_comments_task_idx on public.school_task_comments(school_id,task_id,created_at);
create table if not exists public.school_task_attachments(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 task_id uuid not null references public.school_tasks(id) on delete cascade,uploaded_by uuid not null references public.profiles(id) on delete restrict,
 storage_path text not null check(char_length(storage_path) between 1 and 1024),
 original_file_name text not null check(char_length(original_file_name) between 1 and 255),mime_type text,
 file_size_bytes bigint check(file_size_bytes is null or file_size_bytes between 1 and 52428800),
 created_at timestamptz not null default now(),unique(school_id,storage_path)
);
create table if not exists public.school_automation_rules(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 created_by uuid not null references public.profiles(id) on delete restrict,name text not null check(char_length(trim(name)) between 2 and 160),
 trigger_type text not null check(trigger_type=any(array['task_deadline_approaching','task_overdue','daily_report_due','exam_approaching','syllabus_milestone_missed'])),
 conditions jsonb not null default '{}'::jsonb check(jsonb_typeof(conditions)='object'),
 action_type text not null check(action_type=any(array['email','notification','create_review_task'])),
 action_config jsonb not null default '{}'::jsonb check(jsonb_typeof(action_config)='object'),
 is_enabled boolean not null default false,timezone text not null default 'Asia/Kolkata',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists school_automation_rules_active_idx on public.school_automation_rules(school_id,is_enabled,trigger_type);
create table if not exists public.school_automation_runs(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 rule_id uuid references public.school_automation_rules(id) on delete set null,trigger_type text not null,idempotency_key text not null,
 status text not null default 'queued' check(status=any(array['queued','running','succeeded','failed','skipped'])),
 matched_records jsonb not null default '[]'::jsonb,result_summary text,error_summary text,started_at timestamptz,finished_at timestamptz,
 created_at timestamptz not null default now(),unique(school_id,idempotency_key)
);
create index if not exists school_automation_runs_recent_idx on public.school_automation_runs(school_id,created_at desc);
create table if not exists public.school_email_templates(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 created_by uuid not null references public.profiles(id) on delete restrict,name text not null check(char_length(trim(name)) between 2 and 160),
 category text not null default 'school_notice',subject text not null check(char_length(trim(subject)) between 1 and 250),
 body_html text not null check(char_length(trim(body_html)) between 1 and 20000),is_enabled boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists school_email_templates_school_idx on public.school_email_templates(school_id,category,is_enabled);
create table if not exists public.school_email_delivery_logs(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 template_id uuid references public.school_email_templates(id) on delete set null,rule_id uuid references public.school_automation_rules(id) on delete set null,
 requested_by uuid references public.profiles(id) on delete set null,recipient_email text not null,subject text not null,
 provider text not null default 'brevo',provider_message_id text,idempotency_key text not null,
 status text not null default 'queued' check(status=any(array['queued','sent','failed','retrying','skipped'])),
 attempt_count integer not null default 0 check(attempt_count between 0 and 10),error_summary text,
 accepted_at timestamptz,delivered_at timestamptz,last_attempt_at timestamptz,created_at timestamptz not null default now(),
 unique(school_id,idempotency_key)
);
create index if not exists school_email_delivery_logs_recent_idx on public.school_email_delivery_logs(school_id,created_at desc,status);
create table if not exists public.school_task_reminders(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 task_id uuid not null references public.school_tasks(id) on delete cascade,recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
 reminder_type text not null default 'task_deadline',reminder_at timestamptz not null,
 status text not null default 'scheduled' check(status=any(array['scheduled','queued','sent','failed','skipped'])),
 notification_event_id uuid references public.notification_events(id) on delete set null,
 attempt_count integer not null default 0 check(attempt_count between 0 and 10),error_summary text,processed_at timestamptz,
 created_at timestamptz not null default now(),unique(school_id,task_id,recipient_profile_id,reminder_type,reminder_at)
);
create index if not exists school_task_reminders_due_idx on public.school_task_reminders(status,reminder_at);

create or replace function private.noor_cc_set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now();return new;end;$$;
revoke all on function private.noor_cc_set_updated_at() from public,anon,authenticated;
create trigger noor_cc_updated_dashboard before update on public.school_dashboard_preferences for each row execute function private.noor_cc_set_updated_at();
create trigger noor_cc_updated_rules before update on public.school_automation_rules for each row execute function private.noor_cc_set_updated_at();
create trigger noor_cc_updated_templates before update on public.school_email_templates for each row execute function private.noor_cc_set_updated_at();
create or replace function private.noor_cc_record_task_status() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.status is distinct from old.status then
 insert into public.school_task_status_history(school_id,task_id,actor_id,old_status,new_status) values(new.school_id,new.id,(select auth.uid()),old.status,new.status);
 if new.status='completed' and old.status is distinct from 'completed' then new.completed_at:=now();end if;
 if new.status='cancelled' and old.status is distinct from 'cancelled' then new.cancelled_at:=now();end if;
 if new.status not in ('completed','cancelled') then new.completed_at:=null;new.cancelled_at:=null;end if;
 end if;return new;end;$$;
revoke all on function private.noor_cc_record_task_status() from public,anon,authenticated;
create trigger noor_cc_task_status_history before update of status on public.school_tasks for each row execute function private.noor_cc_record_task_status();

alter table public.school_dashboard_preferences enable row level security;
alter table public.school_task_status_history enable row level security;
alter table public.school_task_comments enable row level security;
alter table public.school_task_attachments enable row level security;
alter table public.school_automation_rules enable row level security;
alter table public.school_automation_runs enable row level security;
alter table public.school_email_templates enable row level security;
alter table public.school_email_delivery_logs enable row level security;
alter table public.school_task_reminders enable row level security;
grant select,insert,update,delete on public.school_dashboard_preferences to authenticated;
grant select on public.school_task_status_history to authenticated;
grant select,insert on public.school_task_comments to authenticated;
grant select,insert,delete on public.school_task_attachments to authenticated;
grant select,insert,update,delete on public.school_automation_rules to authenticated;
grant select on public.school_automation_runs to authenticated;
grant select,insert,update,delete on public.school_email_templates to authenticated;
grant select,insert,update on public.school_email_delivery_logs to authenticated;
grant select on public.school_task_reminders to authenticated;

create policy noor_cc_dashboard_select on public.school_dashboard_preferences for select to authenticated using(private.noor_active_school_access(school_id) and (user_id=(select auth.uid()) or scope='school'));
create policy noor_cc_dashboard_insert on public.school_dashboard_preferences for insert to authenticated with check(private.noor_active_school_access(school_id) and ((scope='personal' and user_id=(select auth.uid())) or (scope='school' and user_id is null and (private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_dashboard')))));
create policy noor_cc_dashboard_update on public.school_dashboard_preferences for update to authenticated using(private.noor_active_school_access(school_id) and ((scope='personal' and user_id=(select auth.uid())) or (scope='school' and (private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_dashboard'))))) with check(private.noor_active_school_access(school_id) and ((scope='personal' and user_id=(select auth.uid())) or (scope='school' and user_id is null and (private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_dashboard')))));
create policy noor_cc_dashboard_delete on public.school_dashboard_preferences for delete to authenticated using(private.noor_active_school_access(school_id) and ((scope='personal' and user_id=(select auth.uid())) or (scope='school' and (private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_dashboard')))));
create policy noor_cc_history_read on public.school_task_status_history for select to authenticated using(private.noor_active_school_access(school_id) and private.can_access_task(task_id));
create policy noor_cc_comments_read on public.school_task_comments for select to authenticated using(private.noor_active_school_access(school_id) and private.can_access_task(task_id));
create policy noor_cc_comments_insert on public.school_task_comments for insert to authenticated with check(author_id=(select auth.uid()) and private.noor_active_school_access(school_id) and private.can_access_task(task_id));
create policy noor_cc_attachments_read on public.school_task_attachments for select to authenticated using(private.noor_active_school_access(school_id) and private.can_access_task(task_id));
create policy noor_cc_attachments_insert on public.school_task_attachments for insert to authenticated with check(uploaded_by=(select auth.uid()) and private.noor_active_school_access(school_id) and private.can_access_task(task_id));
create policy noor_cc_attachments_delete on public.school_task_attachments for delete to authenticated using(uploaded_by=(select auth.uid()) and private.noor_active_school_access(school_id) and private.can_access_task(task_id));
create policy noor_cc_rules_read on public.school_automation_rules for select to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_rules_insert on public.school_automation_rules for insert to authenticated with check(created_by=(select auth.uid()) and (private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation')));
create policy noor_cc_rules_update on public.school_automation_rules for update to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation')) with check(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_rules_delete on public.school_automation_rules for delete to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_runs_read on public.school_automation_runs for select to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_templates_read on public.school_email_templates for select to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_templates_insert on public.school_email_templates for insert to authenticated with check(created_by=(select auth.uid()) and (private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation')));
create policy noor_cc_templates_update on public.school_email_templates for update to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation')) with check(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_templates_delete on public.school_email_templates for delete to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_email_logs_read on public.school_email_delivery_logs for select to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_email_logs_insert on public.school_email_delivery_logs for insert to authenticated with check(requested_by=(select auth.uid()) and (private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation')));
create policy noor_cc_email_logs_update on public.school_email_delivery_logs for update to authenticated using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation')) with check(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_email_automation'));
create policy noor_cc_reminders_read on public.school_task_reminders for select to authenticated using(private.noor_active_school_access(school_id) and (recipient_profile_id=(select auth.uid()) or private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_tasks')));

create or replace function private.noor_cc_queue_due_task_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer:=0;
begin
 with due as (
  insert into public.school_task_reminders(school_id,task_id,recipient_profile_id,reminder_type,reminder_at,status)
  select t.school_id,t.id,ta.assignee_id,'task_deadline',coalesce(t.reminder_at,t.due_at-interval '1 hour'),'queued'
  from public.school_tasks t join public.task_assignees ta on ta.school_id=t.school_id and ta.task_id=t.id
  join public.profiles p on p.id=ta.assignee_id and p.school_id=t.school_id and p.status='active'
  where t.status in ('open','in_progress','blocked') and t.due_at is not null and coalesce(t.reminder_at,t.due_at-interval '1 hour')<=now()
  on conflict(school_id,task_id,recipient_profile_id,reminder_type,reminder_at) do nothing returning id,school_id,task_id,recipient_profile_id
 ), notify as (
  insert into public.notification_events(school_id,recipient_profile_id,recipient_email,event_type,subject,status,requested_by,related_record_id)
  select d.school_id,d.recipient_profile_id,p.email,'task_reminder','Task deadline reminder','queued',t.created_by,d.task_id
  from due d join public.profiles p on p.id=d.recipient_profile_id join public.school_tasks t on t.id=d.task_id
  returning id,related_record_id,recipient_profile_id,school_id
 )
 update public.school_task_reminders r set notification_event_id=n.id,processed_at=now()
 from notify n where r.task_id=n.related_record_id and r.recipient_profile_id=n.recipient_profile_id and r.school_id=n.school_id and r.notification_event_id is null;
 get diagnostics v_count=row_count;return v_count;
end;$$;
revoke all on function private.noor_cc_queue_due_task_reminders() from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then
 perform cron.unschedule(jobid) from cron.job where jobname='noor-cc-task-reminders';
 perform cron.schedule('noor-cc-task-reminders','* * * * *','select private.noor_cc_queue_due_task_reminders();');
 end if; exception when others then raise notice 'Configure pg_cron for the reminder queue: %',sqlerrm; end $$;
commit;