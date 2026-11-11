-- School-owned online test settings, multi-class publishing and durable automatic grading.
alter table public.noor_weekly_quizzes drop constraint noor_weekly_quizzes_quiz_date_check;
alter table public.noor_weekly_quizzes add column assessment_kind text not null default 'weekly' check(assessment_kind in('weekly','monthly','exam')),
 add column exam_key text not null default 'weekly',add column duration_minutes integer not null default 30 check(duration_minutes between 5 and 180),add column auto_grade boolean not null default false;
alter table public.noor_weekly_quizzes drop constraint noor_weekly_quizzes_institution_id_academic_group_id_subjec_key;
create unique index noor_test_date_unique on public.noor_weekly_quizzes(institution_id,academic_group_id,subject_name,quiz_date,exam_key);
alter table private.noor_quiz_keys add column generation_report jsonb not null default '{}';
alter table public.noor_quiz_attempts add column grading_details jsonb not null default '[]',add column grading_status text not null default 'manual';
create table public.noor_test_rules(
 institution_id uuid not null references public.institutions(id) on delete cascade,academic_group_id uuid not null,exam_key text not null check(length(exam_key) between 1 and 90),
 max_marks integer not null check(max_marks between 1 and 600),question_count integer not null check(question_count between 1 and 30),
 formats jsonb not null check(jsonb_typeof(formats)='array' and jsonb_array_length(formats) between 1 and 4 and formats <@ '["mcq","blank","one_word","short"]'::jsonb),
 difficulty text not null default 'challenging' check(difficulty in('balanced','challenging','advanced')),duration_minutes integer not null default 30 check(duration_minutes between 5 and 180),
 primary key(institution_id,academic_group_id,exam_key),foreign key(academic_group_id,institution_id) references public.academic_groups(id,institution_id) on delete cascade,
 check(max_marks between question_count and question_count*20)
);
alter table public.noor_test_rules enable row level security;
grant select,insert,update on public.noor_test_rules to authenticated;
create policy test_rules_read on public.noor_test_rules for select to authenticated using(private.is_active_member(institution_id));
create policy test_rules_create on public.noor_test_rules for insert to authenticated with check(private.can_manage_academics(institution_id));
create policy test_rules_edit on public.noor_test_rules for update to authenticated using(private.can_manage_academics(institution_id)) with check(private.can_manage_academics(institution_id));

create function private.noor_can_publish_learning(p_institution uuid,p_group uuid) returns boolean language sql stable security definer set search_path='' as $f$
 select auth.uid() is not null and private.has_institution_role(p_institution,array['teacher','faculty','principal','school_admin','university_admin','academic_admin']) and exists(select 1 from public.academic_groups g join public.institutions i on i.id=g.institution_id where g.id=p_group and g.institution_id=p_institution and g.is_active and i.status='active');
$f$;
revoke all on function private.noor_can_publish_learning(uuid,uuid) from public,anon;
grant execute on function private.noor_can_publish_learning(uuid,uuid) to authenticated;
alter policy noor_learning_create on public.noor_learning_items with check(created_by=(select auth.uid()) and private.noor_can_publish_learning(institution_id,academic_group_id));
alter policy noor_learning_read on public.noor_learning_items using((created_by=(select auth.uid()) and private.noor_can_publish_learning(institution_id,academic_group_id)) or private.noor_group_access(institution_id,academic_group_id,true) or(status='published' and private.noor_quiz_group_access(institution_id,academic_group_id,false) and(recipient_membership_id is null or private.is_my_membership(recipient_membership_id))));
alter policy noor_learning_edit on public.noor_learning_items using(private.noor_can_publish_learning(institution_id,academic_group_id) and(created_by=(select auth.uid()) or private.can_manage_academics(institution_id))) with check(private.noor_can_publish_learning(institution_id,academic_group_id) and(created_by=(select auth.uid()) or private.can_manage_academics(institution_id)));
alter policy quiz_read on public.noor_weekly_quizzes using(private.noor_quiz_group_access(institution_id,academic_group_id,false) or private.noor_quiz_group_access(institution_id,academic_group_id,true) or(created_by=(select auth.uid()) and private.noor_can_publish_learning(institution_id,academic_group_id)) or private.can_manage_academics(institution_id));
alter policy attempt_read on public.noor_quiz_attempts using(exists(select 1 from public.institution_memberships m join public.institutions i on i.id=m.institution_id where m.id=student_membership_id and m.institution_id=noor_quiz_attempts.institution_id and m.user_id=(select auth.uid()) and m.status='active' and i.status='active') or exists(select 1 from public.noor_weekly_quizzes q where q.id=quiz_id and((q.created_by=(select auth.uid()) and private.noor_can_publish_learning(q.institution_id,q.academic_group_id)) or private.noor_quiz_group_access(q.institution_id,q.academic_group_id,true))) or private.can_manage_academics(institution_id));

