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

-- Additional rollback checks for editable codes, management admission, search and labs.
INSERT INTO noor_test_ids SELECT k,gen_random_uuid() FROM unnest(ARRAY['join_teacher','join_manager','wrong_user']) k;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
 SELECT v,'noor-rollback-'||v::text||'@example.invalid','{"full_name":"Rollback verification"}'::jsonb,'{}'::jsonb FROM noor_test_ids WHERE k IN ('join_teacher','join_manager','wrong_user');
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.noor_save_join_codes((SELECT v FROM noor_test_ids WHERE k='school'),'TestStudent_2026','TestTeacher_2026','TestManager_2026');
 IF (SELECT count(*) FROM public.noor_join_code_status((SELECT v FROM noor_test_ids WHERE k='school')))<>3 THEN RAISE EXCEPTION 'All three code statuses not saved'; END IF;
 BEGIN
  PERFORM public.noor_save_join_codes((SELECT v FROM noor_test_ids WHERE k='school'),'SameCode_2026','SameCode_2026',NULL);
  RAISE EXCEPTION 'Duplicate role codes allowed';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 PERFORM public.noor_save_join_codes((SELECT v FROM noor_test_ids WHERE k='school'),NULL,'ReplacementStaff_2026',NULL);
 INSERT INTO noor_test_results VALUES('leadership_saves_three_separate_hashed_codes',true);
END $$;
INSERT INTO public.institution_labs(institution_id,name,description) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),'Science Lab','Create custom practical work');
INSERT INTO public.academic_groups(institution_id,name,group_type,education_path) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),'CS','class','university');
RESET ROLE;
-- No plaintext code exists in the private code table and the replaced code is invalid.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.noor_join_codes WHERE code_hash IN ('TestStudent_2026','TestTeacher_2026','TestManager_2026')) THEN RAISE EXCEPTION 'Plaintext joining code stored'; END IF;
 IF EXISTS(SELECT 1 FROM private.noor_join_codes WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school') AND code_hash=encode(sha256(convert_to('TestTeacher_2026','UTF8')),'hex')) THEN RAISE EXCEPTION 'Replaced staff code still stored'; END IF;
 INSERT INTO noor_test_results VALUES('hash_only_storage_and_old_code_invalidated',true);
END $$;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='teacher'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.noor_save_join_codes((SELECT v FROM noor_test_ids WHERE k='school'),NULL,NULL,'Escalation_2026');
  RAISE EXCEPTION 'Teacher could create management code';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.noor_rotate_join_code((SELECT v FROM noor_test_ids WHERE k='school'),'school_admin');
  RAISE EXCEPTION 'Generic rotation accepted management role';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO noor_test_results VALUES('teacher_cannot_create_management_codes',true);
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='wrong_user'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.noor_join_selected_institution((SELECT v FROM noor_test_ids WHERE k='school'),'TestManager_2026','teacher');
  RAISE EXCEPTION 'Management code admitted a teacher request';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM public.noor_join_selected_institution((SELECT v FROM noor_test_ids WHERE k='other_school'),'ReplacementStaff_2026','teacher');
  RAISE EXCEPTION 'Wrong school accepted code';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM public.noor_join_selected_institution((SELECT v FROM noor_test_ids WHERE k='school'),'TestTeacher_2026','teacher');
  RAISE EXCEPTION 'Replaced code accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 INSERT INTO noor_test_results VALUES('role_school_and_old_code_mismatches_rejected',true);
END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.institution_memberships WHERE user_id=(SELECT v FROM noor_test_ids WHERE k='wrong_user')) THEN RAISE EXCEPTION 'Rejected join left a membership'; END IF; END $$;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='join_teacher'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM public.noor_join_selected_institution((SELECT v FROM noor_test_ids WHERE k='school'),'ReplacementStaff_2026','teacher'); END $$;
INSERT INTO noor_test_results SELECT 'staff_code_assigns_teacher_role',role='teacher' AND status='active' FROM public.institution_memberships WHERE user_id=(SELECT v FROM noor_test_ids WHERE k='join_teacher');
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='join_manager'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM public.noor_join_selected_institution((SELECT v FROM noor_test_ids WHERE k='school'),'TestManager_2026','manager'); END $$;
INSERT INTO noor_test_results SELECT 'management_code_assigns_school_admin_role',role='school_admin' AND status='active' FROM public.institution_memberships WHERE user_id=(SELECT v FROM noor_test_ids WHERE k='join_manager');
RESET ROLE;
INSERT INTO public.institution_labs(institution_id,name) VALUES((SELECT v FROM noor_test_ids WHERE k='other_school'),'Other Lab');
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='student'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO noor_test_results SELECT 'labs_are_tenant_isolated',count(*)=1 FROM public.institution_labs;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.institution_labs(institution_id,name) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),'Student Lab');
  RAISE EXCEPTION 'Student can create labs';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO noor_test_results VALUES('student_cannot_write_labs',true); END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.noor_find_institutions('Rollback School school'))<>1 THEN RAISE EXCEPTION 'Anonymous school-name suggestion failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.noor_find_institutions('Ro')) THEN RAISE EXCEPTION 'Short search not bounded'; END IF;
 BEGIN
  PERFORM public.noor_save_join_codes(NULL,NULL,NULL,NULL);
  RAISE EXCEPTION 'Anonymous can save codes';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO noor_test_results VALUES('public_name_only_search_and_anonymous_write_denial',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM noor_test_results WHERE NOT passed) THEN RAISE EXCEPTION 'Database verification failed';END IF;END $$;
SELECT count(*) AS checks_passed, bool_and(passed) AS all_passed FROM noor_test_results;
ROLLBACK;
SELECT 'all database assertions passed and rolled back' AS verification,count(*) AS remaining_test_users FROM auth.users WHERE email LIKE 'noor-rollback-%@example.invalid';
