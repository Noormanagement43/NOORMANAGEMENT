-- Atomic, school-scoped teacher attendance; all rows commit or none do.
-- Function runs as the invoker: existing RLS is NOT bypassed.
CREATE OR REPLACE FUNCTION public.noor_submit_attendance_atomic(
  p_school_id uuid,
  p_class_id uuid,
  p_section_id uuid,
  p_attendance_date date,
  p_marks jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $fn$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_session uuid;
 v_previous text;
 v_total integer;
 v_roster integer;
 v_submitted integer;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Please sign in before recording attendance.' USING ERRCODE='42501'; END IF;
 IF p_school_id IS NULL OR p_class_id IS NULL OR p_attendance_date IS NULL THEN
   RAISE EXCEPTION 'School, class and attendance date are required.' USING ERRCODE='22023';
 END IF;
 IF p_attendance_date > ((now() AT TIME ZONE 'Asia/Kolkata')::date) THEN
   RAISE EXCEPTION 'Future attendance dates are not allowed.' USING ERRCODE='22023';
 END IF;
 IF NOT private.noor_active_school_access(p_school_id)
    OR NOT private.can_manage_class_context(p_school_id,p_class_id,p_section_id) THEN
   RAISE EXCEPTION 'Teacher is not authorized for this school class and section.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id=p_class_id AND c.school_id=p_school_id AND c.is_active=true) THEN
   RAISE EXCEPTION 'The class does not belong to this active school.' USING ERRCODE='22023';
 END IF;
 IF p_section_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.sections sec WHERE sec.id=p_section_id AND sec.class_id=p_class_id AND sec.is_active=true
 ) THEN RAISE EXCEPTION 'The section does not belong to this class.' USING ERRCODE='22023'; END IF;
 IF p_marks IS NULL OR jsonb_typeof(p_marks)<>'array' THEN
   RAISE EXCEPTION 'Attendance list must be an array.' USING ERRCODE='22023';
 END IF;
 v_total:=jsonb_array_length(p_marks);
 IF v_total<1 OR v_total>500 THEN RAISE EXCEPTION 'A class must have 1 to 500 attendance entries.' USING ERRCODE='22023'; END IF;
 IF EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_marks) m
  WHERE jsonb_typeof(m)<>'object'
     OR coalesce(m->>'student_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR coalesce(m->>'status','') NOT IN ('present','absent','late')
 ) THEN RAISE EXCEPTION 'Each attendance entry needs a valid student and present, absent or late status.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT m->>'student_id') FROM jsonb_array_elements(p_marks) m) <> v_total THEN
   RAISE EXCEPTION 'Duplicate student IDs are not allowed.' USING ERRCODE='22023';
 END IF;
 SELECT count(*) INTO v_roster FROM public.profiles p
  WHERE p.school_id=p_school_id AND p.class_id=p_class_id AND p.status='active'
    AND p.role='student'
    AND (p_section_id IS NULL OR p.section_id=p_section_id);
 IF v_roster<>v_total OR EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_marks) m
  WHERE NOT EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id=(m->>'student_id')::uuid AND p.school_id=p_school_id
     AND p.class_id=p_class_id AND p.status='active' AND p.role='student'
     AND (p_section_id IS NULL OR p.section_id=p_section_id)
  )
 ) THEN RAISE EXCEPTION 'Attendance roster changed. Refresh the class list and retry.' USING ERRCODE='22023';
 END IF;
 -- UNIQUE NULLS NOT DISTINCT handles a nullable section correctly.
 SELECT s.id,s.status INTO v_session,v_previous
 FROM public.attendance_sessions s
 WHERE s.school_id=p_school_id AND s.class_id=p_class_id
   AND s.section_id IS NOT DISTINCT FROM p_section_id AND s.attendance_date=p_attendance_date
 FOR UPDATE;
 IF v_session IS NULL THEN
  INSERT INTO public.attendance_sessions(school_id,class_id,section_id,attendance_date,status,taken_by)
  VALUES (p_school_id,p_class_id,p_section_id,p_attendance_date,'draft',v_actor)
  ON CONFLICT ON CONSTRAINT noor_attendance_session_unique
   DO NOTHING
  RETURNING id,status INTO v_session,v_previous;
  IF v_session IS NULL THEN
   SELECT s.id,s.status INTO v_session,v_previous FROM public.attendance_sessions s
   WHERE s.school_id=p_school_id AND s.class_id=p_class_id
     AND s.section_id IS NOT DISTINCT FROM p_section_id AND s.attendance_date=p_attendance_date
   FOR UPDATE;
  END IF;
 END IF;
 IF v_session IS NULL THEN RAISE EXCEPTION 'Unable to lock attendance session.'; END IF;
 INSERT INTO public.attendance_records(school_id,session_id,student_id,status,marked_by,marked_at)
 SELECT p_school_id,v_session,(m->>'student_id')::uuid,m->>'status',v_actor,now()
 FROM jsonb_array_elements(p_marks) m
 ON CONFLICT (session_id,student_id) DO UPDATE
  SET status=EXCLUDED.status,marked_by=EXCLUDED.marked_by,marked_at=EXCLUDED.marked_at,updated_at=now();
 GET DIAGNOSTICS v_submitted = ROW_COUNT;
 UPDATE public.attendance_sessions
 SET status=CASE WHEN v_previous IN ('submitted','corrected') THEN 'corrected' ELSE 'submitted' END,
     submitted_at=now(),updated_at=now()
 WHERE id=v_session AND school_id=p_school_id;
 IF NOT FOUND OR v_submitted<>v_total THEN RAISE EXCEPTION 'Attendance count mismatch; no changes were saved.'; END IF;
 RETURN jsonb_build_object('session_id',v_session,'saved',v_submitted,'status',
   CASE WHEN v_previous IN ('submitted','corrected') THEN 'corrected' ELSE 'submitted' END,
   'attendance_date',p_attendance_date);
END;
$fn$;
REVOKE ALL ON FUNCTION public.noor_submit_attendance_atomic(uuid,uuid,uuid,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_submit_attendance_atomic(uuid,uuid,uuid,date,jsonb) TO authenticated;
