-- Cover all foreign keys reported by the live performance advisor.
CREATE INDEX noor_academic_parent_fk ON public.academic_groups(parent_group_id,institution_id);
CREATE INDEX noor_result_member_fk ON public.noor_assessment_results(student_membership_id,institution_id);
CREATE INDEX noor_submission_item_fk ON public.noor_assignment_submissions(learning_item_id,institution_id);
CREATE INDEX noor_submission_member_fk ON public.noor_assignment_submissions(student_membership_id,institution_id);
CREATE INDEX noor_audit_actor_fk ON public.noor_audit_events(actor_id);
CREATE INDEX noor_learning_group_fk ON public.noor_learning_items(academic_group_id,institution_id);
CREATE INDEX noor_period_group_fk ON public.teacher_timetable_periods(academic_group_id,institution_id);
CREATE INDEX noor_period_teacher_fk ON public.teacher_timetable_periods(teacher_membership_id,institution_id);
CREATE INDEX noor_period_author_fk ON public.teacher_timetable_periods(created_by);
-- Existing institution_memberships_user_unique already enforces the same key.
DROP INDEX public.noor_membership_user_tenant;

-- Keep privilege elevation out of the exposed API schema and retain immediate
-- principal onboarding. Serialize requests by auth UID to prevent double creation.
CREATE OR REPLACE FUNCTION private.noor_register_institution(p_name text,p_slug text,p_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE
 v_uid uuid:=auth.uid(); v_name text:=btrim(coalesce(p_name,''));
 v_slug text:=lower(btrim(coalesce(p_slug,''))); v_type text:=lower(btrim(coalesce(p_type,''))); v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in before creating an institution' USING ERRCODE='42501'; END IF;
 IF length(v_name) NOT BETWEEN 2 AND 160 OR length(v_slug) NOT BETWEEN 1 AND 80
 OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR v_type NOT IN ('school','university') THEN
 RAISE EXCEPTION 'Invalid institution name, slug or type' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text,1));
 IF EXISTS(SELECT 1 FROM public.institution_memberships WHERE user_id=v_uid AND status='active') THEN
 RAISE EXCEPTION 'An active institution membership already exists' USING ERRCODE='22023'; END IF;
 INSERT INTO public.institutions(name,slug,institution_type,country_code,timezone,default_language,status,created_by)
 VALUES(v_name,v_slug,v_type,'IN','Asia/Kolkata','en','active',v_uid) RETURNING id INTO v_id;
 INSERT INTO public.institution_memberships(institution_id,user_id,role,status,invited_by,joined_at)
 VALUES(v_id,v_uid,'principal','active',v_uid,now());
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id) VALUES(v_id,v_uid,'institution.created',v_id);
 RETURN jsonb_build_object('institution_id',v_id,'name',v_name,'slug',v_slug,'institution_type',v_type,'role','principal');
END $$;
CREATE OR REPLACE FUNCTION public.register_institution_for_current_user(p_name text,p_slug text,p_type text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.noor_register_institution(p_name,p_slug,p_type); $$;
REVOKE ALL ON FUNCTION private.noor_register_institution(text,text,text),public.register_institution_for_current_user(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_register_institution(text,text,text),public.register_institution_for_current_user(text,text,text) TO authenticated;
