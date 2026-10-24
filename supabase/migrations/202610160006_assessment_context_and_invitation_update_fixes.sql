-- NOOR AI: assessment context validation, owner-safe invitation lifecycle and FK indexes.
-- Intended for the already-migrated NOOR AI project npzedchxfurcphvpjock.
-- Apply through reviewed Supabase migration tooling; all operations are additive/idempotent.
create or replace function private.noor_guard_invitation_role()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actor_role text;
begin
  if tg_op='UPDATE' and current_setting('noor.accepting_invitation',true)='on' then return new; end if;
  select role into v_actor_role from public.profiles where id=(select auth.uid()) and status='active';
  if tg_op='INSERT' then
    if new.created_by is distinct from (select auth.uid()) then raise exception 'Invitation creator must be the signed-in user' using errcode='42501'; end if;
    if new.role in ('principal','manager') and v_actor_role not in ('creator','owner') then raise exception 'Only Owner can appoint a Principal/Manager' using errcode='42501'; end if;
  else
    if new.school_id is distinct from old.school_id or new.role is distinct from old.role
      or new.invited_email is distinct from old.invited_email or new.invited_name is distinct from old.invited_name
      or new.token_hash is distinct from old.token_hash or new.created_by is distinct from old.created_by
      or new.expires_at is distinct from old.expires_at or new.max_uses is distinct from old.max_uses
      or new.used_count is distinct from old.used_count then
      raise exception 'Invitation identity is immutable; use the trusted accept or revoke flow' using errcode='42501';
    end if;
    if not (private.has_school_role(new.school_id,array['owner'])
      or (old.created_by=(select auth.uid()) and private.noor_can_school_permission(new.school_id,'manage_invites'))) then
      raise exception 'You cannot edit this invitation' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.noor_validate_assessment_context()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.academic_years y where y.id=new.academic_year_id and y.school_id=new.school_id) then
  raise exception 'Academic year must belong to the assessment school' using errcode='23514'; end if;
 if not exists(select 1 from public.classes c where c.id=new.class_id and c.school_id=new.school_id and c.is_active) then
  raise exception 'Class must belong to the assessment school' using errcode='23514'; end if;
 if new.section_id is not null and not exists(select 1 from public.sections s where s.id=new.section_id and s.class_id=new.class_id and s.is_active) then
  raise exception 'Section must belong to the selected class' using errcode='23514'; end if;
 if not exists(select 1 from public.subjects s where s.id=new.subject_id and s.school_id=new.school_id and (s.class_id is null or s.class_id=new.class_id)) then
  raise exception 'Subject must belong to the assessment school and class context' using errcode='23514'; end if;
 return new;
end;
$$;
drop trigger if exists school_assessments_validate_context on public.school_assessments;
create trigger school_assessments_validate_context before insert or update on public.school_assessments
for each row execute function private.noor_validate_assessment_context();

create or replace function private.noor_validate_assessment_result()
returns trigger language plpgsql security definer set search_path=''
as $$
declare a public.school_assessments%rowtype; s public.profiles%rowtype;
begin
 select * into a from public.school_assessments where id=new.assessment_id;
 select * into s from public.profiles where id=new.student_id;
 if a.id is null or a.school_id<>new.school_id then raise exception 'Assessment does not belong to this school' using errcode='23514'; end if;
 if new.marks_obtained>a.max_marks then raise exception 'Marks cannot exceed the maximum marks' using errcode='23514'; end if;
 if tg_op='INSERT' then
   if s.id is null or s.school_id<>new.school_id or s.role<>'student' or s.status<>'active' or s.class_id<>a.class_id
    or (a.section_id is not null and s.section_id is distinct from a.section_id) then
    raise exception 'Student must be active and belong to the assessment class/section' using errcode='23514'; end if;
 else
   if new.assessment_id is distinct from old.assessment_id or new.student_id is distinct from old.student_id
     or new.school_id is distinct from old.school_id then
     raise exception 'Assessment, student and school links are immutable; create a new record for a transfer' using errcode='42501'; end if;
 end if;
 return new;
end;
$$;

