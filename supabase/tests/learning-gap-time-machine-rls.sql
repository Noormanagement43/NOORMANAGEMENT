-- ROLLBACK-ONLY staging verification for Learning Gap Time Machine.
-- Test actors are existing non-platform auth users; new school/student rows never persist.
-- Require the Learning Gap migration to be applied in staging before running.
begin;
set local statement_timeout='45s';
set local lock_timeout='5s';
update public.noor_feature_defaults set enabled=true where feature_key='learning_gap_time_machine';

do $fixture$
declare users uuid[]; inst_a uuid:=gen_random_uuid();inst_b uuid:=gen_random_uuid();
 class_a uuid:=gen_random_uuid();class_b uuid:=gen_random_uuid();group_x uuid:=gen_random_uuid();group_y uuid:=gen_random_uuid();group_b uuid:=gen_random_uuid();
 student_a uuid:=gen_random_uuid();student_y uuid:=gen_random_uuid();student_b uuid:=gen_random_uuid();
 teacher_a uuid:=gen_random_uuid();parent_a uuid:=gen_random_uuid();concept_a uuid:=gen_random_uuid();concept_b uuid:=gen_random_uuid(); quiz_a uuid:=gen_random_uuid();attempt_a uuid:=gen_random_uuid();items integer;
begin
 select array_agg(id) into users from (select id from auth.users where id not in (select user_id from public.platform_roles) order by id limit 4)x;
 if array_length(users,1)<4 then raise exception 'Requires four non-platform test identities';end if;
 insert into public.institutions(id,name,slug,institution_type,status) values
 (inst_a,'LG RLS fixture A','lg-rls-'||inst_a,'school','active'),
 (inst_b,'LG RLS fixture B','lg-rls-'||inst_b,'school','active');
 insert into public.institution_memberships(id,institution_id,user_id,role,status) values
 (student_a,inst_a,users[1],'student','active'),
 (teacher_a,inst_a,users[2],'teacher','active'),
 (parent_a,inst_a,users[3],'parent','active'),
 (student_b,inst_b,users[4],'student','active');
 insert into public.institution_memberships(id,institution_id,invited_email,role,status) values
 (student_y,inst_a,'lg-test-peer@example.invalid','student','active');
 insert into public.academic_groups(id,institution_id,name,group_type,parent_group_id) values
 (class_a,inst_a,'Class 3','class',null),
 (class_b,inst_b,'Class 3','class',null),
 (group_x,inst_a,'Section X','section',class_a),
 (group_y,inst_a,'Section Y','section',class_a),
 (group_b,inst_b,'Section X','section',class_b);
 insert into public.academic_group_memberships(institution_id,group_id,membership_id,group_role) values
 (inst_a,group_x,student_a,'student'),
 (inst_a,group_y,student_y,'student'),
 (inst_a,group_x,teacher_a,'teacher'),
 (inst_b,group_b,student_b,'student');
 insert into public.noor_guardian_links(institution_id,guardian_membership_id,student_membership_id,created_by)
 values(inst_a,parent_a,student_a,users[2]);
 insert into public.learning_concepts(id,institution_id,class_group_id,concept_title,status) values
 (concept_a,inst_a,class_a,'Place Value','approved'),
 (concept_b,inst_b,class_b,'Place Value','approved');
 insert into public.student_concept_evidence(institution_id,student_membership_id,concept_id,source_type,source_id,question_index,earned,possible,assessed_at)
 values(inst_a,student_a,concept_a,'teacher_diagnostic',gen_random_uuid(),0,0,1,now()),
       (inst_a,student_y,concept_a,'teacher_diagnostic',gen_random_uuid(),0,1,1,now()),
       (inst_b,student_b,concept_b,'teacher_diagnostic',gen_random_uuid(),0,0,1,now());
 -- Realistic review event and exact question mapping, still rollback-only.
 insert into public.noor_weekly_quizzes(id,institution_id,academic_group_id,teacher_membership_id,created_by,title,subject_name,quiz_date,questions,max_marks)
 values(quiz_a,inst_a,group_x,teacher_a,users[2],'LG rollback concept quiz','Mathematics',
 current_date+(6-extract(dow from current_date)::int+7)%7,
 '[{"type":"mcq","prompt":"Which digit is tens?","options":["2","4"],"marks":1}]'::jsonb,1);
 insert into private.noor_quiz_keys(quiz_id,answer_key) values(quiz_a,'[{"answer":"0"}]'::jsonb);
 insert into public.assessment_concept_mapping(institution_id,assessment_id,question_index,concept_id,approved_by)
 values(inst_a,quiz_a,0,concept_a,users[2]);
 insert into public.noor_quiz_attempts(id,quiz_id,institution_id,student_membership_id,answers,objective_marks,correct_count,wrong_count,unanswered_count,pending_count,reviewed_at,reviewed_by,short_scores,final_marks)
 values(attempt_a,quiz_a,inst_a,student_a,'["1"]'::jsonb,0,0,1,0,0,now(),users[2],'[]'::jsonb,0);
 select count(*) into items from public.student_concept_evidence where source_type='approved_quiz' and source_id=attempt_a;
 if items<>1 then raise exception 'Approved quiz trigger did not ingest concept evidence';end if;
 perform private.noor_lg_ingest_attempt(attempt_a);
 perform private.noor_lg_ingest_attempt(attempt_a);
 select count(*) into items from public.student_concept_evidence where source_type='approved_quiz' and source_id=attempt_a;
 if items<>1 then raise exception 'Repeated review created duplicate evidence';end if;
 perform private.noor_lg_recompute(inst_a,student_a,concept_a);
 perform private.noor_lg_recompute(inst_a,student_y,concept_a);
 perform private.noor_lg_recompute(inst_b,student_b,concept_b);
 if not exists (select 1 from public.student_concept_mastery where institution_id=inst_a and student_membership_id=student_a
 and concept_id=concept_a and estimated_mastery is null and mastery_state='Not Enough Evidence')
 then raise exception 'Single wrong answer incorrectly confirmed';end if;
 perform set_config('lg.audit.group_x',group_x::text,true);
 perform set_config('lg.audit.group_b',group_b::text,true);
 perform set_config('lg.audit.concept_a',concept_a::text,true);
 perform set_config('lg.audit.inst_a',inst_a::text,true);
 perform set_config('lg.audit.inst_b',inst_b::text,true);
 perform set_config('lg.audit.student_a',student_a::text,true);
 perform set_config('lg.audit.student_y',student_y::text,true);
 perform set_config('lg.audit.student_b',student_b::text,true);
 perform set_config('lg.audit.user_student',users[1]::text,true);
 perform set_config('lg.audit.user_teacher',users[2]::text,true);
 perform set_config('lg.audit.user_parent',users[3]::text,true);
 perform set_config('lg.audit.user_school_b',users[4]::text,true);
