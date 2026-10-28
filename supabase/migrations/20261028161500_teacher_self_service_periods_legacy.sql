-- NOOR legacy SCHOOL-ID project only (npzedchxfurcphvpjock), not the NEW institution_id project.
-- Self-service teacher timetable: a teacher owns their own periods without prior
-- principal assignment. Does NOT grant rights to students, marks or school structure.
-- This migration is NOT applied merely by merging GitHub files. Back up and run
-- only against the original school_id schema after reviewing existing policies/triggers.

DO $noor$
BEGIN
 IF to_regclass('public.noor_teacher_periods') IS NULL
    OR to_regclass('public.schools') IS NULL
    OR to_regclass('public.school_memberships') IS NULL
    OR to_regclass('public.classes') IS NULL
    OR to_regclass('public.sections') IS NULL THEN
   RAISE EXCEPTION 'Wrong NOOR database: legacy school_id timetable tables are missing';
 END IF;
END $noor$;

-- Read-only school classes/sections: needed to populate a teacher's personal
-- timetable. A teacher may VIEW school structure, not create/delete classes.
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.classes,public.sections TO authenticated;
DROP POLICY IF EXISTS noor_teacher_view_school_classes_for_timetable ON public.classes;
CREATE POLICY noor_teacher_view_school_classes_for_timetable ON public.classes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_school_role(school_id,ARRAY['teacher']));
DROP POLICY IF EXISTS noor_teacher_view_school_sections_for_timetable ON public.sections;
CREATE POLICY noor_teacher_view_school_sections_for_timetable ON public.sections
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.classes c WHERE c.id=sections.class_id
      AND private.has_school_role(c.school_id,ARRAY['teacher'])
  ));

-- Validate all *new* and edited records; an active teacher can choose ANY
-- existing class/section IN THEIR OWN SCHOOL. No teacher_assignments dependency.
-- SECURITY INVOKER intentionally respects caller privileges and table RLS.
CREATE OR REPLACE FUNCTION private.noor_validate_teacher_self_timetable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_self boolean;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id
   OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
   OR NEW.school_id IS DISTINCT FROM OLD.school_id) THEN
   RAISE EXCEPTION 'Timetable row ownership is immutable' USING errcode='42501';
 END IF;
 IF NEW.class_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.classes c
   WHERE c.id=NEW.class_id AND c.school_id=NEW.school_id AND c.is_active=true
 ) THEN
   RAISE EXCEPTION 'Choose an active class belonging to your school' USING errcode='23514';
 END IF;
 IF NEW.section_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.sections s
   WHERE s.id=NEW.section_id AND s.class_id=NEW.class_id AND s.is_active=true
 ) THEN
   RAISE EXCEPTION 'Section does not belong to that class' USING errcode='23514';
 END IF;
 IF NEW.weekday NOT BETWEEN 0 AND 6
   OR NEW.period_number NOT BETWEEN 1 AND 15
   OR NEW.start_time IS NULL OR NEW.end_time IS NULL
   OR NEW.start_time>=NEW.end_time
   OR btrim(coalesce(NEW.subject_name,''))='' THEN
   RAISE EXCEPTION 'Enter a valid weekday, period, time range and subject' USING errcode='23514';
 END IF;
 v_self:=(v_actor IS NOT NULL AND v_actor=NEW.teacher_id);
 IF v_actor IS NOT NULL AND NOT v_self
    AND NOT private.has_school_role(NEW.school_id,ARRAY['owner','principal']) THEN
   RAISE EXCEPTION 'Only the teacher may change their personal timetable' USING errcode='42501';
 END IF;
 IF v_self THEN
   -- This check cannot be satisfied by a joining code or a forged client role.
   IF NOT EXISTS(
     SELECT 1 FROM public.profiles p
     JOIN public.school_memberships m ON m.user_id=p.id
       AND m.school_id=p.school_id AND m.role=p.role AND m.status='active'
     JOIN public.schools sch ON sch.id=p.school_id
     WHERE p.id=v_actor AND p.role='teacher' AND p.status='active'
       AND p.school_id=NEW.school_id
       AND sch.is_active=true AND sch.account_status='active'
       AND sch.verification_status='verified'
   ) THEN
     RAISE EXCEPTION 'Teacher membership is not active in this school' USING errcode='42501';
   END IF;
   -- The teacher does not need a Principal approval step for this OWN period.
   NEW.approval_status:='approved';
   IF TG_OP='INSERT' THEN NEW.status:='upcoming'; END IF;
 END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS noor_validate_teacher_self_timetable ON public.noor_teacher_periods;
CREATE TRIGGER noor_validate_teacher_self_timetable
BEFORE INSERT OR UPDATE ON public.noor_teacher_periods
FOR EACH ROW EXECUTE FUNCTION private.noor_validate_teacher_self_timetable();

-- Add self-service RLS to existing leadership policies; do not erase them.
ALTER TABLE public.noor_teacher_periods ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.noor_teacher_periods TO authenticated;

DROP POLICY IF EXISTS noor_teacher_self_timetable_select ON public.noor_teacher_periods;
CREATE POLICY noor_teacher_self_timetable_select ON public.noor_teacher_periods
 AS PERMISSIVE FOR SELECT TO authenticated
 USING (
   teacher_id=(SELECT auth.uid())
   AND private.has_school_role(school_id,ARRAY['teacher'])
   AND private.noor_active_school_access(school_id)
 );

DROP POLICY IF EXISTS noor_teacher_self_timetable_insert ON public.noor_teacher_periods;
CREATE POLICY noor_teacher_self_timetable_insert ON public.noor_teacher_periods
 AS PERMISSIVE FOR INSERT TO authenticated
 WITH CHECK (
   teacher_id=(SELECT auth.uid())
   AND private.has_school_role(school_id,ARRAY['teacher'])
   AND private.noor_active_school_access(school_id)
 );

DROP POLICY IF EXISTS noor_teacher_self_timetable_update ON public.noor_teacher_periods;
CREATE POLICY noor_teacher_self_timetable_update ON public.noor_teacher_periods
 AS PERMISSIVE FOR UPDATE TO authenticated
 USING (
   teacher_id=(SELECT auth.uid())
   AND private.has_school_role(school_id,ARRAY['teacher'])
   AND private.noor_active_school_access(school_id)
 )
 WITH CHECK (
   teacher_id=(SELECT auth.uid())
   AND private.has_school_role(school_id,ARRAY['teacher'])
   AND private.noor_active_school_access(school_id)
 );

-- SECURITY REVIEW before deployment:
-- SELECT policy permissive+restrictive composition, legacy integrity triggers,
-- and FK constraints must be checked in the ORIGINAL project.
-- The ability to edit a teacher's own timetable does NOT imply permission to
-- mark another teacher's attendance or to edit any student's roster.
