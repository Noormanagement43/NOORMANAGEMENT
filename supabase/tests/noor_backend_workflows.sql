-- Transaction-only integration test. Caller wraps in BEGIN/ROLLBACK.
-- Uses synthetic accounts directly in SQL; no messages, invitations or auth emails.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('41000000-0000-4000-8000-000000000001','noor-principal@example.invalid','{"full_name":"Test Principal"}'),
 ('41000000-0000-4000-8000-000000000002','noor-teacher@example.invalid','{"full_name":"Test Teacher"}'),
 ('41000000-0000-4000-8000-000000000003','noor-student@example.invalid','{"full_name":"Test Student"}'),
 ('41000000-0000-4000-8000-000000000004','noor-other@example.invalid','{"full_name":"Test Other School"}'),
 ('41000000-0000-4000-8000-000000000005','noor-unassigned@example.invalid','{"full_name":"Test Unassigned Teacher"}'),
 ('41000000-0000-4000-8000-000000000006','noor-joiner@example.invalid','{"full_name":"Test Joiner"}');
INSERT INTO public.institutions(id,name,slug,institution_type,status,created_by) VALUES
 ('42000000-0000-4000-8000-000000000001','Test School A','noor-backend-test-a','school','active','41000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000000002','Test School B','noor-backend-test-b','school','active','41000000-0000-4000-8000-000000000004');
INSERT INTO public.institution_memberships(id,institution_id,user_id,role,status) VALUES
 ('43000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','principal','active'),
 ('43000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','teacher','active'),
 ('43000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000003','student','active'),
 ('43000000-0000-4000-8000-000000000004','42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000004','principal','active'),
 ('43000000-0000-4000-8000-000000000005','42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000005','teacher','active');
INSERT INTO public.academic_groups(id,institution_id,name,group_type) VALUES
 ('44000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','Class A','class'),
 ('44000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','Class B','class');
INSERT INTO public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status) VALUES
 ('42000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000002','teacher','active'),
 ('42000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000003','student','active');
INSERT INTO public.class_sessions(id,institution_id,academic_group_id,teacher_membership_id,title,starts_at,ends_at,created_by) VALUES
 ('46000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000002','Test Maths',now(),now()+interval '1 hour','41000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);
INSERT INTO public.noor_learning_items(id,institution_id,academic_group_id,kind,title,subject_name,created_by) VALUES
 ('45000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','assignment','Math exercise','Maths','41000000-0000-4000-8000-000000000002');
DO $$ BEGIN
 BEGIN
  INSERT INTO public.noor_learning_items(institution_id,academic_group_id,kind,title,subject_name,created_by)
  VALUES('42000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002','assignment','Attack','Maths',auth.uid());
  RAISE EXCEPTION 'FAIL cross-tenant teacher write succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.noor_learning_items) THEN RAISE EXCEPTION 'FAIL student saw draft'; END IF;
 BEGIN PERFORM public.noor_register_connection('42000000-0000-4000-8000-000000000001','gmail','Attack');
 RAISE EXCEPTION 'FAIL student registered connector'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000005',true);
DO $$ BEGIN
 BEGIN
  INSERT INTO public.noor_learning_items(institution_id,academic_group_id,kind,title,subject_name,created_by)
  VALUES('42000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','assignment','Attack','Maths',auth.uid());
  RAISE EXCEPTION 'FAIL unassigned teacher write succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);
UPDATE public.noor_learning_items SET status='published' WHERE id='45000000-0000-4000-8000-000000000001';
INSERT INTO public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,graded_by)
VALUES('42000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000003','Test','Maths',current_date,18,20,auth.uid());
SELECT public.noor_submit_attendance('46000000-0000-4000-8000-000000000001','[{"student_membership_id":"43000000-0000-4000-8000-000000000003","status":"present"}]');
DO $$ BEGIN
 BEGIN PERFORM public.noor_submit_attendance('46000000-0000-4000-8000-000000000001','[{"student_membership_id":"43000000-0000-4000-8000-000000000003","status":"absent"},{"student_membership_id":"43000000-0000-4000-8000-000000000004","status":"present"}]');
 RAISE EXCEPTION 'FAIL mixed-tenant attendance accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT attendance_status FROM public.attendance_records WHERE session_id='46000000-0000-4000-8000-000000000001')<>'present' THEN RAISE EXCEPTION 'FAIL attendance was not atomic'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
