-- Preserve the ordinary teacher-only academic guard; permit only a matching,
-- already-submitted auto-test result through the internal grading path.
create or replace function private.noor_guard_academic_row() returns trigger language plpgsql set search_path='' as $f$
begin
 if tg_op='UPDATE' and(new.id is distinct from old.id or new.institution_id is distinct from old.institution_id or new.academic_group_id is distinct from old.academic_group_id or new.created_at is distinct from old.created_at) then raise exception 'Academic record identity cannot be reassigned' using errcode='42501';end if;
 if tg_table_name='noor_assessment_results' then
  if tg_op='UPDATE' and(new.student_membership_id is distinct from old.student_membership_id or new.graded_by is distinct from old.graded_by) then raise exception 'Assessment ownership cannot be reassigned' using errcode='42501';end if;
  if not private.noor_student_enrolled(new.institution_id,new.academic_group_id,new.student_membership_id) and not(
   new.source_quiz_attempt_id is not null and exists(
    select 1 from public.noor_quiz_attempts a join public.noor_weekly_quizzes q on q.id=a.quiz_id and q.institution_id=a.institution_id
    join public.institution_memberships m on m.id=a.student_membership_id and m.institution_id=a.institution_id and m.status='active'
    join public.institutions i on i.id=a.institution_id and i.status='active'
    where a.id=new.source_quiz_attempt_id and a.institution_id=new.institution_id and a.student_membership_id=new.student_membership_id and q.academic_group_id=new.academic_group_id and q.auto_grade and q.created_by=new.graded_by and new.max_marks=q.max_marks
    and exists(select 1 from public.academic_group_memberships gm join public.academic_groups g on g.id=gm.group_id and g.institution_id=gm.institution_id and g.is_active where gm.institution_id=a.institution_id and gm.membership_id=a.student_membership_id and gm.status='active' and gm.group_role='student' and(g.id=q.academic_group_id or g.parent_group_id=q.academic_group_id))
   )
  ) then raise exception 'Result requires an active student enrolled in this group' using errcode='23514';end if;
 else
  if tg_op='UPDATE' and new.created_by is distinct from old.created_by then raise exception 'Author cannot be reassigned' using errcode='42501';end if;
  if tg_table_name='noor_learning_items' and new.attachment_path is not null and(split_part(new.attachment_path,'/',1)<>new.created_by::text or new.attachment_path like '%..%') then raise exception 'Attachment must belong to the author' using errcode='23514';end if;
 end if;
 new.updated_at=now();return new;
end $f$;
