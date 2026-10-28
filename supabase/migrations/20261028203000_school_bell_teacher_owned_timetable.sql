-- NOOR original-school schema ONLY (school_id). Prepared, NOT applied automatically.
-- Destination: the Supabase project selected by the ORIGINAL index.html config.js.
-- Requires schools, profiles, school_memberships, classes and sections, and helpers
-- private.noor_active_school_access(uuid) / private.has_school_role(uuid,text[]).
-- Existing teacher_assignments and noor_teacher_periods are NOT modified or deleted.
-- Principal configures school-wide bell times ONCE (can edit, add, or archive a slot).
-- Archiving preserves previously saved teacher lesson records and prevents new
-- assignment to inactive slots. Teacher owns subject/section/
-- weekday assignments and date-specific lesson topics. Students are read-only.
BEGIN;

DO $check$
BEGIN
 IF to_regclass('public.schools') IS NULL OR
    to_regclass('public.profiles') IS NULL OR
    to_regclass('public.classes') IS NULL OR
    to_regclass('public.sections') IS NULL OR
    to_regclass('public.school_memberships') IS NULL THEN
   RAISE EXCEPTION 'This is not the original NOOR school_id schema. STOP: no data was modified.';
 END IF;
END $check$;

CREATE TABLE IF NOT EXISTS public.noor_school_bell_slots (
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 period_number smallint NOT NULL CHECK (period_number BETWEEN 1 AND 100),
 start_time time NOT NULL,
 end_time time NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 updated_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(school_id,period_number),
 CONSTRAINT noor_bell_valid_time CHECK (start_time < end_time)
);
CREATE TABLE IF NOT EXISTS public.noor_class_timetable (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES auth.users(id),
 class_id uuid NOT NULL REFERENCES public.classes(id),
 section_id uuid REFERENCES public.sections(id),
 subject_name text NOT NULL CHECK (char_length(btrim(subject_name)) BETWEEN 1 AND 140),
 weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
 period_number smallint NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT noor_class_bell_period FOREIGN KEY(school_id,period_number)
   REFERENCES public.noor_school_bell_slots(school_id,period_number) ON DELETE RESTRICT
);
-- No double-booking a teacher or a school section in the same period.
CREATE UNIQUE INDEX IF NOT EXISTS noor_teacher_weekday_period_only_one
 ON public.noor_class_timetable(school_id,teacher_id,weekday,period_number) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS noor_class_section_weekday_period_only_one
 ON public.noor_class_timetable(school_id,class_id,COALESCE(section_id,'00000000-0000-0000-0000-000000000000'::uuid),weekday,period_number)
 WHERE is_active;
CREATE INDEX IF NOT EXISTS noor_timetable_school_day ON public.noor_class_timetable(school_id,weekday,period_number) WHERE is_active;
CREATE INDEX IF NOT EXISTS noor_timetable_student_section ON public.noor_class_timetable(school_id,class_id,section_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.noor_daily_lesson_topics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 timetable_id uuid NOT NULL REFERENCES public.noor_class_timetable(id) ON DELETE CASCADE,
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES auth.users(id),
 lesson_date date NOT NULL,
 topic text NOT NULL CHECK (char_length(btrim(topic)) BETWEEN 1 AND 600),
 homework text CHECK (homework IS NULL OR char_length(homework)<=1500),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(timetable_id,lesson_date)
);
CREATE INDEX IF NOT EXISTS noor_lesson_school_date ON public.noor_daily_lesson_topics(school_id,lesson_date);

-- Ensure FK identity consistency at the DB boundary, not just client filters.
CREATE OR REPLACE FUNCTION private.noor_guard_teacher_owned_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND (
   NEW.id IS DISTINCT FROM OLD.id OR
   NEW.school_id IS DISTINCT FROM OLD.school_id OR
   NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
 ) THEN
   RAISE EXCEPTION 'Teacher timetable ownership is immutable' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.classes c
   WHERE c.id=NEW.class_id AND c.school_id=NEW.school_id AND c.is_active
 ) THEN RAISE EXCEPTION 'Class must belong to your active school' USING ERRCODE='23514'; END IF;
 IF NEW.section_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.sections s
   WHERE s.id=NEW.section_id AND s.class_id=NEW.class_id AND s.is_active
 ) THEN RAISE EXCEPTION 'Section must belong to the selected class' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.noor_school_bell_slots b
   WHERE b.school_id=NEW.school_id AND b.period_number=NEW.period_number AND b.is_active
 ) THEN RAISE EXCEPTION 'Principal must configure period bell times first' USING ERRCODE='23514'; END IF;
 NEW.updated_at=now();
 RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS noor_guard_teacher_owned_schedule ON public.noor_class_timetable;
