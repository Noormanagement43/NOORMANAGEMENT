alter table public.teacher_timetable_periods add column repeats_daily boolean not null default true;

create policy student_own_display_insert on public.noor_student_display_preferences
 for insert to authenticated with check (
 private.is_active_member(institution_id) and exists (
 select 1 from public.institution_memberships m where m.id=membership_id
 and m.institution_id=noor_student_display_preferences.institution_id and m.user_id=(select auth.uid())
 and m.status='active' and m.role in ('student','university_student')));
create policy student_own_display_update on public.noor_student_display_preferences
 for update to authenticated using (
 private.is_active_member(institution_id) and exists (
 select 1 from public.institution_memberships m where m.id=membership_id
 and m.institution_id=noor_student_display_preferences.institution_id and m.user_id=(select auth.uid())
 and m.status='active' and m.role in ('student','university_student')))
 with check (
 private.is_active_member(institution_id) and exists (
 select 1 from public.institution_memberships m where m.id=membership_id
 and m.institution_id=noor_student_display_preferences.institution_id and m.user_id=(select auth.uid())
 and m.status='active' and m.role in ('student','university_student')));

create table public.noor_class_questions (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 academic_group_id uuid not null,
 student_membership_id uuid not null,
 question text not null check(length(btrim(question)) between 5 and 2000),
 reply text check(reply is null or length(reply)<=10000),
 replied_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key (academic_group_id,institution_id) references public.academic_groups(id,institution_id),
 foreign key (student_membership_id,institution_id) references public.institution_memberships(id,institution_id)
);
create index noor_class_questions_group_idx on public.noor_class_questions(academic_group_id,institution_id);
create index noor_class_questions_student_idx on public.noor_class_questions(student_membership_id,institution_id);
create index noor_class_questions_school_idx on public.noor_class_questions(institution_id);
alter table public.noor_class_questions enable row level security;
revoke all on public.noor_class_questions from anon,authenticated;
grant select,insert on public.noor_class_questions to authenticated;
grant update(reply,replied_at) on public.noor_class_questions to authenticated;
create policy class_questions_read on public.noor_class_questions for select to authenticated
 using (private.is_active_member(institution_id) and (
 private.is_my_membership(student_membership_id) or private.noor_group_access(institution_id,academic_group_id,true)));
create policy class_questions_ask on public.noor_class_questions for insert to authenticated
 with check (reply is null and replied_at is null and private.is_active_member(institution_id)
 and private.is_my_membership(student_membership_id)
 and private.has_institution_role(institution_id,array['student','university_student'])
 and private.noor_group_access(institution_id,academic_group_id,false));
create policy class_questions_reply on public.noor_class_questions for update to authenticated
 using (private.noor_group_access(institution_id,academic_group_id,true))
 with check (private.noor_group_access(institution_id,academic_group_id,true));
notify pgrst,'reload schema';
