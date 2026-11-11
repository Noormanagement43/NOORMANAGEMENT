-- Existing RLS existed, but these Data API grants were missing in the new project.
-- Do not grant administrative status or membership updates directly to the browser.
GRANT SELECT ON public.class_sessions,public.attendance_records TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.academic_groups,public.academic_group_memberships,
 public.academic_years,public.departments,public.programs,public.courses,public.course_enrollments,
 public.class_sessions TO authenticated;
GRANT INSERT,UPDATE ON public.attendance_records TO authenticated;
GRANT UPDATE(full_name,avatar_url,preferred_language,timezone) ON public.profiles TO authenticated;
GRANT UPDATE(name,timezone,default_language) ON public.institutions TO authenticated;

CREATE POLICY noor_attendance_active_guard ON public.attendance_records AS RESTRICTIVE FOR ALL TO authenticated
 USING(private.is_active_member(institution_id) OR private.is_platform_admin())
 WITH CHECK(private.is_active_member(institution_id) OR private.is_platform_admin());
CREATE POLICY noor_sessions_group_read_guard ON public.class_sessions AS RESTRICTIVE FOR SELECT TO authenticated
 USING(private.noor_group_access(institution_id,academic_group_id,false));

CREATE OR REPLACE FUNCTION private.noor_guard_attendance_row()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$ DECLARE v_group uuid;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.institution_id IS DISTINCT FROM OLD.institution_id
 OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.student_membership_id IS DISTINCT FROM OLD.student_membership_id) THEN
 RAISE EXCEPTION 'Attendance identity cannot be reassigned' USING ERRCODE='42501'; END IF;
 SELECT academic_group_id INTO v_group FROM public.class_sessions WHERE id=NEW.session_id AND institution_id=NEW.institution_id;
 IF NOT private.noor_student_enrolled(NEW.institution_id,v_group,NEW.student_membership_id) THEN
 RAISE EXCEPTION 'Attendance requires an active enrolled student and assigned teacher' USING ERRCODE='23514'; END IF;
 NEW.marked_by=auth.uid(); NEW.marked_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER noor_attendance_enrollment_guard BEFORE INSERT OR UPDATE ON public.attendance_records
 FOR EACH ROW EXECUTE FUNCTION private.noor_guard_attendance_row();
CREATE TRIGGER noor_attendance_audit AFTER INSERT OR UPDATE ON public.attendance_records
 FOR EACH ROW EXECUTE FUNCTION private.noor_audit_academic_change();
