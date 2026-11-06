CREATE OR REPLACE FUNCTION private.noor_class_performance(p_institution uuid, p_group uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_me uuid;v_role text;v_parent uuid;v_full boolean;v_tz text;v_result jsonb;v_own uuid;
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
 IF v_role IN('student','university_student') THEN
 SELECT g.id INTO v_own FROM public.academic_group_memberships gm JOIN public.academic_groups g ON g.id=gm.group_id AND g.institution_id=gm.institution_id WHERE gm.membership_id=v_me AND gm.institution_id=p_institution AND gm.status='active' AND gm.group_role='student' AND g.is_active AND g.group_type IN('class','section') ORDER BY(g.group_type='section') DESC,gm.created_at,gm.id LIMIT 1;
 IF p_group IS DISTINCT FROM v_own THEN RAISE EXCEPTION 'Only your own class result is available' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT timezone INTO v_tz FROM public.institutions WHERE id=p_institution;
 WITH selected_groups AS(
 SELECT id FROM public.academic_groups WHERE institution_id=p_institution AND is_active AND (id=p_group OR parent_group_id=p_group)
 ),grade_groups AS(SELECT id FROM selected_groups UNION SELECT v_parent WHERE v_parent IS NOT NULL),roster AS(
 SELECT DISTINCT m.id,m.user_id,p.full_name,p.avatar_url FROM public.institution_memberships m
 JOIN public.academic_group_memberships gm ON gm.membership_id=m.id AND gm.institution_id=m.institution_id
 JOIN public.profiles p ON p.id=m.user_id
 WHERE m.institution_id=p_institution AND m.status='active' AND m.role IN ('student','university_student') AND gm.status='active' AND gm.group_role='student' AND gm.group_id IN(SELECT id FROM selected_groups)
 ),marks AS(
 SELECT student_membership_id,round(100.0*sum(marks)/nullif(sum(max_marks),0),1) pct,count(*) assessments,sum(marks) total_marks,sum(max_marks) total_max_marks FROM public.noor_assessment_results WHERE institution_id=p_institution AND academic_group_id IN(SELECT id FROM grade_groups) AND assessed_on BETWEEN p_from AND p_to GROUP BY student_membership_id
 ),attendance AS(
 SELECT ar.student_membership_id,round(100.0*count(*) FILTER(WHERE ar.attendance_status IN('present','late'))/nullif(count(*),0),1) pct,count(*) marked FROM public.attendance_records ar JOIN public.class_sessions s ON s.id=ar.session_id AND s.institution_id=ar.institution_id
 WHERE ar.institution_id=p_institution AND s.academic_group_id IN(SELECT id FROM grade_groups) AND s.session_status='completed' AND (s.starts_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to AND ar.attendance_status IN('present','late','absent') GROUP BY ar.student_membership_id
 ),scored AS(
 SELECT r.*,m.pct marks_pct,m.assessments,m.total_marks,m.total_max_marks,a.pct attendance_pct,a.marked,d.gender,d.roll_number,
 CASE WHEN m.pct IS NOT NULL THEN dense_rank() OVER(ORDER BY m.pct DESC NULLS LAST) END rank
 FROM roster r LEFT JOIN marks m ON m.student_membership_id=r.id LEFT JOIN attendance a ON a.student_membership_id=r.id LEFT JOIN public.noor_student_display_preferences d ON d.membership_id=r.id AND d.institution_id=p_institution
 )
 SELECT jsonb_build_object('detailed',v_full,'total_students',count(*),'class_average',round(avg(marks_pct),1),'average_attendance',round(avg(attendance_pct),1),'top_performers',count(*) FILTER(WHERE marks_pct>=90),'students',coalesce(jsonb_agg(jsonb_build_object('membership_id',id,'name',full_name,'avatar_url',avatar_url,'gender',gender,'roll_number',roll_number,'total_marks',total_marks,'total_max_marks',total_max_marks,'subjects',(SELECT coalesce(jsonb_agg(jsonb_build_object('subject_name',sub.subject_name,'marks',sub.marks,'max_marks',sub.max_marks,'percentage',sub.pct,'assessments',sub.assessments) ORDER BY sub.subject_name),'[]'::jsonb) FROM (SELECT a.subject_name,sum(a.marks) marks,sum(a.max_marks) max_marks,round(100.0*sum(a.marks)/nullif(sum(a.max_marks),0),1) pct,count(*) assessments FROM public.noor_assessment_results a WHERE a.institution_id=p_institution AND a.student_membership_id=scored.id AND a.academic_group_id IN(SELECT id FROM grade_groups) AND a.assessed_on BETWEEN p_from AND p_to GROUP BY a.subject_name) sub),'marks_pct',marks_pct,'attendance_pct',attendance_pct,'assessments',coalesce(assessments,0),'attendance_marks',coalesce(marked,0),'rank',rank) ORDER BY marks_pct DESC NULLS LAST,full_name,id) FILTER(WHERE v_full OR id=v_me OR EXISTS(SELECT 1 FROM public.noor_guardian_links gl WHERE gl.institution_id=p_institution AND gl.guardian_membership_id=v_me AND gl.student_membership_id=scored.id)),'[]'::jsonb)) INTO v_result FROM scored;
 RETURN v_result||jsonb_build_object('from',p_from,'to',p_to);
END $function$
