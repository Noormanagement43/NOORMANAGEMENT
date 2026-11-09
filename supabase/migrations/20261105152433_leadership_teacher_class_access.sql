CREATE FUNCTION private.noor_set_teacher_groups(p_institution uuid,p_teacher uuid,p_groups uuid[]) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_academics(p_institution) THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.institution_memberships WHERE id=p_teacher AND institution_id=p_institution AND role IN('teacher','faculty') AND status='active') THEN RAISE EXCEPTION 'Choose an active teacher in this school' USING ERRCODE='22023'; END IF;
 IF p_groups IS NULL OR cardinality(p_groups)>500 THEN RAISE EXCEPTION 'Choose up to 500 permitted class groups per save' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_groups) g WHERE g IS NULL OR NOT EXISTS(SELECT 1 FROM public.academic_groups a WHERE a.id=g AND a.institution_id=p_institution AND a.is_active AND a.group_type IN('class','section'))) THEN RAISE EXCEPTION 'Choose active groups in your school only' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.institution_memberships WHERE id=p_teacher FOR UPDATE;
 UPDATE public.academic_group_memberships SET status='inactive' WHERE institution_id=p_institution AND membership_id=p_teacher AND group_role IN('teacher','faculty') AND NOT(group_id=ANY(p_groups));
 INSERT INTO public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status) SELECT p_institution,g,p_teacher,'teacher','active' FROM (SELECT DISTINCT unnest(p_groups) g) x ON CONFLICT(group_id,membership_id) DO UPDATE SET group_role='teacher',status='active';
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id,metadata) VALUES(p_institution,auth.uid(),'teacher.class_access_saved',p_teacher,jsonb_build_object('group_count',cardinality(p_groups)));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.noor_set_teacher_groups(uuid,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_set_teacher_groups(uuid,uuid,uuid[]) TO authenticated;
CREATE FUNCTION public.noor_set_teacher_groups(p_institution uuid,p_teacher uuid,p_groups uuid[]) RETURNS boolean LANGUAGE sql SET search_path='' AS $$ SELECT private.noor_set_teacher_groups(p_institution,p_teacher,p_groups); $$;
REVOKE ALL ON FUNCTION public.noor_set_teacher_groups(uuid,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_set_teacher_groups(uuid,uuid,uuid[]) TO authenticated;
