BEGIN;
CREATE TEMP TABLE noor_flow_ids(k text PRIMARY KEY,v uuid NOT NULL);
INSERT INTO noor_flow_ids SELECT k,gen_random_uuid() FROM unnest(ARRAY['principal','teacher','student','parent','other','school','other_school','class','mango','apple','otherclass','period','period2','pm','parentm','om']) k;
CREATE TEMP TABLE noor_flow_checks(name text,ok boolean);
GRANT SELECT ON noor_flow_ids TO authenticated,anon;
GRANT SELECT,INSERT ON noor_flow_checks TO authenticated,anon;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) SELECT v,'noor-flow-'||v||'@example.invalid',now(),'{"full_name":"Flow verification"}','{}' FROM noor_flow_ids WHERE k IN('principal','teacher','student','parent','other');
INSERT INTO public.institutions(id,name,slug,institution_type,country_code,timezone,default_language,status,created_by)
SELECT v,'Flow School '||k,'flow-'||v,'school','IN','Asia/Kolkata','en','active',(SELECT v FROM noor_flow_ids WHERE k='principal') FROM noor_flow_ids WHERE k IN('school','other_school');
INSERT INTO public.institution_memberships(id,institution_id,user_id,role,status,joined_at)
SELECT m.v,s.v,u.v,r.role,'active',now() FROM (VALUES('pm','school','principal','principal'),('parentm','school','parent','parent'),('om','other_school','other','principal'))r(m,s,u,role) JOIN noor_flow_ids m ON m.k=r.m JOIN noor_flow_ids s ON s.k=r.s JOIN noor_flow_ids u ON u.k=r.u;
INSERT INTO public.academic_groups(id,institution_id,name,group_type,parent_group_id,is_active)
SELECT g.v,s.v,r.name,r.kind,p.v,true FROM(VALUES('class','school','Class 1','class',NULL),('mango','school','Mango','section','class'),('apple','school','Apple','section','class'),('otherclass','other_school','Class 1','class',NULL))r(g,s,name,kind,parent) JOIN noor_flow_ids g ON g.k=r.g JOIN noor_flow_ids s ON s.k=r.s LEFT JOIN noor_flow_ids p ON p.k=r.parent;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_flow_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.noor_save_join_codes((SELECT v FROM noor_flow_ids WHERE k='school'),'FlowStudent_20261106','FlowTeacher_20261106',NULL);
INSERT INTO noor_flow_checks SELECT 'repeat_save_idempotent',(public.noor_save_join_codes((SELECT v FROM noor_flow_ids WHERE k='school'),'FlowStudent_20261106','FlowTeacher_20261106',NULL)->>'count')::int=0;
INSERT INTO noor_flow_checks SELECT 'saved_codes_have_no_automatic_expiry',bool_and(expires_at='infinity'::timestamptz) FROM public.noor_join_code_status((SELECT v FROM noor_flow_ids WHERE k='school'));
INSERT INTO public.institution_period_slots(institution_id,period_number,start_time,end_time)VALUES((SELECT v FROM noor_flow_ids WHERE k='school'),1,'08:00','08:45');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
INSERT INTO noor_flow_checks SELECT 'signup_choices_are_selected_school_only',count(*)=3 AND bool_and(institution_id=(SELECT v FROM noor_flow_ids WHERE k='school')) FROM public.noor_signup_groups((SELECT v FROM noor_flow_ids WHERE k='school'),0);
DO $$ BEGIN BEGIN PERFORM code_hash FROM private.noor_join_codes;RAISE EXCEPTION 'Anonymous read join hashes';EXCEPTION WHEN insufficient_privilege THEN NULL;END; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_flow_ids WHERE k='teacher'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM public.noor_join_selected_institution((SELECT v FROM noor_flow_ids WHERE k='school'),'WrongCode_123','teacher');RAISE EXCEPTION 'Invalid code accepted';EXCEPTION WHEN SQLSTATE '22023' THEN NULL;END; END $$;
SELECT public.noor_join_selected_institution((SELECT v FROM noor_flow_ids WHERE k='school'),'FlowTeacher_20261106','teacher');
SELECT public.noor_select_teacher_section((SELECT v FROM noor_flow_ids WHERE k='school'),(SELECT v FROM noor_flow_ids WHERE k='class'),(SELECT v FROM noor_flow_ids WHERE k='mango'));
INSERT INTO noor_flow_checks SELECT 'teacher_has_section_only_access',count(*)=1 AND bool_and(group_id=(SELECT v FROM noor_flow_ids WHERE k='mango')) FROM public.academic_group_memberships WHERE membership_id IN(SELECT id FROM public.institution_memberships WHERE user_id=auth.uid());
DO $$ BEGIN BEGIN PERFORM public.noor_select_teacher_section((SELECT v FROM noor_flow_ids WHERE k='school'),(SELECT v FROM noor_flow_ids WHERE k='class'),(SELECT v FROM noor_flow_ids WHERE k='apple'));RAISE EXCEPTION 'Teacher changed initial access';EXCEPTION WHEN insufficient_privilege THEN NULL;END; END $$;
INSERT INTO public.teacher_timetable_periods(id,institution_id,teacher_membership_id,academic_group_id,weekday,period_number,start_time,end_time,subject_name,created_by)
SELECT p.v,s.v,m.id,g.v,1,1,'09:00','09:45','English',auth.uid() FROM noor_flow_ids p,noor_flow_ids s,noor_flow_ids g,public.institution_memberships m WHERE p.k='period' AND s.k='school' AND g.k='mango' AND m.user_id=auth.uid();
UPDATE public.teacher_timetable_periods SET start_time='10:00',end_time='10:45' WHERE id=(SELECT v FROM noor_flow_ids WHERE k='period');
INSERT INTO noor_flow_checks SELECT 'teacher_owns_editable_times',start_time='10:00' AND end_time='10:45' FROM public.teacher_timetable_periods WHERE id=(SELECT v FROM noor_flow_ids WHERE k='period');
DO $$ BEGIN BEGIN
 INSERT INTO public.teacher_timetable_periods(institution_id,teacher_membership_id,academic_group_id,weekday,period_number,start_time,end_time,subject_name,created_by)
 SELECT institution_id,teacher_membership_id,academic_group_id,weekday,2,'10:30','11:00','Maths',created_by FROM public.teacher_timetable_periods WHERE id=(SELECT v FROM noor_flow_ids WHERE k='period');RAISE EXCEPTION 'Teacher overlap accepted';EXCEPTION WHEN check_violation THEN NULL;END; END $$;
