-- Shared deterministic objective scorer; independent of the Saturday availability gate.
create function private.noor_score_quiz(p_questions jsonb,p_keys jsonb,p_answers jsonb)
returns jsonb language plpgsql immutable set search_path='' as $f$
declare item jsonb;ans text;total numeric=0;good int=0;bad int=0;blank int=0;pending int=0;
begin
 if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_typeof(p_keys) is distinct from 'array' or jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Quiz arrays required';end if;
 if jsonb_array_length(p_questions) not between 1 and 30 or jsonb_array_length(p_answers)<>jsonb_array_length(p_questions) or jsonb_array_length(p_keys)<>jsonb_array_length(p_questions) then raise exception 'Questions, keys and answers must align';end if;
 for i in 0..jsonb_array_length(p_questions)-1 loop
  item=p_questions->i;
  if jsonb_typeof(p_answers->i) is distinct from 'string' then raise exception 'Answers must be text';end if;
  ans=btrim(p_answers->>i);if length(ans)>4000 then raise exception 'Answer exceeds 4000 characters';end if;
  if ans='' then blank=blank+1;
  elsif item->>'type'='short' then pending=pending+1;
  else
   if ans!~'^[0-5]$' or ans::int>=jsonb_array_length(item->'options') then raise exception 'Invalid selected option';end if;
   if ans=p_keys->i->>'answer' then good=good+1;total=total+(item->>'marks')::numeric;else bad=bad+1;end if;
  end if;
 end loop;
 return jsonb_build_object('objective_marks',total,'correct_count',good,'wrong_count',bad,'unanswered_count',blank,'pending_count',pending);
end $f$;
revoke all on function private.noor_score_quiz(jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function private.noor_submit_quiz(p_quiz uuid,p_answers jsonb)
returns uuid language plpgsql security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes; member uuid; v_id uuid; keys jsonb; item jsonb; ans text; total numeric=0; good int=0; bad int=0; blank int=0; pending int=0; local_day date; scored jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false) then raise exception 'Only enrolled students can submit' using errcode='42501';end if;
 select (now() at time zone timezone)::date into local_day from public.institutions where id=q.institution_id;
 if local_day<>q.quiz_date then raise exception 'Quiz can be submitted on its scheduled Saturday only';end if;
 select id into strict member from public.institution_memberships where institution_id=q.institution_id and user_id=auth.uid() and status='active' and role in('student','university_student');
 if exists(select 1 from public.noor_quiz_attempts where quiz_id=p_quiz and student_membership_id=member) then raise exception 'Final submission is locked';end if;
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>jsonb_array_length(q.questions) then raise exception 'Answer every question or leave it blank';end if;
 select answer_key into strict keys from private.noor_quiz_keys where quiz_id=p_quiz;
 scored=private.noor_score_quiz(q.questions,keys,p_answers);
 total=(scored->>'objective_marks')::numeric;good=(scored->>'correct_count')::int;bad=(scored->>'wrong_count')::int;blank=(scored->>'unanswered_count')::int;pending=(scored->>'pending_count')::int;
 insert into public.noor_quiz_attempts(quiz_id,institution_id,student_membership_id,answers,objective_marks,correct_count,wrong_count,unanswered_count,pending_count)
 values(p_quiz,q.institution_id,member,p_answers,total,good,bad,blank,pending) returning id into v_id;
 return v_id;
end $f$;
