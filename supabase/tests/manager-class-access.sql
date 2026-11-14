-- Isolated fixture exercise. No test accounts, grades or attendance survive rollback.
begin;
insert into auth.users(id,email) values
 ('f7000000-0000-4000-8000-000000000001','manager-one@example.invalid'),
 ('f7000000-0000-4000-8000-000000000002','manager-two@example.invalid'),
 ('f7000000-0000-4000-8000-000000000003','manager-principal@example.invalid'),
 ('f7000000-0000-4000-8000-000000000004','manager-student@example.invalid'),
 ('f7000000-0000-4000-8000-000000000005','manager-outsider@example.invalid'),
 ('f7000000-0000-4000-8000-000000000006','manager-teacher@example.invalid');
insert into public.profiles(id,full_name) values
 ('f7000000-0000-4000-8000-000000000001','Manager One'),('f7000000-0000-4000-8000-000000000002','Manager Two'),
 ('f7000000-0000-4000-8000-000000000003','Principal'),('f7000000-0000-4000-8000-000000000004','Student'),
 ('f7000000-0000-4000-8000-000000000005','Other School Manager'),('f7000000-0000-4000-8000-000000000006','Teacher') on conflict(id) do update set full_name=excluded.full_name;
insert into public.institutions(id,name,slug,institution_type,status) values
 ('f7100000-0000-4000-8000-000000000001','Manager Test School','manager-test-school','school','active'),
 ('f7100000-0000-4000-8000-000000000002','Other Manager School','manager-test-other','school','active');
insert into public.institution_memberships(id,institution_id,user_id,role,status) values
 ('f7200000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001','school_admin','active'),
 ('f7200000-0000-4000-8000-000000000002','f7100000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000002','school_admin','active'),
 ('f7200000-0000-4000-8000-000000000003','f7100000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000003','principal','active'),
 ('f7200000-0000-4000-8000-000000000004','f7100000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000004','student','active'),
 ('f7200000-0000-4000-8000-000000000005','f7100000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000005','school_admin','active'),
 ('f7200000-0000-4000-8000-000000000006','f7100000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000006','teacher','active');
insert into public.academic_groups(id,institution_id,name,group_type) values
 ('f7300000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','Class 5','class'),
 ('f7300000-0000-4000-8000-000000000002','f7100000-0000-4000-8000-000000000002','Class 6','class');
insert into public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status) values
 ('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000004','student','active');
set local role authenticated;
set local request.jwt.claim.sub='f7000000-0000-4000-8000-000000000001';
select public.noor_save_class_register('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',current_date,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","status":"present"}]');
select public.noor_manager_save_marks('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',current_date,'Math','Monthly test','monthly',100,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","marks":65}]');
set local request.jwt.claim.sub='f7000000-0000-4000-8000-000000000002';
-- A different manager can correct the first manager's register and marks.
select public.noor_save_class_register('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',current_date,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","status":"late"}]');
select public.noor_manager_save_marks('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',current_date,'Math','Monthly test','monthly',100,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","marks":75,"feedback":"Corrected"}]');
do $$ begin
 assert (select count(*)=1 and max(marks)=75 from public.noor_assessment_results where institution_id='f7100000-0000-4000-8000-000000000001'),'Marks duplicated instead of updating';
 assert (select graded_by='f7000000-0000-4000-8000-000000000001' from public.noor_assessment_results where institution_id='f7100000-0000-4000-8000-000000000001'),'Original author changed';
 assert (select count(*)=2 from public.noor_manager_activity where institution_id='f7100000-0000-4000-8000-000000000001'),'Manager can see another manager activity';
 begin update public.noor_manager_activity set actor_name='Forged';raise exception 'Audit was editable';exception when insufficient_privilege then null;end;
 begin perform public.noor_manager_save_marks('f7100000-0000-4000-8000-000000000002','f7300000-0000-4000-8000-000000000002',current_date,'Math','Test','monthly',100,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","marks":75}]');raise exception 'Cross-school write allowed';exception when insufficient_privilege then null;end;
end $$;
do $$ begin
 begin perform public.noor_manager_save_marks('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',current_date,'Math','Monthly test','monthly',100,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","marks":99},{"student_membership_id":"f7200000-0000-4000-8000-000000000005","marks":88}]');raise exception 'Unenrolled student was accepted';exception when insufficient_privilege then null;end;
 assert (select marks=75 from public.noor_assessment_results where institution_id='f7100000-0000-4000-8000-000000000001'),'Failed batch partially changed marks';
end $$;
set local request.jwt.claim.sub='f7000000-0000-4000-8000-000000000003';
do $$ declare j jsonb;begin
 j:=public.noor_manager_overview('f7100000-0000-4000-8000-000000000001');
 assert (j->>'manager_count')::int=2,'Multiple managers not visible';
 assert jsonb_array_length(j->'activities')=4,'Principal missing manager changes';
 assert (select before_data->>'marks'='65.00' and after_data->>'marks'='75.00' from public.noor_manager_activity where entity_table='noor_assessment_results' and action='UPDATE' and institution_id='f7100000-0000-4000-8000-000000000001'),'Before/after marks missing';
 assert (select before_data->>'attendance_status'='present' and after_data->>'attendance_status'='late' from public.noor_manager_activity where entity_table='attendance_records' and action='UPDATE' and institution_id='f7100000-0000-4000-8000-000000000001'),'Attendance correction missing';
end $$;
set local request.jwt.claim.sub='f7000000-0000-4000-8000-000000000004';
do $$ begin
 begin perform public.noor_manager_overview('f7100000-0000-4000-8000-000000000001');raise exception 'Student opened manager history';exception when insufficient_privilege then null;end;
 begin perform public.noor_save_class_register('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',current_date,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","status":"absent"}]');raise exception 'Student wrote attendance';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='f7000000-0000-4000-8000-000000000006';
do $$ begin
 begin perform public.noor_save_class_register('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',current_date,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","status":"absent"}]');raise exception 'Unassigned teacher wrote attendance';exception when insufficient_privilege then null;end;
 begin perform public.noor_manager_save_marks('f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',current_date,'Math','Monthly test','monthly',100,'[{"student_membership_id":"f7200000-0000-4000-8000-000000000004","marks":99}]');raise exception 'Teacher used manager mark writer';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='f7000000-0000-4000-8000-000000000005';
do $$ begin assert (select count(*)=0 from public.noor_manager_activity where institution_id='f7100000-0000-4000-8000-000000000001'),'Other-school audit leaked';end $$;
reset role;
update public.institution_memberships set status='suspended' where id='f7200000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='f7000000-0000-4000-8000-000000000002';
do $$ begin
 begin perform public.noor_manager_overview('f7100000-0000-4000-8000-000000000001');raise exception 'Suspended manager retained access';exception when insufficient_privilege then null;end;
end $$;
rollback;