create table private.noor_test_grading_jobs(attempt_id uuid primary key references public.noor_quiz_attempts(id) on delete cascade,status text not null default 'queued',attempts integer not null default 0,next_at timestamptz not null default now(),lease_until timestamptz,error_code text);
revoke all on private.noor_test_grading_jobs from public,anon,authenticated;
create index noor_test_job_due on private.noor_test_grading_jobs(status,next_at);

create function private.noor_finish_auto_test(p_attempt uuid,p_scores jsonb,p_feedback text) returns uuid language plpgsql security definer set search_path='' as $f$
declare a public.noor_quiz_attempts;q public.noor_weekly_quizzes;k jsonb;item jsonb;v numeric;total numeric;good int;bad int;result uuid;details jsonb='[]';reason text;label text;
begin
 select * into strict a from public.noor_quiz_attempts where id=p_attempt for update;
 select * into strict q from public.noor_weekly_quizzes where id=a.quiz_id;
 if a.reviewed_at is not null then return a.assessment_result_id;end if;
 if not q.auto_grade or not exists(select 1 from public.institutions where id=q.institution_id and status='active') or not exists(select 1 from public.institution_memberships where id=a.student_membership_id and institution_id=q.institution_id and status='active') then raise exception 'Inactive test or membership';end if;
 if jsonb_typeof(p_scores) is distinct from 'array' or jsonb_array_length(p_scores)<>jsonb_array_length(q.questions) then raise exception 'All question scores required';end if;
 select answer_key into strict k from private.noor_quiz_keys where quiz_id=q.id;
 total=a.objective_marks;good=a.correct_count;bad=a.wrong_count;
 for i in 0..jsonb_array_length(q.questions)-1 loop
  item=q.questions->i;reason='';v=0;
  if item->>'type'='short' then
   v=(p_scores->i->>'marks')::numeric;reason=left(coalesce(p_scores->i->>'reason',''),2000);
   if v is null or v::text in('NaN','Infinity','-Infinity') or v<0 or v>(item->>'marks')::numeric or(btrim(a.answers->>i)='' and v<>0) then raise exception 'Invalid automatic mark';end if;
   total=total+v;
   if btrim(a.answers->>i)<>'' then if v=(item->>'marks')::numeric then good=good+1;else bad=bad+1;end if;end if;
  else
   if a.answers->>i=k->i->>'answer' then v=(item->>'marks')::numeric;reason='Correct. Well done!';else reason=coalesce(nullif(k->i->>'explanation',''),'Review this topic and try a similar question with your teacher.');end if;
  end if;
  details=details||jsonb_build_array(jsonb_build_object('number',i+1,'marks',v,'max_marks',(item->>'marks')::numeric,'reason',reason));
 end loop;
 label=case q.assessment_kind when 'weekly' then 'Weekly Test' when 'monthly' then 'Monthly Test' else q.title end;
 insert into public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,feedback,graded_by,assessment_kind,source_quiz_attempt_id)
 values(q.institution_id,q.academic_group_id,a.student_membership_id,left(label||' · '||q.title,180),q.subject_name,q.quiz_date,total,q.max_marks,left(coalesce(p_feedback,'Automatically checked against the teacher-approved answer key.'),4000),q.created_by,case q.assessment_kind when 'weekly' then 'weekly_quiz' when 'monthly' then 'monthly_test' else q.exam_key end,a.id) returning id into result;
 update public.noor_quiz_attempts set final_marks=total,short_scores=p_scores,correct_count=good,wrong_count=bad,pending_count=0,feedback=left(coalesce(p_feedback,''),4000),reviewed_at=now(),assessment_result_id=result,grading_details=details,grading_status='completed' where id=p_attempt;
 update private.noor_test_grading_jobs set status='done',lease_until=null where attempt_id=p_attempt;
 return result;
end $f$;
revoke all on function private.noor_finish_auto_test(uuid,jsonb,text) from public,anon,authenticated;

