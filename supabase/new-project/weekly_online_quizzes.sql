-- Online Saturday quizzes: private keys, immutable attempts and teacher-approved marks.
create table public.noor_weekly_quizzes (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 academic_group_id uuid not null, teacher_membership_id uuid not null, created_by uuid not null references auth.users(id),
 title text not null check(length(btrim(title)) between 1 and 180),
 subject_name text not null check(length(btrim(subject_name)) between 1 and 140),
 quiz_date date not null check(extract(dow from quiz_date)=6),
 questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 30),
 max_marks numeric not null check(max_marks>0 and max_marks<=600),
 approved_at timestamptz not null default now(), created_at timestamptz not null default now(),
 foreign key(academic_group_id,institution_id) references public.academic_groups(id,institution_id),
 foreign key(teacher_membership_id,institution_id) references public.institution_memberships(id,institution_id),
 unique(institution_id,academic_group_id,subject_name,quiz_date)
);
create table private.noor_quiz_keys (
 quiz_id uuid primary key references public.noor_weekly_quizzes(id) on delete cascade,
 answer_key jsonb not null check(jsonb_typeof(answer_key)='array')
);
create table public.noor_quiz_attempts (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.noor_weekly_quizzes(id),
 institution_id uuid not null references public.institutions(id), student_membership_id uuid not null,
 answers jsonb not null, objective_marks numeric not null, correct_count integer not null, wrong_count integer not null,
 unanswered_count integer not null, pending_count integer not null,
 submitted_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references auth.users(id),
 short_scores jsonb, final_marks numeric, feedback text not null default '',
 assessment_result_id uuid unique references public.noor_assessment_results(id),
 foreign key(student_membership_id,institution_id) references public.institution_memberships(id,institution_id),
 unique(quiz_id,student_membership_id)
);
create index noor_quiz_schedule_idx on public.noor_weekly_quizzes(institution_id,quiz_date desc);
create index noor_quiz_group_idx on public.noor_weekly_quizzes(academic_group_id,institution_id);
create index noor_quiz_teacher_idx on public.noor_weekly_quizzes(teacher_membership_id,institution_id);
create index noor_quiz_student_idx on public.noor_quiz_attempts(student_membership_id,institution_id);
alter table public.noor_weekly_quizzes enable row level security;
alter table public.noor_quiz_attempts enable row level security;
alter table private.noor_quiz_keys enable row level security;
revoke all on public.noor_weekly_quizzes,public.noor_quiz_attempts from anon,authenticated;
revoke all on private.noor_quiz_keys from public,anon,authenticated;
grant select on public.noor_weekly_quizzes,public.noor_quiz_attempts to authenticated;

-- An enrolled section can see a class-wide quiz; another section cannot.
create function private.noor_quiz_group_access(p_institution uuid,p_group uuid,p_teacher boolean default false)
returns boolean language sql stable security definer set search_path='' as $f$
 select auth.uid() is not null and exists(
  select 1 from public.institution_memberships m
  join public.institutions i on i.id=m.institution_id and i.status='active'
  join public.academic_group_memberships gm on gm.membership_id=m.id and gm.institution_id=m.institution_id and gm.status='active'
  join public.academic_groups enrolled on enrolled.id=gm.group_id and enrolled.institution_id=m.institution_id and enrolled.is_active
  join public.academic_groups target on target.id=p_group and target.institution_id=m.institution_id and target.is_active
  where m.institution_id=p_institution and m.user_id=auth.uid() and m.status='active'
   and (enrolled.id=target.id or enrolled.parent_group_id=target.id)
   and case when p_teacher then m.role in('teacher','faculty') and gm.group_role in('teacher','faculty')
       else m.role in('student','university_student') and gm.group_role='student' end
 );
$f$;
revoke all on function private.noor_quiz_group_access(uuid,uuid,boolean) from public,anon;
grant execute on function private.noor_quiz_group_access(uuid,uuid,boolean) to authenticated;
create policy quiz_read on public.noor_weekly_quizzes for select to authenticated using(
 private.noor_quiz_group_access(institution_id,academic_group_id,false)
 or private.noor_quiz_group_access(institution_id,academic_group_id,true)
 or private.can_manage_academics(institution_id));
