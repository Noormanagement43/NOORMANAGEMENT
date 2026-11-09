-- NOOR single connected Supabase project: teacher's own timetable is school-visible
-- and a student's timetable is scoped to the class/section to which they belong.
-- Removes overly-broad active-member SELECT; teacher creation/edit/delete remains
-- limited by existing self-owned RLS and no Principal period assignment is granted.
DROP POLICY IF EXISTS noor_v2_period_read_active_institution
 ON public.teacher_timetable_periods;
DROP POLICY IF EXISTS noor_v2_period_read_role_scoped
 ON public.teacher_timetable_periods;
CREATE POLICY noor_v2_period_read_role_scoped
ON public.teacher_timetable_periods
FOR SELECT TO authenticated
USING (
  (
    private.has_institution_role(
      institution_id,ARRAY['principal','school_admin','university_admin','academic_admin']
    )
  )
  OR (
    private.has_institution_role(institution_id,ARRAY['teacher','faculty'])
    AND private.is_my_membership(teacher_membership_id)
  )
  OR (
    academic_group_id IS NOT NULL
    AND private.has_institution_role(
      institution_id,ARRAY['student','university_student']
    )
    AND EXISTS(
      SELECT 1
      FROM public.academic_group_memberships my_group
      JOIN public.academic_groups enrolled_group
        ON enrolled_group.id=my_group.group_id
       AND enrolled_group.institution_id=my_group.institution_id
      WHERE my_group.institution_id=teacher_timetable_periods.institution_id
        AND my_group.status='active'
        AND enrolled_group.is_active=true
        AND my_group.group_role='student'
        AND private.is_my_membership(my_group.membership_id)
        AND (
          my_group.group_id=teacher_timetable_periods.academic_group_id
          OR enrolled_group.parent_group_id=teacher_timetable_periods.academic_group_id
        )
    )
  )
);

-- Supabase Postgres Changes publishes only the relevant tables. Visibility
-- remains governed by RLS. A periodic authenticated re-fetch also covers
-- DELETE notification limitations and temporary websocket disconnects.
DO $noor$
DECLARE t text;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
 THEN
  RAISE EXCEPTION 'Expected Supabase realtime publication was missing';
 END IF;
 FOREACH t IN ARRAY ARRAY[
  'teacher_timetable_periods',
  'academic_groups',
  'academic_group_memberships',
  'attendance_records'
 ] LOOP
  IF NOT EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename=t
  ) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
  END IF;
 END LOOP;
END $noor$;
