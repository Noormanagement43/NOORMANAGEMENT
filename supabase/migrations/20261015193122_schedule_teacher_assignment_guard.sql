-- Enforce an active teacher assignment at the database boundary for scheduled
-- and extra teaching sessions. Additive: no table or historical row is deleted.
CREATE OR REPLACE FUNCTION private.noor_validate_academic_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.academic_years y
    WHERE y.id = NEW.academic_year_id AND y.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Academic year does not belong to the selected school'
      USING errcode = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = NEW.class_id AND c.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Class does not belong to the selected school'
      USING errcode = '23514';
  END IF;

  IF NEW.section_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sections s
    WHERE s.id = NEW.section_id AND s.class_id = NEW.class_id
  ) THEN
    RAISE EXCEPTION 'Section does not belong to the selected class'
      USING errcode = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = NEW.subject_id
      AND s.school_id = NEW.school_id
      AND (s.class_id IS NULL OR s.class_id = NEW.class_id)
  ) THEN
    RAISE EXCEPTION 'Subject does not belong to the selected school/class'
      USING errcode = '23514';
  END IF;

  IF TG_TABLE_NAME IN ('teacher_schedule_entries', 'extra_class_records') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.teacher_assignments a
      WHERE a.school_id = NEW.school_id
        AND a.teacher_id = NEW.teacher_id
        AND a.class_id = NEW.class_id
        AND a.is_active = TRUE
        AND (a.subject_id IS NULL OR a.subject_id = NEW.subject_id)
        AND (a.section_id IS NULL OR a.section_id = NEW.section_id)
    ) THEN
      RAISE EXCEPTION 'Teacher is not actively assigned to this class/section/subject'
        USING errcode = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Rollback: restore the prior context-only validator from before this change.
-- See supabase/rollback/20261015193122_schedule_teacher_assignment_guard.sql.
