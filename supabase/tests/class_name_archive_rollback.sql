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

SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.academic_groups(institution_id,name,group_type,education_path) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),'class01','class','school');
  RAISE EXCEPTION 'Duplicate class number accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.academic_groups(institution_id,name,group_type,parent_group_id) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),'mango','section',(SELECT v FROM noor_test_ids WHERE k='class'));
  RAISE EXCEPTION 'Duplicate section name accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 UPDATE public.academic_groups SET is_active=false WHERE id=(SELECT v FROM noor_test_ids WHERE k='class');
 IF (SELECT count(*) FROM public.teacher_timetable_periods WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school'))<>2 THEN RAISE EXCEPTION 'Archiving class removed linked timetable'; END IF;
 IF (SELECT count(*) FROM public.academic_groups WHERE parent_group_id=(SELECT v FROM noor_test_ids WHERE k='class'))<>2 THEN RAISE EXCEPTION 'Archiving class removed sections'; END IF;
 UPDATE public.academic_groups SET is_active=true WHERE id=(SELECT v FROM noor_test_ids WHERE k='class');
END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM noor_test_results WHERE NOT passed) THEN RAISE EXCEPTION 'Database verification failed';END IF;END $$;
SELECT 'duplicate class/section rejection and reversible archival assertions passed' verification;
ROLLBACK;
SELECT count(*) remaining_test_users FROM auth.users WHERE email LIKE 'noor-rollback-%@example.invalid';
