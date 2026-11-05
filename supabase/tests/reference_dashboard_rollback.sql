-- Isolated synthetic verification. Every test row is rolled back.
BEGIN;
CREATE TEMP TABLE noor_test_ids(k text PRIMARY KEY,v uuid NOT NULL);
INSERT INTO noor_test_ids SELECT k,gen_random_uuid() FROM unnest(ARRAY['principal','teacher','student','other','school','other_school','class','mango','apple','other_class','other_section','pm','tm','sm','om','period','other_period']) k;
CREATE TEMP TABLE noor_test_results(check_name text,passed boolean);
GRANT SELECT ON noor_test_ids TO authenticated;
GRANT SELECT,INSERT ON noor_test_results TO authenticated;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
 SELECT v,'noor-rollback-'||v::text||'@example.invalid','{"full_name":"Rollback verification"}'::jsonb,'{}'::jsonb FROM noor_test_ids WHERE k IN ('principal','teacher','student','other');
INSERT INTO public.institutions(id,name,slug,institution_type,country_code,timezone,default_language,status,created_by)
 SELECT v,'Rollback School '||k,'rollback-'||v::text,'school','IN','Asia/Kolkata','en','active',(SELECT v FROM noor_test_ids WHERE k='principal') FROM noor_test_ids WHERE k IN ('school','other_school');
INSERT INTO public.institution_memberships(id,institution_id,user_id,role,status,joined_at)
 SELECT m.v,s.v,u.v,r.role,'active',now() FROM (VALUES('pm','school','principal','principal'),('tm','school','teacher','teacher'),('sm','school','student','student'),('om','other_school','other','student'))r(m,s,u,role)
 JOIN noor_test_ids m ON m.k=r.m JOIN noor_test_ids s ON s.k=r.s JOIN noor_test_ids u ON u.k=r.u;
INSERT INTO public.academic_groups(id,institution_id,name,group_type,parent_group_id,is_active)
 SELECT g.v,s.v,r.name,r.kind,p.v,true FROM (VALUES('class','school','Class 1','class',NULL),('mango','school','Mango','section','class'),('apple','school','Apple','section','class'),('other_class','other_school','BiPC','class',NULL),('other_section','other_school','Other section','section','other_class'))r(g,s,name,kind,parent)
 JOIN noor_test_ids g ON g.k=r.g JOIN noor_test_ids s ON s.k=r.s LEFT JOIN noor_test_ids p ON p.k=r.parent;
INSERT INTO public.institution_branding(institution_id,logo_path) SELECT v,v::text||'/other-logo.png' FROM noor_test_ids WHERE k='other_school';
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.institution_period_slots(institution_id,period_number,start_time,end_time) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),1,'09:00','09:45');
INSERT INTO public.institution_branding(institution_id,logo_path) SELECT v,v::text||'/logo-test.png' FROM noor_test_ids WHERE k='school';
DO $$ BEGIN
 BEGIN
  INSERT INTO public.institution_period_slots VALUES((SELECT v FROM noor_test_ids WHERE k='school'),2,'09:30','10:00');
  RAISE EXCEPTION 'Overlapping school timings were accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN INSERT INTO noor_test_results VALUES('overlapping_period_slots_rejected',true); END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='teacher'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.teacher_timetable_periods(id,institution_id,teacher_membership_id,academic_group_id,weekday,period_number,start_time,end_time,subject_name,created_by)
 VALUES((SELECT v FROM noor_test_ids WHERE k='period'),(SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='tm'),(SELECT v FROM noor_test_ids WHERE k='mango'),1,1,'12:00','13:00','Mathematics',(SELECT v FROM noor_test_ids WHERE k='teacher')),
 ((SELECT v FROM noor_test_ids WHERE k='other_period'),(SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='tm'),(SELECT v FROM noor_test_ids WHERE k='apple'),2,1,'12:00','13:00','Science',(SELECT v FROM noor_test_ids WHERE k='teacher'));
INSERT INTO noor_test_results SELECT 'teacher_period_uses_principal_times',start_time='09:00' AND end_time='09:45' FROM public.teacher_timetable_periods WHERE id=(SELECT v FROM noor_test_ids WHERE k='period');
INSERT INTO public.noor_daily_period_lessons(period_id,institution_id,lesson_date,lesson,topic,completed) VALUES((SELECT v FROM noor_test_ids WHERE k='period'),(SELECT v FROM noor_test_ids WHERE k='school'),'2026-11-05','Fractions','Equivalent fractions',true);
DO $$ BEGIN
 BEGIN
  INSERT INTO public.institution_period_slots VALUES((SELECT v FROM noor_test_ids WHERE k='school'),3,'10:00','10:45');
  RAISE EXCEPTION 'Teacher changed school timings';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO noor_test_results VALUES('teacher_cannot_set_school_timings',true); END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='student'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.noor_select_student_section((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='class'),(SELECT v FROM noor_test_ids WHERE k='mango'));