CREATE TRIGGER noor_guard_teacher_owned_schedule
 BEFORE INSERT OR UPDATE ON public.noor_class_timetable FOR EACH ROW
 EXECUTE FUNCTION private.noor_guard_teacher_owned_schedule();

CREATE OR REPLACE FUNCTION private.noor_guard_daily_lesson()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE plan record;
BEGIN
 IF TG_OP='UPDATE' AND (
   NEW.timetable_id IS DISTINCT FROM OLD.timetable_id OR
   NEW.school_id IS DISTINCT FROM OLD.school_id OR
   NEW.teacher_id IS DISTINCT FROM OLD.teacher_id OR
   NEW.lesson_date IS DISTINCT FROM OLD.lesson_date
 ) THEN RAISE EXCEPTION 'Lesson ownership/date cannot change' USING ERRCODE='42501'; END IF;
 SELECT t.school_id,t.teacher_id,t.weekday,t.is_active INTO plan
 FROM public.noor_class_timetable t
 JOIN public.noor_school_bell_slots b ON b.school_id=t.school_id
  AND b.period_number=t.period_number AND b.is_active
 WHERE t.id=NEW.timetable_id;
 IF plan IS NULL OR NOT plan.is_active
    OR plan.school_id IS DISTINCT FROM NEW.school_id
    OR plan.teacher_id IS DISTINCT FROM NEW.teacher_id
 THEN RAISE EXCEPTION 'Lesson does not match the teacher timetable' USING ERRCODE='23514'; END IF;
 IF extract(dow FROM NEW.lesson_date)::int<>plan.weekday
 THEN RAISE EXCEPTION 'Choose a date matching your scheduled weekday' USING ERRCODE='23514'; END IF;
 NEW.updated_at=now();
 RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS noor_guard_daily_lesson ON public.noor_daily_lesson_topics;
CREATE TRIGGER noor_guard_daily_lesson
 BEFORE INSERT OR UPDATE ON public.noor_daily_lesson_topics FOR EACH ROW
 EXECUTE FUNCTION private.noor_guard_daily_lesson();

-- Student must see only their own assigned class / section.
-- Principal/Owner read all timetable rows in THEIR school.
-- Teacher read/write only periods they own in their active school.
ALTER TABLE public.noor_school_bell_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noor_class_timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noor_daily_lesson_topics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_school_bell_slots,public.noor_class_timetable,public.noor_daily_lesson_topics FROM PUBLIC,anon;
GRANT SELECT ON public.noor_school_bell_slots TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.noor_school_bell_slots TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.noor_class_timetable,public.noor_daily_lesson_topics TO authenticated;

DROP POLICY IF EXISTS noor_bells_school_read ON public.noor_school_bell_slots;
CREATE POLICY noor_bells_school_read ON public.noor_school_bell_slots
FOR SELECT TO authenticated USING (private.noor_active_school_access(school_id));
DROP POLICY IF EXISTS noor_bells_principal_create ON public.noor_school_bell_slots;
CREATE POLICY noor_bells_principal_create ON public.noor_school_bell_slots
FOR INSERT TO authenticated WITH CHECK (
 private.noor_active_school_access(school_id)
 AND private.has_school_role(school_id,ARRAY['owner','principal'])
);
DROP POLICY IF EXISTS noor_bells_principal_update ON public.noor_school_bell_slots;
CREATE POLICY noor_bells_principal_update ON public.noor_school_bell_slots
FOR UPDATE TO authenticated USING (
 private.noor_active_school_access(school_id)
 AND private.has_school_role(school_id,ARRAY['owner','principal'])
) WITH CHECK (
 private.noor_active_school_access(school_id)
 AND private.has_school_role(school_id,ARRAY['owner','principal'])
);
DROP POLICY IF EXISTS noor_bells_principal_delete ON public.noor_school_bell_slots;
CREATE POLICY noor_bells_principal_delete ON public.noor_school_bell_slots
FOR DELETE TO authenticated USING (
 private.noor_active_school_access(school_id)
 AND private.has_school_role(school_id,ARRAY['owner','principal'])
);

