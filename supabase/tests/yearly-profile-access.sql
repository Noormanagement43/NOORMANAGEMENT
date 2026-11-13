-- Isolated transactional integration test. Every fixture and simulated change is rolled back.
begin;
insert into auth.users(id,email) values
 ('fe000000-0000-4000-8000-000000000001','year-principal@example.invalid'),
 ('fe000000-0000-4000-8000-000000000002','year-student@example.invalid'),
 ('fe000000-0000-4000-8000-000000000003','year-teacher@example.invalid'),
 ('fe000000-0000-4000-8000-000000000004','year-outsider@example.invalid');
insert into public.profiles(id,full_name) values
 ('fe000000-0000-4000-8000-000000000001','Year Principal'),('fe000000-0000-4000-8000-000000000002','Year Student'),('fe000000-0000-4000-8000-000000000003','Year Teacher'),('fe000000-0000-4000-8000-000000000004','Year Outsider') on conflict(id) do nothing;
insert into public.institutions(id,name,slug,institution_type,status) values
 ('fe100000-0000-4000-8000-000000000001','Year Test School','year-test-school','school','active'),
 ('fe100000-0000-4000-8000-000000000002','Other Test School','year-test-other-school','school','active');
insert into public.institution_memberships(id,institution_id,user_id,role,status) values
 ('fe200000-0000-4000-8000-000000000001','fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001','principal','active'),
 ('fe200000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000002','student','active'),
 ('fe200000-0000-4000-8000-000000000003','fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000003','teacher','active'),
 ('fe200000-0000-4000-8000-000000000004','fe100000-0000-4000-8000-000000000002','fe000000-0000-4000-8000-000000000004','student','active');
insert into public.academic_groups(id,institution_id,name,group_type) values
 ('fe300000-0000-4000-8000-000000000004','fe100000-0000-4000-8000-000000000001','Class 4','class'),
 ('fe300000-0000-4000-8000-000000000005','fe100000-0000-4000-8000-000000000001','Class 5','class'),
 ('fe300000-0000-4000-8000-000000000006','fe100000-0000-4000-8000-000000000002','Other Class','class');
insert into public.academic_groups(id,institution_id,name,group_type,parent_group_id,homeroom_teacher_membership_id) values
 ('fe400000-0000-4000-8000-000000000004','fe100000-0000-4000-8000-000000000001','A','section','fe300000-0000-4000-8000-000000000004','fe200000-0000-4000-8000-000000000003'),
 ('fe400000-0000-4000-8000-000000000005','fe100000-0000-4000-8000-000000000001','A','section','fe300000-0000-4000-8000-000000000005',null);
insert into public.noor_class_update_windows(institution_id,start_year,is_open) values('fe100000-0000-4000-8000-000000000001',2025,false);
insert into public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status) values('fe100000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000004','fe200000-0000-4000-8000-000000000003','teacher','active');
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000002';
-- Initial signup selection works even when yearly edits are OFF.
select public.noor_select_student_section('fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000004','fe400000-0000-4000-8000-000000000004');
do $$ begin
 assert (public.noor_class_update_status('fe100000-0000-4000-8000-000000000001')->>'selected')::boolean,'Signup placement not saved';
 begin perform public.noor_select_student_section('fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000005','fe400000-0000-4000-8000-000000000005');raise exception 'Second selection was allowed';exception when insufficient_privilege then null;end;
 begin perform public.noor_select_student_section('fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000006',null);raise exception 'Cross-school group was allowed';exception when invalid_parameter_value then null;end;
 begin perform public.noor_set_class_update_window('fe100000-0000-4000-8000-000000000001',2026,true);raise exception 'Student changed principal switch';exception when insufficient_privilege then null;end;
