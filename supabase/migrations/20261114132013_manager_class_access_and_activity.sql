-- School managers keep separate memberships; no shared identities or global grants.
CREATE OR REPLACE FUNCTION private.noor_save_class_register(p_institution uuid, p_group uuid, p_date date, p_records jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m uuid; tz text; s uuid; total int; saved int;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 SELECT im.id,i.timezone INTO m,tz FROM public.institution_memberships im JOIN public.institutions i ON i.id=im.institution_id
 WHERE im.institution_id=p_institution AND im.user_id=auth.uid() AND im.status='active' AND im.role IN('teacher','faculty','principal','school_admin','university_admin','academic_admin') AND i.status='active';
 IF m IS NULL OR NOT private.noor_group_access(p_institution,p_group,true) OR NOT EXISTS(
 SELECT 1 FROM public.academic_groups WHERE id=p_group AND institution_id=p_institution AND is_active AND group_type IN('class','section'))
 THEN RAISE EXCEPTION 'Assigned teacher or active school leadership required for this class' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_feature_enabled(p_institution,'attendance') THEN RAISE EXCEPTION 'Attendance is disabled by NOOR' USING ERRCODE='42501'; END IF;
 IF p_date IS NULL OR p_date>(now() AT TIME ZONE tz)::date THEN RAISE EXCEPTION 'Choose today or a past date' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Attendance list required' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO total FROM public.institution_memberships im WHERE im.institution_id=p_institution AND im.status='active'
 AND im.role IN('student','university_student') AND private.noor_student_enrolled(p_institution,p_group,im.id);
 IF total=0 OR total<>jsonb_array_length(p_records) OR total>500 THEN RAISE EXCEPTION 'Mark every enrolled student (maximum 500)' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_records) x WHERE x->>'status' IS NULL OR x->>'status' NOT IN('present','absent','late','leave')) THEN RAISE EXCEPTION 'Choose Present, Absent, Late or Leave' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution::text||p_group::text||p_date::text,45));
 SELECT id INTO s FROM public.class_sessions WHERE institution_id=p_institution AND academic_group_id=p_group
 AND title='Daily class attendance' AND (starts_at AT TIME ZONE tz)::date=p_date ORDER BY created_at LIMIT 1;
 IF s IS NULL THEN
 INSERT INTO public.class_sessions(institution_id,academic_group_id,teacher_membership_id,title,starts_at,ends_at,created_by)
 VALUES(p_institution,p_group,m,'Daily class attendance',(p_date+time '08:00') AT TIME ZONE tz,(p_date+time '08:01') AT TIME ZONE tz,auth.uid()) RETURNING id INTO s;
 END IF;
 saved:=public.noor_submit_attendance(s,p_records);
 UPDATE public.class_sessions SET session_status='completed',updated_at=now() WHERE id=s AND institution_id=p_institution;
 RETURN jsonb_build_object('session_id',s,'count',saved,'status','completed');
END $function$
;

create table public.noor_manager_activity (
 id bigint generated always as identity primary key,
 institution_id uuid not null references public.institutions(id),
 actor_id uuid not null,
 actor_membership_id uuid not null,
 actor_name text not null,
 action text not null check(action in ('INSERT','UPDATE','DELETE')),
 entity_table text not null,
 entity_id text,
 academic_group_id uuid,
 student_membership_id uuid,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default clock_timestamp()
);
create index noor_manager_activity_school_page on public.noor_manager_activity(institution_id,id desc);
create index noor_manager_activity_actor_page on public.noor_manager_activity(institution_id,actor_id,id desc);
alter table public.noor_manager_activity enable row level security;
revoke all on public.noor_manager_activity from public,anon,authenticated;
grant select on public.noor_manager_activity to authenticated;
create policy noor_manager_activity_read on public.noor_manager_activity for select to authenticated using (
 exists(select 1 from public.institution_memberships m join public.institutions i on i.id=m.institution_id
 where m.institution_id=noor_manager_activity.institution_id and m.user_id=(select auth.uid()) and m.status='active' and i.status='active'
 and (m.role in('principal','university_admin','academic_admin') or (m.role='school_admin' and actor_id=(select auth.uid()))))
);

