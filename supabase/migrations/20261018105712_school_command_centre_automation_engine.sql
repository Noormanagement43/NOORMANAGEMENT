-- NOOR AI School Command Centre automation engine; see live migration school_command_centre_automation_engine.
begin;
alter table public.school_email_delivery_logs add column if not exists body_html text not null default '';
alter table public.syllabus_units add column if not exists planned_completion_on date;
create index if not exists syllabus_units_milestone_idx on public.syllabus_units(school_id,planned_completion_on) where planned_completion_on is not null;
create or replace function private.noor_cc_preserve_event_creator() returns trigger language plpgsql set search_path='' as $$
begin if new.created_by is distinct from old.created_by then raise exception 'Calendar event creator cannot be changed';end if;return new;end;$$;
revoke all on function private.noor_cc_preserve_event_creator() from public,anon,authenticated;
drop trigger if exists noor_cc_event_creator_immutable on public.calendar_events;
create trigger noor_cc_event_creator_immutable before update of created_by on public.calendar_events for each row execute function private.noor_cc_preserve_event_creator();
drop policy if exists noor_calendar_update on public.calendar_events;
create policy noor_calendar_update on public.calendar_events for update to authenticated
using(private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_meetings'))
with check(private.noor_active_school_access(school_id) and (private.has_school_role(school_id,array['owner','principal']) or private.noor_can_school_permission(school_id,'manage_meetings')));

create or replace function private.noor_cc_emit_rule_action(p_rule_id uuid,p_record_id uuid,p_record_title text,p_due_at timestamptz,p_recipient_id uuid,p_class_id uuid default null,p_section_id uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.school_automation_rules%rowtype;person public.profiles%rowtype;templ public.school_email_templates%rowtype;
 run_key text;run_id uuid;task_id uuid;email_subject text;email_body text;local_day date;
begin
 select * into r from public.school_automation_rules where id=p_rule_id and is_enabled=true;if not found then return false;end if;
 select * into person from public.profiles where id=p_recipient_id and school_id=r.school_id and status='active';
 if not found or person.email is null then return false;end if;
 local_day:=(now() at time zone r.timezone)::date;
 run_key:=r.id::text||':'||r.trigger_type||':'||p_record_id::text||':'||person.id::text||':'||local_day::text;
 insert into public.school_automation_runs(school_id,rule_id,trigger_type,idempotency_key,status,matched_records,started_at)
 values(r.school_id,r.id,r.trigger_type,run_key,'running',jsonb_build_array(jsonb_build_object('id',p_record_id,'title',left(coalesce(p_record_title,''),180))),now())
 on conflict(school_id,idempotency_key) do nothing returning id into run_id;
 if run_id is null then return false;end if;
 if r.action_type='email' then
  begin select * into templ from public.school_email_templates where id=(r.action_config->>'template_id')::uuid and school_id=r.school_id and is_enabled=true;
  exception when invalid_text_representation then templ.id:=null;end;
  if templ.id is null then update public.school_automation_runs set status='failed',error_summary='No enabled email template is configured for this rule.',finished_at=now() where id=run_id;return true;end if;
  email_subject:=replace(replace(templ.subject,'{{record_title}}',left(coalesce(p_record_title,''),180)),'{{recipient_name}}',coalesce(person.full_name,''));
  email_body:=replace(replace(templ.body_html,'{{record_title}}',left(coalesce(p_record_title,''),180)),'{{recipient_name}}',coalesce(person.full_name,''));
  if p_due_at is not null then email_subject:=replace(email_subject,'{{deadline}}',to_char(p_due_at at time zone r.timezone,'YYYY-MM-DD HH24:MI'));email_body:=replace(email_body,'{{deadline}}',to_char(p_due_at at time zone r.timezone,'YYYY-MM-DD HH24:MI'));end if;
  insert into public.school_email_delivery_logs(school_id,template_id,rule_id,requested_by,recipient_email,subject,body_html,provider,idempotency_key,status,attempt_count)
  values(r.school_id,templ.id,r.id,r.created_by,person.email,email_subject,email_body,'brevo',run_key||':email','queued',0)
  on conflict(school_id,idempotency_key) do nothing;
  update public.school_automation_runs set status='queued',result_summary='Email queued; delivery awaits the configured provider worker.',finished_at=now() where id=run_id;return true;
 elsif r.action_type='notification' then
  insert into public.notification_events(school_id,recipient_profile_id,recipient_email,event_type,subject,status,requested_by,related_record_id)
  values(r.school_id,person.id,person.email,case when r.trigger_type in ('task_deadline_approaching','task_overdue','daily_report_due') then 'task_reminder' else 'school_notice' end,left(r.name||': '||coalesce(p_record_title,'School update'),250),'queued',r.created_by,p_record_id);
  update public.school_automation_runs set status='succeeded',result_summary='In-app notification queued for an authorised active account.',finished_at=now() where id=run_id;return true;
 elsif r.action_type='create_review_task' then
  insert into public.school_tasks(school_id,created_by,title,description,task_type,priority,status,class_id,section_id,due_at,idempotency_key)
  values(r.school_id,r.created_by,left('Review: '||coalesce(p_record_title,r.name),180),'Created by automation rule "'||r.name||'". Review the supporting record before taking action.','school','high','open',p_class_id,p_section_id,now()+interval '1 day','auto:'||run_key)
  on conflict(school_id,idempotency_key) where idempotency_key is not null do nothing returning id into task_id;
  if task_id is not null then insert into public.task_assignees(school_id,task_id,assignee_id,assigned_by,status) values(r.school_id,task_id,person.id,r.created_by,'assigned') on conflict do nothing;end if;
  update public.school_automation_runs set status='succeeded',result_summary=case when task_id is null then 'Review task already existed; duplicate suppressed.' else 'Review task created and assigned.' end,finished_at=now() where id=run_id;return true;
 end if;
 update public.school_automation_runs set status='skipped',result_summary='Unsupported action type.',finished_at=now() where id=run_id;return true;
end;$$;
revoke all on function private.noor_cc_emit_rule_action(uuid,uuid,text,timestamptz,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.noor_cc_evaluate_automation_rules() returns integer language plpgsql security definer set search_path='' as $$
declare r record;c record;v_count integer:=0;local_day date;
begin
 for r in select * from public.school_automation_rules where is_enabled=true order by created_at loop local_day:=(now() at time zone r.timezone)::date;
  if r.trigger_type in ('task_deadline_approaching','task_overdue') then
   for c in
    select t.id record_id,t.title record_title,t.due_at,t.class_id,t.section_id,ta.assignee_id recipient_id
    from public.school_tasks t join public.task_assignees ta on ta.task_id=t.id and ta.school_id=t.school_id
    join public.profiles p on p.id=ta.assignee_id and p.school_id=t.school_id and p.status='active'
    where t.school_id=r.school_id and t.status in ('open','in_progress','blocked') and t.due_at is not null
      and ((r.trigger_type='task_deadline_approaching' and t.due_at>now() and t.due_at<=now()+interval '1 hour') or (r.trigger_type='task_overdue' and t.due_at<now()))
    union all
    select t.id,t.title,t.due_at,t.class_id,t.section_id,t.created_by from public.school_tasks t
    where t.school_id=r.school_id and t.status in ('open','in_progress','blocked') and t.due_at is not null
      and not exists(select 1 from public.task_assignees ta where ta.school_id=t.school_id and ta.task_id=t.id)
      and ((r.trigger_type='task_deadline_approaching' and t.due_at>now() and t.due_at<=now()+interval '1 hour') or (r.trigger_type='task_overdue' and t.due_at<now()))
   loop if private.noor_cc_emit_rule_action(r.id,c.record_id,c.record_title,c.due_at,c.recipient_id,c.class_id,c.section_id) then v_count:=v_count+1;end if;end loop;
  elsif r.trigger_type='daily_report_due' then
   for c in select distinct ts.teacher_id record_id,coalesce(p.full_name,'Daily teaching report') record_title,null::timestamptz due_at,ts.class_id,ts.section_id,ts.teacher_id recipient_id
    from public.teacher_schedule_entries ts join public.profiles p on p.id=ts.teacher_id and p.school_id=ts.school_id and p.status='active'
    where ts.school_id=r.school_id and ts.schedule_date=local_day and ts.status='scheduled'
    and not exists(select 1 from public.daily_teaching_reports dr where dr.school_id=ts.school_id and dr.teacher_id=ts.teacher_id and dr.report_date=local_day and dr.report_status in ('submitted','reviewed','approved'))
   loop if private.noor_cc_emit_rule_action(r.id,c.record_id,c.record_title,c.due_at,c.recipient_id,c.class_id,c.section_id) then v_count:=v_count+1;end if;end loop;
  elsif r.trigger_type='exam_approaching' then
   for c in select a.id record_id,a.title record_title,null::timestamptz due_at,a.class_id,a.section_id,p.id recipient_id
    from public.school_assessments a cross join public.profiles p where a.school_id=r.school_id and a.assessment_date between local_day and local_day+3
    and p.school_id=r.school_id and p.status='active' and p.role in ('owner','principal')
   loop if private.noor_cc_emit_rule_action(r.id,c.record_id,c.record_title,c.due_at,c.recipient_id,c.class_id,c.section_id) then v_count:=v_count+1;end if;end loop;
  elsif r.trigger_type='syllabus_milestone_missed' then
   for c in select u.id record_id,u.title record_title,null::timestamptz due_at,u.class_id,u.section_id,p.id recipient_id
    from public.syllabus_units u cross join public.profiles p where u.school_id=r.school_id and u.planned_completion_on is not null and u.planned_completion_on<local_day and u.is_active=true
    and p.school_id=r.school_id and p.status='active' and p.role in ('owner','principal')
    and not exists(select 1 from public.syllabus_progress sp where sp.school_id=u.school_id and sp.syllabus_unit_id=u.id and sp.progress_status='completed')
   loop if private.noor_cc_emit_rule_action(r.id,c.record_id,c.record_title,c.due_at,c.recipient_id,c.class_id,c.section_id) then v_count:=v_count+1;end if;end loop;
  end if;
 end loop;return v_count;
end;$$;
revoke all on function private.noor_cc_evaluate_automation_rules() from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then
 perform cron.unschedule(jobid) from cron.job where jobname='noor-cc-automation-rules';
 perform cron.schedule('noor-cc-automation-rules','* * * * *','select private.noor_cc_evaluate_automation_rules();');
 end if;exception when others then raise notice 'Automation rule scheduler: %',sqlerrm;end $$;
commit;