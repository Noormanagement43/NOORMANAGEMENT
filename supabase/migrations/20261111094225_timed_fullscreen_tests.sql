-- Persist authoritative test clocks and drafts; timer survives reload/device changes.
alter table public.noor_weekly_quizzes add column timed_test boolean not null default false;
alter table public.noor_weekly_quizzes alter column timed_test set default true;
create table private.noor_test_sessions(
 quiz_id uuid not null references public.noor_weekly_quizzes(id) on delete cascade,
 membership_id uuid not null references public.institution_memberships(id) on delete cascade,
 started_at timestamptz not null default clock_timestamp(), ends_at timestamptz not null,
 answers jsonb not null, primary key(quiz_id,membership_id)
);
alter table private.noor_test_sessions enable row level security;
revoke all on private.noor_test_sessions from public,anon,authenticated;
create index noor_test_sessions_due on private.noor_test_sessions(ends_at);
create function private.noor_test_clock(p_quiz uuid,p_answers jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes;m uuid;s private.noor_test_sessions;existing uuid;k jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false) then raise exception 'Only your enrolled class test can be opened' using errcode='42501';end if;
 select id into strict m from public.institution_memberships where institution_id=q.institution_id and user_id=auth.uid() and status='active' and role in('student','university_student');
 select id into existing from public.noor_quiz_attempts where quiz_id=q.id and student_membership_id=m;
 if existing is not null then return jsonb_build_object('attempt_id',existing);end if;
 select * into s from private.noor_test_sessions where quiz_id=q.id and membership_id=m for update;
 if s.quiz_id is null then
  if q.quiz_date<>(select (clock_timestamp() at time zone timezone)::date from public.institutions where id=q.institution_id and status='active') then raise exception 'This test opens on its scheduled date';end if;
  insert into private.noor_test_sessions(quiz_id,membership_id,ends_at,answers) values(q.id,m,clock_timestamp()+make_interval(mins=>q.duration_minutes),(select jsonb_agg(''::text) from jsonb_array_elements(q.questions))) on conflict do nothing;
  select * into strict s from private.noor_test_sessions where quiz_id=q.id and membership_id=m for update;
 end if;
 if p_answers is not null and clock_timestamp()<s.ends_at then
  if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>jsonb_array_length(q.questions) then raise exception 'Invalid draft answers';end if;
  select answer_key into strict k from private.noor_quiz_keys where quiz_id=q.id;
  perform private.noor_score_quiz(q.questions,k,p_answers);
  update private.noor_test_sessions set answers=p_answers where quiz_id=q.id and membership_id=m returning * into s;
 end if;
 return jsonb_build_object('started_at',s.started_at,'ends_at',s.ends_at,'server_now',clock_timestamp(),'answers',s.answers,'expired',clock_timestamp()>=s.ends_at);
end $f$;
create function public.noor_test_clock(p_quiz uuid,p_answers jsonb default null) returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_test_clock(p_quiz,p_answers); $f$;
revoke all on function private.noor_test_clock(uuid,jsonb),public.noor_test_clock(uuid,jsonb) from public,anon;
grant execute on function private.noor_test_clock(uuid,jsonb),public.noor_test_clock(uuid,jsonb) to authenticated;
create or replace function private.noor_submit_quiz(p_quiz uuid,p_answers jsonb)
returns uuid language plpgsql security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes; member uuid; v_id uuid; keys jsonb; item jsonb; ans text; total numeric=0; good int=0; bad int=0; blank int=0; pending int=0; local_day date; scored jsonb; session_row private.noor_test_sessions;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false) then raise exception 'Only enrolled students can submit' using errcode='42501';end if;
 select (now() at time zone timezone)::date into local_day from public.institutions where id=q.institution_id;

 select id into strict member from public.institution_memberships where institution_id=q.institution_id and user_id=auth.uid() and status='active' and role in('student','university_student');
 if exists(select 1 from public.noor_quiz_attempts where quiz_id=p_quiz and student_membership_id=member) then raise exception 'Final submission is locked';end if;
 select * into session_row from private.noor_test_sessions where quiz_id=q.id and membership_id=member for update;
 if q.timed_test and session_row.quiz_id is null then raise exception 'Start the test before submitting';end if;
 if local_day<>q.quiz_date and session_row.quiz_id is null then raise exception 'Test can be submitted on its scheduled date only';end if;
 if session_row.quiz_id is not null and clock_timestamp()>=session_row.ends_at then p_answers=session_row.answers;end if;

 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>jsonb_array_length(q.questions) then raise exception 'Answer every question or leave it blank';end if;
 select answer_key into strict keys from private.noor_quiz_keys where quiz_id=p_quiz;
 scored=private.noor_score_quiz(q.questions,keys,p_answers);
 total=(scored->>'objective_marks')::numeric;good=(scored->>'correct_count')::int;bad=(scored->>'wrong_count')::int;blank=(scored->>'unanswered_count')::int;pending=(scored->>'pending_count')::int;
 insert into public.noor_quiz_attempts(quiz_id,institution_id,student_membership_id,answers,objective_marks,correct_count,wrong_count,unanswered_count,pending_count)
 values(p_quiz,q.institution_id,member,p_answers,total,good,bad,blank,pending) returning id into v_id;
 if q.auto_grade then
  update public.noor_quiz_attempts set grading_status='queued' where id=v_id;
  if pending=0 then
   perform private.noor_finish_auto_test(v_id,(select jsonb_agg(jsonb_build_object('marks',0,'reason','No written answer submitted.')) from jsonb_array_elements(q.questions)), 'Automatically checked against the teacher-approved answer key.');
  else insert into private.noor_test_grading_jobs(attempt_id) values(v_id);end if;
 end if;
 return v_id;
end $f$;


-- Only the scheduler can finalize expired sessions. Restore JWT context on all paths.
create function private.noor_finish_expired_tests() returns integer language plpgsql security definer set search_path='' as $f$
declare r record;original text=current_setting('request.jwt.claim.sub',true);n integer=0;
begin
 for r in select s.quiz_id,s.answers,m.user_id from private.noor_test_sessions s join public.institution_memberships m on m.id=s.membership_id join public.institutions i on i.id=m.institution_id and i.status='active' where s.ends_at<=clock_timestamp() and m.status='active' and not exists(select 1 from public.noor_quiz_attempts a where a.quiz_id=s.quiz_id and a.student_membership_id=s.membership_id) order by s.ends_at limit 50 for update of s skip locked loop
  begin perform set_config('request.jwt.claim.sub',r.user_id::text,true);perform private.noor_submit_quiz(r.quiz_id,r.answers);n=n+1;
  exception when others then null;end;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(original,''),true);return n;
exception when others then perform set_config('request.jwt.claim.sub',coalesce(original,''),true);raise;
end $f$;
revoke all on function private.noor_finish_expired_tests() from public,anon,authenticated;
select cron.schedule('noor-expired-test-submissions','* * * * *','select private.noor_finish_expired_tests();');