end $$;
-- Add genuine prior-year report fixtures as database owner.
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
insert into public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,assessment_kind,graded_by) values('fe100000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000004','fe200000-0000-4000-8000-000000000002','Final exam','Maths','2026-03-10',81,100,'term3','fe000000-0000-4000-8000-000000000001');
insert into public.class_sessions(id,institution_id,academic_group_id,title,starts_at,ends_at,session_status) values('fe500000-0000-4000-8000-000000000001','fe100000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000004','Daily class attendance','2026-03-10T09:00:00+05:30','2026-03-10T09:10:00+05:30','completed');
insert into public.attendance_records(institution_id,session_id,student_membership_id,attendance_status) values('fe100000-0000-4000-8000-000000000001','fe500000-0000-4000-8000-000000000001','fe200000-0000-4000-8000-000000000002','present');
-- Class teacher may pause/reactivate their own student, but cannot manage another school.
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000003';
select public.noor_set_member_status('fe100000-0000-4000-8000-000000000001','fe200000-0000-4000-8000-000000000002','suspended');
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000002';
do $$ begin
 assert not private.is_active_member('fe100000-0000-4000-8000-000000000001'),'Paused user remained active';
 assert (select count(*)=0 from public.attendance_records where institution_id='fe100000-0000-4000-8000-000000000001'),'Paused token can read attendance';
 assert (select count(*)=0 from public.academic_groups where institution_id='fe100000-0000-4000-8000-000000000001'),'Paused token can read groups';
 begin perform public.noor_select_student_section('fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000004','fe400000-0000-4000-8000-000000000004');raise exception 'Paused student could select';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000003';
select public.noor_set_member_status('fe100000-0000-4000-8000-000000000001','fe200000-0000-4000-8000-000000000002','active');
do $$ begin
 begin perform public.noor_set_member_status('fe100000-0000-4000-8000-000000000002','fe200000-0000-4000-8000-000000000004','suspended');raise exception 'Teacher paused another school';exception when insufficient_privilege then null;end;
 assert jsonb_array_length(public.noor_manageable_members('fe100000-0000-4000-8000-000000000001',''))=1,'Class teacher roster scope wrong';
end $$;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select public.noor_set_class_update_window('fe100000-0000-4000-8000-000000000001',2026,true);
do $$ begin
 assert (select (report->'marks'->0->>'marks')::numeric=81 and report->'attendance'->0->>'status'='present' and report->>'class_name'='Class 4' from public.noor_annual_archives where membership_id='fe200000-0000-4000-8000-000000000002' and start_year=2025),'Annual report archive incomplete';
end $$;
-- OFF blocks a not-yet-selected returning student; reopening never resets their annual allowance.
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select public.noor_set_class_update_window('fe100000-0000-4000-8000-000000000001',2026,false);
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000002';
do $$ begin
 begin perform public.noor_select_student_section('fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000005','fe400000-0000-4000-8000-000000000005');raise exception 'Closed updates accepted selection';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select public.noor_set_class_update_window('fe100000-0000-4000-8000-000000000001',2026,true);
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000002';
do $$ begin
 assert not private.noor_group_access('fe100000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000004',false),'Old class access remains after rollover';
end $$;
select public.noor_select_student_section('fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000005','fe400000-0000-4000-8000-000000000005');
-- Retry is idempotent; choosing another class is denied even while ON.
select public.noor_select_student_section('fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000005','fe400000-0000-4000-8000-000000000005');
do $$ begin
 assert private.noor_group_access('fe100000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000005',false),'New class access missing';
 begin perform public.noor_select_student_section('fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000004','fe400000-0000-4000-8000-000000000004');raise exception 'Second yearly change allowed';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin assert (select count(*)=1 from public.noor_annual_archives where membership_id='fe200000-0000-4000-8000-000000000002'),'Student cannot read own previous-year report';end $$;
reset role;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000004';
set local role authenticated;
do $$ begin assert (select count(*)=0 from public.noor_annual_archives where institution_id='fe100000-0000-4000-8000-000000000001'),'Other school can read report';end $$;
reset role;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select public.noor_set_class_update_window('fe100000-0000-4000-8000-000000000001',2026,false);
select public.noor_set_member_status('fe100000-0000-4000-8000-000000000001','fe200000-0000-4000-8000-000000000003','suspended');
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000003';
do $$ begin
 begin perform public.noor_manageable_members('fe100000-0000-4000-8000-000000000001','');raise exception 'Paused teacher can manage students';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS: signup persistence, one change/year, principal switch, annual archives, class access, pause, teacher scope and tenant isolation; fixtures rolled back' as verification;