drop policy if exists school_assessments_read on public.school_assessments;
create policy school_assessments_read on public.school_assessments for select to authenticated using (
  private.noor_can_school_permission(school_id,'view_academic_reports')
  or private.noor_can_school_permission(school_id,'manage_assessments')
  or private.noor_is_assigned_teacher(school_id,class_id,section_id,subject_id)
  or (private.noor_active_school_access(school_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid())
    and p.role='student' and p.school_id=school_assessments.school_id and p.class_id=school_assessments.class_id
    and (school_assessments.section_id is null or p.section_id=school_assessments.section_id)
    and school_assessments.status in ('conducted','marked')))
);
drop policy if exists assessment_results_read on public.assessment_results;
create policy assessment_results_read on public.assessment_results for select to authenticated using (
  private.noor_can_school_permission(school_id,'view_academic_reports')
  or private.noor_can_school_permission(school_id,'manage_assessments')
  or private.noor_is_assigned_teacher(school_id,
    (select a.class_id from public.school_assessments a where a.id=assessment_results.assessment_id),
    (select a.section_id from public.school_assessments a where a.id=assessment_results.assessment_id),
    (select a.subject_id from public.school_assessments a where a.id=assessment_results.assessment_id))
  or (student_id=(select auth.uid()) and private.noor_active_school_access(school_id))
);

create index if not exists school_assessments_year_idx on public.school_assessments(academic_year_id);
create index if not exists school_assessments_class_idx on public.school_assessments(class_id);
create index if not exists school_assessments_section_idx on public.school_assessments(section_id);
create index if not exists school_assessments_subject_idx on public.school_assessments(subject_id);
create index if not exists assessment_results_student_idx on public.assessment_results(student_id);
create index if not exists school_memberships_user_idx on public.school_memberships(user_id);
create index if not exists teacher_schedule_teacher_idx on public.teacher_schedule_entries(teacher_id);
create index if not exists teacher_schedule_class_idx on public.teacher_schedule_entries(class_id);
create index if not exists teacher_schedule_section_idx on public.teacher_schedule_entries(section_id);
create index if not exists teacher_schedule_subject_idx on public.teacher_schedule_entries(subject_id);
create index if not exists lesson_plans_teacher_idx on public.lesson_plans(teacher_id);
create index if not exists lesson_plans_year_idx on public.lesson_plans(academic_year_id);
create index if not exists lesson_plans_class_idx on public.lesson_plans(class_id);
create index if not exists lesson_plans_section_idx on public.lesson_plans(section_id);
create index if not exists lesson_plans_subject_idx on public.lesson_plans(subject_id);
create index if not exists daily_reports_teacher_idx on public.daily_teaching_reports(teacher_id);
create index if not exists daily_reports_year_idx on public.daily_teaching_reports(academic_year_id);
create index if not exists daily_reports_class_idx on public.daily_teaching_reports(class_id);
create index if not exists daily_reports_section_idx on public.daily_teaching_reports(section_id);
create index if not exists daily_reports_subject_idx on public.daily_teaching_reports(subject_id);
create index if not exists daily_reports_unit_idx on public.daily_teaching_reports(unit_id);
create index if not exists syllabus_units_year_idx on public.syllabus_units(academic_year_id);
create index if not exists syllabus_units_class_idx on public.syllabus_units(class_id);
create index if not exists syllabus_units_section_idx on public.syllabus_units(section_id);
create index if not exists syllabus_units_subject_idx on public.syllabus_units(subject_id);
create index if not exists syllabus_progress_teacher_idx on public.syllabus_progress(teacher_id);
create index if not exists syllabus_progress_unit_idx on public.syllabus_progress(syllabus_unit_id);
create index if not exists smart_notes_teacher_idx on public.smart_notes(teacher_id);
create index if not exists smart_notes_year_idx on public.smart_notes(academic_year_id);
create index if not exists smart_notes_class_idx on public.smart_notes(class_id);
create index if not exists smart_notes_section_idx on public.smart_notes(section_id);
create index if not exists smart_notes_subject_idx on public.smart_notes(subject_id);
create index if not exists school_invitations_school_idx on public.school_invitations(school_id);
create index if not exists administrative_audit_target_user_idx on public.administrative_audit_logs(target_user_id);
