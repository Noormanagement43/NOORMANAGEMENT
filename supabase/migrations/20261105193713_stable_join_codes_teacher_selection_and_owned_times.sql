-- Stable join codes, tenant-only signup choices, teacher-owned recurring times and linked-parent reads.
CREATE OR REPLACE FUNCTION private.noor_save_join_codes(p_institution uuid,p_student text,p_staff text,p_management text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_code text;v_role text;v_saved int:=0;v_hash text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_institution_role(p_institution,ARRAY['principal','school_admin','university_admin']) THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution::text,23));
 FOR v_role,v_code IN SELECT * FROM (VALUES('student',nullif(trim(p_student),'')),('teacher',nullif(trim(p_staff),'')),('school_admin',nullif(trim(p_management),''))) c(role,code) LOOP
  IF v_code IS NULL THEN CONTINUE; END IF;
  IF v_code !~ '^[A-Za-z0-9_-]{8,64}$' THEN RAISE EXCEPTION 'Use 8–64 letters, digits, underscores or hyphens' USING ERRCODE='22023'; END IF;
  v_hash:=encode(sha256(convert_to(v_code,'UTF8')),'hex');
  IF EXISTS(SELECT 1 FROM private.noor_join_codes WHERE code_hash=v_hash AND (institution_id<>p_institution OR role<>v_role)) THEN RAISE EXCEPTION 'Use a different, unique code for each group' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM private.noor_join_codes WHERE institution_id=p_institution AND role=v_role AND code_hash=v_hash AND expires_at='infinity'::timestamptz) THEN CONTINUE; END IF;
  INSERT INTO private.noor_join_codes(institution_id,role,code_hash,expires_at) VALUES(p_institution,v_role,v_hash,'infinity') ON CONFLICT(institution_id,role) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at;
  v_saved:=v_saved+1;
 END LOOP;
 IF v_saved>0 THEN
  IF NOT private.noor_consume_limit('save_join_codes',10) THEN RAISE EXCEPTION 'Too many changes; retry in a minute' USING ERRCODE='54000'; END IF;
  INSERT INTO public.noor_audit_events(institution_id,actor_id,action,metadata) VALUES(p_institution,auth.uid(),'joining_codes.saved',jsonb_build_object('count',v_saved));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM private.noor_join_codes WHERE institution_id=p_institution) THEN RAISE EXCEPTION 'Enter at least one joining code' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('saved',true,'count',v_saved,'automatic_expiry',false);
END $$;
CREATE OR REPLACE FUNCTION private.noor_rotate_join_code(p_institution uuid,p_role text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_code text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_academics(p_institution) OR p_role IS NULL OR p_role NOT IN('student','teacher') THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_consume_limit('rotate_join_code',10) THEN RAISE EXCEPTION 'Too many changes' USING ERRCODE='54000'; END IF;
 INSERT INTO private.noor_join_codes(institution_id,role,code_hash,expires_at) VALUES(p_institution,p_role,encode(sha256(convert_to(v_code,'UTF8')),'hex'),'infinity') ON CONFLICT(institution_id,role) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,metadata) VALUES(p_institution,auth.uid(),'joining_code.rotated',jsonb_build_object('role',p_role));RETURN v_code;
