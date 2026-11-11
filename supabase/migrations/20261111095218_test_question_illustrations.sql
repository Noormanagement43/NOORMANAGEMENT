-- Preserve the approved picture scene; arbitrary SVG/HTML is never accepted.
create or replace function private.noor_publish_test(p_institution uuid,p_group uuid,p_title text,p_subject text,p_date date,p_questions jsonb,p_keys jsonb,p_settings jsonb,p_report jsonb)
returns uuid language plpgsql security definer set search_path='' as $f$
declare v_teacher uuid; v_id uuid; q jsonb; k jsonb; clean jsonb='[]'; n integer; total numeric=0; options jsonb; score numeric; rule public.noor_test_rules; mode text; exam text;
begin
 if auth.uid() is null or not private.noor_can_publish_learning(p_institution,p_group) then raise exception 'Assigned teaching staff required' using errcode='42501';end if;
 select id into strict v_teacher from public.institution_memberships where institution_id=p_institution and user_id=auth.uid() and status='active' and role in('teacher','faculty');
 mode=coalesce(p_settings->>'kind','weekly');exam=coalesce(p_settings->>'exam_key',mode);
 if mode not in('weekly','monthly','exam') or length(exam) not between 1 and 90 or(mode in('weekly','monthly') and exam<>mode) or(mode='exam' and exam in('weekly','monthly')) then raise exception 'Invalid test category';end if;
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
  clean=clean||jsonb_build_array(jsonb_build_object('type',q->>'type','prompt',btrim(q->>'prompt'),'marks',score,'options',options,'response_mode',coalesce(q->>'response_mode','short'),'scene',case when q->>'scene' in('sunrise','water','plant','reading','watering','farmer','animal') then q->>'scene' else 'none' end,'visuals',case when jsonb_typeof(q->'visuals')='array' then q->'visuals' else '[]'::jsonb end));total=total+score;
 end loop;
 if p_settings->>'question_count' is null or p_settings->>'max_marks' is null then raise exception 'Test counts and marks required';end if;
 if n<>coalesce(rule.question_count,(p_settings->>'question_count')::int) or total<>coalesce(rule.max_marks,(p_settings->>'max_marks')::numeric) then raise exception 'Questions and total marks must match test settings';end if;
 if rule.exam_key is not null and exists(select 1 from jsonb_array_elements(clean) x where not (rule.formats ? case when x->>'type'='short' then coalesce(x->>'response_mode','short') else x->>'type' end)) then raise exception 'Question format not allowed by principal';end if;
 insert into public.noor_weekly_quizzes(institution_id,academic_group_id,teacher_membership_id,created_by,title,subject_name,quiz_date,questions,max_marks,assessment_kind,exam_key,duration_minutes,auto_grade)
 values(p_institution,p_group,v_teacher,auth.uid(),btrim(p_title),btrim(p_subject),p_date,clean,total,mode,exam,coalesce(rule.duration_minutes,least(180,greatest(5,(p_settings->>'duration_minutes')::int)),30),true) returning id into v_id;
 insert into private.noor_quiz_keys(quiz_id,answer_key,generation_report) values(v_id,p_keys,coalesce(p_report,'{}'));
 return v_id;
end $f$;

