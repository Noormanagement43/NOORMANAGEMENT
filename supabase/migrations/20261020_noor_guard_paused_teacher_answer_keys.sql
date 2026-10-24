-- A paused teacher must not read or modify saved assessment answer keys through an old JWT.
-- Answer keys have no school_id column: resolve school through their assignment.
alter policy noor_keys_teacher_select on public.noor_assignment_answer_keys
  using (
    teacher_id=(select auth.uid())
    and exists (
      select 1 from public.noor_student_assignments a
      where a.id=noor_assignment_answer_keys.assignment_id
        and a.teacher_id=(select auth.uid())
        and private.noor_active_school_access(a.school_id)
    )
  );
alter policy noor_keys_teacher_insert on public.noor_assignment_answer_keys
  with check (
    teacher_id=(select auth.uid())
    and exists (
      select 1 from public.noor_student_assignments a
      where a.id=noor_assignment_answer_keys.assignment_id
        and a.teacher_id=(select auth.uid())
        and private.noor_active_school_access(a.school_id)
    )
  );
alter policy noor_keys_teacher_update on public.noor_assignment_answer_keys
  using (
    teacher_id=(select auth.uid())
    and exists (
      select 1 from public.noor_student_assignments a
      where a.id=noor_assignment_answer_keys.assignment_id
        and a.teacher_id=(select auth.uid())
        and private.noor_active_school_access(a.school_id)
    )
  )
  with check (
    teacher_id=(select auth.uid())
    and exists (
      select 1 from public.noor_student_assignments a
      where a.id=noor_assignment_answer_keys.assignment_id
        and a.teacher_id=(select auth.uid())
        and private.noor_active_school_access(a.school_id)
    )
  );