-- Trigger-only definer writes an immutable audit entry, in the original write's transaction.
create function private.noor_log_manager_change() returns trigger language plpgsql security definer set search_path='' as $$
declare oldrow jsonb; newrow jsonb; r jsonb; actor uuid; who text; inst uuid; grp uuid; student uuid;
begin
 if auth.uid() is null then return case when tg_op='DELETE' then old else new end; end if;
 oldrow:=case when tg_op<>'INSERT' then to_jsonb(old) end;
 newrow:=case when tg_op<>'DELETE' then to_jsonb(new) end;
 if tg_op='UPDATE' and (oldrow-array['updated_at','marked_at'])=(newrow-array['updated_at','marked_at']) then return new; end if;
 r:=coalesce(newrow,oldrow);inst:=(r->>'institution_id')::uuid;
 select m.id,coalesce(p.full_name,'Manager') into actor,who from public.institution_memberships m
 join public.institutions i on i.id=m.institution_id left join public.profiles p on p.id=m.user_id
 where m.institution_id=inst and m.user_id=auth.uid() and m.role='school_admin' and m.status='active' and i.status='active';
 if actor is null then return case when tg_op='DELETE' then old else new end; end if;
 grp:=(r->>'academic_group_id')::uuid;student:=(r->>'student_membership_id')::uuid;
 if tg_table_name='attendance_records' then select academic_group_id into grp from public.class_sessions where id=(r->>'session_id')::uuid and institution_id=inst; end if;
 insert into public.noor_manager_activity(institution_id,actor_id,actor_membership_id,actor_name,action,entity_table,entity_id,academic_group_id,student_membership_id,before_data,after_data)
 values(inst,auth.uid(),actor,who,tg_op,tg_table_name,coalesce(r->>'id',r->>'institution_id'),grp,student,oldrow,newrow);
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function private.noor_log_manager_change() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['attendance_records','noor_assessment_results','noor_learning_items','noor_calendar_events','noor_principal_tasks','academic_groups','institution_memberships','noor_school_appearance','noor_report_settings','noor_group_report_settings','teacher_timetable_periods'] loop
 execute format('create trigger noor_manager_change after insert or update or delete on public.%I for each row execute function private.noor_log_manager_change()',t);
 end loop;
end $$;

create function private.noor_manager_overview(p_institution uuid,p_before bigint default null,p_actor uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.institution_memberships; roster jsonb; events jsonb;
begin
 select m.* into me from public.institution_memberships m join public.institutions i on i.id=m.institution_id where m.institution_id=p_institution and m.user_id=auth.uid() and m.status='active' and i.status='active';
 if auth.uid() is null or me.id is null or me.role not in('principal','school_admin','university_admin','academic_admin') then raise exception 'Active school leadership required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'name',p.full_name,'status',m.status) order by p.full_name,m.id),'[]'::jsonb) into roster
 from public.institution_memberships m join public.profiles p on p.id=m.user_id where m.institution_id=p_institution and m.role='school_admin' and (me.role<>'school_admin' or m.user_id=auth.uid());
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]'::jsonb) into events from (
 select a.*,coalesce(p.full_name,'') student_name,coalesce(parent.name||' · '||g.name,g.name,'School') class_label
 from public.noor_manager_activity a left join public.academic_groups g on g.id=a.academic_group_id and g.institution_id=a.institution_id
 left join public.academic_groups parent on parent.id=g.parent_group_id and parent.institution_id=g.institution_id
 left join public.institution_memberships sm on sm.id=a.student_membership_id and sm.institution_id=a.institution_id
 left join public.profiles p on p.id=sm.user_id
 where a.institution_id=p_institution and (p_before is null or a.id<p_before) and (p_actor is null or a.actor_id=p_actor) and (me.role<>'school_admin' or a.actor_id=auth.uid())
 order by a.id desc limit 50) x;
 return jsonb_build_object('managers',roster,'activities',events,'manager_count',jsonb_array_length(roster));