INSERT INTO public.teacher_timetable_periods(id,institution_id,teacher_membership_id,academic_group_id,weekday,period_number,start_time,end_time,subject_name,created_by)
SELECT p.v,s.v,m.id,g.v,1,2,'11:00','11:45','Maths',auth.uid() FROM noor_flow_ids p,noor_flow_ids s,noor_flow_ids g,public.institution_memberships m WHERE p.k='period2' AND s.k='school' AND g.k='apple' AND m.user_id=auth.uid();
INSERT INTO public.noor_daily_period_lessons(period_id,institution_id,lesson_date,lesson,topic,completed) VALUES((SELECT v FROM noor_flow_ids WHERE k='period'),(SELECT v FROM noor_flow_ids WHERE k='school'),'2026-11-06','Chapter 1','Verbs',true);
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_flow_ids WHERE k='student'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.noor_join_selected_institution((SELECT v FROM noor_flow_ids WHERE k='school'),'FlowStudent_20261106','student');
SELECT public.noor_select_student_section((SELECT v FROM noor_flow_ids WHERE k='school'),(SELECT v FROM noor_flow_ids WHERE k='class'),(SELECT v FROM noor_flow_ids WHERE k='mango'));
INSERT INTO noor_flow_checks SELECT 'student_reads_own_section_period_only',count(*)=1 FROM public.teacher_timetable_periods WHERE institution_id=(SELECT v FROM noor_flow_ids WHERE k='school');
INSERT INTO noor_flow_checks SELECT 'student_reads_saved_daily_topic',count(*)=1 FROM public.noor_daily_period_lessons WHERE topic='Verbs' AND period_id=(SELECT v FROM noor_flow_ids WHERE k='period');
RESET ROLE;
INSERT INTO public.noor_guardian_links(institution_id,guardian_membership_id,student_membership_id,created_by)
SELECT s.v,p.v,m.id,u.v FROM noor_flow_ids s,noor_flow_ids p,noor_flow_ids u,public.institution_memberships m WHERE s.k='school' AND p.k='parentm' AND u.k='principal' AND m.user_id=(SELECT v FROM noor_flow_ids WHERE k='student');
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_flow_ids WHERE k='parent'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO noor_flow_checks SELECT 'linked_parent_reads_only_child_section_period',count(*)=1 FROM public.teacher_timetable_periods WHERE institution_id=(SELECT v FROM noor_flow_ids WHERE k='school');
INSERT INTO noor_flow_checks SELECT 'linked_parent_reads_daily_topic',count(*)=1 FROM public.noor_daily_period_lessons WHERE topic='Verbs' AND period_id=(SELECT v FROM noor_flow_ids WHERE k='period');
DO $$ BEGIN BEGIN UPDATE public.teacher_timetable_periods SET subject_name='Unauthorized' WHERE id=(SELECT v FROM noor_flow_ids WHERE k='period');IF FOUND THEN RAISE EXCEPTION 'Parent edited timetable';END IF;EXCEPTION WHEN insufficient_privilege THEN NULL;END; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_flow_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
UPDATE public.institution_period_slots SET start_time='08:30',end_time='09:15' WHERE institution_id=(SELECT v FROM noor_flow_ids WHERE k='school') AND period_number=1;
INSERT INTO noor_flow_checks SELECT 'principal_default_does_not_overwrite_teacher_time',start_time='10:00' AND end_time='10:45' FROM public.teacher_timetable_periods WHERE id=(SELECT v FROM noor_flow_ids WHERE k='period');
SELECT public.noor_save_join_codes((SELECT v FROM noor_flow_ids WHERE k='school'),'FlowStudentNew_20261106',NULL,NULL);
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_flow_ids WHERE k='other'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO noor_flow_checks SELECT 'other_school_cannot_read_teacher_period',count(*)=0 FROM public.teacher_timetable_periods WHERE institution_id=(SELECT v FROM noor_flow_ids WHERE k='school');
DO $$ BEGIN BEGIN PERFORM public.noor_save_join_codes((SELECT v FROM noor_flow_ids WHERE k='school'),'InvalidChange_123',NULL,NULL);RAISE EXCEPTION 'Other principal changed codes';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN PERFORM public.noor_join_selected_institution((SELECT v FROM noor_flow_ids WHERE k='school'),'FlowStudent_20261106','student');RAISE EXCEPTION 'Replaced code remains active';EXCEPTION WHEN SQLSTATE '22023' THEN NULL;END;END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM noor_flow_checks WHERE NOT ok) OR(SELECT count(*) FROM noor_flow_checks)<10 THEN RAISE EXCEPTION 'Flow assertions failed';END IF;END $$;
SELECT count(*) passed_checks FROM noor_flow_checks WHERE ok;
ROLLBACK;
SELECT count(*) remaining_flow_test_users FROM auth.users WHERE email LIKE 'noor-flow-%@example.invalid';
