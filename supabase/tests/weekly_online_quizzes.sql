-- Rollback-only checks against existing enrolled test accounts. No records survive.
begin;
do $score$
declare q jsonb='[{"type":"mcq","options":["3","4"],"marks":2},{"type":"blank","options":["2","3"],"marks":1},{"type":"short","marks":3}]';
 k jsonb='[{"answer":"1"},{"answer":"0"},{"answer":"Combine quantities"}]';x jsonb;denied boolean;
begin
 x=private.noor_score_quiz(q,k,'["1","0","Combine quantities"]');
 if x<>'{"objective_marks":3,"correct_count":2,"wrong_count":0,"unanswered_count":0,"pending_count":1}'::jsonb then raise exception 'Incorrect objective scoring';end if;
 x=private.noor_score_quiz(q,k,'["0","1",""]');
 if (x->>'wrong_count')::int<>2 or (x->>'unanswered_count')::int<>1 or (x->>'objective_marks')::numeric<>0 then raise exception 'Incorrect wrong/blank scoring';end if;
 x=private.noor_score_quiz(q,k,'["","",""]');if (x->>'unanswered_count')::int<>3 then raise exception 'Incorrect unanswered count';end if;
 denied=false;begin perform private.noor_score_quiz(q,k,'["9","0",""]');exception when others then denied=true;end;if not denied then raise exception 'Invalid option accepted';end if;
 denied=false;begin perform private.noor_score_quiz(q,k,'[1,"0",""]');exception when others then denied=true;end;if not denied then raise exception 'Invalid answer type accepted';end if;
