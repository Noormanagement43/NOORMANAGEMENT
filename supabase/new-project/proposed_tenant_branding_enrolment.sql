-- REVIEW ONLY: additive tenant branding and student initial class/section selection.
-- Apply only after owner approval. Existing records and policies are not replaced.
BEGIN;
CREATE TABLE public.institution_branding (
 institution_id uuid PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
 logo_path text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT own_tenant_logo_path CHECK (logo_path IS NULL OR
  (logo_path LIKE institution_id::text || '/%' AND logo_path NOT LIKE '%..%'))
);
ALTER TABLE public.institution_branding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institution_branding FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.institution_branding TO authenticated;
CREATE POLICY branding_member_read ON public.institution_branding FOR SELECT TO authenticated
 USING (private.is_active_member(institution_id));
CREATE POLICY branding_leadership_insert ON public.institution_branding FOR INSERT TO authenticated
 WITH CHECK (private.can_manage_academics(institution_id));
CREATE POLICY branding_leadership_update ON public.institution_branding FOR UPDATE TO authenticated
 USING (private.can_manage_academics(institution_id)) WITH CHECK (private.can_manage_academics(institution_id));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('noor-school-logos','noor-school-logos',false,3145728,ARRAY['image/jpeg','image/png','image/webp']);
CREATE FUNCTION private.noor_logo_tenant(p_name text) RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path=''
 AS $$ SELECT CASE WHEN split_part(p_name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 THEN split_part(p_name,'/',1)::uuid ELSE NULL END $$;
REVOKE ALL ON FUNCTION private.noor_logo_tenant(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_logo_tenant(text) TO authenticated;
CREATE POLICY noor_school_logo_member_read ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='noor-school-logos' AND private.is_active_member(private.noor_logo_tenant(name)));
CREATE POLICY noor_school_logo_leadership_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='noor-school-logos' AND private.can_manage_academics(private.noor_logo_tenant(name)));
-- No overwrite/delete access: each replacement uses a new object path.
CREATE FUNCTION private.noor_select_student_section(p_institution uuid,p_class uuid,p_section uuid)
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
   OR NOT EXISTS(SELECT 1 FROM public.academic_groups WHERE id=p_section AND institution_id=p_institution
   AND parent_group_id=p_class AND group_type='section' AND is_active) THEN
   RAISE EXCEPTION 'Choose an active class and one of its sections from your school' USING ERRCODE='22023'; END IF;
  SELECT array_agg(g.id) INTO v_existing FROM public.academic_group_memberships m
   JOIN public.academic_groups g ON g.id=m.group_id AND g.institution_id=m.institution_id
   WHERE m.institution_id=p_institution AND m.membership_id=v_member AND m.status='active'
   AND g.group_type IN ('class','section');
  IF EXISTS(SELECT 1 FROM unnest(v_existing) AS x(id) WHERE id NOT IN (p_class,p_section)) THEN
   RAISE EXCEPTION 'Ask your principal to change an existing class assignment' USING ERRCODE='42501'; END IF;
  INSERT INTO public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status)
   VALUES(p_institution,p_class,v_member,'student','active'),(p_institution,p_section,v_member,'student','active')
   ON CONFLICT DO NOTHING;
  IF (SELECT count(*) FROM public.academic_group_memberships WHERE institution_id=p_institution
   AND membership_id=v_member AND group_id IN (p_class,p_section) AND status='active' AND group_role='student')<>2 THEN
   RAISE EXCEPTION 'Ask your principal to reactivate the existing class assignment' USING ERRCODE='42501'; END IF;
  INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id)
   VALUES(p_institution,auth.uid(),'student.initial_class_selected',p_section);
  RETURN jsonb_build_object('class_id',p_class,'section_id',p_section);
 END $$;
CREATE FUNCTION public.noor_select_student_section(p_institution uuid,p_class uuid,p_section uuid)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $$ SELECT private.noor_select_student_section(p_institution,p_class,p_section); $$;
REVOKE ALL ON FUNCTION private.noor_select_student_section(uuid,uuid,uuid),public.noor_select_student_section(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_select_student_section(uuid,uuid,uuid),public.noor_select_student_section(uuid,uuid,uuid) TO authenticated;
COMMIT;
