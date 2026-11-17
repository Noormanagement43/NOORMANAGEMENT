-- NOOR Learning Gap Time Machine: configurable school (Nursery–Class 10) and college curricula.
-- No example student data is inserted. All learning evidence is historical/immutable.
set local lock_timeout='5s';
set local statement_timeout='60s';

insert into public.noor_feature_catalog(feature_key,label,category,description)
values('learning_gap_time_machine','Learning Gap Time Machine','academics','Teacher-reviewed Class 3 Maths concept evidence and recovery')
on conflict(feature_key) do nothing;
insert into public.noor_feature_defaults(feature_key,enabled)
values('learning_gap_time_machine',false) on conflict(feature_key) do nothing;

create table public.learning_concepts (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 class_group_id uuid not null,
 subject_name text not null default 'Mathematics',
 concept_title text not null check(length(concept_title) between 2 and 120),
 curriculum_version text not null default 'pilot-v1',
 status text not null default 'suggested' check(status in('suggested','approved','archived')),
 approved_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,institution_id),
 unique(institution_id,class_group_id,subject_name,curriculum_version,concept_title),
 foreign key(class_group_id,institution_id) references public.academic_groups(id,institution_id)
);
create table public.concept_dependencies (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 concept_id uuid not null,
 prerequisite_concept_id uuid not null,
 relationship_type text not null default 'prerequisite',
 approved_by uuid references auth.users(id),
 check(concept_id<>prerequisite_concept_id),
 unique(concept_id,prerequisite_concept_id),
 foreign key(concept_id,institution_id) references public.learning_concepts(id,institution_id),
 foreign key(prerequisite_concept_id,institution_id) references public.learning_concepts(id,institution_id)
);
create table public.assessment_concept_mapping (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 assessment_id uuid not null references public.noor_weekly_quizzes(id),
 question_index integer not null check(question_index between 0 and 29),
 concept_id uuid not null,
 weight numeric not null default 1 check(weight>0 and weight<=1),
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),
 unique(assessment_id,question_index),
 foreign key(concept_id,institution_id) references public.learning_concepts(id,institution_id)
);
create table public.student_concept_evidence (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 student_membership_id uuid not null,
 concept_id uuid not null,
 source_type text not null check(source_type in('approved_quiz','teacher_diagnostic','reassessment')),
 source_id uuid not null,
 question_index integer not null check(question_index>=0 and question_index<=29),
 earned numeric not null check(earned>=0),
 possible numeric not null check(possible>0),
 assessed_at timestamptz not null,
 recorded_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 check(earned<=possible),
 unique(institution_id,source_type,source_id,question_index,concept_id),
 foreign key(student_membership_id,institution_id) references public.institution_memberships(id,institution_id),
 foreign key(concept_id,institution_id) references public.learning_concepts(id,institution_id)
);
create table public.student_concept_mastery (
 institution_id uuid not null references public.institutions(id),
 student_membership_id uuid not null,
 concept_id uuid not null,
 estimated_mastery numeric,
 confidence numeric not null default 0 check(confidence between 0 and 1),
 evidence_count integer not null default 0,
 source_count integer not null default 0,
 mastery_state text not null default 'Not Enough Evidence',
 last_checked_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(institution_id,student_membership_id,concept_id),
 foreign key(student_membership_id,institution_id) references public.institution_memberships(id,institution_id),
 foreign key(concept_id,institution_id) references public.learning_concepts(id,institution_id)
);
create table public.learning_gap_findings (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 student_membership_id uuid not null,
 concept_id uuid not null,
 finding_type text not null default 'observed_gap' check(finding_type in('observed_gap','possible_root_cause')),
 evidence_summary jsonb not null default '{}'::jsonb,
 confidence numeric not null default 0 check(confidence between 0 and 1),
 status text not null default 'not_enough_evidence' check(status in('not_enough_evidence','needs_review','confirmed','dismissed','resolved')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(institution_id,student_membership_id,concept_id,finding_type),
 foreign key(student_membership_id,institution_id) references public.institution_memberships(id,institution_id),
 foreign key(concept_id,institution_id) references public.learning_concepts(id,institution_id)
);
create table public.learning_recovery_plans (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 student_membership_id uuid not null,
 concept_id uuid not null,
 generated_plan jsonb not null,
 teacher_status text not null default 'draft' check(teacher_status in('draft','approved','assigned','completed','rejected')),
 approved_by uuid references auth.users(id),
 assigned_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,institution_id),
 foreign key(student_membership_id,institution_id) references public.institution_memberships(id,institution_id),
 foreign key(concept_id,institution_id) references public.learning_concepts(id,institution_id),
 check(jsonb_typeof(generated_plan)='object')
);
create table public.learning_recovery_activities (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 plan_id uuid not null,
 activity_type text not null default 'micro_practice',
 content jsonb not null,
 sequence integer not null default 1,
 completion_status text not null default 'pending' check(completion_status in('pending','completed')),
 completed_at timestamptz,
 unique(plan_id,sequence),
 foreign key(plan_id,institution_id) references public.learning_recovery_plans(id,institution_id)
);
create table public.learning_reassessments (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 plan_id uuid not null,
 source_id uuid not null,
 prior_mastery numeric,
 updated_mastery numeric,
 result text not null,
 assessed_at timestamptz not null default now(),
 foreign key(plan_id,institution_id) references public.learning_recovery_plans(id,institution_id)
);
create table public.learning_ai_audit_logs (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 request_type text not null,
 model_provider text not null,
 generated_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 outcome text not null
);
create table public.learning_timeline_events (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 student_membership_id uuid not null,
 concept_id uuid not null,
 event_type text not null,
 occurred_at timestamptz not null default now(),
 actor_id uuid references auth.users(id),
 details jsonb not null default '{}'::jsonb,
 foreign key(student_membership_id,institution_id) references public.institution_memberships(id,institution_id),
 foreign key(concept_id,institution_id) references public.learning_concepts(id,institution_id)
);

