-- Non-destructive regression check for student paper opening and auto grading.
-- Executes within a transaction and discards every temporary attempt/report row.
begin;
do $paper_regression$
declare
  fn regprocedure;
  definition text;
  v_quiz uuid;
  v_user uuid;
  v_token uuid;
  v_paper jsonb;
  v_attempt uuid;
  v_retry uuid;
  v_empty jsonb;
begin
  foreach fn in array array[
    'private.noor_paper_member(uuid)'::regprocedure,
    'private.noor_test_clock(uuid,jsonb)'::regprocedure,
    'private.noor_submit_quiz(uuid,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(fn);
    if position('from public.noor_weekly_quizzes q where q.id=p_quiz' in definition)>0 then
      raise exception 'Ambiguous q.id guard reintroduced in %', fn;
    end if;
  end loop;

  select q.id,m.user_id,coalesce(s.paper_token,gen_random_uuid())
  into v_quiz,v_user,v_token
  from public.noor_weekly_quizzes q
  join public.institutions i on i.id=q.institution_id and i.status='active'
  join public.institution_memberships m on m.institution_id=q.institution_id
    and m.status='active' and m.role in ('student','university_student')
  join public.academic_group_memberships gm on gm.institution_id=m.institution_id
    and gm.membership_id=m.id and gm.status='active' and gm.group_role='student'
  join public.academic_groups g on g.id=gm.group_id and g.institution_id=gm.institution_id
    and g.is_active and (g.id=q.academic_group_id or g.parent_group_id=q.academic_group_id)
  left join private.noor_test_sessions s on s.quiz_id=q.id and s.membership_id=m.id
  where q.assessment_kind='weekly' and q.auto_grade
    and q.quiz_date<=(now() at time zone i.timezone)::date
    and s.abandoned_at is null
    and private.noor_feature_enabled(q.institution_id,'weekly_tests')
  order by q.quiz_date desc limit 1;

  if v_quiz is null then
    raise notice 'No eligible weekly quiz student fixture: SQL alias checks passed; runtime test skipped.';
    return;
  end if;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  v_paper := private.noor_paper_start(v_quiz,v_token);
  if v_paper->>'submitted'='true' or jsonb_typeof(v_paper->'questions')<>'array' then
    raise exception 'Paper did not open';
  end if;
  select jsonb_agg(''::text) into v_empty from jsonb_array_elements(v_paper->'questions');
  v_attempt := private.noor_paper_submit(v_quiz,v_token,v_empty);
  v_retry := private.noor_paper_submit(v_quiz,v_token,v_empty);
  if v_attempt is distinct from v_retry or not exists(
    select 1 from public.noor_quiz_attempts a
    join public.noor_assessment_results r on r.id=a.assessment_result_id
    join public.noor_weekly_quizzes q on q.id=a.quiz_id
    where a.id=v_attempt and a.grading_status='completed'
      and a.student_membership_id=r.student_membership_id
      and a.institution_id=r.institution_id
      and r.assessment_kind='weekly_quiz'
      and r.subject_name=q.subject_name and r.assessed_on=q.quiz_date
  ) then
    raise exception 'Auto grade, report card, weekly separation, or retry failed';
  end if;
  raise notice 'PASS: paper opening, idempotent submission, automatic marks, weekly date and subject.';
end;
$paper_regression$;
rollback;