create function private.noor_claim_test_job(p_actor uuid default null,p_attempt uuid default null) returns jsonb language plpgsql security definer set search_path='' as $f$
declare j private.noor_test_grading_jobs;a public.noor_quiz_attempts;q public.noor_weekly_quizzes;v_limit int;used int;
begin
 select jobs.* into j from private.noor_test_grading_jobs jobs join public.noor_quiz_attempts at on at.id=jobs.attempt_id join public.noor_weekly_quizzes qt on qt.id=at.quiz_id join public.institutions inst on inst.id=at.institution_id and inst.status='active' join public.institution_memberships m on m.id=at.student_membership_id and m.status='active'
 where (p_attempt is null or at.id=p_attempt) and(p_actor is null or(exists(select 1 from public.institution_memberships actor where actor.institution_id=at.institution_id and actor.user_id=p_actor and actor.status='active') and(m.user_id=p_actor or qt.created_by=p_actor))) and at.reviewed_at is null and jobs.attempts<5 and((jobs.status in('queued','retry') and jobs.next_at<=now()) or(jobs.status='running' and jobs.lease_until<now())) order by jobs.next_at limit 1 for update of jobs skip locked;
 if j.attempt_id is null then return null;end if;
 select * into a from public.noor_quiz_attempts where id=j.attempt_id;select * into q from public.noor_weekly_quizzes where id=a.quiz_id;
 perform pg_advisory_xact_lock(hashtextextended(a.institution_id::text,2));
 select coalesce(per_institution_daily,1000) into v_limit from private.noor_ai_limits where institution_id=a.institution_id;v_limit=coalesce(v_limit,1000);
 select coalesce(sum(units),0) into used from private.noor_ai_daily_usage where institution_id=a.institution_id and usage_date=(now() at time zone 'UTC')::date;
 if used>=v_limit then update private.noor_test_grading_jobs set status='retry',next_at=now()+interval '15 minutes',error_code='CAPACITY' where attempt_id=a.id;return null;end if;
 insert into private.noor_ai_daily_usage(institution_id,usage_date,actor_id,units) values(a.institution_id,(now() at time zone 'UTC')::date,q.created_by,1) on conflict(institution_id,usage_date,actor_id) do update set units=private.noor_ai_daily_usage.units+1;
 update private.noor_test_grading_jobs set status='running',attempts=attempts+1,lease_until=now()+interval '2 minutes' where attempt_id=a.id;
 update public.noor_quiz_attempts set grading_status='checking' where id=a.id;
 return jsonb_build_object('attempt_id',a.id,'questions',q.questions,'answers',a.answers,'subject',q.subject_name,'answer_key',(select answer_key from private.noor_quiz_keys where quiz_id=q.id));