create index lg_concept_class_idx on public.learning_concepts(institution_id,class_group_id,status);
create index lg_mapping_quiz_idx on public.assessment_concept_mapping(assessment_id,question_index);
create index lg_evidence_student_idx on public.student_concept_evidence(institution_id,student_membership_id,concept_id,assessed_at desc);
create index lg_evidence_source_idx on public.student_concept_evidence(source_id,source_type);
create index lg_mastery_concept_aggregate_idx on public.student_concept_mastery(institution_id,concept_id,mastery_state);
create index lg_findings_status_idx on public.learning_gap_findings(institution_id,status,updated_at desc);
create index lg_plans_student_idx on public.learning_recovery_plans(institution_id,student_membership_id,teacher_status);
create index lg_timeline_student_idx on public.learning_timeline_events(institution_id,student_membership_id,occurred_at desc);
create index lg_dependencies_prereq_idx on public.concept_dependencies(prerequisite_concept_id);

-- Fail closed: only SELECT grants; all writes go through checked RPCs/triggers.
do $$ declare tbl text; begin
 foreach tbl in array array['learning_concepts','concept_dependencies','assessment_concept_mapping',
 'student_concept_evidence','student_concept_mastery','learning_gap_findings','learning_recovery_plans',
 'learning_recovery_activities','learning_reassessments','learning_ai_audit_logs','learning_timeline_events'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
 end loop;
end $$;

create function private.noor_lg_can_teach(p_inst uuid,p_student uuid)
returns boolean language sql stable security definer set search_path='' as $$
select (select auth.uid()) is not null and (
 private.can_manage_academics(p_inst) or exists (
 select 1 from public.institution_memberships tm
 join public.academic_group_memberships tgm on tgm.institution_id=tm.institution_id and tgm.membership_id=tm.id and tgm.status='active' and tgm.group_role in('teacher','faculty')
 join public.institution_memberships sm on sm.id=p_student and sm.institution_id=tm.institution_id and sm.status='active' and sm.role in('student','university_student')
 join public.academic_group_memberships sgm on sgm.institution_id=sm.institution_id and sgm.membership_id=sm.id and sgm.status='active' and sgm.group_role='student'
 join public.academic_groups sg on sg.id=sgm.group_id and sg.institution_id=sm.institution_id and sg.is_active
 where tm.institution_id=p_inst and tm.user_id=(select auth.uid()) and tm.status='active' and tm.role in('teacher','faculty')
 and (tgm.group_id=sgm.group_id or tgm.group_id=sg.parent_group_id)
 ));
$$;
create function private.noor_lg_can_read(p_inst uuid,p_student uuid)
returns boolean language sql stable security definer set search_path='' as $$
select private.noor_lg_can_teach(p_inst,p_student)
 or exists(select 1 from public.institution_memberships m join public.institutions i on i.id=m.institution_id
 where m.id=p_student and m.institution_id=p_inst and m.user_id=(select auth.uid()) and m.status='active' and i.status='active')
 or exists(select 1 from public.noor_guardian_links link
 join public.institution_memberships g on g.id=link.guardian_membership_id and g.institution_id=link.institution_id and g.status='active'
 join public.institution_memberships s on s.id=link.student_membership_id and s.institution_id=link.institution_id and s.status='active'
 where link.institution_id=p_inst and link.student_membership_id=p_student and g.user_id=(select auth.uid()));
$$;
create function private.noor_lg_can_see_class(p_inst uuid,p_class uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.can_manage_academics(p_inst)
 or private.noor_quiz_group_access(p_inst,p_class,true)
 or private.noor_quiz_group_access(p_inst,p_class,false)
 or exists(select 1 from public.academic_group_memberships gm
 join public.academic_groups g on g.id=gm.group_id and g.institution_id=gm.institution_id
 join public.noor_guardian_links l on l.student_membership_id=gm.membership_id and l.institution_id=gm.institution_id
 join public.institution_memberships p on p.id=l.guardian_membership_id and p.institution_id=l.institution_id and p.status='active'
 where gm.institution_id=p_inst and gm.status='active' and gm.group_role='student'
 and (gm.group_id=p_class or g.parent_group_id=p_class) and p.user_id=(select auth.uid()));
$$;
revoke all on function private.noor_lg_can_teach(uuid,uuid),private.noor_lg_can_read(uuid,uuid),private.noor_lg_can_see_class(uuid,uuid) from public,anon;
grant execute on function private.noor_lg_can_teach(uuid,uuid),private.noor_lg_can_read(uuid,uuid),private.noor_lg_can_see_class(uuid,uuid) to authenticated;

create policy lg_concept_read on public.learning_concepts for select to authenticated
 using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and private.noor_lg_can_see_class(institution_id,class_group_id));
create policy lg_dependency_read on public.concept_dependencies for select to authenticated
 using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and exists(select 1 from public.learning_concepts c where c.id=concept_id and c.institution_id=concept_dependencies.institution_id));
create policy lg_mapping_read on public.assessment_concept_mapping for select to authenticated
 using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and exists(select 1 from public.learning_concepts c where c.id=concept_id and c.institution_id=assessment_concept_mapping.institution_id));
create policy lg_evidence_read on public.student_concept_evidence for select to authenticated using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and private.noor_lg_can_read(institution_id,student_membership_id));
create policy lg_mastery_read on public.student_concept_mastery for select to authenticated using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and private.noor_lg_can_read(institution_id,student_membership_id));
create policy lg_finding_read on public.learning_gap_findings for select to authenticated using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and private.noor_lg_can_read(institution_id,student_membership_id));
create policy lg_plan_read on public.learning_recovery_plans for select to authenticated using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and private.noor_lg_can_read(institution_id,student_membership_id));
create policy lg_activity_read on public.learning_recovery_activities for select to authenticated
 using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and exists(select 1 from public.learning_recovery_plans p where p.id=plan_id and p.institution_id=learning_recovery_activities.institution_id));