DROP POLICY IF EXISTS noor_timetable_read_roles ON public.noor_class_timetable;
CREATE POLICY noor_timetable_read_roles ON public.noor_class_timetable
FOR SELECT TO authenticated USING (
 private.noor_active_school_access(school_id)
 AND (
   private.has_school_role(school_id,ARRAY['owner','principal'])
   OR (teacher_id=(SELECT auth.uid()) AND private.has_school_role(school_id,ARRAY['teacher']))
   OR EXISTS (
     SELECT 1 FROM public.profiles me
     WHERE me.id=(SELECT auth.uid()) AND me.school_id=noor_class_timetable.school_id
       AND me.role='student' AND me.status='active'
       AND me.class_id=noor_class_timetable.class_id
       AND (noor_class_timetable.section_id IS NULL OR me.section_id=noor_class_timetable.section_id)
   )
 )
);
DROP POLICY IF EXISTS noor_timetable_teacher_create ON public.noor_class_timetable;
CREATE POLICY noor_timetable_teacher_create ON public.noor_class_timetable
FOR INSERT TO authenticated WITH CHECK (
 teacher_id=(SELECT auth.uid())
 AND private.noor_active_school_access(school_id)
 AND private.has_school_role(school_id,ARRAY['teacher'])
);
DROP POLICY IF EXISTS noor_timetable_teacher_update ON public.noor_class_timetable;
CREATE POLICY noor_timetable_teacher_update ON public.noor_class_timetable
FOR UPDATE TO authenticated USING (
 teacher_id=(SELECT auth.uid())
 AND private.noor_active_school_access(school_id)
 AND private.has_school_role(school_id,ARRAY['teacher'])
) WITH CHECK (
 teacher_id=(SELECT auth.uid())
 AND private.noor_active_school_access(school_id)
 AND private.has_school_role(school_id,ARRAY['teacher'])
);
DROP POLICY IF EXISTS noor_timetable_teacher_delete ON public.noor_class_timetable;
CREATE POLICY noor_timetable_teacher_delete ON public.noor_class_timetable
FOR DELETE TO authenticated USING (
 teacher_id=(SELECT auth.uid())
 AND private.noor_active_school_access(school_id)
 AND private.has_school_role(school_id,ARRAY['teacher'])
);

DROP POLICY IF EXISTS noor_lesson_read_roles ON public.noor_daily_lesson_topics;
CREATE POLICY noor_lesson_read_roles ON public.noor_daily_lesson_topics
FOR SELECT TO authenticated USING (
 private.noor_active_school_access(school_id)
 AND EXISTS (
   SELECT 1 FROM public.noor_class_timetable t
   WHERE t.id=noor_daily_lesson_topics.timetable_id AND t.school_id=noor_daily_lesson_topics.school_id
 )
);
DROP POLICY IF EXISTS noor_lesson_teacher_insert ON public.noor_daily_lesson_topics;
CREATE POLICY noor_lesson_teacher_insert ON public.noor_daily_lesson_topics
FOR INSERT TO authenticated WITH CHECK (
 teacher_id=(SELECT auth.uid())
 AND private.has_school_role(school_id,ARRAY['teacher'])
 AND private.noor_active_school_access(school_id)
 AND EXISTS (
  SELECT 1 FROM public.noor_class_timetable t
  WHERE t.id=timetable_id AND t.teacher_id=(SELECT auth.uid()) AND t.school_id=school_id AND t.is_active
 )
);
DROP POLICY IF EXISTS noor_lesson_teacher_update ON public.noor_daily_lesson_topics;
CREATE POLICY noor_lesson_teacher_update ON public.noor_daily_lesson_topics
FOR UPDATE TO authenticated USING (
 teacher_id=(SELECT auth.uid())
 AND private.has_school_role(school_id,ARRAY['teacher'])
 AND private.noor_active_school_access(school_id)
) WITH CHECK (
 teacher_id=(SELECT auth.uid())
 AND private.has_school_role(school_id,ARRAY['teacher'])
 AND private.noor_active_school_access(school_id)
);
DROP POLICY IF EXISTS noor_lesson_teacher_delete ON public.noor_daily_lesson_topics;
CREATE POLICY noor_lesson_teacher_delete ON public.noor_daily_lesson_topics
FOR DELETE TO authenticated USING (
 teacher_id=(SELECT auth.uid())
 AND private.has_school_role(school_id,ARRAY['teacher'])
 AND private.noor_active_school_access(school_id)
);

-- Postgres Realtime: principal, teacher and student are notified of saved changes.
DO $pub$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['noor_school_bell_slots','noor_class_timetable','noor_daily_lesson_topics'] LOOP
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=tbl
  ) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',tbl);
  END IF;
 END LOOP;
END $pub$;

COMMIT;

-- Verify AFTER deploying in the ORIGINAL project:
-- SELECT schemaname,tablename,policyname,cmd FROM pg_policies
--  WHERE tablename IN ('noor_school_bell_slots','noor_class_timetable','noor_daily_lesson_topics');
-- SELECT * FROM public.noor_school_bell_slots LIMIT 2;
-- School/principal/admin RLS identities must be tested with real JWTs.
