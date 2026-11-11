alter table public.noor_learning_items add column homework_date date;
alter table public.noor_class_questions add column recipient_teacher_membership_id uuid;
alter table public.noor_class_questions add constraint class_question_recipient_fk foreign key(recipient_teacher_membership_id,institution_id) references public.institution_memberships(id,institution_id);
create index class_question_recipient_idx on public.noor_class_questions(recipient_teacher_membership_id,institution_id);

create or replace function private.noor_is_class_teacher(p_institution uuid,p_group uuid,p_teacher uuid)
returns boolean language sql stable security definer set search_path=''
as $f$
select auth.uid() is not null and private.is_active_member(p_institution) and exists(
 select 1 from public.institution_memberships tm join public.academic_groups g on g.id=p_group and g.institution_id=tm.institution_id
 where tm.id=p_teacher and tm.institution_id=p_institution and tm.status='active' and tm.role in('teacher','faculty') and g.is_active and (
 g.homeroom_teacher_membership_id=tm.id or exists(select 1 from public.academic_groups parent where parent.id=g.parent_group_id and parent.institution_id=p_institution and parent.is_active and parent.homeroom_teacher_membership_id=tm.id)
 or exists(select 1 from public.teacher_timetable_periods t where t.institution_id=p_institution and t.teacher_membership_id=tm.id and t.academic_group_id in(g.id,g.parent_group_id))));
$f$;
revoke all on function private.noor_is_class_teacher(uuid,uuid,uuid) from public,anon;
grant execute on function private.noor_is_class_teacher(uuid,uuid,uuid) to authenticated;

create or replace function private.noor_class_teacher_directory(p_institution uuid,p_group uuid)
returns table(membership_id uuid,full_name text,avatar_reference text,subjects text[],is_class_teacher boolean)
language plpgsql stable security definer set search_path=''
as $f$
begin
 if auth.uid() is null or not private.has_institution_role(p_institution,array['student','university_student']) or not private.noor_group_access(p_institution,p_group,false) then raise exception 'Your enrolled class is required' using errcode='42501'; end if;
 return query select tm.id,p.full_name,p.avatar_url,
 coalesce(array(select distinct t.subject_name from public.teacher_timetable_periods t join public.academic_groups g on g.id=p_group and g.institution_id=t.institution_id where t.institution_id=p_institution and t.teacher_membership_id=tm.id and t.academic_group_id in(g.id,g.parent_group_id) order by t.subject_name),array[]::text[]),
 exists(select 1 from public.academic_groups g where g.institution_id=p_institution and (g.id=p_group or g.id=(select parent_group_id from public.academic_groups where id=p_group and institution_id=p_institution)) and g.homeroom_teacher_membership_id=tm.id)
 from public.institution_memberships tm join public.profiles p on p.id=tm.user_id
 where tm.institution_id=p_institution and private.noor_is_class_teacher(p_institution,p_group,tm.id);
end $f$;
revoke all on function private.noor_class_teacher_directory(uuid,uuid) from public,anon;
grant execute on function private.noor_class_teacher_directory(uuid,uuid) to authenticated;
create or replace function public.noor_class_teacher_directory(p_institution uuid,p_group uuid)
returns table(membership_id uuid,full_name text,avatar_reference text,subjects text[],is_class_teacher boolean)
language sql stable security invoker set search_path=''
as $f$ select * from private.noor_class_teacher_directory(p_institution,p_group); $f$;
revoke all on function public.noor_class_teacher_directory(uuid,uuid) from public,anon;
grant execute on function public.noor_class_teacher_directory(uuid,uuid) to authenticated;

drop policy class_questions_read on public.noor_class_questions;
drop policy class_questions_ask on public.noor_class_questions;
drop policy class_questions_reply on public.noor_class_questions;
create policy class_questions_read on public.noor_class_questions for select to authenticated using (
 private.is_active_member(institution_id) and (private.is_my_membership(student_membership_id) or private.can_manage_academics(institution_id)
 or (recipient_teacher_membership_id is not null and private.is_my_membership(recipient_teacher_membership_id))
 or (recipient_teacher_membership_id is null and private.noor_group_access(institution_id,academic_group_id,true))));
