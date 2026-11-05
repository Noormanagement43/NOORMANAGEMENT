CREATE FUNCTION private.noor_unlink_guardian(p_institution uuid,p_student uuid,p_parent_email text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_member uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_institution_role(p_institution,ARRAY['principal','school_admin','university_admin']) THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
 SELECT m.id INTO v_member FROM public.institution_memberships m JOIN auth.users u ON u.id=m.user_id WHERE m.institution_id=p_institution AND m.role='parent' AND lower(u.email)=lower(trim(p_parent_email)) FOR UPDATE OF m;
 IF v_member IS NULL THEN RAISE EXCEPTION 'No linked parent account found in this school' USING ERRCODE='22023'; END IF;
 DELETE FROM public.noor_guardian_links WHERE institution_id=p_institution AND guardian_membership_id=v_member AND student_membership_id=p_student;
 IF NOT FOUND THEN RAISE EXCEPTION 'This child is not linked to that parent' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.noor_guardian_links WHERE guardian_membership_id=v_member) THEN UPDATE public.institution_memberships SET status='suspended',updated_at=now() WHERE id=v_member; END IF;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id) VALUES(p_institution,auth.uid(),'guardian.unlinked',p_student);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.noor_unlink_guardian(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_unlink_guardian(uuid,uuid,text) TO authenticated;
CREATE FUNCTION public.noor_unlink_guardian(p_institution uuid,p_student uuid,p_parent_email text) RETURNS boolean LANGUAGE sql SET search_path='' AS $$ SELECT private.noor_unlink_guardian(p_institution,p_student,p_parent_email); $$;
REVOKE ALL ON FUNCTION public.noor_unlink_guardian(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_unlink_guardian(uuid,uuid,text) TO authenticated;