END $$;
-- Preserve existing hashes; remove automatic expiry without rotating or revealing codes.
UPDATE private.noor_join_codes SET expires_at='infinity'::timestamptz WHERE expires_at<>'infinity'::timestamptz;
-- Deliberately public, bounded class/section names only: no people, rosters, join codes or access grants.
CREATE FUNCTION noor_discovery.noor_signup_groups(p_institution uuid,p_offset int DEFAULT 0) RETURNS TABLE(id uuid,name text,group_type text,parent_group_id uuid,institution_id uuid,is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT g.id,g.name,g.group_type,g.parent_group_id,g.institution_id,g.is_active FROM public.academic_groups g JOIN public.institutions i ON i.id=g.institution_id
 WHERE g.institution_id=p_institution AND i.status='active' AND g.is_active AND g.group_type IN('class','section')
 AND (g.group_type='class' OR EXISTS(SELECT 1 FROM public.academic_groups p WHERE p.id=g.parent_group_id AND p.institution_id=g.institution_id AND p.is_active AND p.group_type='class'))
 ORDER BY g.id LIMIT 200 OFFSET greatest(0,least(p_offset,100000));
$$;
CREATE FUNCTION public.noor_signup_groups(p_institution uuid,p_offset int DEFAULT 0) RETURNS TABLE(id uuid,name text,group_type text,parent_group_id uuid,institution_id uuid,is_active boolean)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM noor_discovery.noor_signup_groups(p_institution,p_offset); $$;
REVOKE ALL ON FUNCTION noor_discovery.noor_signup_groups(uuid,int),public.noor_signup_groups(uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION noor_discovery.noor_signup_groups(uuid,int),public.noor_signup_groups(uuid,int) TO anon,authenticated;
CREATE FUNCTION private.noor_select_teacher_section(p_institution uuid,p_class uuid,p_section uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_member uuid;v_role text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 SELECT id,role INTO v_member,v_role FROM public.institution_memberships WHERE institution_id=p_institution AND user_id=auth.uid() AND status='active' AND role IN('teacher','faculty') FOR UPDATE;
 IF v_member IS NULL OR NOT private.is_active_member(p_institution) THEN RAISE EXCEPTION 'Active teacher membership required' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_consume_limit('initial_teacher_section',10) THEN RAISE EXCEPTION 'Too many requests' USING ERRCODE='54000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.academic_groups WHERE id=p_class AND institution_id=p_institution AND is_active AND group_type='class') OR NOT EXISTS(SELECT 1 FROM public.academic_groups WHERE id=p_section AND institution_id=p_institution AND parent_group_id=p_class AND is_active AND group_type='section') THEN RAISE EXCEPTION 'Choose a class and section from your school' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.academic_group_memberships m JOIN public.academic_groups g ON g.id=m.group_id AND g.institution_id=m.institution_id WHERE m.membership_id=v_member AND m.institution_id=p_institution AND m.status='active' AND g.group_type IN('class','section') AND g.id<>p_section) THEN RAISE EXCEPTION 'Ask your principal to change an existing class assignment' USING ERRCODE='42501'; END IF;
 -- Section-only teacher access avoids exposing other sections through a parent-class grant.
 INSERT INTO public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status) VALUES(p_institution,p_section,v_member,v_role,'active') ON CONFLICT(group_id,membership_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.academic_group_memberships WHERE institution_id=p_institution AND group_id=p_section AND membership_id=v_member AND status='active' AND group_role=v_role) THEN RAISE EXCEPTION 'Ask leadership to reactivate this assignment' USING ERRCODE='42501'; END IF;
 UPDATE public.academic_groups SET homeroom_teacher_membership_id=v_member WHERE id=p_section AND institution_id=p_institution AND homeroom_teacher_membership_id IS NULL;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id) VALUES(p_institution,auth.uid(),'teacher.initial_class_selected',p_section);
 RETURN jsonb_build_object('class_id',p_class,'section_id',p_section);
END $$;
CREATE FUNCTION public.noor_select_teacher_section(p_institution uuid,p_class uuid,p_section uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.noor_select_teacher_section(p_institution,p_class,p_section); $$;
REVOKE ALL ON FUNCTION private.noor_select_teacher_section(uuid,uuid,uuid),public.noor_select_teacher_section(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_select_teacher_section(uuid,uuid,uuid),public.noor_select_teacher_section(uuid,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION private.noor_period_use_school_times() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.academic_group_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.academic_groups g WHERE g.id=NEW.academic_group_id AND g.institution_id=NEW.institution_id AND g.is_active AND (g.group_type='class' OR(g.group_type='section' AND EXISTS(SELECT 1 FROM public.academic_groups p WHERE p.id=g.parent_group_id AND p.institution_id=g.institution_id AND p.is_active AND p.group_type='class')))) THEN RAISE EXCEPTION 'Choose an active class or section from your school' USING ERRCODE='22023'; END IF;
 IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.start_time>=NEW.end_time THEN RAISE EXCEPTION 'Choose valid period start and end times' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.noor_propagate_period_times() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION private.noor_v2_enforce_teacher_period() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND(NEW.teacher_membership_id IS DISTINCT FROM OLD.teacher_membership_id OR NEW.institution_id IS DISTINCT FROM OLD.institution_id OR NEW.created_by IS DISTINCT FROM OLD.created_by) THEN RAISE EXCEPTION 'Timetable ownership cannot be changed' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.teacher_membership_id::text,91));
 IF EXISTS(SELECT 1 FROM public.teacher_timetable_periods p WHERE p.teacher_membership_id=NEW.teacher_membership_id AND p.weekday=NEW.weekday AND p.id<>NEW.id AND(p.period_number=NEW.period_number OR(p.start_time<NEW.end_time AND p.end_time>NEW.start_time))) THEN RAISE EXCEPTION 'Your periods overlap or this period number already exists on this day' USING ERRCODE='23514'; END IF;
 NEW.updated_at=now();RETURN NEW;
END $$;
CREATE FUNCTION private.noor_parent_period_access(p_institution uuid,p_group uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.noor_guardian_links l
 JOIN public.institution_memberships parent ON parent.id=l.guardian_membership_id AND parent.institution_id=l.institution_id
 JOIN public.institution_memberships child ON child.id=l.student_membership_id AND child.institution_id=l.institution_id
 JOIN public.institutions i ON i.id=l.institution_id
 JOIN public.academic_group_memberships gm ON gm.membership_id=child.id AND gm.institution_id=child.institution_id AND gm.status='active' AND gm.group_role='student'
 JOIN public.academic_groups g ON g.id=gm.group_id AND g.institution_id=gm.institution_id AND g.is_active
 WHERE l.institution_id=p_institution AND i.status='active' AND parent.user_id=auth.uid() AND parent.role='parent' AND parent.status='active' AND child.status='active' AND child.role IN('student','university_student')
 AND(g.id=p_group OR(g.group_type='section' AND g.parent_group_id=p_group)));
$$;
REVOKE ALL ON FUNCTION private.noor_parent_period_access(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_parent_period_access(uuid,uuid) TO authenticated;
CREATE POLICY noor_linked_parent_period_read ON public.teacher_timetable_periods FOR SELECT TO authenticated USING(private.noor_parent_period_access(institution_id,academic_group_id));
NOTIFY pgrst,'reload schema';