create policy attempt_read on public.noor_quiz_attempts for select to authenticated using(
 exists(select 1 from public.institution_memberships m join public.institutions i on i.id=m.institution_id
  where m.id=student_membership_id and m.institution_id=noor_quiz_attempts.institution_id and m.user_id=(select auth.uid()) and m.status='active' and i.status='active')
 or exists(select 1 from public.noor_weekly_quizzes q where q.id=quiz_id and private.noor_quiz_group_access(q.institution_id,q.academic_group_id,true))
 or private.can_manage_academics(institution_id));

create function private.noor_publish_quiz(p_institution uuid,p_group uuid,p_title text,p_subject text,p_date date,p_questions jsonb,p_keys jsonb)
returns uuid language plpgsql security definer set search_path='' as $f$
declare v_teacher uuid; v_id uuid; q jsonb; k jsonb; clean jsonb='[]'; n integer; total numeric=0; options jsonb; score numeric;
begin
 if auth.uid() is null or not private.noor_quiz_group_access(p_institution,p_group,true) then raise exception 'Assigned teaching staff required' using errcode='42501';end if;
 select id into strict v_teacher from public.institution_memberships where institution_id=p_institution and user_id=auth.uid() and status='active' and role in('teacher','faculty');
 if p_date is null or extract(dow from p_date)<>6 or p_date<(select (now() at time zone timezone)::date from public.institutions where id=p_institution)
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
  clean=clean||jsonb_build_array(jsonb_build_object('type',q->>'type','prompt',btrim(q->>'prompt'),'marks',score,'options',options));total=total+score;
 end loop;
 insert into public.noor_weekly_quizzes(institution_id,academic_group_id,teacher_membership_id,created_by,title,subject_name,quiz_date,questions,max_marks)
 values(p_institution,p_group,v_teacher,auth.uid(),btrim(p_title),btrim(p_subject),p_date,clean,total) returning id into v_id;
 insert into private.noor_quiz_keys values(v_id,p_keys);
 return v_id;
end $f$;

create function private.noor_submit_quiz(p_quiz uuid,p_answers jsonb)
returns uuid language plpgsql security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes; member uuid; v_id uuid; keys jsonb; item jsonb; ans text; total numeric=0; good int=0; bad int=0; blank int=0; pending int=0; local_day date;
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
 for i in 0..jsonb_array_length(q.questions)-1 loop
  item=q.questions->i;
  if jsonb_typeof(p_answers->i) is distinct from 'string' then raise exception 'Answers must be text';end if;
  ans=btrim(p_answers->>i);if length(ans)>4000 then raise exception 'Answer exceeds 4000 characters';end if;
  if ans='' then blank=blank+1;
  elsif item->>'type'='short' then pending=pending+1;
  else
   if ans!~'^[0-5]$' or ans::int>=jsonb_array_length(item->'options') then raise exception 'Invalid selected option';end if;
   if ans=keys->i->>'answer' then good=good+1;total=total+(item->>'marks')::numeric;else bad=bad+1;end if;
  end if;
 end loop;
 insert into public.noor_quiz_attempts(quiz_id,institution_id,student_membership_id,answers,objective_marks,correct_count,wrong_count,unanswered_count,pending_count)
 values(p_quiz,q.institution_id,member,p_answers,total,good,bad,blank,pending) returning id into v_id;
 return v_id;
end $f$;

create function private.noor_quiz_review_data(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes; result jsonb;
begin
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if auth.uid() is null or not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,true) then raise exception 'Assigned teacher required' using errcode='42501';end if;
 select jsonb_build_object('answer_key',k.answer_key,'students',coalesce((select jsonb_agg(jsonb_build_object('membership_id',m.id,'name',p.full_name)) from public.noor_quiz_attempts a join public.institution_memberships m on m.id=a.student_membership_id and m.institution_id=a.institution_id join public.profiles p on p.id=m.user_id where a.quiz_id=p_quiz),'[]')) into result from private.noor_quiz_keys k where k.quiz_id=p_quiz;
 return result;
end $f$;

