
-- NOOR 2: use the CONNECTED new institution_id database only.
-- Teacher-run weekly timetable with school-tenant isolation. No principal approval required.
CREATE TABLE IF NOT EXISTS public.teacher_timetable_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 teacher_membership_id uuid NOT NULL,
 academic_group_id uuid NULL,
 weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
 period_number smallint NOT NULL CHECK (period_number BETWEEN 1 AND 20),
 start_time time NOT NULL,
 end_time time NOT NULL,
 subject_name text NOT NULL CHECK (length(btrim(subject_name)) BETWEEN 1 AND 140),
 room_label text NULL CHECK (room_label IS NULL OR length(room_label)<=100),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT noor_period_positive_duration CHECK (start_time < end_time),
 CONSTRAINT noor_period_teacher_fk FOREIGN KEY (teacher_membership_id,institution_id)
   REFERENCES public.institution_memberships(id,institution_id) ON DELETE CASCADE,
 CONSTRAINT noor_period_group_fk FOREIGN KEY (academic_group_id,institution_id)
   REFERENCES public.academic_groups(id,institution_id) ON DELETE RESTRICT,
 CONSTRAINT noor_period_unique_number UNIQUE (teacher_membership_id,weekday,period_number)
);
CREATE INDEX IF NOT EXISTS noor_v2_periods_institution_day_idx
 ON public.teacher_timetable_periods(institution_id,weekday,start_time);
CREATE INDEX IF NOT EXISTS noor_v2_periods_teacher_day_idx
 ON public.teacher_timetable_periods(teacher_membership_id,weekday,start_time);
ALTER TABLE public.teacher_timetable_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_timetable_periods FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.teacher_timetable_periods TO authenticated;

-- Disallow forged ownership/school transfer; teacher controls only their rows.
CREATE OR REPLACE FUNCTION private.noor_v2_enforce_teacher_period()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 IF TG_OP='UPDATE' AND (
   NEW.teacher_membership_id IS DISTINCT FROM OLD.teacher_membership_id OR
   NEW.institution_id IS DISTINCT FROM OLD.institution_id OR
   NEW.created_by IS DISTINCT FROM OLD.created_by
 ) THEN RAISE EXCEPTION 'Timetable ownership cannot be changed' USING errcode='42501'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.teacher_timetable_periods p
   WHERE p.teacher_membership_id=NEW.teacher_membership_id AND p.weekday=NEW.weekday
     AND p.id<>NEW.id AND p.start_time<NEW.end_time AND p.end_time>NEW.start_time
 ) THEN RAISE EXCEPTION 'Your periods overlap. Choose another time.' USING errcode='23514'; END IF;
 NEW.updated_at=now();
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS noor_v2_period_validate ON public.teacher_timetable_periods;
CREATE TRIGGER noor_v2_period_validate BEFORE INSERT OR UPDATE
ON public.teacher_timetable_periods FOR EACH ROW EXECUTE FUNCTION private.noor_v2_enforce_teacher_period();

DROP POLICY IF EXISTS noor_v2_period_read_active_institution ON public.teacher_timetable_periods;
CREATE POLICY noor_v2_period_read_active_institution ON public.teacher_timetable_periods
FOR SELECT TO authenticated USING (private.is_active_member(institution_id));
DROP POLICY IF EXISTS noor_v2_period_teacher_create ON public.teacher_timetable_periods;
CREATE POLICY noor_v2_period_teacher_create ON public.teacher_timetable_periods
FOR INSERT TO authenticated WITH CHECK (
 created_by=(select auth.uid())
 AND private.is_active_member(institution_id)
 AND EXISTS(SELECT 1 FROM public.institution_memberships m
            WHERE m.id=teacher_membership_id AND m.institution_id=teacher_timetable_periods.institution_id
              AND m.user_id=(select auth.uid()) AND m.status='active'
              AND m.role IN ('teacher','faculty'))
);
DROP POLICY IF EXISTS noor_v2_period_teacher_edit ON public.teacher_timetable_periods;
CREATE POLICY noor_v2_period_teacher_edit ON public.teacher_timetable_periods
FOR UPDATE TO authenticated
USING (created_by=(select auth.uid()) AND private.is_active_member(institution_id)
 AND EXISTS(SELECT 1 FROM public.institution_memberships m WHERE m.id=teacher_membership_id
 AND m.institution_id=teacher_timetable_periods.institution_id
 AND m.user_id=(select auth.uid()) AND m.status='active'
 AND m.role IN ('teacher','faculty')))
WITH CHECK (created_by=(select auth.uid()) AND private.is_active_member(institution_id)
 AND EXISTS(SELECT 1 FROM public.institution_memberships m WHERE m.id=teacher_membership_id
 AND m.institution_id=teacher_timetable_periods.institution_id
 AND m.user_id=(select auth.uid()) AND m.status='active'
 AND m.role IN ('teacher','faculty')));
DROP POLICY IF EXISTS noor_v2_period_teacher_delete ON public.teacher_timetable_periods;
CREATE POLICY noor_v2_period_teacher_delete ON public.teacher_timetable_periods
FOR DELETE TO authenticated USING (created_by=(select auth.uid())
 AND private.is_active_member(institution_id)
 AND EXISTS(SELECT 1 FROM public.institution_memberships m WHERE m.id=teacher_membership_id
 AND m.institution_id=teacher_timetable_periods.institution_id
 AND m.user_id=(select auth.uid()) AND m.status='active'
 AND m.role IN ('teacher','faculty')));

-- Keep new-project avatars private and scoped to authenticated owner only.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('noor-profile-photos','noor-profile-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY noor_v2_photo_upload_own_folder ON storage.objects
 FOR INSERT TO authenticated WITH CHECK
 (bucket_id='noor-profile-photos'
  AND (storage.foldername(name))[1] = (select auth.uid())::text);
CREATE POLICY noor_v2_photo_view_own_or_leadership ON storage.objects
 FOR SELECT TO authenticated USING
 (bucket_id='noor-profile-photos' AND (
 (storage.foldername(name))[1]=(select auth.uid())::text
 OR EXISTS(
  SELECT 1 FROM public.institution_memberships viewer
  JOIN public.institution_memberships subject ON subject.institution_id=viewer.institution_id
  JOIN public.institutions i ON i.id=viewer.institution_id
  WHERE viewer.user_id=(select auth.uid()) AND viewer.status='active'
    AND viewer.role IN('principal','school_admin','university_admin','academic_admin')
    AND subject.user_id::text=(storage.foldername(name))[1]
    AND subject.status='active' AND i.status='active'
 )
 ));
-- New uploads use immutable unique filenames: do not allow object replacement.
CREATE POLICY noor_v2_photo_delete_own_folder ON storage.objects
 FOR DELETE TO authenticated USING
 (bucket_id='noor-profile-photos'
  AND (storage.foldername(name))[1]=(select auth.uid())::text);

-- Only user-specific, private, immutable storage addresses may be recorded as
-- personal avatar references. Existing two profiles have avatar_url NULL.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS noor_v2_avatar_own_path;
ALTER TABLE public.profiles ADD CONSTRAINT noor_v2_avatar_own_path CHECK
 (avatar_url IS NULL OR avatar_url LIKE ('noor-profile-photos/'||id::text||'/%'));
