-- Persist which real class/stream groups belong in the Secondary Attendance chart.
-- Existing preferences and data are preserved; existing RLS policies remain in force.
ALTER TABLE public.institution_dashboard_preferences
  ADD COLUMN IF NOT EXISTS secondary_class_ids uuid[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'institution_dashboard_preferences_secondary_class_ids_limit'
      AND conrelid = 'public.institution_dashboard_preferences'::regclass
  ) THEN
    ALTER TABLE public.institution_dashboard_preferences
      ADD CONSTRAINT institution_dashboard_preferences_secondary_class_ids_limit
      CHECK (secondary_class_ids IS NULL OR cardinality(secondary_class_ids) <= 100);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.validate_secondary_attendance_class_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.secondary_class_ids IS NULL THEN
    RETURN NEW;
  END IF;

  IF cardinality(NEW.secondary_class_ids) > 100 THEN
    RAISE EXCEPTION 'Choose no more than 100 secondary attendance classes.'
      USING ERRCODE = '22023';
  END IF;

  IF cardinality(NEW.secondary_class_ids) <>
     (SELECT count(DISTINCT selected.group_id)
      FROM unnest(NEW.secondary_class_ids) AS selected(group_id)) THEN
    RAISE EXCEPTION 'A class can only be selected once.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(NEW.secondary_class_ids) AS selected(group_id)
    LEFT JOIN public.academic_groups AS g
      ON g.id = selected.group_id
     AND g.institution_id = NEW.institution_id
     AND g.group_type = 'class'
     AND g.is_active = true
    WHERE selected.group_id IS NULL OR g.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Secondary attendance can only include active classes from this school.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_secondary_attendance_class_ids
  ON public.institution_dashboard_preferences;

CREATE TRIGGER validate_secondary_attendance_class_ids
BEFORE INSERT OR UPDATE OF secondary_class_ids, institution_id
ON public.institution_dashboard_preferences
FOR EACH ROW
EXECUTE FUNCTION private.validate_secondary_attendance_class_ids();

REVOKE ALL ON FUNCTION private.validate_secondary_attendance_class_ids() FROM PUBLIC, anon, authenticated;
