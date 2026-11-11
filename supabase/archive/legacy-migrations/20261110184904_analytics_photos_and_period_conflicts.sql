-- A daily period occupies the slot on every day, including legacy weekday rows.
create or replace function private.noor_v2_enforce_teacher_period() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and(new.teacher_membership_id is distinct from old.teacher_membership_id or new.institution_id is distinct from old.institution_id or new.created_by is distinct from old.created_by) then raise exception 'Timetable ownership cannot be changed' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.teacher_membership_id::text,91));
 if exists(select 1 from public.teacher_timetable_periods p where p.teacher_membership_id=new.teacher_membership_id and p.id<>new.id
 and (p.repeats_daily or new.repeats_daily or p.weekday=new.weekday)
 and (p.period_number=new.period_number or(p.start_time<new.end_time and p.end_time>new.start_time))) then
 raise exception 'Your periods overlap or this period number already exists on this day' using errcode='23514';end if;
 new.updated_at=now();return new;
end $$;
-- Only the currently published winner's profile image, never their other uploads.
create or replace function private.noor_achiever_photo(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.institution_memberships viewer join public.institutions i on i.id=viewer.institution_id and i.status='active'
 join lateral(
 select a.student_membership_id,100*sum(a.marks)/nullif(sum(a.max_marks),0) pct
 from public.noor_assessment_results a join public.institution_memberships active on active.id=a.student_membership_id and active.institution_id=a.institution_id and active.status='active'
 where a.institution_id=i.id and a.assessed_on between date_trunc('week',now() at time zone i.timezone)::date and (now() at time zone i.timezone)::date
 group by a.student_membership_id order by round(100*sum(a.marks)/nullif(sum(a.max_marks),0),1) desc,a.student_membership_id limit 3
 ) winner on true
 join public.institution_memberships student on student.id=winner.student_membership_id and student.institution_id=i.id and student.status='active'
 join public.profiles p on p.id=student.user_id and p.avatar_url='noor-profile-photos/'||path
 where viewer.user_id=auth.uid() and viewer.status='active' and viewer.role in('principal','school_admin','university_admin','academic_admin','teacher','faculty','student','university_student'));
$$;
revoke all on function private.noor_achiever_photo(text) from public,anon;
grant execute on function private.noor_achiever_photo(text) to authenticated;
create policy noor_weekly_achiever_photo on storage.objects for select to authenticated
using(bucket_id='noor-profile-photos' and private.noor_achiever_photo(name));
