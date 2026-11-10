-- Transaction-only verification against an existing school; fixtures never persist.
begin;
do $$
declare school uuid; teacher_user uuid; teacher uuid; student uuid; student_user uuid; principal_user uuid; grp uuid; subj text; result jsonb; other_subject text:='__analytics_other_subject__'; today date; saved uuid;
begin
 select t.institution_id,t.teacher_membership_id,t.academic_group_id,t.subject_name,m.user_id into school,teacher,grp,subj,teacher_user
 from public.teacher_timetable_periods t join public.institution_memberships m on m.id=t.teacher_membership_id and m.status='active'
 where exists(select 1 from public.academic_group_memberships gm join public.institution_memberships s on s.id=gm.membership_id and s.role='student' and s.status='active' where gm.group_id=t.academic_group_id and gm.group_role='student' and gm.status='active') limit 1;
 if school is null then raise exception 'Test needs a real teacher period with an enrolled student'; end if;
 select m.id,m.user_id into student,student_user from public.academic_group_memberships gm join public.institution_memberships m on m.id=gm.membership_id where gm.group_id=grp and gm.group_role='student' and gm.status='active' and m.role='student' and m.status='active' limit 1;
 select user_id into principal_user from public.institution_memberships where institution_id=school and role='principal' and status='active' limit 1;
 select (now() at time zone timezone)::date into today from public.institutions where id=school;
 perform set_config('request.jwt.claim.sub',principal_user::text,true);
 insert into public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,graded_by) values
 (school,grp,student,'Analytics rollback test',subj,today,40,100,teacher_user),
 (school,grp,student,'Analytics rollback test',subj,today-30,80,100,teacher_user),
 (school,grp,student,'Analytics rollback test',other_subject,today,95,100,teacher_user);
 perform set_config('request.jwt.claim.sub',teacher_user::text,true);execute 'set local role authenticated';
 result:=public.noor_live_analytics(school);
 if not exists(select 1 from jsonb_array_elements(result->'rows') x where x->>'subject'=subj and (x->>'percentage')::numeric=40 and (x->>'previous_percentage')::numeric=80) then raise exception 'Teacher subject trend missing';end if;
 if exists(select 1 from jsonb_array_elements(result->'rows') x where x->>'subject'=other_subject) then raise exception 'Teacher saw another subject';end if;
 begin perform public.noor_live_analytics(gen_random_uuid());raise exception 'Cross school access allowed';exception when insufficient_privilege then null;end;
 -- The real teacher's new period can be saved and read back under RLS.
 insert into public.teacher_timetable_periods(institution_id,teacher_membership_id,academic_group_id,created_by,weekday,period_number,start_time,end_time,subject_name,repeats_daily)
 values(school,teacher,grp,teacher_user,6,20,'23:00','23:30',subj,true) returning id into saved;
 if not exists(select 1 from public.teacher_timetable_periods where id=saved) then raise exception 'Saved period not readable';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',student_user::text,true);execute 'set local role authenticated';
 result:=public.noor_live_analytics(school);
 if exists(select 1 from jsonb_array_elements(result->'rows') x where x->>'membership_id'<>student::text) then raise exception 'Student saw private classmate analytics';end if;
 if jsonb_array_length(result->'achievers')<>1 then raise exception 'School achiever deduplication failed';end if;
 begin insert into public.noor_group_report_settings(institution_id,academic_group_id) values(school,grp);raise exception 'Student edited settings';exception when insufficient_privilege then null;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',principal_user::text,true);execute 'set local role authenticated';
 result:=public.noor_live_analytics(school);
 if not exists(select 1 from jsonb_array_elements(result->'rows') x where x->>'subject'=other_subject) then raise exception 'Principal cannot see school insights';end if;
 insert into public.noor_group_report_settings(institution_id,academic_group_id,subject_names,exam_labels) values(school,grp,array['English','Maths'],'{"weekly":"Weekly Quiz","term1":"Midyear","custom":"Pre-final"}')
 on conflict(institution_id,academic_group_id) do update set subject_names=excluded.subject_names,exam_labels=excluded.exam_labels;
 if not exists(select 1 from public.noor_group_report_settings where institution_id=school and academic_group_id=grp and exam_labels->>'custom'='Pre-final') then raise exception 'Principal settings not saved';end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: teacher subject scope, trends, student privacy, cross-school denial, achievers, settings permissions, period save/read; all fixtures rolled back' result;
