begin;
set local statement_timeout='10s';
do $test$
declare t public.institution_memberships;s public.institution_memberships;g uuid;q uuid;a uuid;c jsonb;again jsonb;d timestamptz;denied boolean;
begin
 select * into strict t from public.institution_memberships where role='teacher' and status='active' limit 1;
 select * into strict s from public.institution_memberships where institution_id=t.institution_id and role='student' and status='active' limit 1;
 insert into public.academic_groups(institution_id,name,group_type) values(t.institution_id,'Rollback timer class','class') returning id into g;
 insert into public.academic_group_memberships(institution_id,group_id,membership_id,group_role) values(t.institution_id,g,s.id,'student');
 perform set_config('request.jwt.claim.sub',t.user_id::text,true);
 q=public.noor_publish_test(t.institution_id,g,'Clock test','English',(select (now() at time zone timezone)::date from public.institutions where id=t.institution_id),'[{"type":"mcq","prompt":"Opposite of hot?","scene":"reading","options":["cold","tall"],"marks":5}]','[{"answer":"0"}]','{"kind":"monthly","exam_key":"monthly","question_count":1,"max_marks":5,"duration_minutes":5}','{}');
 if (select questions->0->>'scene' from public.noor_weekly_quizzes where id=q)<>'reading' then raise exception 'Approved question illustration was dropped';end if;
 denied=false;begin perform public.noor_test_clock(q);exception when others then denied=true;end;if not denied then raise exception 'Teacher started a student clock';end if;
 perform set_config('request.jwt.claim.sub',s.user_id::text,true);
 denied=false;begin perform public.noor_submit_quiz(q,'["0"]');exception when others then denied=true;end;if not denied then raise exception 'Timed test submitted without starting';end if;
 c=public.noor_test_clock(q);d=(c->>'ends_at')::timestamptz;again=public.noor_test_clock(q);
 if d is distinct from (again->>'ends_at')::timestamptz then raise exception 'Reload reset the clock';end if;
 c=public.noor_test_clock(q,'["0"]');if c->'answers'<>'["0"]'::jsonb or (c->>'ends_at')::timestamptz<>d then raise exception 'Draft or deadline incorrect';end if;
 update private.noor_test_sessions set ends_at=clock_timestamp()-interval '1 second' where quiz_id=q and membership_id=s.id;
 c=public.noor_test_clock(q,'["1"]');if c->'answers'<>'["0"]'::jsonb or not(c->>'expired')::boolean then raise exception 'Late answers overwrote saved answers';end if;
 perform private.noor_finish_expired_tests();
 select id into strict a from public.noor_quiz_attempts where quiz_id=q and student_membership_id=s.id and answers='["0"]' and final_marks=5;
 if auth.uid()<>s.user_id then raise exception 'Scheduler did not restore context';end if;
 perform private.noor_finish_expired_tests();if (select count(*) from public.noor_quiz_attempts where quiz_id=q)<>1 then raise exception 'Timed submission duplicated';end if;
 c=public.noor_test_clock(q);if c->>'attempt_id'<>a::text then raise exception 'Completed test did not stay locked';end if;
 if has_table_privilege('authenticated','private.noor_test_sessions','select') or has_function_privilege('authenticated','private.noor_finish_expired_tests()','execute') then raise exception 'Clock storage or scheduler exposed';end if;
end $test$;
rollback;
