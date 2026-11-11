-- A section is required only when the selected class has active sections.
CREATE OR REPLACE FUNCTION private.noor_select_student_section(p_institution uuid,p_class uuid,p_section uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE v_member uuid; v_existing uuid[];
 BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_member FROM public.institution_memberships
   WHERE institution_id=p_institution AND user_id=auth.uid() AND status='active'
   AND role IN ('student','university_student') FOR UPDATE;
  IF v_member IS NULL OR NOT private.is_active_member(p_institution) THEN
   RAISE EXCEPTION 'Active student membership required' USING ERRCODE='42501'; END IF;
  IF NOT private.noor_consume_limit('select_student_section',10) THEN
   RAISE EXCEPTION 'Too many requests' USING ERRCODE='54000'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.academic_groups WHERE id=p_class AND institution_id=p_institution
   AND group_type='class' AND is_active)
   OR (p_section IS NULL AND EXISTS(SELECT 1 FROM public.academic_groups WHERE institution_id=p_institution AND parent_group_id=p_class AND group_type='section' AND is_active))
   OR (p_section IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academic_groups WHERE id=p_section AND institution_id=p_institution
   AND parent_group_id=p_class AND group_type='section' AND is_active)) THEN
   RAISE EXCEPTION 'Choose an active class and one of its sections from your school' USING ERRCODE='22023'; END IF;
  SELECT array_agg(g.id) INTO v_existing FROM public.academic_group_memberships m
   JOIN public.academic_groups g ON g.id=m.group_id AND g.institution_id=m.institution_id
   WHERE m.institution_id=p_institution AND m.membership_id=v_member AND m.status='active'
   AND g.group_type IN ('class','section');
  IF EXISTS(SELECT 1 FROM unnest(v_existing) AS x(id) WHERE id<>p_class AND (p_section IS NULL OR id<>p_section)) THEN
   RAISE EXCEPTION 'Ask your principal to change an existing class assignment' USING ERRCODE='42501'; END IF;
  INSERT INTO public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status)
   SELECT p_institution,gid,v_member,'student','active' FROM unnest(ARRAY[p_class,p_section]) AS selected(gid) WHERE gid IS NOT NULL
   ON CONFLICT DO NOTHING;
  IF (SELECT count(*) FROM public.academic_group_memberships WHERE institution_id=p_institution
   AND membership_id=v_member AND group_id IN (p_class,p_section) AND status='active' AND group_role='student')<>(CASE WHEN p_section IS NULL THEN 1 ELSE 2 END) THEN
   RAISE EXCEPTION 'Ask your principal to reactivate the existing class assignment' USING ERRCODE='42501'; END IF;
  INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id)
   VALUES(p_institution,auth.uid(),'student.initial_class_selected',coalesce(p_section,p_class));
  RETURN jsonb_build_object('class_id',p_class,'section_id',p_section);
 END $$;
