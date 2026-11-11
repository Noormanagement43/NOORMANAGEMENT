create or replace function private.noor_approve_quiz_marks(p_attempt uuid,p_short_scores jsonb,p_feedback text)
returns uuid language plpgsql security definer set search_path='' as $f$
declare a public.noor_quiz_attempts; q public.noor_weekly_quizzes; item jsonb; score numeric; total numeric; good int; bad int; result_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict a from public.noor_quiz_attempts where id=p_attempt for update;
 select * into strict q from public.noor_weekly_quizzes where id=a.quiz_id;
 if not(private.noor_quiz_group_access(q.institution_id,q.academic_group_id,true) or(q.created_by=auth.uid() and private.noor_can_publish_learning(q.institution_id,q.academic_group_id))) then raise exception 'Assigned teacher required' using errcode='42501';end if;
 if a.reviewed_at is not null then return a.assessment_result_id;end if;
 if jsonb_typeof(p_short_scores) is distinct from 'array' or jsonb_array_length(p_short_scores)<>jsonb_array_length(q.questions) or p_feedback is null or length(p_feedback)>4000 then raise exception 'Scores and feedback required';end if;
 total=a.objective_marks;good=a.correct_count;bad=a.wrong_count;
 for i in 0..jsonb_array_length(q.questions)-1 loop
  item=q.questions->i;
  if item->>'type'='short' then
   score=(p_short_scores->>i)::numeric;
   if score is null or score::text in('NaN','Infinity','-Infinity') or score<0 or score>(item->>'marks')::numeric then raise exception 'Invalid short-answer marks';end if;
   if btrim(a.answers->>i)='' and score<>0 then raise exception 'Blank answers must score zero';end if;
   total=total+score;
   if btrim(a.answers->>i)<>'' then if score=(item->>'marks')::numeric then good=good+1;else bad=bad+1;end if;end if;
  end if;
 end loop;
 insert into public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,feedback,graded_by,assessment_kind,source_quiz_attempt_id)
 values(q.institution_id,q.academic_group_id,a.student_membership_id,left(case q.assessment_kind when 'weekly' then 'Weekly Test · '||q.title when 'monthly' then 'Monthly Test · '||q.title else q.title end,180),q.subject_name,q.quiz_date,total,q.max_marks,p_feedback,auth.uid(),case q.assessment_kind when 'weekly' then 'weekly_quiz' when 'monthly' then 'monthly_test' else q.exam_key end,a.id) returning id into result_id;
 update public.noor_quiz_attempts set short_scores=p_short_scores,final_marks=total,correct_count=good,wrong_count=bad,pending_count=0,feedback=p_feedback,reviewed_by=auth.uid(),reviewed_at=now(),assessment_result_id=result_id,grading_status='completed' where id=p_attempt;
 return result_id;
end $f$;

-- A student receives a compact key only after the scheduled day and teacher approval.

create policy test_category_teacher_read on public.noor_group_report_settings for select to authenticated using(private.noor_can_publish_learning(institution_id,academic_group_id));