INSERT INTO noor_test_results SELECT 'student_sees_own_section_period_only',count(*)=1 FROM public.teacher_timetable_periods WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school');
INSERT INTO noor_test_results SELECT 'student_sees_authorised_daily_lesson',count(*)=1 FROM public.noor_daily_period_lessons WHERE period_id=(SELECT v FROM noor_test_ids WHERE k='period') AND topic='Equivalent fractions';
INSERT INTO noor_test_results SELECT 'student_cannot_list_other_school_groups',count(*)=0 FROM public.academic_groups WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='other_school');
INSERT INTO noor_test_results SELECT 'student_reads_own_school_branding',count(*)=1 FROM public.institution_branding;
DO $$ BEGIN
 BEGIN
  PERFORM public.noor_select_student_section((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='class'),(SELECT v FROM noor_test_ids WHERE k='other_section'));
  RAISE EXCEPTION 'Cross-school section was accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN INSERT INTO noor_test_results VALUES('cross_school_section_rejected',true); END;
 BEGIN
  PERFORM public.noor_select_student_section((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='class'),(SELECT v FROM noor_test_ids WHERE k='apple'));
  RAISE EXCEPTION 'Student transferred themselves after enrollment';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO noor_test_results VALUES('student_transfer_requires_leadership',true); END;
 BEGIN
  INSERT INTO public.institution_branding(institution_id) SELECT v FROM noor_test_ids WHERE k='other_school';
  RAISE EXCEPTION 'Student changed another school branding';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO noor_test_results VALUES('student_cannot_write_branding',true); END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
UPDATE public.institution_period_slots SET start_time='08:30',end_time='09:15' WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school') AND period_number=1;
INSERT INTO noor_test_results SELECT 'principal_time_change_propagates',count(*)=2 FROM public.teacher_timetable_periods WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school') AND start_time='08:30' AND end_time='09:15';
RESET ROLE;

-- Performance RPC data and role-isolation tests. No test records are retained.
INSERT INTO noor_test_ids VALUES('student2',gen_random_uuid()),('sm2',gen_random_uuid());
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) SELECT v,'noor-rollback-'||v::text||'@example.invalid','{}','{}' FROM noor_test_ids WHERE k='student2';
INSERT INTO public.institution_memberships(id,institution_id,user_id,role,status) VALUES((SELECT v FROM noor_test_ids WHERE k='sm2'),(SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='student2'),'student','active');
INSERT INTO public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status) VALUES
((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),(SELECT v FROM noor_test_ids WHERE k='sm2'),'student','active'),
((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),(SELECT v FROM noor_test_ids WHERE k='tm'),'teacher','active');
INSERT INTO public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,graded_by)
SELECT (SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),v,'Rollback mathematics','Mathematics','2026-11-05',CASE k WHEN 'sm' THEN 90 ELSE 80 END,100,(SELECT v FROM noor_test_ids WHERE k='teacher') FROM noor_test_ids WHERE k IN('sm','sm2');
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),'2026-01-01','2026-12-31');
 IF NOT (r->>'detailed')::boolean OR jsonb_array_length(r->'students')<>2 OR (r->>'class_average')::numeric<>85 THEN RAISE EXCEPTION 'Leadership full cohort / actual average failed: %',r; END IF;
END $$;
INSERT INTO public.institution_dashboard_preferences(institution_id,chart_type,section_colours) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),'bar','{"Mango":"#173B70"}');
INSERT INTO public.noor_principal_tasks(institution_id,title) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),'Rollback task');
INSERT INTO public.noor_staff_checkins(institution_id,membership_id,checkin_date,status) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='tm'),'2026-11-05','present');
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='teacher'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 IF NOT private.noor_can_view_profile_photo((SELECT v::text FROM noor_test_ids WHERE k='student')||'/profile.png') THEN RAISE EXCEPTION 'Assigned teacher photo denied'; END IF;
 IF private.noor_can_view_profile_photo((SELECT v::text FROM noor_test_ids WHERE k='other')||'/profile.png') THEN RAISE EXCEPTION 'Other-school photo allowed'; END IF;
 r:=public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),'2026-01-01','2026-12-31');
 IF NOT (r->>'detailed')::boolean OR jsonb_array_length(r->'students')<>2 THEN RAISE EXCEPTION 'Assigned teacher cohort failed'; END IF;
 BEGIN
  PERFORM public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='apple'),'2026-01-01','2026-12-31');
  RAISE EXCEPTION 'Unassigned teacher section allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.institution_dashboard_preferences(institution_id) VALUES((SELECT v FROM noor_test_ids WHERE k='other_school'));
  RAISE EXCEPTION 'Teacher changed another school chart';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='student'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),'2026-01-01','2026-12-31');
 IF (r->>'detailed')::boolean OR jsonb_array_length(r->'students')<>1 OR (r->'students'->0->>'membership_id')<>(SELECT v::text FROM noor_test_ids WHERE k='sm') OR (r->'students'->0->>'rank')::int<>1 OR (r->'students'->0->>'total_marks')::numeric<>90 OR (r->'students'->0->'subjects'->0->>'subject_name')<>'Mathematics' THEN RAISE EXCEPTION 'Student private comparison failed: %',r; END IF;
 IF EXISTS(SELECT 1 FROM public.noor_principal_tasks) THEN RAISE EXCEPTION 'Student read leadership tasks'; END IF;
 IF EXISTS(SELECT 1 FROM public.noor_staff_checkins) THEN RAISE EXCEPTION 'Student read staff checkins'; END IF;
 BEGIN
  PERFORM public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='other_school'),(SELECT v FROM noor_test_ids WHERE k='other_section'),'2026-01-01','2026-12-31');
  RAISE EXCEPTION 'Other school performance access allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.noor_student_display_preferences(membership_id,institution_id,gender) VALUES((SELECT v FROM noor_test_ids WHERE k='sm'),(SELECT v FROM noor_test_ids WHERE k='school'),'female');
  RAISE EXCEPTION 'Student changed official display metadata';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