create policy lg_reassess_read on public.learning_reassessments for select to authenticated
 using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and exists(select 1 from public.learning_recovery_plans p where p.id=plan_id and p.institution_id=learning_reassessments.institution_id));
create policy lg_timeline_read on public.learning_timeline_events for select to authenticated using(private.noor_feature_enabled(institution_id,'learning_gap_time_machine') and private.noor_lg_can_read(institution_id,student_membership_id));
-- Audit logs remain backend-only: no SELECT policy.

create function private.noor_lg_recompute(p_inst uuid,p_student uuid,p_concept uuid)
returns void language plpgsql security definer set search_path='' as $$
declare n int; sources int; pct numeric; conf numeric; latest timestamptz; state text; summary jsonb;
begin
 select count(*),count(distinct source_type||':'||source_id::text),
 round(100*sum(earned)/nullif(sum(possible),0),1),max(assessed_at)
 into n,sources,pct,latest
 from public.student_concept_evidence
 where institution_id=p_inst and student_membership_id=p_student and concept_id=p_concept;
 conf:=case when n>=3 and sources>=2 then least(0.95,round((n::numeric/8)+(sources::numeric/10),2)) else 0 end;
 state:=case when n<3 or sources<2 then 'Not Enough Evidence'
 when pct>=85 then 'Demonstrated Mastery'
 when pct>=65 then 'Developing'
 when pct>=45 then 'Emerging Understanding'
 else 'Recheck Recommended' end;
 insert into public.student_concept_mastery(institution_id,student_membership_id,concept_id,estimated_mastery,confidence,evidence_count,source_count,mastery_state,last_checked_at)
 values(p_inst,p_student,p_concept,case when n>=3 and sources>=2 then pct else null end,conf,n,sources,state,latest)
 on conflict(institution_id,student_membership_id,concept_id) do update set estimated_mastery=excluded.estimated_mastery,
 confidence=excluded.confidence,evidence_count=excluded.evidence_count,source_count=excluded.source_count,mastery_state=excluded.mastery_state,last_checked_at=excluded.last_checked_at,updated_at=now();
 summary:=jsonb_build_object('evidence_count',n,'source_count',sources,'last_assessed_at',latest,'estimated_mastery',case when n>=3 and sources>=2 then pct else null end);
 insert into public.learning_gap_findings(institution_id,student_membership_id,concept_id,evidence_summary,confidence,status)
 values(p_inst,p_student,p_concept,summary,conf,case when state='Recheck Recommended' then 'needs_review' else 'not_enough_evidence' end)
 on conflict(institution_id,student_membership_id,concept_id,finding_type) do update
 set evidence_summary=excluded.evidence_summary,confidence=excluded.confidence,
 status=case when public.learning_gap_findings.status in('confirmed','dismissed','resolved') then public.learning_gap_findings.status
 when state='Recheck Recommended' then 'needs_review' else 'not_enough_evidence' end,updated_at=now();
end $$;
create function private.noor_lg_ingest_attempt(p_attempt uuid)
returns void language plpgsql security definer set search_path='' as $$
declare a public.noor_quiz_attempts; q public.noor_weekly_quizzes; k jsonb; m record; item jsonb; points numeric; total numeric;
begin
 select * into a from public.noor_quiz_attempts where id=p_attempt and reviewed_at is not null;
 if not found then return;end if;
 select * into q from public.noor_weekly_quizzes where id=a.quiz_id;
 if not private.noor_feature_enabled(q.institution_id,'learning_gap_time_machine') then return;end if;
 select answer_key into k from private.noor_quiz_keys where quiz_id=q.id;
 for m in select * from public.assessment_concept_mapping where assessment_id=q.id and institution_id=q.institution_id loop
  item:=q.questions->m.question_index;total:=(item->>'marks')::numeric;
  if item->>'type'='short' then
   points:=coalesce(nullif(a.short_scores->m.question_index->>'marks','')::numeric,(a.short_scores->>m.question_index)::numeric,0);
  else
   points:=case when a.answers->>m.question_index=k->m.question_index->>'answer' then total else 0 end;
  end if;
  insert into public.student_concept_evidence(institution_id,student_membership_id,concept_id,source_type,source_id,question_index,earned,possible,assessed_at)
  values(q.institution_id,a.student_membership_id,m.concept_id,'approved_quiz',a.id,m.question_index,points,total,a.reviewed_at)
  on conflict(institution_id,source_type,source_id,question_index,concept_id) do nothing;
  perform private.noor_lg_recompute(q.institution_id,a.student_membership_id,m.concept_id);
 end loop;
end $$;
create function private.noor_lg_attempt_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin if new.reviewed_at is not null then perform private.noor_lg_ingest_attempt(new.id); end if;return new;end $$;
create trigger noor_lg_attempt_reviewed after insert or update of reviewed_at on public.noor_quiz_attempts
 for each row execute function private.noor_lg_attempt_trigger();

