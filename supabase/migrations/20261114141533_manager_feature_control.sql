-- Register the new Manager module without changing existing school settings.
insert into public.noor_feature_catalog(feature_key,label,category,description)
values('manager_tools','Manager Workspace','People','Manager substitute attendance, manual marks and activity workspace')
on conflict(feature_key) do nothing;
insert into public.noor_feature_defaults(feature_key,enabled) values('manager_tools',true)
on conflict(feature_key) do nothing;

create or replace function private.noor_manager_overview(p_institution uuid,p_before bigint default null,p_actor uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me public.institution_memberships; roster jsonb; events jsonb;
begin
 select m.* into me from public.institution_memberships m join public.institutions i on i.id=m.institution_id where m.institution_id=p_institution and m.user_id=auth.uid() and m.status='active' and i.status='active';
 if auth.uid() is null or me.id is null or me.role not in('principal','school_admin','university_admin','academic_admin') then raise exception 'Active school leadership required' using errcode='42501'; end if;
 if not private.noor_feature_enabled(p_institution,'manager_tools') then raise exception 'Manager workspace is disabled by NOOR' using errcode='42501';end if;
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

create or replace function private.noor_manager_save_marks(p_institution uuid,p_group uuid,p_date date,p_subject text,p_title text,p_kind text,p_max numeric,p_records jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare m uuid; tz text; r jsonb; target uuid; count_saved integer:=0; existing_count integer;
begin
 select im.id,i.timezone into m,tz from public.institution_memberships im join public.institutions i on i.id=im.institution_id
 where im.institution_id=p_institution and im.user_id=auth.uid() and im.status='active' and im.role in('principal','school_admin','university_admin','academic_admin') and i.status='active';
 if auth.uid() is null or m is null then raise exception 'Active school leadership required' using errcode='42501';end if;
 if not private.noor_feature_enabled(p_institution,'manager_tools') then raise exception 'Manager workspace is disabled by NOOR' using errcode='42501';end if;
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

-- A dedicated workspace endpoint composes module and Attendance controls. Existing
-- teacher attendance access remains governed by Attendance and its current RLS.
create function private.noor_manager_save_attendance(p_institution uuid,p_group uuid,p_date date,p_records jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.has_institution_role(p_institution,array['principal','school_admin','university_admin','academic_admin']) then
  raise exception 'Active school leadership required' using errcode='42501';
 end if;
 if not private.noor_feature_enabled(p_institution,'manager_tools') then
  raise exception 'Manager workspace is disabled by NOOR' using errcode='42501';
 end if;
 return public.noor_save_class_register(p_institution,p_group,p_date,p_records);
end $$;
create function public.noor_manager_save_attendance(p_institution uuid,p_group uuid,p_date date,p_records jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.noor_manager_save_attendance(p_institution,p_group,p_date,p_records)
$$;
revoke all on function private.noor_manager_save_attendance(uuid,uuid,date,jsonb),public.noor_manager_save_attendance(uuid,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function private.noor_manager_save_attendance(uuid,uuid,date,jsonb),public.noor_manager_save_attendance(uuid,uuid,date,jsonb) to authenticated;