INSERT INTO noor_test_ids VALUES('parent',gen_random_uuid());
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) SELECT v,'noor-rollback-'||v::text||'@example.invalid',now(),'{}','{}' FROM noor_test_ids WHERE k='parent';
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.noor_link_guardian((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='sm'),'noor-rollback-'||(SELECT v::text FROM noor_test_ids WHERE k='parent')||'@example.invalid');
 PERFORM public.noor_set_teacher_groups((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='tm'),ARRAY[(SELECT v FROM noor_test_ids WHERE k='mango')]);
 BEGIN
  PERFORM public.noor_set_teacher_groups((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='tm'),ARRAY[(SELECT v FROM noor_test_ids WHERE k='other_section')]);
  RAISE EXCEPTION 'Cross-school teacher assignment accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='parent'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),'2026-01-01','2026-12-31');
 IF NOT private.noor_can_view_profile_photo((SELECT v::text FROM noor_test_ids WHERE k='student')||'/profile.png') THEN RAISE EXCEPTION 'Linked parent photo denied'; END IF;
 IF private.noor_can_view_profile_photo((SELECT v::text FROM noor_test_ids WHERE k='student2')||'/profile.png') THEN RAISE EXCEPTION 'Parent saw another student photo'; END IF;
 IF (r->>'detailed')::boolean OR jsonb_array_length(r->'students')<>1 OR (r->'students'->0->>'membership_id')<>(SELECT v::text FROM noor_test_ids WHERE k='sm') THEN RAISE EXCEPTION 'Parent saw another child or lost own child'; END IF;
 IF (SELECT count(*) FROM public.noor_guardian_group_ids((SELECT v FROM noor_test_ids WHERE k='school')))<>2 THEN RAISE EXCEPTION 'Parent permitted class groups incorrect'; END IF;
 BEGIN
  PERFORM public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='apple'),'2026-01-01','2026-12-31');
  RAISE EXCEPTION 'Parent accessed unlinked section';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.noor_link_guardian((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='sm2'),'noor-rollback-'||(SELECT v::text FROM noor_test_ids WHERE k='parent')||'@example.invalid');
  RAISE EXCEPTION 'Parent linked own arbitrary child';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM public.noor_unlink_guardian((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='sm'),'noor-rollback-'||(SELECT v::text FROM noor_test_ids WHERE k='parent')||'@example.invalid'); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='parent'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),'2026-01-01','2026-12-31');
  RAISE EXCEPTION 'Unlinked parent retained school access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM public.noor_link_guardian((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='sm'),'noor-rollback-'||(SELECT v::text FROM noor_test_ids WHERE k='parent')||'@example.invalid'); END $$;
RESET ROLE;

INSERT INTO public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,graded_by) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='class'),(SELECT v FROM noor_test_ids WHERE k='sm'),'Class-level practical','Lab Work','2026-11-05',50,50,(SELECT v FROM noor_test_ids WHERE k='teacher'));
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='student'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),'2026-01-01','2026-12-31');
 IF (r->'students'->0->>'total_marks')::numeric<>140 OR (r->'students'->0->>'total_max_marks')::numeric<>150 OR jsonb_array_length(r->'students'->0->'subjects')<>2 THEN RAISE EXCEPTION 'Class-level lab marks missing from section subject result'; END IF;
END $$;
RESET ROLE;
SELECT 'all original and performance/operations isolation assertions passed' verification;
ROLLBACK;
SELECT 'all performance, guardian and teacher-class assertions passed; rolled back' verification,count(*) remaining_test_users FROM auth.users WHERE email LIKE 'noor-rollback-%@example.invalid';
