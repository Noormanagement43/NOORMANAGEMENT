begin;
set local statement_timeout='15s';
do $test$
declare t public.institution_memberships;s public.institution_memberships;g uuid;q uuid;a uuid;c jsonb;again jsonb;denied boolean;kind text;release date;local_day date;
begin
 select * into strict t from public.institution_memberships where role='teacher' and status='active' limit 1;
 select * into strict s from public.institution_memberships where institution_id=t.institution_id and role='student' and status='active' limit 1;
 select (now() at time zone timezone)::date into local_day from public.institutions where id=t.institution_id;
 insert into public.academic_groups(institution_id,name,group_type) values(t.institution_id,'Rollback resumable class','class') returning id into g;
 insert into public.academic_group_memberships(institution_id,group_id,membership_id,group_role) values(t.institution_id,g,s.id,'student');
 foreach kind in array array['weekly','monthly'] loop
  perform set_config('request.jwt.claim.sub',t.user_id::text,true);
  release=case when kind='weekly' then local_day+((6-extract(dow from local_day)::int+7)%7) else local_day end;
  q=public.noor_publish_test(t.institution_id,g,'Resume '||kind,'English',release,'[{"type":"mcq","prompt":"Opposite of hot?","options":["cold","tall"],"marks":5}]','[{"answer":"0"}]',jsonb_build_object('kind',kind,'exam_key',kind,'question_count',1,'max_marks',5,'duration_minutes',5),'{}');
  -- Simulate a previously published assignment, still unsubmitted on a later date.
  update public.noor_weekly_quizzes set quiz_date=release-interval '7 days' where id=q;
  denied=false;begin perform public.noor_test_clock(q);exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Teacher opened student paper';end if;
  perform set_config('request.jwt.claim.sub',s.user_id::text,true);
  c=public.noor_test_clock(q);if not(c->>'resumable')::boolean then raise exception 'Coursework not resumable';end if;
  c=public.noor_test_clock(q,'["1"]');
  again=public.noor_test_clock(q);if again->'answers'<>'["1"]'::jsonb then raise exception 'Reopen lost saved answers';end if;
  update private.noor_test_sessions set ends_at=clock_timestamp()-interval '1 second' where quiz_id=q and membership_id=s.id;
  perform private.noor_finish_expired_tests();
  if exists(select 1 from public.noor_quiz_attempts where quiz_id=q) then raise exception 'Unsubmitted coursework was auto-finalized';end if;
  c=public.noor_test_clock(q,'["0"]');if (c->>'expired')::boolean or c->'answers'<>'["0"]'::jsonb then raise exception 'Suggested time blocked edits';end if;
  a=public.noor_submit_quiz(q,'["0"]');
  if not exists(select 1 from public.noor_quiz_attempts where id=a and answers='["0"]' and final_marks=5) then raise exception 'Final answers were not graded';end if;
  denied=false;begin perform public.noor_submit_quiz(q,'["1"]');exception when others then denied=true;end;if not denied then raise exception 'Submitted answers editable';end if;
  c=public.noor_test_clock(q);if c->>'attempt_id'<>a::text then raise exception 'Submitted paper reopened for editing';end if;
 end loop;
 -- A future assignment cannot be opened early, even though past assignments can resume.
 perform set_config('request.jwt.claim.sub',t.user_id::text,true);
 q=public.noor_publish_test(t.institution_id,g,'Future monthly','Maths',local_day+1,'[{"type":"mcq","prompt":"Two plus two?","options":["four","five"],"marks":5}]','[{"answer":"0"}]','{"kind":"monthly","exam_key":"monthly","question_count":1,"max_marks":5}','{}');
 perform set_config('request.jwt.claim.sub',s.user_id::text,true);
 denied=false;begin perform public.noor_test_clock(q);exception when others then denied=true;end;if not denied then raise exception 'Future assignment opened early';end if;
end $test$;
select 'Coursework resumes after exit/date change; suggested time never submits; explicit Submit locks; future release and role checks enforced' as verified;
rollback;