create function private.noor_approve_quiz_marks(p_attempt uuid,p_short_scores jsonb,p_feedback text)
returns uuid language plpgsql security definer set search_path='' as $f$
declare a public.noor_quiz_attempts; q public.noor_weekly_quizzes; item jsonb; score numeric; total numeric; good int; bad int; result_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict a from public.noor_quiz_attempts where id=p_attempt for update;
 select * into strict q from public.noor_weekly_quizzes where id=a.quiz_id;
 if not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,true) then raise exception 'Assigned teacher required' using errcode='42501';end if;
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
create function private.noor_quiz_result_key(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes; result jsonb;
begin
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if auth.uid() is null or not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false) then raise exception 'Enrolled student required' using errcode='42501';end if;
 if (select (now() at time zone timezone)::date from public.institutions where id=q.institution_id)<=q.quiz_date
 or not exists(select 1 from public.noor_quiz_attempts a join public.institution_memberships m on m.id=a.student_membership_id where a.quiz_id=p_quiz and m.user_id=auth.uid() and a.reviewed_at is not null) then return '[]';end if;
 select coalesce(jsonb_agg(jsonb_build_object('number',n,'answer',case when q.questions->(n::int-1)->>'type' in('mcq','blank') then chr(65+(k->>'answer')::int) else k->>'answer' end) order by n),'[]') into result from private.noor_quiz_keys keys,jsonb_array_elements(keys.answer_key) with ordinality t(k,n) where keys.quiz_id=p_quiz;
 return result;
end $f$;

alter table public.noor_assessment_results add column assessment_kind text not null default 'assessment';
alter table public.noor_assessment_results add column source_quiz_attempt_id uuid unique references public.noor_quiz_attempts(id);

-- Public invoker entrypoints; privileged code and keys stay outside the exposed schema.
create function public.noor_publish_quiz(p_institution uuid,p_group uuid,p_title text,p_subject text,p_date date,p_questions jsonb,p_keys jsonb) returns uuid language sql security invoker set search_path='' as $f$ select private.noor_publish_quiz(p_institution,p_group,p_title,p_subject,p_date,p_questions,p_keys); $f$;
create function public.noor_submit_quiz(p_quiz uuid,p_answers jsonb) returns uuid language sql security invoker set search_path='' as $f$ select private.noor_submit_quiz(p_quiz,p_answers); $f$;
create function public.noor_quiz_review_data(p_quiz uuid) returns jsonb language sql stable security invoker set search_path='' as $f$ select private.noor_quiz_review_data(p_quiz); $f$;
create function public.noor_approve_quiz_marks(p_attempt uuid,p_short_scores jsonb,p_feedback text) returns uuid language sql security invoker set search_path='' as $f$ select private.noor_approve_quiz_marks(p_attempt,p_short_scores,p_feedback); $f$;
create function public.noor_quiz_result_key(p_quiz uuid) returns jsonb language sql stable security invoker set search_path='' as $f$ select private.noor_quiz_result_key(p_quiz); $f$;
revoke all on function private.noor_publish_quiz(uuid,uuid,text,text,date,jsonb,jsonb),private.noor_submit_quiz(uuid,jsonb),private.noor_quiz_review_data(uuid),private.noor_approve_quiz_marks(uuid,jsonb,text),private.noor_quiz_result_key(uuid) from public,anon;
grant execute on function private.noor_publish_quiz(uuid,uuid,text,text,date,jsonb,jsonb),private.noor_submit_quiz(uuid,jsonb),private.noor_quiz_review_data(uuid),private.noor_approve_quiz_marks(uuid,jsonb,text),private.noor_quiz_result_key(uuid) to authenticated;
revoke all on function public.noor_publish_quiz(uuid,uuid,text,text,date,jsonb,jsonb),public.noor_submit_quiz(uuid,jsonb),public.noor_quiz_review_data(uuid),public.noor_approve_quiz_marks(uuid,jsonb,text),public.noor_quiz_result_key(uuid) from public,anon;
grant execute on function public.noor_publish_quiz(uuid,uuid,text,text,date,jsonb,jsonb),public.noor_submit_quiz(uuid,jsonb),public.noor_quiz_review_data(uuid),public.noor_approve_quiz_marks(uuid,jsonb,text),public.noor_quiz_result_key(uuid) to authenticated;
notify pgrst,'reload schema';