end $fixture$;

-- RLS must prevent all peer and other school rows for student.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lg.audit.user_student'),true);
do $check_student$
declare own_cnt int;peer_cnt int;foreign_cnt int; denied boolean:=false;
begin
 select count(*) into own_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_a')::uuid;
 select count(*) into peer_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_y')::uuid;
 select count(*) into foreign_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_b')::uuid;
 if own_cnt<>1 or peer_cnt<>0 or foreign_cnt<>0 then raise exception 'Student learning privacy failed: %,%,%',own_cnt,peer_cnt,foreign_cnt;end if;
 begin
  insert into public.student_concept_evidence(institution_id,student_membership_id,concept_id,source_type,source_id,question_index,earned,possible,assessed_at)
  select institution_id,student_membership_id,concept_id,'teacher_diagnostic',gen_random_uuid(),3,1,1,now()
  from public.student_concept_evidence where student_membership_id=current_setting('lg.audit.student_a')::uuid limit 1;
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Student inserted unauthorized evidence';end if;
end $check_student$;

-- Teacher section X must not read section Y, even in the same school.
select set_config('request.jwt.claim.sub',current_setting('lg.audit.user_teacher'),true);
do $check_teacher$
declare own_cnt int;peer_cnt int;foreign_cnt int;
begin
 select count(*) into own_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_a')::uuid;
 select count(*) into peer_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_y')::uuid;
 select count(*) into foreign_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_b')::uuid;
 if own_cnt<>1 or peer_cnt<>0 or foreign_cnt<>0 then raise exception 'Teacher section isolation failed: %,%,%',own_cnt,peer_cnt,foreign_cnt;end if;
