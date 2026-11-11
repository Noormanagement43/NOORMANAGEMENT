-- Approved additive upgrade: structure areas, labs, school-name search and editable hashed joining codes.
ALTER TABLE public.academic_groups ADD COLUMN education_path text;
UPDATE public.academic_groups g SET education_path=CASE WHEN i.institution_type='university' THEN 'university' ELSE 'school' END FROM public.institutions i WHERE i.id=g.institution_id;
ALTER TABLE public.academic_groups ALTER COLUMN education_path SET DEFAULT 'school', ALTER COLUMN education_path SET NOT NULL;
ALTER TABLE public.academic_groups ADD CONSTRAINT noor_education_path_check CHECK(education_path IN ('school','university'));
CREATE TABLE public.institution_labs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 education_path text NOT NULL DEFAULT 'school' CHECK(education_path IN ('school','university')),is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX noor_labs_tenant ON public.institution_labs(institution_id);
ALTER TABLE public.institution_labs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institution_labs FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.institution_labs TO authenticated;
CREATE POLICY noor_labs_read ON public.institution_labs FOR SELECT TO authenticated USING(private.is_active_member(institution_id));
CREATE POLICY noor_labs_insert ON public.institution_labs FOR INSERT TO authenticated WITH CHECK(private.can_manage_academics(institution_id));
CREATE POLICY noor_labs_update ON public.institution_labs FOR UPDATE TO authenticated USING(private.can_manage_academics(institution_id)) WITH CHECK(private.can_manage_academics(institution_id));
-- Name-only discovery is deliberately public; private records and joining codes are never returned.
CREATE FUNCTION private.noor_find_institutions(p_search text) RETURNS TABLE(id uuid,name text,institution_type text,slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT i.id,i.name,i.institution_type,i.slug FROM public.institutions i
 WHERE i.status='active' AND length(trim(p_search)) BETWEEN 3 AND 100
 AND strpos(lower(i.name),lower(trim(p_search)))>0 ORDER BY i.name,i.id LIMIT 10;
$$;
REVOKE ALL ON FUNCTION private.noor_find_institutions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.noor_find_institutions(text) TO anon,authenticated;
CREATE FUNCTION public.noor_find_institutions(p_search text) RETURNS TABLE(id uuid,name text,institution_type text,slug text)
LANGUAGE sql STABLE SET search_path='' AS $$ SELECT * FROM private.noor_find_institutions(p_search); $$;
REVOKE ALL ON FUNCTION public.noor_find_institutions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.noor_find_institutions(text) TO anon,authenticated;
ALTER TABLE private.noor_join_codes DROP CONSTRAINT noor_join_codes_role_check;
ALTER TABLE private.noor_join_codes ADD CONSTRAINT noor_join_codes_role_check CHECK(role IN ('teacher','student','school_admin'));
CREATE FUNCTION private.noor_save_join_codes(p_institution uuid,p_student text,p_staff text,p_management text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_code text;v_role text;v_saved int:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_institution_role(p_institution,ARRAY['principal','school_admin','university_admin']) THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_consume_limit('save_join_codes',10) THEN RAISE EXCEPTION 'Too many changes; retry in a minute' USING ERRCODE='54000'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution::text,23));
 -- Blank fields preserve existing codes. Supplied values replace the relevant hash atomically.
 FOR v_role,v_code IN SELECT * FROM (VALUES('student',nullif(trim(p_student),'')),('teacher',nullif(trim(p_staff),'')),('school_admin',nullif(trim(p_management),''))) c(role,code) LOOP
  IF v_code IS NULL THEN CONTINUE; END IF;
  IF v_code !~ '^[A-Za-z0-9_-]{8,64}$' THEN RAISE EXCEPTION 'Use 8–64 letters, digits, underscores or hyphens' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM private.noor_join_codes WHERE code_hash=encode(sha256(convert_to(v_code,'UTF8')),'hex') AND (institution_id<>p_institution OR role<>v_role)) THEN RAISE EXCEPTION 'Use a different, unique code for each group' USING ERRCODE='22023'; END IF;
  INSERT INTO private.noor_join_codes(institution_id,role,code_hash,expires_at) VALUES(p_institution,v_role,encode(sha256(convert_to(v_code,'UTF8')),'hex'),now()+interval '30 days') ON CONFLICT(institution_id,role) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at;
  v_saved:=v_saved+1;
 END LOOP;
 IF v_saved=0 THEN RAISE EXCEPTION 'Enter at least one new code' USING ERRCODE='22023'; END IF;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,metadata) VALUES(p_institution,auth.uid(),'joining_codes.saved',jsonb_build_object('count',v_saved));
 RETURN jsonb_build_object('saved',true,'count',v_saved,'expires_in_days',30);
END $$;
REVOKE ALL ON FUNCTION private.noor_save_join_codes(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_save_join_codes(uuid,text,text,text) TO authenticated;
CREATE FUNCTION public.noor_save_join_codes(p_institution uuid,p_student text,p_staff text,p_management text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT private.noor_save_join_codes(p_institution,p_student,p_staff,p_management); $$;
REVOKE ALL ON FUNCTION public.noor_save_join_codes(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_save_join_codes(uuid,text,text,text) TO authenticated;
CREATE FUNCTION private.noor_join_code_status(p_institution uuid) RETURNS TABLE(role text,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT private.has_institution_role(p_institution,ARRAY['principal','school_admin','university_admin']) THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT c.role,c.expires_at FROM private.noor_join_codes c WHERE c.institution_id=p_institution;
END $$;
REVOKE ALL ON FUNCTION private.noor_join_code_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_join_code_status(uuid) TO authenticated;
CREATE FUNCTION public.noor_join_code_status(p_institution uuid) RETURNS TABLE(role text,expires_at timestamptz) LANGUAGE sql SET search_path='' AS $$ SELECT * FROM private.noor_join_code_status(p_institution); $$;
REVOKE ALL ON FUNCTION public.noor_join_code_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_join_code_status(uuid) TO authenticated;
CREATE FUNCTION private.noor_join_selected_institution(p_institution uuid,p_code text,p_kind text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_role text;
BEGIN
 IF p_kind NOT IN ('student','teacher','manager') OR p_kind IS NULL THEN RAISE EXCEPTION 'Choose your joining group' USING ERRCODE='22023'; END IF;
 v_id:=private.noor_join_institution(p_institution,p_code);
 SELECT role INTO v_role FROM public.institution_memberships WHERE id=v_id;
 IF v_role<>(CASE p_kind WHEN 'manager' THEN 'school_admin' ELSE p_kind END) THEN RAISE EXCEPTION 'Use the joining code for your selected group' USING ERRCODE='22023'; END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.noor_join_selected_institution(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_join_selected_institution(uuid,text,text) TO authenticated;
CREATE FUNCTION public.noor_join_selected_institution(p_institution uuid,p_code text,p_kind text) RETURNS uuid LANGUAGE sql SET search_path='' AS $$ SELECT private.noor_join_selected_institution(p_institution,p_code,p_kind); $$;
REVOKE ALL ON FUNCTION public.noor_join_selected_institution(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_join_selected_institution(uuid,text,text) TO authenticated;
