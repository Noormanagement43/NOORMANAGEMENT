-- Explicitly correlate the student's school; avoid ambiguous column references in RLS subqueries.
ALTER POLICY "noor_parent_contact_insert" ON public.noor_parent_contact_logs
 WITH CHECK(
  created_by=(SELECT auth.uid())
  AND private.noor_active_school_access(noor_parent_contact_logs.school_id)
  AND private.noor_can_school_permission(noor_parent_contact_logs.school_id,'manage_notices')
  AND EXISTS(
    SELECT 1 FROM public.profiles student
    WHERE student.id=noor_parent_contact_logs.student_id
      AND student.school_id=noor_parent_contact_logs.school_id
      AND student.role='student' AND student.status='active'
  )
 );