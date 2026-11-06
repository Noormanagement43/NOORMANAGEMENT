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
INSERT INTO public.teacher_timetable_periods(id,institution_id,teacher_membership_id,academic_group_id,weekday,period_number,start_time,end_time,subject_name,repeats_daily,created_by)
 VALUES((SELECT v FROM noor_test_ids WHERE k='period'),(SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='tm'),(SELECT v FROM noor_test_ids WHERE k='mango'),1,1,'12:00','13:00','Mathematics',false,(SELECT v FROM noor_test_ids WHERE k='teacher')),
 ((SELECT v FROM noor_test_ids WHERE k='other_period'),(SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='tm'),(SELECT v FROM noor_test_ids WHERE k='apple'),2,1,'12:00','13:00','Science',false,(SELECT v FROM noor_test_ids WHERE k='teacher'));
INSERT INTO noor_test_results SELECT 'teacher_period_preserves_own_times',start_time='12:00' AND end_time='13:00' FROM public.teacher_timetable_periods WHERE id=(SELECT v FROM noor_test_ids WHERE k='period');
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
INSERT INTO noor_test_results SELECT 'principal_defaults_preserve_teacher_times',count(*)=2 FROM public.teacher_timetable_periods WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school') AND start_time='12:00' AND end_time='13:00';
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
-- New communications, targeted tasks, private photos and progress assertions.
INSERT INTO noor_test_ids SELECT k,gen_random_uuid() FROM unnest(ARRAY['message','staff_message','task','note','plan']) k;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.noor_school_messages(id,institution_id,kind,title,body,audience) VALUES
((SELECT v FROM noor_test_ids WHERE k='message'),(SELECT v FROM noor_test_ids WHERE k='school'),'meeting','Rollback student meeting','Synthetic message',ARRAY['student']),
((SELECT v FROM noor_test_ids WHERE k='staff_message'),(SELECT v FROM noor_test_ids WHERE k='school'),'notice','Rollback teachers notice','Synthetic message',ARRAY['teacher']);
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='teacher'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.noor_learning_items(id,institution_id,academic_group_id,recipient_membership_id,kind,status,title,body,subject_name,created_by,attachment_path) VALUES
((SELECT v FROM noor_test_ids WHERE k='task'),(SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),(SELECT v FROM noor_test_ids WHERE k='sm'),'assignment','published','Targeted task','Only this student','Maths',(SELECT v FROM noor_test_ids WHERE k='teacher'),(SELECT v::text||'/target.png' FROM noor_test_ids WHERE k='teacher')),
((SELECT v FROM noor_test_ids WHERE k='note'),(SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),NULL,'smart_note','published','Board photo','Whole class','Maths',(SELECT v FROM noor_test_ids WHERE k='teacher'),(SELECT v::text||'/board.png' FROM noor_test_ids WHERE k='teacher'));
INSERT INTO public.noor_teacher_weekly_plans(id,institution_id,academic_group_id,teacher_membership_id,title,body,subject_name,created_by,attachment_path,due_at,plan_days) VALUES
((SELECT v FROM noor_test_ids WHERE k='plan'),(SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),(SELECT v FROM noor_test_ids WHERE k='tm'),'Private weekly plan','Synthetic plan','Maths',(SELECT v FROM noor_test_ids WHERE k='teacher'),(SELECT v::text||'/plan.png' FROM noor_test_ids WHERE k='teacher'),'2026-11-09T12:00:00Z','[{"date":"2026-11-09","subject":"Maths","body":"Fractions"}]');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.noor_school_messages WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school'))<>1 THEN RAISE EXCEPTION 'Teacher audience filter failed'; END IF;
 BEGIN
 INSERT INTO public.noor_learning_items(institution_id,academic_group_id,recipient_membership_id,kind,status,title,body,subject_name,created_by) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='apple'),(SELECT v FROM noor_test_ids WHERE k='sm'),'assignment','published','Wrong section','Test','Maths',(SELECT v FROM noor_test_ids WHERE k='teacher'));
 RAISE EXCEPTION 'Wrong section recipient accepted'; EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
 UPDATE public.noor_teacher_weekly_plans SET attachment_path=(SELECT v::text||'/stolen.png' FROM noor_test_ids WHERE k='other') WHERE id=(SELECT v FROM noor_test_ids WHERE k='plan');
 RAISE EXCEPTION 'Foreign author photo accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public.noor_daily_period_lessons SET progress_status='ongoing' WHERE period_id=(SELECT v FROM noor_test_ids WHERE k='period');
 IF (SELECT completed FROM public.noor_daily_period_lessons WHERE period_id=(SELECT v FROM noor_test_ids WHERE k='period')) THEN RAISE EXCEPTION 'Ongoing state left completed=true'; END IF;
 UPDATE public.noor_daily_period_lessons SET progress_status='completed' WHERE period_id=(SELECT v FROM noor_test_ids WHERE k='period');
 IF NOT (SELECT completed FROM public.noor_daily_period_lessons WHERE period_id=(SELECT v FROM noor_test_ids WHERE k='period')) THEN RAISE EXCEPTION 'Finished state not persisted'; END IF;