end $score$;
do $test$
declare t public.institution_memberships; s public.institution_memberships; g uuid; quiz uuid; attempt uuid; result uuid; result2 uuid; upcoming date; denied boolean; k jsonb;
begin
 select tm.* into strict t from public.institution_memberships tm where tm.role='teacher' and tm.status='active' and exists(select 1 from public.academic_group_memberships tg join public.academic_group_memberships sg on sg.group_id=tg.group_id join public.institution_memberships sm on sm.id=sg.membership_id where tg.membership_id=tm.id and tg.status='active' and sg.status='active' and sm.role='student' and sm.status='active') limit 1;
 select gm.group_id into strict g from public.academic_group_memberships gm where gm.membership_id=t.id and gm.status='active' and exists(select 1 from public.academic_group_memberships sg join public.institution_memberships m on m.id=sg.membership_id where sg.group_id=gm.group_id and sg.status='active' and m.role='student' and m.status='active') limit 1;
 select m.* into strict s from public.institution_memberships m join public.academic_group_memberships gm on gm.membership_id=m.id where gm.group_id=g and gm.status='active' and m.role='student' and m.status='active' limit 1;
 upcoming=(select (now() at time zone timezone)::date from public.institutions where id=t.institution_id);
 upcoming=upcoming+((6-extract(dow from upcoming)::int+7)%7);
 perform set_config('request.jwt.claim.sub',t.user_id::text,true);
 quiz=public.noor_publish_quiz(t.institution_id,g,'Rollback verification '||gen_random_uuid(),'Verification Maths',upcoming,
 '[{"type":"mcq","prompt":"2+2?","options":["3","4"],"marks":2},{"type":"blank","prompt":"5 minus __ is 3","options":["2","3"],"marks":1},{"type":"short","prompt":"Explain addition","options":[],"marks":3}]',
 '[{"answer":"1"},{"answer":"0"},{"answer":"Combining quantities","rubric":"3 for clear explanation"}]');
 if exists(select 1 from jsonb_array_elements((select questions from public.noor_weekly_quizzes where id=quiz)) q where q?'answer' or q?'answer_key') then raise exception 'Answer key leaked into quiz';end if;
 denied=false;begin perform public.noor_publish_quiz(t.institution_id,g,'Invalid','Maths',upcoming,'[{"type":"mcq","prompt":"Q","options":["a","a"],"marks":1}]','[{"answer":"0"}]');exception when others then denied=true;end;if not denied then raise exception 'Duplicate options accepted';end if;
 perform set_config('request.jwt.claim.sub',s.user_id::text,true);
 denied=false;begin perform public.noor_quiz_review_data(quiz);exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Student received private teacher key';end if;
 denied=false;begin perform public.noor_publish_quiz(t.institution_id,g,'Invalid','Maths',upcoming,'[]','[]');exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Student published quiz';end if;
 -- Scheduled-day guard is exercised on weekdays. On Saturday exercise actual scoring.
 if (select (now() at time zone timezone)::date from public.institutions where id=t.institution_id)=upcoming then
  attempt=public.noor_submit_quiz(quiz,'["1","0","Combining quantities"]');
 else
  denied=false;begin perform public.noor_submit_quiz(quiz,'["1","0","Combining quantities"]');exception when others then denied=true;end;if not denied then raise exception 'Submitted before quiz date';end if;
  insert into public.noor_quiz_attempts(quiz_id,institution_id,student_membership_id,answers,objective_marks,correct_count,wrong_count,unanswered_count,pending_count) values(quiz,t.institution_id,s.id,'["1","0","Combining quantities"]',3,2,0,0,1) returning id into attempt;
 end if;
 if (select objective_marks from public.noor_quiz_attempts where id=attempt)<>3 then raise exception 'Objective score incorrect';end if;
 denied=false;begin perform public.noor_submit_quiz(quiz,'["0","1","changed"]');exception when others then denied=true;end;if not denied then raise exception 'Second submission accepted';end if;
 if exists(select 1 from public.noor_assessment_results where source_quiz_attempt_id=attempt) then raise exception 'Marks published before approval';end if;
 denied=false;begin perform public.noor_approve_quiz_marks(attempt,'[null,null,3]','');exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Student approved marks';end if;
 k=public.noor_quiz_result_key(quiz);if k<>'[]'::jsonb then raise exception 'Key released before close';end if;
 perform set_config('request.jwt.claim.sub',t.user_id::text,true);
 denied=false;begin perform public.noor_approve_quiz_marks(attempt,'[null,null,4]','');exception when others then denied=true;end;if not denied then raise exception 'Excessive marks accepted';end if;
 result=public.noor_approve_quiz_marks(attempt,'[null,null,2]','Partial explanation');
 result2=public.noor_approve_quiz_marks(attempt,'[null,null,3]','Retry');
 if result<>result2 or (select count(*) from public.noor_assessment_results where source_quiz_attempt_id=attempt)<>1 then raise exception 'Duplicate weekly marks';end if;
 if not exists(select 1 from public.noor_assessment_results where id=result and marks=5 and max_marks=6 and subject_name='Verification Maths' and assessment_kind='weekly_quiz' and assessed_on=upcoming and student_membership_id=s.id) then raise exception 'Weekly result mapping incorrect';end if;
 perform set_config('noor.test.quiz',quiz::text,true);
 perform set_config('noor.test.student',s.user_id::text,true);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 denied=false;begin perform public.noor_quiz_review_data(quiz);exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Unrelated account saw private key';end if;
 if has_table_privilege('authenticated','public.noor_quiz_attempts','UPDATE') or has_table_privilege('authenticated','public.noor_quiz_attempts','INSERT') or has_table_privilege('authenticated','private.noor_quiz_keys','SELECT') then raise exception 'Direct mutation or private key grants exist';end if;
 raise notice 'PASS: publish validation, role checks, private keys, schedule guard, immutable submission, teacher approval, subject/date mapping and idempotent marks';
end $test$;
set local role authenticated;
do $rls$
begin
 if exists(select 1 from public.noor_weekly_quizzes where id=current_setting('noor.test.quiz')::uuid)
 or exists(select 1 from public.noor_quiz_attempts where quiz_id=current_setting('noor.test.quiz')::uuid) then raise exception 'RLS leaked quiz to unrelated account';end if;
 perform set_config('request.jwt.claim.sub',current_setting('noor.test.student'),true);
 if not exists(select 1 from public.noor_weekly_quizzes where id=current_setting('noor.test.quiz')::uuid)
 or not exists(select 1 from public.noor_quiz_attempts where quiz_id=current_setting('noor.test.quiz')::uuid) then raise exception 'Enrolled student cannot read own quiz result';end if;
 begin update public.noor_quiz_attempts set answers='[]' where quiz_id=current_setting('noor.test.quiz')::uuid;raise exception 'Direct answer edit accepted';exception when insufficient_privilege then null;end;
 begin perform answer_key from private.noor_quiz_keys where quiz_id=current_setting('noor.test.quiz')::uuid;raise exception 'Direct private key read accepted';exception when insufficient_privilege then null;end;
end $rls$;
rollback;
