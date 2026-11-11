CREATE OR REPLACE FUNCTION private.noor_link_guardian(p_institution uuid,p_student uuid,p_parent_email text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_parent uuid;v_member uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_institution_role(p_institution,ARRAY['principal','school_admin','university_admin']) THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.institution_memberships WHERE id=p_student AND institution_id=p_institution AND role IN('student','university_student') AND status='active') THEN RAISE EXCEPTION 'Choose an active student in your school' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_parent FROM auth.users WHERE lower(email)=lower(trim(p_parent_email)) AND email_confirmed_at IS NOT NULL;
 IF v_parent IS NULL THEN RAISE EXCEPTION 'Parent must first create and verify their own email account' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_parent::text,29));
 IF EXISTS(SELECT 1 FROM public.institution_memberships WHERE user_id=v_parent AND (institution_id<>p_institution OR role<>'parent' OR status NOT IN('active','suspended'))) THEN RAISE EXCEPTION 'Use a separate verified parent account; existing role access is preserved' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_member FROM public.institution_memberships WHERE user_id=v_parent AND institution_id=p_institution AND role='parent' AND status IN('active','suspended');
 IF v_member IS NOT NULL THEN UPDATE public.institution_memberships SET status='active',updated_at=now() WHERE id=v_member; END IF;
 IF v_member IS NULL THEN INSERT INTO public.institution_memberships(institution_id,user_id,role,status,joined_at) VALUES(p_institution,v_parent,'parent','active',now()) RETURNING id INTO v_member; END IF;
 INSERT INTO public.noor_guardian_links(institution_id,guardian_membership_id,student_membership_id,created_by) VALUES(p_institution,v_member,p_student,auth.uid()) ON CONFLICT DO NOTHING;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id) VALUES(p_institution,auth.uid(),'guardian.linked',p_student);
 RETURN true;
END $$;