-- Explicitly teacher-initiated pilot; no fabricated student data.
create function private.noor_lg_start_pilot(p_class uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare inst uuid; nm text; titles text[]:=array['Place Value','Regrouping','Multi-digit Subtraction','Complex Arithmetic']; ids uuid[]:=array[]::uuid[]; i integer; cid uuid;
begin
 select institution_id,name into inst,nm from public.academic_groups where id=p_class and group_type='class' and is_active;
 if inst is null or regexp_replace(lower(nm),'[^a-z0-9]','','g') not in('3','class3','grade3','3rd','third') then raise exception 'Choose an active Class 3 group';end if;
 if not private.noor_feature_enabled(inst,'learning_gap_time_machine') then raise exception 'Feature is disabled' using errcode='42501';end if;
 if not (private.can_manage_academics(inst) or private.noor_quiz_group_access(inst,p_class,true)) then raise exception 'Assigned teacher required' using errcode='42501';end if;
 for i in 1..4 loop
  insert into public.learning_concepts(institution_id,class_group_id,concept_title)
  values(inst,p_class,titles[i]) on conflict(institution_id,class_group_id,subject_name,curriculum_version,concept_title) do update set concept_title=excluded.concept_title returning id into cid;
  ids:=array_append(ids,cid);
 end loop;
 for i in 2..4 loop
  insert into public.concept_dependencies(institution_id,concept_id,prerequisite_concept_id)
  values(inst,ids[i],ids[i-1]) on conflict(concept_id,prerequisite_concept_id) do nothing;
 end loop;
 return 4;
end $$;
create function private.noor_lg_map_question(p_quiz uuid,p_index integer,p_concept uuid)
returns void language plpgsql security definer set search_path='' as $$
declare q public.noor_weekly_quizzes; c public.learning_concepts; cls uuid; a record;
begin
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 select * into strict c from public.learning_concepts where id=p_concept and institution_id=q.institution_id;
 select coalesce(g.parent_group_id,g.id) into cls from public.academic_groups g where g.id=q.academic_group_id and g.institution_id=q.institution_id;
 if not private.noor_feature_enabled(q.institution_id,'learning_gap_time_machine') then raise exception 'Feature is disabled' using errcode='42501';end if;
 if c.class_group_id<>cls or lower(btrim(q.subject_name))<>lower(btrim(c.subject_name))
 or p_index<0 or p_index>=jsonb_array_length(q.questions) then raise exception 'Class, subject or question mismatch';end if;
 if not (private.can_manage_academics(q.institution_id) or private.noor_quiz_group_access(q.institution_id,q.academic_group_id,true)) then raise exception 'Assigned teacher required' using errcode='42501';end if;
 update public.learning_concepts set status='approved',approved_by=auth.uid() where id=c.id;
 insert into public.assessment_concept_mapping(institution_id,assessment_id,question_index,concept_id,approved_by)
 values(q.institution_id,p_quiz,p_index,p_concept,auth.uid())
 on conflict(assessment_id,question_index) do update set concept_id=excluded.concept_id,approved_by=excluded.approved_by,approved_at=now()
 where public.assessment_concept_mapping.concept_id=excluded.concept_id or not exists
 (select 1 from public.student_concept_evidence ev where ev.source_type='approved_quiz' and ev.concept_id=public.assessment_concept_mapping.concept_id and ev.question_index=excluded.question_index and ev.source_id in
 (select id from public.noor_quiz_attempts where quiz_id=p_quiz));
 if not found then raise exception 'Historical evidence exists. Mapping cannot be changed';end if;
 -- Do not rewrite historic evidence when mapping changes: mapping edits require a deliberate migration.
 for a in select id from public.noor_quiz_attempts where quiz_id=q.id and reviewed_at is not null loop
  perform private.noor_lg_ingest_attempt(a.id);
 end loop;
end $$;
create function private.noor_lg_diagnostic(p_student uuid,p_concept uuid,p_questions jsonb,p_scores jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.learning_concepts; n int; k int; v uuid:=gen_random_uuid(); student_class uuid;
begin
 select * into strict c from public.learning_concepts where id=p_concept and status='approved';
 if not private.noor_feature_enabled(c.institution_id,'learning_gap_time_machine') then raise exception 'Feature is disabled' using errcode='42501';end if;
 if not private.noor_lg_can_teach(c.institution_id,p_student) then raise exception 'Assigned teacher required' using errcode='42501';end if;
 if not exists(select 1 from public.academic_group_memberships gm join public.academic_groups g on g.id=gm.group_id and g.institution_id=gm.institution_id
 where gm.institution_id=c.institution_id and gm.membership_id=p_student and gm.status='active' and (gm.group_id=c.class_group_id or g.parent_group_id=c.class_group_id)) then raise exception 'Student class mismatch';end if;
 if jsonb_typeof(p_questions)<>'array' or jsonb_typeof(p_scores)<>'array' then raise exception 'Questions and scores must be arrays';end if;
 if (select count(distinct source_id) from public.student_concept_evidence where institution_id=c.institution_id and student_membership_id=p_student and concept_id=p_concept and source_type='teacher_diagnostic' and assessed_at>now()-interval '7 days')>=3 then raise exception 'Review recent diagnostics before adding another';end if;
 n:=jsonb_array_length(p_questions);
 if n<3 or n>5 or jsonb_array_length(p_scores)<>n then raise exception 'Use 3 to 5 teacher-reviewed questions';end if;
 for k in 0..n-1 loop
  if jsonb_typeof(p_questions->k)<>'string' or length(btrim(p_questions->>k)) not between 5 and 300
  or p_scores->>k not in('0','1') then raise exception 'Invalid question or score';end if;
  insert into public.student_concept_evidence(institution_id,student_membership_id,concept_id,source_type,source_id,question_index,earned,possible,assessed_at,recorded_by)
  values(c.institution_id,p_student,p_concept,'teacher_diagnostic',v,k,(p_scores->>k)::numeric,1,now(),auth.uid());
 end loop;
 perform private.noor_lg_recompute(c.institution_id,p_student,p_concept);
 insert into public.learning_timeline_events(institution_id,student_membership_id,concept_id,event_type,actor_id,details)
 values(c.institution_id,p_student,p_concept,'diagnostic_completed',auth.uid(),jsonb_build_object('question_count',n));
 return v;
end $$;
create function private.noor_lg_review(p_student uuid,p_concept uuid,p_action text,p_plan jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.student_concept_mastery; f public.learning_gap_findings; pid uuid; pinst uuid; ctitle text;
begin
 select * into strict m from public.student_concept_mastery where student_membership_id=p_student and concept_id=p_concept;
 pinst:=m.institution_id;
 if not private.noor_feature_enabled(pinst,'learning_gap_time_machine') then raise exception 'Feature is disabled' using errcode='42501';end if;
 if not private.noor_lg_can_teach(pinst,p_student) then raise exception 'Assigned teacher required' using errcode='42501';end if;
 select * into strict f from public.learning_gap_findings where institution_id=pinst and student_membership_id=p_student and concept_id=p_concept and finding_type='observed_gap' for update;
 select concept_title into ctitle from public.learning_concepts where id=p_concept;
 if p_action='confirm' then
  if m.evidence_count<3 or m.source_count<2 or m.estimated_mastery is null or m.estimated_mastery>=65 then raise exception 'Insufficient evidence for confirmed gap';end if;
  update public.learning_gap_findings set status='confirmed',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=f.id;
  insert into public.learning_timeline_events(institution_id,student_membership_id,concept_id,event_type,actor_id)
  values(pinst,p_student,p_concept,'gap_confirmed',auth.uid());
 elsif p_action='dismiss' then
  update public.learning_gap_findings set status='dismissed',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=f.id;
 elsif p_action='resolve' then
  if m.estimated_mastery is null or m.estimated_mastery<75 or m.evidence_count<4 or m.source_count<2
 or not exists (select 1 from public.learning_recovery_plans plan
  join public.learning_reassessments recheck on recheck.plan_id=plan.id and recheck.institution_id=plan.institution_id
  where plan.institution_id=pinst and plan.student_membership_id=p_student and plan.concept_id=p_concept
  and plan.teacher_status='completed' and recheck.updated_mastery>=75)
 then raise exception 'Completed practice and a verified reassessment are required';end if;
  update public.learning_gap_findings set status='resolved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=f.id;
  insert into public.learning_timeline_events(institution_id,student_membership_id,concept_id,event_type,actor_id)
  values(pinst,p_student,p_concept,'concept_resolved',auth.uid());
 elsif p_action='assign_plan' then
  if f.status<>'confirmed' then raise exception 'Teacher must confirm an observed gap first';end if;
  if jsonb_typeof(p_plan)<>'object' or length(btrim(coalesce(p_plan->>'lesson',''))) not between 10 and 2000
   or length(btrim(coalesce(p_plan->>'practice',''))) not between 5 and 2000
   then raise exception 'Teacher-approved lesson and practice required';end if;
  insert into public.learning_recovery_plans(institution_id,student_membership_id,concept_id,generated_plan,teacher_status,approved_by,assigned_at)
  values(pinst,p_student,p_concept,jsonb_build_object('lesson',left(p_plan->>'lesson',2000),'practice',left(p_plan->>'practice',2000),'follow_up',left(coalesce(p_plan->>'follow_up',''),24)),'assigned',auth.uid(),now()) returning id into pid;
  insert into public.learning_recovery_activities(institution_id,plan_id,content)
  values(pinst,pid,jsonb_build_object('practice',p_plan->>'practice','concept',ctitle));
  insert into public.learning_timeline_events(institution_id,student_membership_id,concept_id,event_type,actor_id,details)
  values(pinst,p_student,p_concept,'recovery_assigned',auth.uid(),jsonb_build_object('plan_id',pid));
 else raise exception 'Unknown review action';end if;
 return pid;
end $$;
create function private.noor_lg_complete(p_plan uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.learning_recovery_plans;
begin
 select * into strict p from public.learning_recovery_plans where id=p_plan and teacher_status='assigned' for update;
 if not private.noor_feature_enabled(p.institution_id,'learning_gap_time_machine') then raise exception 'Feature is disabled' using errcode='42501';end if;
 if not exists(select 1 from public.institution_memberships m where m.id=p.student_membership_id and m.institution_id=p.institution_id and m.user_id=auth.uid() and m.status='active' and m.role in('student','university_student'))
 then raise exception 'Only assigned student may complete practice' using errcode='42501';end if;
 update public.learning_recovery_activities set completion_status='completed',completed_at=now() where plan_id=p.id and institution_id=p.institution_id and completion_status='pending';
 update public.learning_recovery_plans set teacher_status='completed',completed_at=now(),updated_at=now() where id=p.id;
 insert into public.learning_timeline_events(institution_id,student_membership_id,concept_id,event_type,actor_id,details)
 values(p.institution_id,p.student_membership_id,p.concept_id,'practice_completed',auth.uid(),jsonb_build_object('plan_id',p.id));
 return true;
end $$;

create function public.noor_lg_start_pilot(p_class uuid) returns integer language sql security invoker set search_path='' as $$ select private.noor_lg_start_pilot(p_class) $$;
create function public.noor_lg_map_question(p_quiz uuid,p_index integer,p_concept uuid) returns void language sql security invoker set search_path='' as $$ select private.noor_lg_map_question(p_quiz,p_index,p_concept) $$;
create function public.noor_lg_diagnostic(p_student uuid,p_concept uuid,p_questions jsonb,p_scores jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.noor_lg_diagnostic(p_student,p_concept,p_questions,p_scores) $$;
create function public.noor_lg_review(p_student uuid,p_concept uuid,p_action text,p_plan jsonb default null) returns uuid language sql security invoker set search_path='' as $$ select private.noor_lg_review(p_student,p_concept,p_action,p_plan) $$;
create function public.noor_lg_complete(p_plan uuid) returns boolean language sql security invoker set search_path='' as $$ select private.noor_lg_complete(p_plan) $$;
revoke all on function private.noor_lg_recompute(uuid,uuid,uuid),private.noor_lg_ingest_attempt(uuid),private.noor_lg_attempt_trigger(),
 private.noor_lg_start_pilot(uuid),private.noor_lg_map_question(uuid,integer,uuid),
 private.noor_lg_diagnostic(uuid,uuid,jsonb,jsonb),private.noor_lg_review(uuid,uuid,text,jsonb),private.noor_lg_complete(uuid)
 from public,anon;
revoke all on function public.noor_lg_start_pilot(uuid),public.noor_lg_map_question(uuid,integer,uuid),
 public.noor_lg_diagnostic(uuid,uuid,jsonb,jsonb),public.noor_lg_review(uuid,uuid,text,jsonb),public.noor_lg_complete(uuid) from public,anon;
grant execute on function private.noor_lg_start_pilot(uuid),private.noor_lg_map_question(uuid,integer,uuid),
 private.noor_lg_diagnostic(uuid,uuid,jsonb,jsonb),private.noor_lg_review(uuid,uuid,text,jsonb),private.noor_lg_complete(uuid)
 to authenticated;
grant execute on function public.noor_lg_start_pilot(uuid),public.noor_lg_map_question(uuid,integer,uuid),
 public.noor_lg_diagnostic(uuid,uuid,jsonb,jsonb),public.noor_lg_review(uuid,uuid,text,jsonb),public.noor_lg_complete(uuid) to authenticated;

-- Teacher-scored recheck after actual practice: no automatic mastery certification.
create function private.noor_lg_reassess(p_plan uuid,p_questions jsonb,p_scores jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.learning_recovery_plans; c public.learning_concepts; m public.student_concept_mastery;
 n integer; i integer; v uuid:=gen_random_uuid(); before_pct numeric; after_pct numeric; outcome text;
begin
 select * into strict p from public.learning_recovery_plans where id=p_plan and teacher_status in('assigned','completed');
 select * into strict c from public.learning_concepts where id=p.concept_id and institution_id=p.institution_id;
 if not private.noor_feature_enabled(p.institution_id,'learning_gap_time_machine') then
  raise exception 'Feature is disabled' using errcode='42501';end if;
 if not private.noor_lg_can_teach(p.institution_id,p.student_membership_id) then
  raise exception 'Assigned teacher required' using errcode='42501';end if;
 if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_typeof(p_scores) is distinct from 'array'
 then raise exception 'Review 3 to 5 questions and scores';end if;
 n:=jsonb_array_length(p_questions);
 if n<3 or n>5 or jsonb_array_length(p_scores)<>n then raise exception 'Review 3 to 5 questions and scores';end if;
 if (select count(*) from public.learning_reassessments where plan_id=p_plan and assessed_at>now()-interval '7 days')>=3
 then raise exception 'Review recent rechecks before adding another';end if;
 select estimated_mastery into before_pct from public.student_concept_mastery
 where institution_id=p.institution_id and student_membership_id=p.student_membership_id and concept_id=p.concept_id;
 for i in 0..n-1 loop
  if jsonb_typeof(p_questions->i) is distinct from 'string' or length(btrim(p_questions->>i)) not between 5 and 300
   or p_scores->>i not in('0','1') then raise exception 'Invalid reassessment question or score';end if;
  insert into public.student_concept_evidence(institution_id,student_membership_id,concept_id,source_type,source_id,question_index,earned,possible,assessed_at,recorded_by)
  values(p.institution_id,p.student_membership_id,p.concept_id,'reassessment',v,i,(p_scores->>i)::numeric,1,now(),auth.uid());
 end loop;
 perform private.noor_lg_recompute(p.institution_id,p.student_membership_id,p.concept_id);
 select * into m from public.student_concept_mastery where institution_id=p.institution_id and student_membership_id=p.student_membership_id and concept_id=p.concept_id;
 after_pct:=m.estimated_mastery;
 outcome:=case when after_pct is null then 'not_enough_evidence'
   when before_pct is null then 'baseline_established'
   when after_pct>before_pct then 'improving'
   else 'teacher_followup_recommended' end;
 insert into public.learning_reassessments(institution_id,plan_id,source_id,prior_mastery,updated_mastery,result)
 values(p.institution_id,p_plan,v,before_pct,after_pct,outcome);
 insert into public.learning_timeline_events(institution_id,student_membership_id,concept_id,event_type,actor_id,details)
 values(p.institution_id,p.student_membership_id,p.concept_id,'reassessment_completed',auth.uid(),jsonb_build_object('plan_id',p_plan,'result',outcome,'question_count',n));
 return v;
end $$;
create function public.noor_lg_reassess(p_plan uuid,p_questions jsonb,p_scores jsonb)
returns uuid language sql security invoker set search_path='' as $$
 select private.noor_lg_reassess(p_plan,p_questions,p_scores)
$$;
revoke all on function private.noor_lg_reassess(uuid,jsonb,jsonb),public.noor_lg_reassess(uuid,jsonb,jsonb) from public,anon;
grant execute on function private.noor_lg_reassess(uuid,jsonb,jsonb),public.noor_lg_reassess(uuid,jsonb,jsonb) to authenticated;


-- Server-side aggregated principal view: no default student identities returned.
create function private.noor_lg_principal_summary(p_inst uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare response jsonb;
begin
 if not private.noor_feature_enabled(p_inst,'learning_gap_time_machine')
   or not private.can_manage_academics(p_inst) then raise exception 'Leadership access required' using errcode='42501';end if;
 select jsonb_build_object(
 'assessed_students',(select count(distinct m.student_membership_id) from public.student_concept_mastery m
   join public.learning_concepts c on c.id=m.concept_id and c.institution_id=m.institution_id
   join public.academic_groups gr on gr.id=c.class_group_id and gr.institution_id=c.institution_id
   where m.institution_id=p_inst and m.mastery_state<>'Not Enough Evidence'
     and regexp_replace(lower(gr.name),'[^a-z0-9]','','g') in('3','class3','grade3','3rd','third')
     and c.subject_name='Mathematics'),
 'findings_to_review',(select count(*) from public.learning_gap_findings f
   join public.learning_concepts c on c.id=f.concept_id and c.institution_id=f.institution_id
   join public.academic_groups gr on gr.id=c.class_group_id and gr.institution_id=c.institution_id
   where f.institution_id=p_inst and f.status in('needs_review','confirmed')
     and regexp_replace(lower(gr.name),'[^a-z0-9]','','g') in('3','class3','grade3','3rd','third')
     and c.subject_name='Mathematics'),
 'completed_plans',(select count(*) from public.learning_recovery_plans p
   join public.learning_concepts c on c.id=p.concept_id and c.institution_id=p.institution_id
   join public.academic_groups gr on gr.id=c.class_group_id and gr.institution_id=c.institution_id
   where p.institution_id=p_inst and p.teacher_status='completed'
     and regexp_replace(lower(gr.name),'[^a-z0-9]','','g') in('3','class3','grade3','3rd','third')
     and c.subject_name='Mathematics'),
 'concepts',coalesce((select jsonb_agg(jsonb_build_object(
   'concept_title',c.concept_title,
   'recheck_count',(select count(*) from public.student_concept_mastery m
      where m.institution_id=c.institution_id and m.concept_id=c.id and m.mastery_state='Recheck Recommended'),
   'insufficient_count',(select count(*) from public.student_concept_mastery m
      where m.institution_id=c.institution_id and m.concept_id=c.id and m.mastery_state='Not Enough Evidence')
 ) order by c.concept_title)
  from public.learning_concepts c
  join public.academic_groups gr on gr.id=c.class_group_id and gr.institution_id=c.institution_id
  where c.institution_id=p_inst and c.subject_name='Mathematics'
     and regexp_replace(lower(gr.name),'[^a-z0-9]','','g') in('3','class3','grade3','3rd','third')),'[]'::jsonb)
 ) into response;
 return response;
end $$;
create function public.noor_lg_principal_summary(p_institution uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.noor_lg_principal_summary(p_institution) $$;
revoke all on function private.noor_lg_principal_summary(uuid),public.noor_lg_principal_summary(uuid) from public,anon;
grant execute on function private.noor_lg_principal_summary(uuid),public.noor_lg_principal_summary(uuid) to authenticated;


-- Generic curriculum authoring: all schools and college streams, no synthetic lessons.
create function private.noor_lg_add_concept(
 p_group uuid,p_subject text,p_title text,p_curriculum_version text default 'school-v1',p_prerequisite uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare g public.academic_groups; canonical uuid; inst uuid; subject_clean text; concept_title_clean text;
 version_clean text; new_concept_id uuid; predecessor public.learning_concepts;
begin
 select * into strict g from public.academic_groups where id=p_group and is_active and group_type in('class','section');
 inst:=g.institution_id;canonical:=coalesce(g.parent_group_id,g.id);
 if not private.noor_feature_enabled(inst,'learning_gap_time_machine') then raise exception 'Feature disabled' using errcode='42501';end if;
 if not (private.can_manage_academics(inst) or private.noor_quiz_group_access(inst,p_group,true)) then
  raise exception 'Assigned teacher or school leadership required' using errcode='42501';end if;
 subject_clean:=btrim(p_subject);concept_title_clean:=btrim(p_title);version_clean:=btrim(p_curriculum_version);
 if length(subject_clean) not between 2 and 140 or length(concept_title_clean) not between 2 and 120
  or length(version_clean) not between 1 and 40 then raise exception 'Valid subject, concept and curriculum version required';end if;
 if p_prerequisite is not null then
  select * into strict predecessor from public.learning_concepts
   where id=p_prerequisite and institution_id=inst and class_group_id=canonical
     and lower(subject_name)=lower(subject_clean) and curriculum_version=version_clean and status<>'archived';
 end if;
 insert into public.learning_concepts(institution_id,class_group_id,subject_name,concept_title,curriculum_version,status,approved_by)
 values(inst,canonical,subject_clean,concept_title_clean,version_clean,'approved',auth.uid())
 on conflict(institution_id,class_group_id,subject_name,curriculum_version,concept_title)
 do update set status='approved',approved_by=auth.uid() returning id into new_concept_id;
 if p_prerequisite is not null then
  if new_concept_id=p_prerequisite then raise exception 'A concept cannot depend on itself';end if;
  -- Reject cycle via recursive closure, using the already stored dependency graph.
  if exists(with recursive prerequisites(cid) as(
     select prerequisite_concept_id from public.concept_dependencies where concept_id=p_prerequisite
     union
     select cd.prerequisite_concept_id from public.concept_dependencies cd join prerequisites p on cd.concept_id=p.cid
   ) select 1 from prerequisites where prerequisites.cid=new_concept_id) then
   raise exception 'Circular prerequisite relationship';end if;
  insert into public.concept_dependencies(institution_id,concept_id,prerequisite_concept_id,approved_by)
  values(inst,new_concept_id,p_prerequisite,auth.uid()) on conflict(concept_id,prerequisite_concept_id) do nothing;
 end if;
 return new_concept_id;
end $$;
create function public.noor_lg_add_concept(
 p_group uuid,p_subject text,p_title text,p_curriculum_version text default 'school-v1',p_prerequisite uuid default null)
returns uuid language sql security invoker set search_path='' as $$
 select private.noor_lg_add_concept(p_group,p_subject,p_title,p_curriculum_version,p_prerequisite)
$$;
revoke all on function private.noor_lg_add_concept(uuid,text,text,text,uuid),
 public.noor_lg_add_concept(uuid,text,text,text,uuid) from public,anon;
grant execute on function private.noor_lg_add_concept(uuid,text,text,text,uuid),
 public.noor_lg_add_concept(uuid,text,text,text,uuid) to authenticated;

-- Ages 3–6: teacher-observed competencies; no text-heavy student exams.
alter table public.student_concept_evidence drop constraint student_concept_evidence_source_type_check;
alter table public.student_concept_evidence add constraint student_concept_evidence_source_type_check
 check(source_type in('approved_quiz','teacher_diagnostic','reassessment','teacher_observation'));

create function private.noor_lg_observe(p_student uuid,p_concept uuid,p_activities jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.learning_concepts; n integer; i integer; item jsonb; sid uuid:=gen_random_uuid(); class_id uuid;
begin
 select * into strict c from public.learning_concepts where id=p_concept and status='approved';
 if not private.noor_feature_enabled(c.institution_id,'learning_gap_time_machine')
 or not private.noor_lg_can_teach(c.institution_id,p_student) then
  raise exception 'Teaching access or feature disabled' using errcode='42501';end if;
 if not exists(select 1 from public.academic_group_memberships gm join public.academic_groups g
   on g.id=gm.group_id and g.institution_id=gm.institution_id
  where gm.institution_id=c.institution_id and gm.membership_id=p_student and gm.status='active'
   and (gm.group_id=c.class_group_id or g.parent_group_id=c.class_group_id))
 then raise exception 'Student class mismatch';end if;
 if jsonb_typeof(p_activities) is distinct from 'array' then raise exception 'Observation array required';end if;
 n:=jsonb_array_length(p_activities);
 if n not between 3 and 5 then raise exception 'Record 3 to 5 short competency observations';end if;
 if (select count(distinct source_id) from public.student_concept_evidence
    where institution_id=c.institution_id and student_membership_id=p_student and concept_id=p_concept
    and source_type='teacher_observation' and assessed_at>now()-interval '7 days')>=3
 then raise exception 'Review existing observations before adding more';end if;
 for i in 0..n-1 loop
  item:=p_activities->i;
  if jsonb_typeof(item) is distinct from 'object' or
    length(btrim(coalesce(item->>'activity',''))) not between 5 and 300 or
    jsonb_typeof(item->'demonstrated') is distinct from 'boolean'
  then raise exception 'Each activity needs an observation and a demonstrated boolean';end if;
  insert into public.student_concept_evidence(institution_id,student_membership_id,concept_id,source_type,source_id,
   question_index,earned,possible,assessed_at,recorded_by)
  values(c.institution_id,p_student,p_concept,'teacher_observation',sid,i,
   case when item->>'demonstrated'='true' then 1 else 0 end,1,now(),auth.uid());
 end loop;
 perform private.noor_lg_recompute(c.institution_id,p_student,p_concept);
 insert into public.learning_timeline_events(institution_id,student_membership_id,concept_id,event_type,actor_id,details)
 values(c.institution_id,p_student,p_concept,'teacher_observation_recorded',auth.uid(),jsonb_build_object('activity_count',n));
 return sid;
end $$;
create function public.noor_lg_observe(p_student uuid,p_concept uuid,p_activities jsonb)
returns uuid language sql security invoker set search_path='' as $$
 select private.noor_lg_observe(p_student,p_concept,p_activities)
$$;
revoke all on function private.noor_lg_observe(uuid,uuid,jsonb),public.noor_lg_observe(uuid,uuid,jsonb)
 from public,anon;
grant execute on function private.noor_lg_observe(uuid,uuid,jsonb),public.noor_lg_observe(uuid,uuid,jsonb)
 to authenticated;

-- Aggregate without exposing student identities or teacher-only notes.
create or replace function private.noor_lg_principal_summary(p_inst uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare response jsonb;
begin
 if not private.noor_feature_enabled(p_inst,'learning_gap_time_machine')
   or not private.can_manage_academics(p_inst) then
   raise exception 'Leadership access required' using errcode='42501';end if;
 select jsonb_build_object(
 'assessed_students',(select count(distinct m.student_membership_id) from public.student_concept_mastery m
   where m.institution_id=p_inst and m.mastery_state<>'Not Enough Evidence'),
 'findings_to_review',(select count(*) from public.learning_gap_findings f
   where f.institution_id=p_inst and f.status in('needs_review','confirmed')),
 'completed_plans',(select count(*) from public.learning_recovery_plans p
   where p.institution_id=p_inst and p.teacher_status='completed'),
 'scopes',coalesce((
 select jsonb_agg(jsonb_build_object('group_name',a.group_name,'subject_name',a.subject_name,
 'concept_count',a.concept_count,'recheck_count',a.recheck_count,'evidence_pending',a.evidence_pending)
 order by a.group_name,a.subject_name)
 from (
 select g.name group_name,c.subject_name,
  count(distinct c.id) concept_count,
  count(m.*) filter(where m.mastery_state='Recheck Recommended') recheck_count,
  count(m.*) filter(where m.mastery_state='Not Enough Evidence') evidence_pending
 from public.learning_concepts c
 join public.academic_groups g on g.id=c.class_group_id and g.institution_id=c.institution_id
 left join public.student_concept_mastery m on m.concept_id=c.id and m.institution_id=c.institution_id
 where c.institution_id=p_inst and c.status='approved'
 group by g.name,c.subject_name
 ) a
 ),'[]'::jsonb)
 ) into response;
 return response;
end $$;
