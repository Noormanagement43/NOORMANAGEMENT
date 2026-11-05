-- Canonical teacher check-in and atomic daily class register.
-- No caller-supplied user identity or membership grants.
CREATE TABLE IF NOT EXISTS public.noor_teacher_weekly_plans(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 teacher_membership_id uuid NOT NULL,
 academic_group_id uuid NOT NULL,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 180),
 subject_name text NOT NULL CHECK(length(trim(subject_name)) BETWEEN 1 AND 140),
 body text NOT NULL CHECK(length(body)<=50000),
 due_at timestamptz NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(teacher_membership_id,institution_id) REFERENCES public.institution_memberships(id,institution_id) ON DELETE CASCADE,
 FOREIGN KEY(academic_group_id,institution_id) REFERENCES public.academic_groups(id,institution_id)
);
ALTER TABLE public.noor_teacher_weekly_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_teacher_weekly_plans FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.noor_teacher_weekly_plans TO authenticated;
CREATE INDEX IF NOT EXISTS teacher_weekly_plans_owner ON public.noor_teacher_weekly_plans(teacher_membership_id,created_at);
CREATE POLICY teacher_plans_read ON public.noor_teacher_weekly_plans FOR SELECT TO authenticated
 USING(created_by=auth.uid() AND private.is_active_member(institution_id) AND private.is_my_membership(teacher_membership_id));
CREATE POLICY teacher_plans_insert ON public.noor_teacher_weekly_plans FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid() AND private.is_my_membership(teacher_membership_id) AND private.has_institution_role(institution_id,ARRAY['teacher','faculty']) AND private.noor_group_access(institution_id,academic_group_id,true));
CREATE POLICY teacher_plans_update ON public.noor_teacher_weekly_plans FOR UPDATE TO authenticated
 USING(created_by=auth.uid() AND private.is_my_membership(teacher_membership_id) AND private.has_institution_role(institution_id,ARRAY['teacher','faculty']))
 WITH CHECK(created_by=auth.uid() AND private.is_my_membership(teacher_membership_id) AND private.has_institution_role(institution_id,ARRAY['teacher','faculty']) AND private.noor_group_access(institution_id,academic_group_id,true));

CREATE OR REPLACE FUNCTION private.noor_teacher_check_in(p_institution uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m uuid; d date; r public.noor_staff_checkins;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 SELECT im.id,(now() AT TIME ZONE i.timezone)::date INTO m,d
 FROM public.institution_memberships im JOIN public.institutions i ON i.id=im.institution_id
 WHERE im.institution_id=p_institution AND im.user_id=auth.uid() AND im.status='active'
 AND im.role IN('teacher','faculty') AND i.status='active';
 IF m IS NULL THEN RAISE EXCEPTION 'Active teacher membership required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.noor_staff_checkins(institution_id,membership_id,checkin_date,status,marked_by)
 VALUES(p_institution,m,d,'present',auth.uid()) ON CONFLICT(membership_id,checkin_date) DO NOTHING;
 SELECT * INTO r FROM public.noor_staff_checkins WHERE membership_id=m AND checkin_date=d;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION private.noor_teacher_check_in(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_teacher_check_in(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.noor_teacher_check_in(p_institution uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.noor_teacher_check_in(p_institution); $$;
REVOKE ALL ON FUNCTION public.noor_teacher_check_in(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_teacher_check_in(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.noor_save_class_register(p_institution uuid,p_group uuid,p_date date,p_records jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m uuid; tz text; s uuid; total int; saved int;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 SELECT im.id,i.timezone INTO m,tz FROM public.institution_memberships im JOIN public.institutions i ON i.id=im.institution_id
 WHERE im.institution_id=p_institution AND im.user_id=auth.uid() AND im.status='active' AND im.role IN('teacher','faculty') AND i.status='active';
 IF m IS NULL OR NOT private.noor_group_access(p_institution,p_group,true) OR NOT EXISTS(
 SELECT 1 FROM public.academic_groups WHERE id=p_group AND institution_id=p_institution AND is_active AND group_type IN('class','section'))
 THEN RAISE EXCEPTION 'Assigned teacher required for this class' USING ERRCODE='42501'; END IF;
 IF p_date IS NULL OR p_date>(now() AT TIME ZONE tz)::date THEN RAISE EXCEPTION 'Choose today or a past date' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Attendance list required' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO total FROM public.institution_memberships im WHERE im.institution_id=p_institution AND im.status='active'
 AND im.role IN('student','university_student') AND private.noor_student_enrolled(p_institution,p_group,im.id);
 IF total=0 OR total<>jsonb_array_length(p_records) OR total>500 THEN RAISE EXCEPTION 'Mark every enrolled student (maximum 500)' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_records) x WHERE x->>'status' IS NULL OR x->>'status' NOT IN('present','absent','late')) THEN RAISE EXCEPTION 'Choose Present, Absent or Late' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution::text||p_group::text||p_date::text,45));
 SELECT id INTO s FROM public.class_sessions WHERE institution_id=p_institution AND academic_group_id=p_group
 AND title='Daily class attendance' AND (starts_at AT TIME ZONE tz)::date=p_date ORDER BY created_at LIMIT 1;
 IF s IS NULL THEN
 INSERT INTO public.class_sessions(institution_id,academic_group_id,teacher_membership_id,title,starts_at,ends_at,created_by)
 VALUES(p_institution,p_group,m,'Daily class attendance',(p_date+time '08:00') AT TIME ZONE tz,(p_date+time '08:01') AT TIME ZONE tz,auth.uid()) RETURNING id INTO s;
 END IF;
 saved:=public.noor_submit_attendance(s,p_records);
 UPDATE public.class_sessions SET session_status='completed',updated_at=now() WHERE id=s AND institution_id=p_institution;
 RETURN jsonb_build_object('session_id',s,'count',saved,'status','completed');
END $$;
REVOKE ALL ON FUNCTION private.noor_save_class_register(uuid,uuid,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_save_class_register(uuid,uuid,date,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.noor_save_class_register(p_institution uuid,p_group uuid,p_date date,p_records jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.noor_save_class_register(p_institution,p_group,p_date,p_records); $$;
REVOKE ALL ON FUNCTION public.noor_save_class_register(uuid,uuid,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_save_class_register(uuid,uuid,date,jsonb) TO authenticated;

DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='noor_staff_checkins') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.noor_staff_checkins; END IF; END $$;