end $check_teacher$;

-- Guardian can only read actively linked child, not their class peers.
select set_config('request.jwt.claim.sub',current_setting('lg.audit.user_parent'),true);
do $check_parent$
declare own_cnt int;peer_cnt int;
begin
 select count(*) into own_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_a')::uuid;
 select count(*) into peer_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_y')::uuid;
 if own_cnt<>1 or peer_cnt<>0 then raise exception 'Guardian child-only policy failed: %,%',own_cnt,peer_cnt;end if;
end $check_parent$;

-- Other-school student cannot inspect school A.
select set_config('request.jwt.claim.sub',current_setting('lg.audit.user_school_b'),true);
do $check_other$
declare own_cnt int;other_cnt int;
begin
 select count(*) into own_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_b')::uuid;
 select count(*) into other_cnt from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_a')::uuid;
 if own_cnt<>1 or other_cnt<>0 then raise exception 'Cross-school student isolation failed';end if;
end $check_other$;

reset role;
-- RLS must be enabled on every new public table; AI audit should not have a read policy.
do $check_catalog$
declare n integer; log_policy integer;
begin
 select count(*) into n from pg_class t join pg_namespace ns on ns.oid=t.relnamespace
 where ns.nspname='public' and t.relname in
 ('learning_concepts','concept_dependencies','assessment_concept_mapping','student_concept_evidence','student_concept_mastery','learning_gap_findings','learning_recovery_plans','learning_recovery_activities','learning_reassessments','learning_ai_audit_logs','learning_timeline_events')
 and t.relrowsecurity;
 if n<>11 then raise exception 'Only % learning tables have RLS; expected 11',n;end if;
 select count(*) into log_policy from pg_policies where schemaname='public' and tablename='learning_ai_audit_logs' and cmd='SELECT';
 if log_policy<>0 then raise exception 'AI audit logs are exposed to clients';end if;
end $check_catalog$;

-- Verified learning lifecycle and curriculum authoring for school and College subjects.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lg.audit.user_teacher'),true);
do $curriculum$
declare x uuid; y uuid; blocked boolean:=false;
begin
 x:=public.noor_lg_add_concept(current_setting('lg.audit.group_x')::uuid,'Biology','Cell Structure','college-stream-v1',null);
 y:=public.noor_lg_add_concept(current_setting('lg.audit.group_x')::uuid,'Biology','Cell Processes','college-stream-v1',x);
 if not exists(select 1 from public.concept_dependencies where concept_id=y and prerequisite_concept_id=x)
 then raise exception 'Configurable college prerequisites missing';end if;
 begin
 perform public.noor_lg_add_concept(current_setting('lg.audit.group_x')::uuid,'Biology','Cell Structure','college-stream-v1',y);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Circular prerequisite relationship accepted';end if;
 blocked:=false;
 begin perform public.noor_lg_add_concept(current_setting('lg.audit.group_b')::uuid,'Maths','Unauthorized Topic','school-v1',null);
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Teacher authored an unauthorized school concept';end if;
end $curriculum$;