end $f$;
create function public.noor_claim_test_job(p_actor uuid default null,p_attempt uuid default null) returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_claim_test_job(p_actor,p_attempt);$f$;
revoke all on function private.noor_claim_test_job(uuid,uuid),public.noor_claim_test_job(uuid,uuid) from public,anon,authenticated;
grant execute on function private.noor_claim_test_job(uuid,uuid),public.noor_claim_test_job(uuid,uuid) to service_role;
create function public.noor_finish_auto_test(p_attempt uuid,p_scores jsonb,p_feedback text) returns uuid language sql security invoker set search_path='' as $f$ select private.noor_finish_auto_test(p_attempt,p_scores,p_feedback);$f$;
revoke all on function public.noor_finish_auto_test(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.noor_finish_auto_test(uuid,jsonb,text),private.noor_finish_auto_test(uuid,jsonb,text) to service_role;
create function private.noor_retry_test_job(p_attempt uuid) returns void language plpgsql security definer set search_path='' as $f$ begin
 update private.noor_test_grading_jobs set status=case when attempts>=5 then 'review' else 'retry' end,next_at=now()+make_interval(secs=>least(900,30*power(2,attempts)::int)),lease_until=null,error_code='CHECKING_UNAVAILABLE' where attempt_id=p_attempt;
 update public.noor_quiz_attempts set grading_status=case when (select status from private.noor_test_grading_jobs where attempt_id=p_attempt)='review' then 'teacher_review' else 'queued' end where id=p_attempt and reviewed_at is null;
end $f$;
create function public.noor_retry_test_job(p_attempt uuid) returns void language sql security invoker set search_path='' as $f$ select private.noor_retry_test_job(p_attempt);$f$;
revoke all on function private.noor_retry_test_job(uuid),public.noor_retry_test_job(uuid) from public,anon,authenticated;
grant execute on function private.noor_retry_test_job(uuid),public.noor_retry_test_job(uuid) to service_role;
create function private.noor_publish_test(p_institution uuid,p_group uuid,p_title text,p_subject text,p_date date,p_questions jsonb,p_keys jsonb,p_settings jsonb,p_report jsonb)
returns uuid language plpgsql security definer set search_path='' as $f$
declare v_teacher uuid; v_id uuid; q jsonb; k jsonb; clean jsonb='[]'; n integer; total numeric=0; options jsonb; score numeric; rule public.noor_test_rules; mode text; exam text;
begin
 if auth.uid() is null or not private.noor_can_publish_learning(p_institution,p_group) then raise exception 'Assigned teaching staff required' using errcode='42501';end if;
 select id into strict v_teacher from public.institution_memberships where institution_id=p_institution and user_id=auth.uid() and status='active' and role in('teacher','faculty');
 mode=coalesce(p_settings->>'kind','weekly');exam=coalesce(p_settings->>'exam_key',mode);
 if mode not in('weekly','monthly','exam') or length(exam)>90 then raise exception 'Invalid test category';end if;
 select * into rule from public.noor_test_rules where institution_id=p_institution and academic_group_id in(p_group,(select parent_group_id from public.academic_groups where id=p_group)) and exam_key=exam order by (academic_group_id=p_group) desc limit 1;
 if p_date is null or (mode='weekly' and extract(dow from p_date)<>6) or p_date<(select (now() at time zone timezone)::date from public.institutions where id=p_institution)
  or p_title is null or length(btrim(p_title)) not between 1 and 180 or p_subject is null or length(btrim(p_subject)) not between 1 and 140
  or jsonb_typeof(p_questions) is distinct from 'array' or jsonb_typeof(p_keys) is distinct from 'array'
 then raise exception 'Valid Saturday, title, subject, questions and keys required';end if;
 n=jsonb_array_length(p_questions);
 if n not between 1 and 30 or jsonb_array_length(p_keys)<>n then raise exception 'Use 1 to 30 questions and matching keys';end if;
 for i in 0..n-1 loop
  q=p_questions->i;k=p_keys->i; options=q->'options';score=(q->>'marks')::numeric;
  if q->>'type' is null or q->>'type' not in('mcq','blank','short') or coalesce(length(btrim(q->>'prompt')),0) not between 1 and 2000
   or score is null or score::text in('NaN','Infinity','-Infinity') or score<=0 or score>20
   or coalesce(length(btrim(k->>'answer')),0) not between 1 and 2000 then raise exception 'Invalid question or key at %',i+1;end if;
  if q->>'type' in('mcq','blank') then
   if jsonb_typeof(options) is distinct from 'array' or jsonb_array_length(options) not between 2 and 6
    or exists(select 1 from jsonb_array_elements(options) o where jsonb_typeof(o)<>'string' or length(btrim(o#>>'{}')) not between 1 and 300)
    or (select count(distinct btrim(o#>>'{}')) from jsonb_array_elements(options) o)<>jsonb_array_length(options)
    or (k->>'answer')!~'^[0-5]$' or (k->>'answer')::int>=jsonb_array_length(options)
   then raise exception 'Choice options and zero-based answer index required at %',i+1;end if;
  else options='[]';end if;
  if coalesce(q->>'response_mode','short') not in('short','one_word') then raise exception 'Invalid answer format';end if;
  clean=clean||jsonb_build_array(jsonb_build_object('type',q->>'type','prompt',btrim(q->>'prompt'),'marks',score,'options',options,'response_mode',coalesce(q->>'response_mode','short'),'visuals',case when jsonb_typeof(q->'visuals')='array' then q->'visuals' else '[]'::jsonb end));total=total+score;
 end loop;
 if p_settings->>'question_count' is null or p_settings->>'max_marks' is null then raise exception 'Test counts and marks required';end if;
 if n<>coalesce(rule.question_count,(p_settings->>'question_count')::int) or total<>coalesce(rule.max_marks,(p_settings->>'max_marks')::numeric) then raise exception 'Questions and total marks must match test settings';end if;
 if rule.exam_key is not null and exists(select 1 from jsonb_array_elements(clean) x where not (rule.formats ? case when x->>'type'='short' then coalesce(x->>'response_mode','short') else x->>'type' end)) then raise exception 'Question format not allowed by principal';end if;
 insert into public.noor_weekly_quizzes(institution_id,academic_group_id,teacher_membership_id,created_by,title,subject_name,quiz_date,questions,max_marks,assessment_kind,exam_key,duration_minutes,auto_grade)
 values(p_institution,p_group,v_teacher,auth.uid(),btrim(p_title),btrim(p_subject),p_date,clean,total,mode,exam,coalesce(rule.duration_minutes,least(180,greatest(5,(p_settings->>'duration_minutes')::int)),30),true) returning id into v_id;
 insert into private.noor_quiz_keys(quiz_id,answer_key,generation_report) values(v_id,p_keys,coalesce(p_report,'{}'));
 return v_id;
end $f$;

create function public.noor_publish_test(p_institution uuid,p_group uuid,p_title text,p_subject text,p_date date,p_questions jsonb,p_keys jsonb,p_settings jsonb,p_report jsonb) returns uuid language sql security invoker set search_path='' as $f$ select private.noor_publish_test(p_institution,p_group,p_title,p_subject,p_date,p_questions,p_keys,p_settings,p_report);$f$;
revoke all on function private.noor_publish_test(uuid,uuid,text,text,date,jsonb,jsonb,jsonb,jsonb),public.noor_publish_test(uuid,uuid,text,text,date,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function private.noor_publish_test(uuid,uuid,text,text,date,jsonb,jsonb,jsonb,jsonb),public.noor_publish_test(uuid,uuid,text,text,date,jsonb,jsonb,jsonb,jsonb) to authenticated;

create or replace function private.noor_submit_quiz(p_quiz uuid,p_answers jsonb)
returns uuid language plpgsql security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes; member uuid; v_id uuid; keys jsonb; item jsonb; ans text; total numeric=0; good int=0; bad int=0; blank int=0; pending int=0; local_day date; scored jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false) then raise exception 'Only enrolled students can submit' using errcode='42501';end if;
 select (now() at time zone timezone)::date into local_day from public.institutions where id=q.institution_id;
 if local_day<>q.quiz_date then raise exception 'Test can be submitted on its scheduled date only';end if;
 select id into strict member from public.institution_memberships where institution_id=q.institution_id and user_id=auth.uid() and status='active' and role in('student','university_student');
 if exists(select 1 from public.noor_quiz_attempts where quiz_id=p_quiz and student_membership_id=member) then raise exception 'Final submission is locked';end if;
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

create or replace function private.noor_quiz_review_data(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes; result jsonb;
begin
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if auth.uid() is null or not(private.noor_quiz_group_access(q.institution_id,q.academic_group_id,true) or(q.created_by=auth.uid() and private.noor_can_publish_learning(q.institution_id,q.academic_group_id))) then raise exception 'Assigned teacher required' using errcode='42501';end if;
 select jsonb_build_object('answer_key',k.answer_key,'generation_report',k.generation_report,'students',coalesce((select jsonb_agg(jsonb_build_object('membership_id',m.id,'name',p.full_name)) from public.noor_quiz_attempts a join public.institution_memberships m on m.id=a.student_membership_id and m.institution_id=a.institution_id join public.profiles p on p.id=m.user_id where a.quiz_id=p_quiz),'[]')) into result from private.noor_quiz_keys k where k.quiz_id=p_quiz;
 return result;
end $f$;

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
 values(q.institution_id,q.academic_group_id,a.student_membership_id,left('Weekly Quiz · '||q.title,180),q.subject_name,q.quiz_date,total,q.max_marks,p_feedback,auth.uid(),'weekly_quiz',a.id) returning id into result_id;
 update public.noor_quiz_attempts set short_scores=p_short_scores,final_marks=total,correct_count=good,wrong_count=bad,pending_count=0,feedback=p_feedback,reviewed_by=auth.uid(),reviewed_at=now(),assessment_result_id=result_id where id=p_attempt;
 return result_id;
end $f$;

-- A student receives a compact key only after the scheduled day and teacher approval.

select cron.schedule('noor-auto-test-grading','* * * * *',$worker$
 select net.http_post(url:='https://ayrryemawwplguaauxij.supabase.co/functions/v1/noor-test-grader',headers:=jsonb_build_object('Content-Type','application/json','x-noor-worker-token',(select token_value from private.noor_worker_credentials where name='email-worker')),body:='{}'::jsonb,timeout_milliseconds:=60000)
 where exists(select 1 from private.noor_test_grading_jobs where status in('queued','retry','running') and next_at<=now());
$worker$);
notify pgrst,'reload schema';