create policy class_questions_ask on public.noor_class_questions for insert to authenticated with check (
 reply is null and replied_at is null and private.is_my_membership(student_membership_id)
 and private.has_institution_role(institution_id,array['student','university_student'])
 and private.noor_group_access(institution_id,academic_group_id,false)
 and private.noor_is_class_teacher(institution_id,academic_group_id,recipient_teacher_membership_id));
create policy class_questions_reply on public.noor_class_questions for update to authenticated using(
 private.is_active_member(institution_id) and (
 (recipient_teacher_membership_id is not null and private.is_my_membership(recipient_teacher_membership_id))
 or (recipient_teacher_membership_id is null and private.noor_group_access(institution_id,academic_group_id,true))))
 with check (private.is_active_member(institution_id) and (
 (recipient_teacher_membership_id is not null and private.is_my_membership(recipient_teacher_membership_id))
 or (recipient_teacher_membership_id is null and private.noor_group_access(institution_id,academic_group_id,true))));

CREATE OR REPLACE FUNCTION private.noor_can_view_profile_photo(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
SELECT auth.uid() IS NOT NULL AND (
 split_part(p_path,'/',1)=auth.uid()::text OR EXISTS(
 SELECT 1 FROM public.institution_memberships subject JOIN public.institutions i ON i.id=subject.institution_id
 JOIN public.institution_memberships viewer ON viewer.institution_id=subject.institution_id
 WHERE subject.user_id::text=split_part(p_path,'/',1) AND subject.status='active' AND viewer.user_id=auth.uid() AND viewer.status='active' AND i.status='active' AND (
 viewer.role IN('principal','school_admin','university_admin','academic_admin') OR
 (viewer.role IN('teacher','faculty') AND subject.role IN('student','university_student') AND EXISTS(
 SELECT 1 FROM public.academic_group_memberships tm JOIN public.academic_group_memberships sm ON sm.institution_id=tm.institution_id JOIN public.academic_groups sg ON sg.id=sm.group_id AND sg.institution_id=sm.institution_id
 WHERE tm.membership_id=viewer.id AND sm.membership_id=subject.id AND tm.institution_id=i.id AND tm.status='active' AND sm.status='active' AND tm.group_role IN('teacher','faculty') AND sm.group_role='student' AND sg.is_active AND (tm.group_id=sm.group_id OR tm.group_id=sg.parent_group_id))) OR
 (viewer.role IN('student','university_student') AND subject.role IN('teacher','faculty') AND EXISTS (SELECT 1 FROM public.academic_group_memberships sm WHERE sm.institution_id=i.id AND sm.membership_id=viewer.id AND sm.group_role='student' AND sm.status='active' AND private.noor_is_class_teacher(i.id,sm.group_id,subject.id))) OR
 (viewer.role='parent' AND EXISTS(SELECT 1 FROM public.noor_guardian_links gl WHERE gl.institution_id=i.id AND gl.guardian_membership_id=viewer.id AND gl.student_membership_id=subject.id))
 ))
);
$function$
;

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
 WHERE im.institution_id=p_institution AND im.user_id=auth.uid() AND im.status='active' AND im.role IN('teacher','faculty') AND i.status='active';
 IF m IS NULL OR NOT private.noor_group_access(p_institution,p_group,true) OR NOT EXISTS(
 SELECT 1 FROM public.academic_groups WHERE id=p_group AND institution_id=p_institution AND is_active AND group_type IN('class','section'))
 THEN RAISE EXCEPTION 'Assigned teacher required for this class' USING ERRCODE='42501'; END IF;
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
notify pgrst,'reload schema';
