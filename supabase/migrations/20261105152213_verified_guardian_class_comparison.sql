-- Verified guardian links, never user-metadata role claims.
ALTER TABLE public.institution_memberships DROP CONSTRAINT institution_memberships_role_check;
ALTER TABLE public.institution_memberships ADD CONSTRAINT institution_memberships_role_check CHECK(role IN ('principal','school_admin','teacher','staff','student','university_admin','faculty','university_student','academic_admin','finance_admin','parent'));
CREATE TABLE public.noor_guardian_links(
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 guardian_membership_id uuid NOT NULL,student_membership_id uuid NOT NULL,
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(guardian_membership_id,student_membership_id),CHECK(guardian_membership_id<>student_membership_id),
 FOREIGN KEY(guardian_membership_id,institution_id) REFERENCES public.institution_memberships(id,institution_id) ON DELETE CASCADE,
 FOREIGN KEY(student_membership_id,institution_id) REFERENCES public.institution_memberships(id,institution_id) ON DELETE CASCADE);
CREATE INDEX guardian_links_student ON public.noor_guardian_links(student_membership_id,institution_id);
ALTER TABLE public.noor_guardian_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_guardian_links FROM PUBLIC,anon;
GRANT SELECT ON public.noor_guardian_links TO authenticated;
CREATE POLICY guardian_links_read ON public.noor_guardian_links FOR SELECT TO authenticated USING(private.can_manage_academics(institution_id) OR private.is_my_membership(guardian_membership_id));
CREATE FUNCTION private.noor_link_guardian(p_institution uuid,p_student uuid,p_parent_email text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_parent uuid;v_member uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_institution_role(p_institution,ARRAY['principal','school_admin','university_admin']) THEN RAISE EXCEPTION 'School leadership required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.institution_memberships WHERE id=p_student AND institution_id=p_institution AND role IN('student','university_student') AND status='active') THEN RAISE EXCEPTION 'Choose an active student in your school' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_parent FROM auth.users WHERE lower(email)=lower(trim(p_parent_email)) AND email_confirmed_at IS NOT NULL;
 IF v_parent IS NULL THEN RAISE EXCEPTION 'Parent must first create and verify their own email account' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_parent::text,29));
 IF EXISTS(SELECT 1 FROM public.institution_memberships WHERE user_id=v_parent AND (institution_id<>p_institution OR role<>'parent' OR status<>'active')) THEN RAISE EXCEPTION 'Use a separate verified parent account; existing role access is preserved' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_member FROM public.institution_memberships WHERE user_id=v_parent AND institution_id=p_institution AND role='parent' AND status='active';
 IF v_member IS NULL THEN INSERT INTO public.institution_memberships(institution_id,user_id,role,status,joined_at) VALUES(p_institution,v_parent,'parent','active',now()) RETURNING id INTO v_member; END IF;
 INSERT INTO public.noor_guardian_links(institution_id,guardian_membership_id,student_membership_id,created_by) VALUES(p_institution,v_member,p_student,auth.uid()) ON CONFLICT DO NOTHING;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id) VALUES(p_institution,auth.uid(),'guardian.linked',p_student);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.noor_link_guardian(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_link_guardian(uuid,uuid,text) TO authenticated;
CREATE FUNCTION public.noor_link_guardian(p_institution uuid,p_student uuid,p_parent_email text) RETURNS boolean LANGUAGE sql SET search_path='' AS $$ SELECT private.noor_link_guardian(p_institution,p_student,p_parent_email); $$;
REVOKE ALL ON FUNCTION public.noor_link_guardian(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_link_guardian(uuid,uuid,text) TO authenticated;
CREATE FUNCTION private.noor_guardian_group_ids(p_institution uuid) RETURNS TABLE(group_id uuid,group_role text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT DISTINCT gm.group_id,'student'::text FROM public.noor_guardian_links gl JOIN public.institution_memberships parent ON parent.id=gl.guardian_membership_id AND parent.institution_id=gl.institution_id JOIN public.institution_memberships child ON child.id=gl.student_membership_id AND child.institution_id=gl.institution_id JOIN public.academic_group_memberships gm ON gm.membership_id=child.id AND gm.institution_id=child.institution_id WHERE gl.institution_id=p_institution AND parent.user_id=auth.uid() AND parent.role='parent' AND parent.status='active' AND child.status='active' AND gm.status='active' AND gm.group_role='student';
END $$;
REVOKE ALL ON FUNCTION private.noor_guardian_group_ids(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_guardian_group_ids(uuid) TO authenticated;
CREATE FUNCTION public.noor_guardian_group_ids(p_institution uuid) RETURNS TABLE(group_id uuid,group_role text) LANGUAGE sql STABLE SET search_path='' AS $$ SELECT * FROM private.noor_guardian_group_ids(p_institution); $$;
REVOKE ALL ON FUNCTION public.noor_guardian_group_ids(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_guardian_group_ids(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION private.noor_class_performance(p_institution uuid,p_group uuid,p_from date,p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_me uuid;v_role text;v_parent uuid;v_full boolean;v_tz text;v_result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 SELECT m.id,m.role INTO v_me,v_role FROM public.institution_memberships m JOIN public.institutions i ON i.id=m.institution_id
 WHERE m.institution_id=p_institution AND m.user_id=auth.uid() AND m.status='active' AND i.status='active';
 IF v_me IS NULL THEN RAISE EXCEPTION 'Active school membership required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_to-p_from>1827 THEN RAISE EXCEPTION 'Choose a valid date range (up to five years)' USING ERRCODE='22023'; END IF;
 SELECT g.parent_group_id INTO v_parent FROM public.academic_groups g WHERE g.id=p_group AND g.institution_id=p_institution AND g.is_active AND g.group_type IN ('class','section');
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active class or section from your school' USING ERRCODE='22023'; END IF;
 v_full:=private.can_manage_academics(p_institution) OR (v_role IN ('teacher','faculty') AND (private.noor_group_access(p_institution,p_group,true) OR (v_parent IS NOT NULL AND private.noor_group_access(p_institution,v_parent,true))));
 IF NOT v_full AND NOT (v_role='parent' AND EXISTS(SELECT 1 FROM public.noor_guardian_links gl JOIN public.institution_memberships child ON child.id=gl.student_membership_id AND child.institution_id=gl.institution_id JOIN public.academic_group_memberships gm ON gm.membership_id=child.id AND gm.institution_id=child.institution_id JOIN public.academic_groups g ON g.id=gm.group_id AND g.institution_id=gm.institution_id WHERE gl.guardian_membership_id=v_me AND gl.institution_id=p_institution AND child.status='active' AND gm.status='active' AND g.is_active AND (g.id=p_group OR g.parent_group_id=p_group))) AND NOT(v_role IN ('student','university_student') AND (private.noor_group_access(p_institution,p_group,false) OR (EXISTS(SELECT 1 FROM public.academic_group_memberships gm JOIN public.academic_groups g ON g.id=gm.group_id AND g.institution_id=gm.institution_id WHERE gm.membership_id=v_me AND gm.institution_id=p_institution AND gm.status='active' AND g.parent_group_id=p_group AND g.is_active)))) THEN RAISE EXCEPTION 'This class is outside your assigned access' USING ERRCODE='42501'; END IF;
 SELECT timezone INTO v_tz FROM public.institutions WHERE id=p_institution;
 WITH selected_groups AS(
 SELECT id FROM public.academic_groups WHERE institution_id=p_institution AND is_active AND (id=p_group OR parent_group_id=p_group)
 ),roster AS(
 SELECT DISTINCT m.id,m.user_id,p.full_name,p.avatar_url FROM public.institution_memberships m
 JOIN public.academic_group_memberships gm ON gm.membership_id=m.id AND gm.institution_id=m.institution_id
 JOIN public.profiles p ON p.id=m.user_id
 WHERE m.institution_id=p_institution AND m.status='active' AND m.role IN ('student','university_student') AND gm.status='active' AND gm.group_role='student' AND gm.group_id IN(SELECT id FROM selected_groups)
 ),marks AS(
 SELECT student_membership_id,round(100.0*sum(marks)/nullif(sum(max_marks),0),1) pct,count(*) assessments FROM public.noor_assessment_results WHERE institution_id=p_institution AND academic_group_id IN(SELECT id FROM selected_groups) AND assessed_on BETWEEN p_from AND p_to GROUP BY student_membership_id
 ),attendance AS(
 SELECT ar.student_membership_id,round(100.0*count(*) FILTER(WHERE ar.attendance_status IN('present','late'))/nullif(count(*),0),1) pct,count(*) marked FROM public.attendance_records ar JOIN public.class_sessions s ON s.id=ar.session_id AND s.institution_id=ar.institution_id
 WHERE ar.institution_id=p_institution AND s.academic_group_id IN(SELECT id FROM selected_groups) AND s.session_status='completed' AND (s.starts_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to AND ar.attendance_status IN('present','late','absent') GROUP BY ar.student_membership_id
 ),scored AS(
 SELECT r.*,m.pct marks_pct,m.assessments,a.pct attendance_pct,a.marked,d.gender,
 CASE WHEN m.pct IS NOT NULL THEN dense_rank() OVER(ORDER BY m.pct DESC NULLS LAST) END rank
 FROM roster r LEFT JOIN marks m ON m.student_membership_id=r.id LEFT JOIN attendance a ON a.student_membership_id=r.id LEFT JOIN public.noor_student_display_preferences d ON d.membership_id=r.id AND d.institution_id=p_institution
 )
 SELECT jsonb_build_object('detailed',v_full,'total_students',count(*),'class_average',round(avg(marks_pct),1),'average_attendance',round(avg(attendance_pct),1),'top_performers',count(*) FILTER(WHERE marks_pct>=90),'students',coalesce(jsonb_agg(jsonb_build_object('membership_id',id,'name',full_name,'avatar_url',avatar_url,'gender',gender,'marks_pct',marks_pct,'attendance_pct',attendance_pct,'assessments',coalesce(assessments,0),'attendance_marks',coalesce(marked,0),'rank',rank) ORDER BY marks_pct DESC NULLS LAST,full_name,id) FILTER(WHERE v_full OR id=v_me OR EXISTS(SELECT 1 FROM public.noor_guardian_links gl WHERE gl.institution_id=p_institution AND gl.guardian_membership_id=v_me AND gl.student_membership_id=scored.id)),'[]'::jsonb)) INTO v_result FROM scored;
 RETURN v_result||jsonb_build_object('from',p_from,'to',p_to);
END $$;
