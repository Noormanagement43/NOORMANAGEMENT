-- NOOR AI Command Centre: recurring task generation and contextual school calendar filters.
-- Applied as migration school_command_centre_recurring_tasks_and_calendar_filters.
begin;
alter table public.school_tasks add column if not exists recurrence_spawned_at timestamptz;
alter table public.calendar_events add column if not exists subject_id uuid references public.subjects(id) on delete set null;
alter table public.calendar_events add column if not exists teacher_id uuid references public.profiles(id) on delete set null;
create index if not exists calendar_events_school_subject_idx on public.calendar_events(school_id,subject_id,starts_at);
create index if not exists calendar_events_school_teacher_idx on public.calendar_events(school_id,teacher_id,starts_at);

create or replace function private.noor_cc_validate_calendar_context()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.class_id is not null and not exists(select 1 from public.classes c where c.id=new.class_id and c.school_id=new.school_id) then raise exception 'Calendar class must belong to the active school';end if;
 if new.section_id is not null and not exists(select 1 from public.sections s join public.classes c on c.id=s.class_id where s.id=new.section_id and c.school_id=new.school_id and (new.class_id is null or c.id=new.class_id)) then raise exception 'Calendar section must belong to the selected school and class';end if;
 if new.subject_id is not null and not exists(select 1 from public.subjects s where s.id=new.subject_id and s.school_id=new.school_id and (new.class_id is null or s.class_id is null or s.class_id=new.class_id)) then raise exception 'Calendar subject must belong to the selected school and class';end if;
 if new.teacher_id is not null and not exists(select 1 from public.profiles p where p.id=new.teacher_id and p.school_id=new.school_id and p.role='teacher' and p.status='active') then raise exception 'Calendar teacher must be an active teacher in this school';end if;
 return new;
end;$$;
revoke all on function private.noor_cc_validate_calendar_context() from public,anon,authenticated;
drop trigger if exists noor_cc_validate_calendar_context on public.calendar_events;
create trigger noor_cc_validate_calendar_context before insert or update of school_id,class_id,section_id,subject_id,teacher_id on public.calendar_events for each row execute function private.noor_cc_validate_calendar_context();

create or replace function private.noor_cc_spawn_recurring_tasks()
returns integer language plpgsql security definer set search_path='' as $$
declare t record;period interval;next_due timestamptz;next_start timestamptz;next_reminder timestamptz;v_new_id uuid;freq text;tz text;spawned integer:=0;i integer;
begin
 for t in select * from public.school_tasks where status='completed' and completed_at is not null and recurrence_spawned_at is null and due_at is not null and recurrence->>'frequency' in ('daily','weekly','monthly') order by completed_at limit 500 loop
  freq:=t.recurrence->>'frequency';tz:=coalesce(t.recurrence->>'timezone','Asia/Kolkata');
  period:=case freq when 'daily' then interval '1 day' when 'weekly' then interval '1 week' else interval '1 month' end;
  next_due:=t.due_at;
  for i in 1..240 loop next_due:=next_due+period;exit when next_due>now();end loop;
  if next_due<=now() then next_due:=now()+period;end if;
  next_start:=case when t.starts_at is null then null else t.starts_at+(next_due-t.due_at) end;
  next_reminder:=case when t.reminder_at is null then null else t.reminder_at+(next_due-t.due_at) end;
  insert into public.school_tasks(school_id,created_by,title,description,task_type,priority,status,class_id,section_id,starts_at,due_at,reminder_at,checklist,links,recurrence,attachment_path,idempotency_key)
  values(t.school_id,t.created_by,t.title,t.description,t.task_type,t.priority,'open',t.class_id,t.section_id,next_start,next_due,next_reminder,t.checklist,t.links,t.recurrence,t.attachment_path,
    'recurrence:'||t.id::text||':'||to_char(next_due at time zone tz,'YYYYMMDDHH24MISS'))
  on conflict(school_id,idempotency_key) where idempotency_key is not null do nothing returning id into v_new_id;
  if v_new_id is not null then
   insert into public.task_assignees(school_id,task_id,assignee_id,assigned_by,status)
   select school_id,v_new_id,assignee_id,t.created_by,'assigned' from public.task_assignees where school_id=t.school_id and task_id=t.id on conflict do nothing;
   spawned:=spawned+1;
  end if;
  update public.school_tasks set recurrence_spawned_at=now() where id=t.id;
  v_new_id:=null;
 end loop;
 return spawned;
end;$$;
revoke all on function private.noor_cc_spawn_recurring_tasks() from public,anon,authenticated;

create or replace function private.noor_cc_queue_due_task_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer:=0;
begin
 with recipients as (
  select t.school_id,t.id task_id,ta.assignee_id recipient_profile_id,coalesce(t.reminder_at,t.due_at-interval '1 hour') reminder_at,t.created_by
  from public.school_tasks t join public.task_assignees ta on ta.school_id=t.school_id and ta.task_id=t.id
  join public.profiles p on p.id=ta.assignee_id and p.school_id=t.school_id and p.status='active'
  where t.status in ('open','in_progress','blocked') and t.due_at is not null
  union all
  select t.school_id,t.id,t.created_by,coalesce(t.reminder_at,t.due_at-interval '1 hour'),t.created_by
  from public.school_tasks t join public.profiles p on p.id=t.created_by and p.school_id=t.school_id and p.status='active'
  where t.status in ('open','in_progress','blocked') and t.due_at is not null
   and not exists(select 1 from public.task_assignees ta where ta.school_id=t.school_id and ta.task_id=t.id)
 ), due as (
  insert into public.school_task_reminders(school_id,task_id,recipient_profile_id,reminder_type,reminder_at,status)
  select r.school_id,r.task_id,r.recipient_profile_id,'task_deadline',r.reminder_at,'queued' from recipients r where r.reminder_at<=now()
  on conflict(school_id,task_id,recipient_profile_id,reminder_type,reminder_at) do nothing returning id,school_id,task_id,recipient_profile_id
 ), notify as (
  insert into public.notification_events(school_id,recipient_profile_id,recipient_email,event_type,subject,status,requested_by,related_record_id)
  select d.school_id,d.recipient_profile_id,p.email,'task_reminder','Task deadline reminder','queued',t.created_by,d.task_id
  from due d join public.profiles p on p.id=d.recipient_profile_id join public.school_tasks t on t.id=d.task_id
  returning id,related_record_id,recipient_profile_id,school_id
 )
 update public.school_task_reminders r set notification_event_id=n.id,processed_at=now() from notify n
 where r.task_id=n.related_record_id and r.recipient_profile_id=n.recipient_profile_id and r.school_id=n.school_id and r.notification_event_id is null;
 get diagnostics v_count=row_count;return v_count;
end;$$;
revoke all on function private.noor_cc_queue_due_task_reminders() from public,anon,authenticated;

do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.unschedule(jobid) from cron.job where jobname='noor-cc-recurring-tasks';
  perform cron.schedule('noor-cc-recurring-tasks','* * * * *','select private.noor_cc_spawn_recurring_tasks();');
 end if;
exception when others then raise notice 'Recurring task worker could not be scheduled: %',sqlerrm;
end $$;
commit;
