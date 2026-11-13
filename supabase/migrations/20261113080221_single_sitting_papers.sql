-- A paper is revealed to its student only after Start Paper, within one in-memory attempt.
alter table private.noor_test_sessions add column paper_token uuid,add column abandoned_at timestamptz;
alter policy quiz_read on public.noor_weekly_quizzes using(
 private.noor_quiz_group_access(institution_id,academic_group_id,true)
 or(created_by=(select auth.uid()) and private.noor_can_publish_learning(institution_id,academic_group_id))
 or private.can_manage_academics(institution_id));

create function private.noor_paper_member(p_quiz uuid) returns uuid
language plpgsql security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes;m uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false) then raise exception 'Only your enrolled class paper can be opened' using errcode='42501';end if;
 select id into strict m from public.institution_memberships where institution_id=q.institution_id and user_id=auth.uid() and status='active' and role in('student','university_student') for update;
 return m;
end $f$;
revoke all on function private.noor_paper_member(uuid) from public,anon,authenticated;

create function private.noor_paper_list() returns setof jsonb
language sql security definer set search_path='' as $f$
 select jsonb_build_object('id',q.id,'academic_group_id',q.academic_group_id,'title',q.title,'subject_name',q.subject_name,'quiz_date',q.quiz_date,'assessment_kind',q.assessment_kind,'duration_minutes',q.duration_minutes,'max_marks',q.max_marks,'question_count',jsonb_array_length(q.questions),'submitted',a.id is not null,'started',s.paper_token is not null,'auto_grade',q.auto_grade)
 from public.noor_weekly_quizzes q
 join public.institutions i on i.id=q.institution_id and i.status='active'
 join public.institution_memberships m on m.institution_id=q.institution_id and m.user_id=auth.uid() and m.status='active' and m.role in('student','university_student')
 left join private.noor_test_sessions s on s.quiz_id=q.id and s.membership_id=m.id
 left join public.noor_quiz_attempts a on a.quiz_id=q.id and a.student_membership_id=m.id
 where auth.uid() is not null and private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false)
 order by q.quiz_date desc,q.id limit 150;
$f$;
create function public.noor_paper_list() returns setof jsonb language sql security invoker set search_path='' as $f$ select * from private.noor_paper_list(); $f$;
revoke all on function private.noor_paper_list(),public.noor_paper_list() from public,anon;
grant execute on function private.noor_paper_list(),public.noor_paper_list() to authenticated;