end $$;
create function public.noor_manager_overview(p_institution uuid,p_before bigint default null,p_actor uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.noor_manager_overview(p_institution,p_before,p_actor);$$;
revoke all on function public.noor_manager_overview(uuid,bigint,uuid),private.noor_manager_overview(uuid,bigint,uuid) from public,anon;
grant execute on function public.noor_manager_overview(uuid,bigint,uuid),private.noor_manager_overview(uuid,bigint,uuid) to authenticated;

-- Atomic manual mark batch. Preserve a prior author's identity on corrections.
create function private.noor_manager_save_marks(p_institution uuid,p_group uuid,p_date date,p_subject text,p_title text,p_kind text,p_max numeric,p_records jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare m uuid; tz text; r jsonb; target uuid; count_saved integer:=0; existing_count integer;
begin
 select im.id,i.timezone into m,tz from public.institution_memberships im join public.institutions i on i.id=im.institution_id
 where im.institution_id=p_institution and im.user_id=auth.uid() and im.status='active' and im.role in('principal','school_admin','university_admin','academic_admin') and i.status='active';
 if auth.uid() is null or m is null then raise exception 'Active school leadership required' using errcode='42501';end if;
 if not private.noor_feature_enabled(p_institution,'marks') then raise exception 'Marks are disabled by NOOR' using errcode='42501';end if;
 if not exists(select 1 from public.academic_groups where id=p_group and institution_id=p_institution and is_active and group_type in('class','section')) then raise exception 'Choose an active class or section in your school' using errcode='22023';end if;
 p_subject:=btrim(p_subject);p_title:=btrim(p_title);
 if p_date is null or p_date>(now() at time zone tz)::date or p_date<date '1900-01-01' or coalesce(length(p_subject),0) not between 1 and 140 or coalesce(length(p_title),0) not between 1 and 180 or p_kind is null or p_kind not in('weekly','monthly','term1','term2','term3','exam') or p_max is null or p_max<=0 or p_max>999999 then raise exception 'Enter valid subject, assessment, date and maximum marks' using errcode='22023';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 500 then raise exception 'Enter marks for 1–500 students' using errcode='22023';end if;
 if (select count(*) from jsonb_array_elements(p_records))<>(select count(distinct value->>'student_membership_id') from jsonb_array_elements(p_records)) then raise exception 'Duplicate student in marks batch' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_institution::text||p_group::text||p_date::text||p_subject||p_title||p_kind,66));
 for r in select value from jsonb_array_elements(p_records) loop
 if not private.noor_student_enrolled(p_institution,p_group,(r->>'student_membership_id')::uuid) then raise exception 'Student is not enrolled in this school class' using errcode='42501';end if;
 if r->>'marks' is null or (r->>'marks')::numeric<0 or (r->>'marks')::numeric>p_max or length(coalesce(r->>'feedback',''))>4000 then raise exception 'Marks must be within the maximum' using errcode='22023';end if;
 select count(*),(array_agg(id order by created_at))[1] into existing_count,target from public.noor_assessment_results
 where institution_id=p_institution and academic_group_id=p_group and student_membership_id=(r->>'student_membership_id')::uuid
 and assessed_on=p_date and subject_name=p_subject and assessment_title=p_title and assessment_kind=p_kind and source_quiz_attempt_id is null;
 if existing_count>1 then raise exception 'Multiple existing results found. Review the duplicate assessment before saving.' using errcode='22023';end if;
 if target is null then
 insert into public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,feedback,assessment_kind,graded_by)
 values(p_institution,p_group,(r->>'student_membership_id')::uuid,p_title,p_subject,p_date,(r->>'marks')::numeric,p_max,coalesce(r->>'feedback',''),p_kind,auth.uid());
 else
 update public.noor_assessment_results set marks=(r->>'marks')::numeric,max_marks=p_max,feedback=coalesce(r->>'feedback','') where id=target and institution_id=p_institution;
 end if;
 count_saved:=count_saved+1;
 end loop;
 return count_saved;
end $$;
create function public.noor_manager_save_marks(p_institution uuid,p_group uuid,p_date date,p_subject text,p_title text,p_kind text,p_max numeric,p_records jsonb) returns integer language sql security invoker set search_path='' as $$select private.noor_manager_save_marks(p_institution,p_group,p_date,p_subject,p_title,p_kind,p_max,p_records);$$;
revoke all on function public.noor_manager_save_marks(uuid,uuid,date,text,text,text,numeric,jsonb),private.noor_manager_save_marks(uuid,uuid,date,text,text,text,numeric,jsonb) from public,anon;
grant execute on function public.noor_manager_save_marks(uuid,uuid,date,text,text,text,numeric,jsonb),private.noor_manager_save_marks(uuid,uuid,date,text,text,text,numeric,jsonb) to authenticated;
-- Polling is also provided in the UI for missed/disconnected realtime delivery.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='noor_manager_activity') then alter publication supabase_realtime add table public.noor_manager_activity;end if;
end $$;
notify pgrst,'reload schema';