INSERT INTO public.noor_assignment_submissions(institution_id,learning_item_id,student_membership_id,answer)
VALUES('42000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000003','Student answer');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.noor_assessment_results)<>1 THEN RAISE EXCEPTION 'FAIL student cannot read own grade'; END IF;
 IF (SELECT count(*) FROM public.noor_learning_items)<>1 THEN RAISE EXCEPTION 'FAIL published assignment not visible'; END IF;
 UPDATE public.noor_assessment_results SET marks=20;
 IF FOUND THEN RAISE EXCEPTION 'FAIL student modified grade'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.noor_learning_items) OR EXISTS(SELECT 1 FROM public.noor_assessment_results) OR EXISTS(SELECT 1 FROM public.noor_assignment_submissions) THEN RAISE EXCEPTION 'FAIL other institution saw data'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE c uuid; j uuid; j2 uuid; first_code text; new_code text;
BEGIN
 c:=public.noor_register_connection('42000000-0000-4000-8000-000000000001','gemini','Gemini');
 j:=public.noor_draft_workflow('42000000-0000-4000-8000-000000000001',c,'ai.generate','{"prompt":"Draft a lesson"}','test-idempotency-1');
 j2:=public.noor_draft_workflow('42000000-0000-4000-8000-000000000001',c,'ai.generate','{"prompt":"Draft a lesson"}','test-idempotency-1');
 IF j<>j2 THEN RAISE EXCEPTION 'FAIL idempotency duplicate'; END IF;
 BEGIN PERFORM public.noor_draft_workflow('42000000-0000-4000-8000-000000000001',c,'ai.generate','{"prompt":"Different"}','test-idempotency-1');
 RAISE EXCEPTION 'FAIL idempotency conflict accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.noor_workflow_jobs WHERE state<>'draft') THEN RAISE EXCEPTION 'FAIL job auto executed'; END IF;
 BEGIN UPDATE public.noor_workflow_jobs SET state='cancelled'; RAISE EXCEPTION 'FAIL direct state change'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_table_privilege('authenticated','public.noor_audit_events','DELETE') THEN RAISE EXCEPTION 'FAIL audit deletion privilege'; END IF;
 first_code:=public.noor_rotate_join_code('42000000-0000-4000-8000-000000000001','student');
 new_code:=public.noor_rotate_join_code('42000000-0000-4000-8000-000000000001','student');
 PERFORM set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000006',true);
 BEGIN PERFORM public.noor_join_institution('42000000-0000-4000-8000-000000000001',first_code);
 RAISE EXCEPTION 'FAIL rotated code accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.noor_join_institution('42000000-0000-4000-8000-000000000001',new_code);
 IF NOT EXISTS(SELECT 1 FROM public.institution_memberships WHERE user_id=auth.uid() AND role='student' AND status='active') THEN RAISE EXCEPTION 'FAIL join missing'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
SELECT public.noor_set_member_status('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000003','suspended');
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.noor_learning_items) OR EXISTS(SELECT 1 FROM public.noor_assessment_results) THEN RAISE EXCEPTION 'FAIL suspended student sees learning data'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
SELECT public.noor_set_member_status('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000003','active');
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.noor_assessment_results)<>1 THEN RAISE EXCEPTION 'FAIL reactivated student missing grade'; END IF;
END $$;
RESET ROLE;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('41000000-0000-4000-8000-000000000007','noor-onboarding@example.invalid','{"full_name":"Test New Principal"}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000007',true);
DO $$ DECLARE result jsonb; new_id uuid;
BEGIN
 result:=public.register_institution_for_current_user('Test New University','noor-backend-test-new','university');
 new_id:=(result->>'institution_id')::uuid;
 IF NOT private.has_institution_role(new_id,ARRAY['principal']) THEN RAISE EXCEPTION 'FAIL immediate principal onboarding'; END IF;
 INSERT INTO public.academic_groups(institution_id,name,group_type) VALUES(new_id,'First Year','class');
 BEGIN PERFORM public.register_institution_for_current_user('Duplicate','noor-backend-test-duplicate','school');
 RAISE EXCEPTION 'FAIL duplicate active onboarding'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: tenant isolation, assigned teacher scope, student grade protection, atomic attendance, pause/reactivate, joining-code rotation, audit immutability, task idempotency and immediate onboarding' AS backend_test_result;
