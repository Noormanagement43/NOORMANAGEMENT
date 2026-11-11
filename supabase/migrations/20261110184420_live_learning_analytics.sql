-- Automatic insights use verified school records, never model guesses.
create table public.noor_group_report_settings (
 institution_id uuid not null references public.institutions(id),
 academic_group_id uuid not null,
 subject_names text[] not null default '{}',
 exam_labels jsonb not null default '{}',
 exam_aliases jsonb not null default '{}',
 primary key(institution_id,academic_group_id),
 foreign key(academic_group_id,institution_id) references public.academic_groups(id,institution_id),
 check(cardinality(subject_names)<=30),
 check(jsonb_typeof(exam_labels)='object' and jsonb_typeof(exam_aliases)='object')
);
alter table public.noor_group_report_settings enable row level security;
grant select,insert,update,delete on public.noor_group_report_settings to authenticated;
create policy group_report_read on public.noor_group_report_settings for select to authenticated using(private.is_active_member(institution_id));
create policy group_report_manage on public.noor_group_report_settings for all to authenticated
 using(private.can_manage_academics(institution_id)) with check(private.can_manage_academics(institution_id));
create index if not exists noor_insights_marks_date on public.noor_assessment_results(institution_id,assessed_on,student_membership_id);

create or replace function private.noor_live_analytics(p_institution uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid; myrole text; today date; week_start date; output jsonb; winners jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 select m.id,m.role,(now() at time zone i.timezone)::date into me,myrole,today
 from public.institution_memberships m join public.institutions i on i.id=m.institution_id
 where m.user_id=auth.uid() and m.institution_id=p_institution and m.status='active' and i.status='active';
 if me is null or myrole not in ('principal','school_admin','academic_admin','university_admin','teacher','faculty','student','university_student') then
 raise exception 'Active school membership required' using errcode='42501'; end if;
 week_start:=date_trunc('week',today::timestamp)::date;
 with scoped as (
 select a.* from public.noor_assessment_results a
 join public.institution_memberships sm on sm.id=a.student_membership_id and sm.institution_id=a.institution_id and sm.status='active'
 join public.academic_groups g on g.id=a.academic_group_id and g.institution_id=a.institution_id and g.is_active
 where a.institution_id=p_institution and a.assessed_on between today-55 and today
 and (myrole in ('principal','school_admin','academic_admin','university_admin')
 or (myrole in ('student','university_student') and a.student_membership_id=me)
 or (myrole in ('teacher','faculty') and exists (
 select 1 from public.teacher_timetable_periods t join public.academic_groups tg on tg.id=t.academic_group_id and tg.institution_id=t.institution_id and tg.is_active
 where t.institution_id=p_institution and t.teacher_membership_id=me
 and lower(btrim(t.subject_name))=lower(btrim(a.subject_name))
 and (t.academic_group_id=g.id or t.academic_group_id=g.parent_group_id
 or (g.group_type='class' and tg.parent_group_id=g.id and exists (
 select 1 from public.academic_group_memberships sg where sg.institution_id=p_institution and sg.group_id=tg.id and sg.membership_id=a.student_membership_id and sg.status='active' and sg.group_role='student'))))))
 ), scores as (
 select student_membership_id,academic_group_id,subject_name,
 round(100*sum(marks) filter(where assessed_on>=today-27)/nullif(sum(max_marks) filter(where assessed_on>=today-27),0),1) percentage,
 round(100*sum(marks) filter(where assessed_on<today-27)/nullif(sum(max_marks) filter(where assessed_on<today-27),0),1) previous_percentage,
 count(*) filter(where assessed_on>=today-27) assessments
 from scoped group by student_membership_id,academic_group_id,subject_name
 ), visible_students as (
 select distinct student_membership_id from scores
 union select me where myrole in ('student','university_student')
 ), att as (
 select ar.student_membership_id,
 round(100.0*count(*) filter(where ar.attendance_status in ('present','late') and (cs.starts_at at time zone i.timezone)::date>=today-13)/nullif(count(*) filter(where ar.attendance_status in ('present','late','absent') and (cs.starts_at at time zone i.timezone)::date>=today-13),0),1) attendance,
 round(100.0*count(*) filter(where ar.attendance_status in ('present','late') and (cs.starts_at at time zone i.timezone)::date<today-13)/nullif(count(*) filter(where ar.attendance_status in ('present','late','absent') and (cs.starts_at at time zone i.timezone)::date<today-13),0),1) previous_attendance
 from public.attendance_records ar join public.class_sessions cs on cs.id=ar.session_id and cs.institution_id=ar.institution_id
 join public.institutions i on i.id=ar.institution_id
 where ar.institution_id=p_institution and cs.session_status='completed' and (cs.starts_at at time zone i.timezone)::date between today-27 and today
 and (ar.student_membership_id in (select student_membership_id from visible_students)
 or myrole in ('principal','school_admin','academic_admin','university_admin')
 or (myrole in ('teacher','faculty') and exists(select 1 from public.teacher_timetable_periods t
 join public.academic_group_memberships sg on sg.institution_id=t.institution_id and sg.membership_id=ar.student_membership_id and sg.status='active' and sg.group_role='student'
 join public.academic_groups g on g.id=sg.group_id and g.institution_id=sg.institution_id and g.is_active
 where t.institution_id=p_institution and t.teacher_membership_id=me and (t.academic_group_id=g.id or t.academic_group_id=g.parent_group_id))))
 group by ar.student_membership_id
 ), details as (
 select coalesce(s.student_membership_id,a.student_membership_id) student_membership_id,s.academic_group_id,s.subject_name,s.percentage,s.previous_percentage,s.assessments,a.attendance,a.previous_attendance
 from scores s full join att a on a.student_membership_id=s.student_membership_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('membership_id',d.student_membership_id,'name',p.full_name,'user_id',m.user_id,'avatar_reference',p.avatar_url,
 'group_id',coalesce(g.id,enrol.id),'class_label',case when coalesce(g.group_type,enrol.group_type)='section' then coalesce(parent.name,enrol_parent.name)||' · '||coalesce(g.name,enrol.name) else coalesce(g.name,enrol.name) end,
 'subject',d.subject_name,'percentage',d.percentage,'previous_percentage',d.previous_percentage,'assessments',coalesce(d.assessments,0),
 'attendance',d.attendance,'previous_attendance',d.previous_attendance) order by p.full_name,d.subject_name),'[]'::jsonb) into output
 from details d join public.institution_memberships m on m.id=d.student_membership_id and m.institution_id=p_institution and m.status='active'
 join public.profiles p on p.id=m.user_id
 left join public.academic_groups g on g.id=d.academic_group_id and g.institution_id=p_institution
 left join public.academic_groups parent on parent.id=g.parent_group_id and parent.institution_id=p_institution
 left join lateral(select eg.* from public.academic_group_memberships gm join public.academic_groups eg on eg.id=gm.group_id and eg.institution_id=gm.institution_id
 where gm.institution_id=p_institution and gm.membership_id=m.id and gm.status='active' and gm.group_role='student' and eg.is_active order by (eg.group_type='section') desc,eg.id limit 1) enrol on true
 left join public.academic_groups enrol_parent on enrol_parent.id=enrol.parent_group_id and enrol_parent.institution_id=p_institution;

 -- Only this minimal honour-board projection is shared across the school.
 with ranked as (
 select a.student_membership_id,round(100*sum(a.marks)/nullif(sum(a.max_marks),0),1) percentage,sum(a.marks) marks,sum(a.max_marks) max_marks,
 string_agg(distinct a.subject_name,', ' order by a.subject_name) subjects
 from public.noor_assessment_results a join public.institution_memberships m on m.id=a.student_membership_id and m.institution_id=a.institution_id and m.status='active'
 where a.institution_id=p_institution and a.assessed_on between week_start and today
 group by a.student_membership_id order by percentage desc,a.student_membership_id limit 3
 ) select coalesce(jsonb_agg(jsonb_build_object('name',p.full_name,'user_id',m.user_id,'avatar_reference',p.avatar_url,'percentage',r.percentage,'marks',r.marks,'max_marks',r.max_marks,'subject',r.subjects,
 'class_label',case when eg.group_type='section' then pg.name||' · '||eg.name else eg.name end,'class_teacher',tp.full_name) order by r.percentage desc,r.student_membership_id),'[]'::jsonb) into winners
 from ranked r join public.institution_memberships m on m.id=r.student_membership_id and m.institution_id=p_institution join public.profiles p on p.id=m.user_id
 left join lateral(select g.* from public.academic_group_memberships gm join public.academic_groups g on g.id=gm.group_id and g.institution_id=gm.institution_id
 where gm.membership_id=m.id and gm.institution_id=p_institution and gm.status='active' and gm.group_role='student' and g.is_active order by (g.group_type='section') desc,g.id limit 1) eg on true
 left join public.academic_groups pg on pg.id=eg.parent_group_id and pg.institution_id=p_institution
 left join public.institution_memberships tm on tm.id=coalesce(eg.homeroom_teacher_membership_id,pg.homeroom_teacher_membership_id) and tm.institution_id=p_institution and tm.status='active'
 left join public.profiles tp on tp.id=tm.user_id;
 return jsonb_build_object('rows',output,'achievers',winners,'week_start',week_start,'as_of',today,'role',myrole,'generated_at',now());
end $$;
revoke all on function private.noor_live_analytics(uuid) from public,anon;
grant execute on function private.noor_live_analytics(uuid) to authenticated;
create or replace function public.noor_live_analytics(p_institution uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.noor_live_analytics(p_institution); $$;
revoke all on function public.noor_live_analytics(uuid) from public,anon;
grant execute on function public.noor_live_analytics(uuid) to authenticated;