END $$;
RESET ROLE;
INSERT INTO storage.objects(bucket_id,name) SELECT 'noor-learning-files',v::text||'/'||f FROM noor_test_ids CROSS JOIN unnest(ARRAY['target.png','board.png','plan.png']) f WHERE k='teacher';
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='student'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 IF (SELECT count(*) FROM public.noor_school_messages WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school'))<>1 THEN RAISE EXCEPTION 'Student audience filter failed'; END IF;
 IF (SELECT count(*) FROM public.noor_learning_items WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school'))<>2 THEN RAISE EXCEPTION 'Target student cannot read own assignment and class note'; END IF;
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='noor-learning-files' AND name LIKE (SELECT v::text||'/%' FROM noor_test_ids WHERE k='teacher'))<>2 THEN RAISE EXCEPTION 'Target student photo scope failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.noor_teacher_weekly_plans WHERE id=(SELECT v FROM noor_test_ids WHERE k='plan')) THEN RAISE EXCEPTION 'Student saw private teacher plan'; END IF;
 r:=public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='mango'),'2026-01-01','2026-12-31');
 IF (r->>'class_average')::numeric<>85 OR jsonb_array_length(r->'students')<>1 THEN RAISE EXCEPTION 'Own result/cohort average incorrect'; END IF;
 BEGIN
 PERFORM public.noor_class_performance((SELECT v FROM noor_test_ids WHERE k='school'),(SELECT v FROM noor_test_ids WHERE k='class'),'2026-01-01','2026-12-31');
 RAISE EXCEPTION 'Student parent-class access accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 INSERT INTO public.noor_school_messages(institution_id,kind,title,body,audience) VALUES((SELECT v FROM noor_test_ids WHERE k='school'),'notice','Unauthorized','Not allowed',ARRAY['all']);
 RAISE EXCEPTION 'Student broadcast accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO public.noor_message_reads(message_id,institution_id,membership_id) SELECT msg.v,s.v,m.v FROM noor_test_ids msg,noor_test_ids s,noor_test_ids m WHERE msg.k='message' AND s.k='school' AND m.k='sm';
DO $$ BEGIN
 BEGIN
 INSERT INTO public.noor_message_reads(message_id,institution_id,membership_id) SELECT msg.v,s.v,m.v FROM noor_test_ids msg,noor_test_ids s,noor_test_ids m WHERE msg.k='message' AND s.k='school' AND m.k='tm';
 RAISE EXCEPTION 'Student marked teacher messages read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='student2'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.noor_learning_items WHERE id=(SELECT v FROM noor_test_ids WHERE k='task')) THEN RAISE EXCEPTION 'Classmate read targeted task'; END IF;
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='noor-learning-files' AND name LIKE (SELECT v::text||'/%' FROM noor_test_ids WHERE k='teacher'))<>1 THEN RAISE EXCEPTION 'Classmate private photo leak'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_test_ids WHERE k='other'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.noor_school_messages WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school')) THEN RAISE EXCEPTION 'Cross-school messages visible'; END IF;
 IF EXISTS(SELECT 1 FROM public.noor_learning_items WHERE institution_id=(SELECT v FROM noor_test_ids WHERE k='school')) THEN RAISE EXCEPTION 'Cross-school notes visible'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='noor-learning-files' AND name LIKE (SELECT v::text||'/%' FROM noor_test_ids WHERE k='teacher')) THEN RAISE EXCEPTION 'Cross-school photo leak'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM noor_test_results WHERE NOT passed) THEN RAISE EXCEPTION 'Base assertions failed'; END IF; END $$;
ROLLBACK;
SELECT 'communications, targeted tasks, photos, progress and class isolation assertions passed' verification,count(*) remaining_test_users FROM auth.users WHERE email LIKE 'noor-rollback-%@example.invalid';