do $ai_context$
declare ctx jsonb; denied boolean:=false;
begin
 ctx:=public.noor_lg_ai_context(current_setting('lg.audit.student_a')::uuid,current_setting('lg.audit.concept_a')::uuid);
 if ctx->>'concept_title'<>'Place Value' or jsonb_array_length(ctx->'evidence')<2
 then raise exception 'Authorized teacher AI context missing checked evidence';end if;
 begin
  perform public.noor_lg_ai_context(current_setting('lg.audit.student_y')::uuid,current_setting('lg.audit.concept_a')::uuid);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'AI context leaked another section';end if;
end $ai_context$;

do $diagnostic$
declare sid uuid;plan uuid;current_pct numeric;total int; i int;
 questions jsonb:='["Explain place value using blocks.","Find the tens in a number.","Show three hundreds and two tens."]'::jsonb;
 recheck jsonb:='["Apply the idea correctly in example one.","Apply the idea correctly in example two.","Apply the idea correctly in example three.","Apply the idea correctly in example four.","Apply the idea correctly in example five."]'::jsonb;
begin
 perform public.noor_lg_diagnostic(current_setting('lg.audit.student_a')::uuid,current_setting('lg.audit.concept_a')::uuid,
  questions,'[0,0,0]'::jsonb);
 if not exists(select 1 from public.learning_gap_findings where student_membership_id=current_setting('lg.audit.student_a')::uuid
  and concept_id=current_setting('lg.audit.concept_a')::uuid and status='needs_review')
 then raise exception 'Independent diagnostic failed to trigger teacher review';end if;
 perform public.noor_lg_review(current_setting('lg.audit.student_a')::uuid,current_setting('lg.audit.concept_a')::uuid,'confirm',null);
 plan:=public.noor_lg_review(current_setting('lg.audit.student_a')::uuid,current_setting('lg.audit.concept_a')::uuid,'assign_plan',
  jsonb_build_object('lesson','Use physical objects to model place value during a short explanation.','practice','Show another example using blocks.'));
 perform set_config('lg.audit.recovery_plan',plan::text,true);
 if not exists(select 1 from public.learning_recovery_plans where id=plan and teacher_status='assigned')
 then raise exception 'Teacher plan not assigned';end if;
end $diagnostic$;

select set_config('request.jwt.claim.sub',current_setting('lg.audit.user_student'),true);
do $practice$
begin
 if not public.noor_lg_complete(current_setting('lg.audit.recovery_plan')::uuid)
 then raise exception 'Assigned learner could not complete practice';end if;
end $practice$;

select set_config('request.jwt.claim.sub',current_setting('lg.audit.user_teacher'),true);
do $reassess$
declare i int; score numeric; n int;
 questions jsonb:='["Show place value example one.","Show place value example two.","Show place value example three.","Show place value example four.","Show place value example five."]'::jsonb;
begin
 for i in 1..3 loop
  perform public.noor_lg_reassess(current_setting('lg.audit.recovery_plan')::uuid,questions,'[1,1,1,1,1]'::jsonb);
 end loop;
 select estimated_mastery into score from public.student_concept_mastery where student_membership_id=current_setting('lg.audit.student_a')::uuid
  and concept_id=current_setting('lg.audit.concept_a')::uuid;
 if score<75 then raise exception 'Reassessment did not update demonstrated progress: %',score;end if;
 perform public.noor_lg_review(current_setting('lg.audit.student_a')::uuid,current_setting('lg.audit.concept_a')::uuid,'resolve',null);
 if not exists(select 1 from public.learning_gap_findings where student_membership_id=current_setting('lg.audit.student_a')::uuid
  and concept_id=current_setting('lg.audit.concept_a')::uuid and status='resolved')
 then raise exception 'Teacher did not resolve verified learning progress';end if;
 select count(*) into n from public.learning_reassessments where plan_id=current_setting('lg.audit.recovery_plan')::uuid;
 if n<>3 then raise exception 'Reassessments not recorded independently';end if;
end $reassess$;
reset role;

rollback;
