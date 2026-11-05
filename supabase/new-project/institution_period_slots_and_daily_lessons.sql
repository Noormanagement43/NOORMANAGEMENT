-- Principal controls bell timings; teachers own weekly allocation and daily lesson notes.
CREATE TABLE public.institution_period_slots (
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 period_number smallint NOT NULL CHECK(period_number BETWEEN 1 AND 20),
 start_time time NOT NULL,end_time time NOT NULL,CHECK(start_time<end_time),
 PRIMARY KEY(institution_id,period_number)
);
ALTER TABLE public.institution_period_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institution_period_slots FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.institution_period_slots TO authenticated;
CREATE POLICY period_slots_member_read ON public.institution_period_slots FOR SELECT TO authenticated USING(private.is_active_member(institution_id));
CREATE POLICY period_slots_leader_insert ON public.institution_period_slots FOR INSERT TO authenticated WITH CHECK(private.can_manage_academics(institution_id));
CREATE POLICY period_slots_leader_update ON public.institution_period_slots FOR UPDATE TO authenticated USING(private.can_manage_academics(institution_id)) WITH CHECK(private.can_manage_academics(institution_id));
CREATE FUNCTION private.noor_validate_period_slot() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
 BEGIN
  IF TG_OP='UPDATE' AND (NEW.institution_id,NEW.period_number) IS DISTINCT FROM (OLD.institution_id,OLD.period_number) THEN
   RAISE EXCEPTION 'Edit timings without changing the school or period number' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.institution_id::text,77));
  IF EXISTS(SELECT 1 FROM public.institution_period_slots s WHERE s.institution_id=NEW.institution_id
   AND s.period_number<>NEW.period_number AND s.start_time<NEW.end_time AND NEW.start_time<s.end_time) THEN
   RAISE EXCEPTION 'Period timings must not overlap' USING ERRCODE='22023'; END IF;
  RETURN NEW;
 END $$;
CREATE TRIGGER noor_validate_period_slot BEFORE INSERT OR UPDATE ON public.institution_period_slots FOR EACH ROW EXECUTE FUNCTION private.noor_validate_period_slot();
CREATE FUNCTION private.noor_period_use_school_times() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
 DECLARE v_start time;v_end time;
 BEGIN
  SELECT start_time,end_time INTO v_start,v_end FROM public.institution_period_slots
   WHERE institution_id=NEW.institution_id AND period_number=NEW.period_number;
  IF v_start IS NULL THEN RAISE EXCEPTION 'Ask the principal to set this period timing first' USING ERRCODE='22023'; END IF;
  IF NEW.academic_group_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.academic_groups g
   WHERE g.id=NEW.academic_group_id AND g.institution_id=NEW.institution_id AND g.is_active
   AND (g.group_type='class' OR (g.group_type='section' AND EXISTS(SELECT 1 FROM public.academic_groups parent
    WHERE parent.id=g.parent_group_id AND parent.institution_id=g.institution_id AND parent.is_active AND parent.group_type='class')))) THEN
   RAISE EXCEPTION 'Choose an active class or section from your school' USING ERRCODE='22023'; END IF;
  NEW.start_time:=v_start;NEW.end_time:=v_end;RETURN NEW;
 END $$;
CREATE TRIGGER noor_period_use_school_times BEFORE INSERT OR UPDATE ON public.teacher_timetable_periods FOR EACH ROW EXECUTE FUNCTION private.noor_period_use_school_times();
CREATE FUNCTION private.noor_propagate_period_times() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 BEGIN
  -- Caller must already pass the slots table's leadership RLS policy.
  IF NOT private.can_manage_academics(NEW.institution_id) THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
  UPDATE public.teacher_timetable_periods SET start_time=NEW.start_time,end_time=NEW.end_time,updated_at=now()
   WHERE institution_id=NEW.institution_id AND period_number=NEW.period_number
   AND (start_time,end_time) IS DISTINCT FROM (NEW.start_time,NEW.end_time)
   AND EXISTS(SELECT 1 FROM public.academic_groups g WHERE g.id=teacher_timetable_periods.academic_group_id
    AND g.institution_id=NEW.institution_id AND g.is_active AND (g.group_type='class' OR (g.group_type='section'
     AND EXISTS(SELECT 1 FROM public.academic_groups parent WHERE parent.id=g.parent_group_id AND parent.institution_id=g.institution_id AND parent.is_active AND parent.group_type='class'))));
  RETURN NEW;
 END $$;
CREATE TRIGGER noor_propagate_period_times AFTER INSERT OR UPDATE ON public.institution_period_slots FOR EACH ROW EXECUTE FUNCTION private.noor_propagate_period_times();
CREATE TABLE public.noor_daily_period_lessons (
 period_id uuid NOT NULL REFERENCES public.teacher_timetable_periods(id) ON DELETE CASCADE,
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 lesson_date date NOT NULL,lesson text NOT NULL DEFAULT '' CHECK(length(lesson)<=2000),
 topic text NOT NULL DEFAULT '' CHECK(length(topic)<=2000),completed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(period_id,lesson_date)
);
CREATE INDEX noor_daily_lessons_tenant_date ON public.noor_daily_period_lessons(institution_id,lesson_date);
ALTER TABLE public.noor_daily_period_lessons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_daily_period_lessons FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.noor_daily_period_lessons TO authenticated;
CREATE POLICY daily_lesson_read_visible_period ON public.noor_daily_period_lessons FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.teacher_timetable_periods p WHERE p.id=period_id AND p.institution_id=noor_daily_period_lessons.institution_id));
CREATE POLICY daily_lesson_insert_own ON public.noor_daily_period_lessons FOR INSERT TO authenticated
 WITH CHECK(private.has_institution_role(institution_id,ARRAY['teacher','faculty']) AND EXISTS(SELECT 1 FROM public.teacher_timetable_periods p WHERE p.id=period_id AND p.institution_id=noor_daily_period_lessons.institution_id AND private.is_my_membership(p.teacher_membership_id)));
CREATE POLICY daily_lesson_update_own ON public.noor_daily_period_lessons FOR UPDATE TO authenticated
 USING(private.has_institution_role(institution_id,ARRAY['teacher','faculty']) AND EXISTS(SELECT 1 FROM public.teacher_timetable_periods p WHERE p.id=period_id AND p.institution_id=noor_daily_period_lessons.institution_id AND private.is_my_membership(p.teacher_membership_id)))
 WITH CHECK(private.has_institution_role(institution_id,ARRAY['teacher','faculty']) AND EXISTS(SELECT 1 FROM public.teacher_timetable_periods p WHERE p.id=period_id AND p.institution_id=noor_daily_period_lessons.institution_id AND private.is_my_membership(p.teacher_membership_id)));
REVOKE ALL ON FUNCTION private.noor_validate_period_slot(),private.noor_period_use_school_times(),private.noor_propagate_period_times() FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.institution_period_slots,public.noor_daily_period_lessons,public.institution_branding;
 END IF;
END $$;

-- Applied separately as period_slot_propagation_index.
CREATE INDEX noor_period_institution_number ON public.teacher_timetable_periods(institution_id,period_number);