create function private.noor_paper_start(p_quiz uuid,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare m uuid;s private.noor_test_sessions;q public.noor_weekly_quizzes;c jsonb;a uuid;
begin
 if p_token is null then raise exception 'Attempt identifier required' using errcode='22023';end if;
 m=private.noor_paper_member(p_quiz);
 select id into a from public.noor_quiz_attempts where quiz_id=p_quiz and student_membership_id=m;
 if a is not null then return jsonb_build_object('submitted',true,'attempt_id',a);end if;
 select * into s from private.noor_test_sessions where quiz_id=p_quiz and membership_id=m for update;
 if s.abandoned_at is not null or(s.paper_token is not null and s.paper_token<>p_token) then
  raise exception 'This paper has already been started. It cannot be reopened. Contact your teacher if you need help.' using errcode='42501';end if;
 c=private.noor_test_clock(p_quiz,null);
 update private.noor_test_sessions set paper_token=p_token where quiz_id=p_quiz and membership_id=m and paper_token is null;
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if coalesce((c->>'expired')::boolean,false) then
  a=private.noor_submit_quiz(p_quiz,c->'answers');return jsonb_build_object('submitted',true,'attempt_id',a);end if;
 return c||jsonb_build_object('questions',q.questions,'started',true);
end $f$;
create function public.noor_paper_start(p_quiz uuid,p_token uuid) returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_paper_start(p_quiz,p_token); $f$;
revoke all on function private.noor_paper_start(uuid,uuid),public.noor_paper_start(uuid,uuid) from public,anon;
grant execute on function private.noor_paper_start(uuid,uuid),public.noor_paper_start(uuid,uuid) to authenticated;

create function private.noor_paper_guard(p_quiz uuid,p_token uuid) returns uuid
language plpgsql security definer set search_path='' as $f$
declare m uuid;s private.noor_test_sessions;
begin
 m=private.noor_paper_member(p_quiz);
 select * into s from private.noor_test_sessions where quiz_id=p_quiz and membership_id=m for update;
 if s.paper_token is null or p_token is null or s.paper_token<>p_token or s.abandoned_at is not null then
  raise exception 'This paper is not open in this attempt. Contact your teacher if you need help.' using errcode='42501';end if;
 return m;
end $f$;
revoke all on function private.noor_paper_guard(uuid,uuid) from public,anon,authenticated;

create function private.noor_paper_save(p_quiz uuid,p_token uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $f$
begin
 perform private.noor_paper_guard(p_quiz,p_token);
 return private.noor_test_clock(p_quiz,p_answers);
end $f$;
create function public.noor_paper_save(p_quiz uuid,p_token uuid,p_answers jsonb) returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_paper_save(p_quiz,p_token,p_answers); $f$;
revoke all on function private.noor_paper_save(uuid,uuid,jsonb),public.noor_paper_save(uuid,uuid,jsonb) from public,anon;
grant execute on function private.noor_paper_save(uuid,uuid,jsonb),public.noor_paper_save(uuid,uuid,jsonb) to authenticated;

create function private.noor_paper_submit(p_quiz uuid,p_token uuid,p_answers jsonb) returns uuid
language plpgsql security definer set search_path='' as $f$
declare m uuid;a uuid;
begin
 m=private.noor_paper_guard(p_quiz,p_token);
 select id into a from public.noor_quiz_attempts where quiz_id=p_quiz and student_membership_id=m;
 if a is not null then return a;end if;
 return private.noor_submit_quiz(p_quiz,p_answers);
end $f$;
create function public.noor_paper_submit(p_quiz uuid,p_token uuid,p_answers jsonb) returns uuid language sql security invoker set search_path='' as $f$ select private.noor_paper_submit(p_quiz,p_token,p_answers); $f$;
revoke all on function private.noor_paper_submit(uuid,uuid,jsonb),public.noor_paper_submit(uuid,uuid,jsonb) from public,anon;
grant execute on function private.noor_paper_submit(uuid,uuid,jsonb),public.noor_paper_submit(uuid,uuid,jsonb) to authenticated;

create function private.noor_paper_abandon(p_quiz uuid,p_token uuid) returns void
language plpgsql security definer set search_path='' as $f$
declare m uuid;
begin
 m=private.noor_paper_guard(p_quiz,p_token);
 if not exists(select 1 from public.noor_quiz_attempts where quiz_id=p_quiz and student_membership_id=m) then
  update private.noor_test_sessions set abandoned_at=clock_timestamp() where quiz_id=p_quiz and membership_id=m;end if;
end $f$;
create function public.noor_paper_abandon(p_quiz uuid,p_token uuid) returns void language sql security invoker set search_path='' as $f$ select private.noor_paper_abandon(p_quiz,p_token); $f$;
revoke all on function private.noor_paper_abandon(uuid,uuid),public.noor_paper_abandon(uuid,uuid) from public,anon;
grant execute on function private.noor_paper_abandon(uuid,uuid),public.noor_paper_abandon(uuid,uuid) to authenticated;

-- Retire direct student draft/submission routes. Server grading and the scheduler keep their owner access.
revoke all on function public.noor_test_clock(uuid,jsonb),private.noor_test_clock(uuid,jsonb),public.noor_submit_quiz(uuid,jsonb),private.noor_submit_quiz(uuid,jsonb) from public,anon,authenticated;
