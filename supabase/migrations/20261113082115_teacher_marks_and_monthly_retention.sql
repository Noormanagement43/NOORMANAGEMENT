-- A permanent marks ledger is independent of transient test payloads.
alter table public.noor_assessment_results drop constraint noor_assessment_results_source_quiz_attempt_id_fkey;
comment on column public.noor_assessment_results.source_quiz_attempt_id is 'Historical source receipt; retained after the transient paper/attempt is removed.';
alter table public.noor_assessment_results add column manual_entry_key text;
create unique index noor_manual_subject_slot on public.noor_assessment_results(institution_id,student_membership_id,lower(btrim(subject_name)),assessment_kind,manual_entry_key) where manual_entry_key is not null;
alter table public.noor_weekly_quizzes add column retired_at timestamptz;
create index noor_test_retention_date on public.noor_weekly_quizzes(quiz_date,id);

create function private.noor_marks_allowed(p_institution uuid,p_group uuid,p_subject text default null) returns boolean
language sql stable security definer set search_path='' as $f$
 select auth.uid() is not null and exists(select 1 from public.academic_groups g where g.id=p_group and g.institution_id=p_institution and g.is_active and (
 private.can_manage_academics(p_institution) or exists(
  select 1 from public.institution_memberships m join public.institutions i on i.id=m.institution_id and i.status='active'
  where m.institution_id=p_institution and m.user_id=auth.uid() and m.status='active' and m.role in('teacher','faculty') and (
   g.homeroom_teacher_membership_id=m.id or exists(select 1 from public.academic_group_memberships gm where gm.institution_id=p_institution and gm.membership_id=m.id and gm.status='active' and gm.group_role in('teacher','faculty') and gm.group_id in(g.id,g.parent_group_id))
   or exists(select 1 from public.teacher_timetable_periods t where t.institution_id=p_institution and t.teacher_membership_id=m.id and t.academic_group_id in(g.id,g.parent_group_id) and (p_subject is null or lower(btrim(t.subject_name))=lower(btrim(p_subject))))
  ))));
$f$;
revoke all on function private.noor_marks_allowed(uuid,uuid,text) from public,anon,authenticated;

create function private.noor_manual_mark_key(p_institution uuid,p_kind text,p_date date) returns text
language plpgsql stable security definer set search_path='' as $f$
declare yr date;
begin
 if p_kind not in('monthly_test','term1','term2','term3') or p_kind is null or p_date is null then raise exception 'Choose Monthly, Term 1, Term 2 or Annual / Final marks';end if;
 if p_kind='monthly_test' then return to_char(p_date,'YYYY-MM');end if;
 select start_date into yr from public.academic_years where institution_id=p_institution and p_date between start_date and end_date order by is_current desc,start_date desc limit 1;
 if yr is null then yr=make_date(extract(year from p_date)::int-case when extract(month from p_date)<4 then 1 else 0 end,4,1);end if;
 return yr::text;
end $f$;
revoke all on function private.noor_manual_mark_key(uuid,text,date) from public,anon,authenticated;

create function private.noor_subject_marks_roster(p_institution uuid,p_group uuid,p_subject text,p_kind text,p_date date) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare slot text;output jsonb;
begin
 if not private.noor_marks_allowed(p_institution,p_group,p_subject) then raise exception 'Choose a class and subject you teach' using errcode='42501';end if;
 slot=private.noor_manual_mark_key(p_institution,p_kind,p_date);
 select coalesce(jsonb_agg(jsonb_build_object('student',m.id,'name',p.full_name,'roll_number',d.roll_number,'marks',r.marks,'max_marks',r.max_marks,'feedback',r.feedback,'editable',r.id is null or r.graded_by=auth.uid() or private.can_manage_academics(p_institution)) order by p.full_name,m.id),'[]') into output
 from public.institution_memberships m join public.profiles p on p.id=m.user_id
 left join public.noor_student_display_preferences d on d.membership_id=m.id and d.institution_id=p_institution
 left join public.noor_assessment_results r on r.institution_id=p_institution and r.student_membership_id=m.id and lower(btrim(r.subject_name))=lower(btrim(p_subject)) and r.assessment_kind=p_kind and r.manual_entry_key=slot
 where m.institution_id=p_institution and m.status='active' and m.role in('student','university_student') and private.noor_student_enrolled(p_institution,p_group,m.id);
 return output;
end $f$;
create function public.noor_subject_marks_roster(p_institution uuid,p_group uuid,p_subject text,p_kind text,p_date date) returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_subject_marks_roster(p_institution,p_group,p_subject,p_kind,p_date);$f$;
revoke all on function private.noor_subject_marks_roster(uuid,uuid,text,text,date),public.noor_subject_marks_roster(uuid,uuid,text,text,date) from public,anon;
grant execute on function private.noor_subject_marks_roster(uuid,uuid,text,text,date),public.noor_subject_marks_roster(uuid,uuid,text,text,date) to authenticated;

create function private.noor_save_subject_marks(p_institution uuid,p_group uuid,p_subject text,p_kind text,p_date date,p_max numeric,p_records jsonb) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare slot text;item jsonb;student uuid;score numeric;oldrow public.noor_assessment_results;local_day date;counted int=0;title text;
begin
 if not private.noor_marks_allowed(p_institution,p_group,p_subject) then raise exception 'Choose a class and subject you teach' using errcode='42501';end if;
 select (now() at time zone timezone)::date into local_day from public.institutions where id=p_institution;
 if p_date is null or p_date>local_day or p_date<'1900-01-01' or p_subject is null or length(btrim(p_subject)) not between 1 and 140 or p_max is null or p_max::text in('NaN','Infinity','-Infinity') or p_max<=0 or p_max>10000 then raise exception 'Check the subject, assessment date and maximum marks';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 500 or (select count(distinct x->>'student') from jsonb_array_elements(p_records) x)<>jsonb_array_length(p_records) then raise exception 'Enter each student once, up to 500 students';end if;
 slot=private.noor_manual_mark_key(p_institution,p_kind,p_date);
 title=(case p_kind when 'monthly_test' then 'Monthly Test' when 'term1' then 'Term 1 Exam' when 'term2' then 'Term 2 Exam' else 'Annual / Final Exam' end)||' · '||slot;
 for item in select x from jsonb_array_elements(p_records) x order by x->>'student' loop
  student=(item->>'student')::uuid;score=(item->>'marks')::numeric;
  if score is null or score::text in('NaN','Infinity','-Infinity') or score<0 or score>p_max or length(coalesce(item->>'feedback',''))>1000 then raise exception 'Marks must be between zero and the maximum';end if;
  perform 1 from public.institution_memberships where id=student and institution_id=p_institution and status='active' and role in('student','university_student') for update;
  if not found or not private.noor_student_enrolled(p_institution,p_group,student) then raise exception 'Student does not belong to the selected class' using errcode='42501';end if;
  select * into oldrow from public.noor_assessment_results where institution_id=p_institution and student_membership_id=student and lower(btrim(subject_name))=lower(btrim(p_subject)) and assessment_kind=p_kind and manual_entry_key=slot for update;
  if oldrow.id is not null then
   if oldrow.graded_by<>auth.uid() and not private.can_manage_academics(p_institution) then raise exception 'These marks were entered by another teacher. Ask the principal for corrections.' using errcode='42501';end if;
   if oldrow.academic_group_id<>p_group then raise exception 'Use the original class / section to correct these marks';end if;
   update public.noor_assessment_results set marks=score,max_marks=p_max,assessed_on=p_date,feedback=coalesce(item->>'feedback',''),assessment_title=title where id=oldrow.id;
  else
   insert into public.noor_assessment_results(institution_id,academic_group_id,student_membership_id,assessment_title,subject_name,assessed_on,marks,max_marks,feedback,graded_by,assessment_kind,manual_entry_key)
   values(p_institution,p_group,student,title,btrim(p_subject),p_date,score,p_max,coalesce(item->>'feedback',''),auth.uid(),p_kind,slot);
  end if;counted=counted+1;
 end loop;
 return jsonb_build_object('count',counted,'period',slot);
end $f$;
create function public.noor_save_subject_marks(p_institution uuid,p_group uuid,p_subject text,p_kind text,p_date date,p_max numeric,p_records jsonb) returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_save_subject_marks(p_institution,p_group,p_subject,p_kind,p_date,p_max,p_records);$f$;
revoke all on function private.noor_save_subject_marks(uuid,uuid,text,text,date,numeric,jsonb),public.noor_save_subject_marks(uuid,uuid,text,text,date,numeric,jsonb) from public,anon;
grant execute on function private.noor_save_subject_marks(uuid,uuid,text,text,date,numeric,jsonb),public.noor_save_subject_marks(uuid,uuid,text,text,date,numeric,jsonb) to authenticated;

-- Retire papers immediately; purge payload only after every submitted mark is safely in the ledger.
create function private.noor_purge_test(p_quiz uuid) returns boolean language plpgsql security definer set search_path='' as $f$
begin
 perform 1 from public.noor_weekly_quizzes where id=p_quiz for update;if not found then return true;end if;
 if exists(select 1 from public.noor_quiz_attempts where quiz_id=p_quiz and assessment_result_id is null) then return false;end if;
 delete from public.noor_quiz_attempts where quiz_id=p_quiz;
 delete from public.noor_weekly_quizzes where id=p_quiz;
 return true;
end $f$;
revoke all on function private.noor_purge_test(uuid) from public,anon,authenticated;
create function private.noor_delete_test(p_quiz uuid) returns jsonb language plpgsql security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes;done boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz for update;
 if q.created_by<>auth.uid() or not private.noor_can_publish_learning(q.institution_id,q.academic_group_id) then raise exception 'Only the teacher who created this test can delete it' using errcode='42501';end if;
 update public.noor_weekly_quizzes set retired_at=coalesce(retired_at,clock_timestamp()) where id=p_quiz;
 done=private.noor_purge_test(p_quiz);
 return jsonb_build_object('deleted',done,'pending_review',not done);
end $f$;
create function public.noor_delete_test(p_quiz uuid) returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_delete_test(p_quiz);$f$;
revoke all on function private.noor_delete_test(uuid),public.noor_delete_test(uuid) from public,anon;
grant execute on function private.noor_delete_test(uuid),public.noor_delete_test(uuid) to authenticated;
-- Manual slots are written only through the checked batch RPC, never through direct client writes.
create policy noor_manual_slot_insert_guard on public.noor_assessment_results as restrictive for insert to authenticated with check(manual_entry_key is null);
create policy noor_manual_slot_update_guard on public.noor_assessment_results as restrictive for update to authenticated using(manual_entry_key is null) with check(manual_entry_key is null);
alter table public.noor_learning_items add column attachment_removed_at timestamptz;
create index noor_daily_note_attachment on public.noor_learning_items(attachment_path) where homework_date is not null and attachment_path is not null;

create table private.noor_retention_files(
 id uuid primary key default gen_random_uuid(),bucket text not null check(bucket='noor-learning-files'),path text not null check(path not like '%..%' and path ~ '^[0-9a-f-]{36}/daily-homework-[0-9a-f-]{36}\.(jpg|png|webp)$'),
 attempts int not null default 0,lease_until timestamptz,retry_at timestamptz not null default now(),created_at timestamptz not null default now(),unique(bucket,path)
);
alter table private.noor_retention_files enable row level security;
revoke all on private.noor_retention_files from public,anon,authenticated;
create index noor_retention_files_due on private.noor_retention_files(retry_at,lease_until);

create function private.noor_retention_prepare() returns jsonb language plpgsql security definer set search_path='' as $f$
declare r record;purged int=0;pending int=0;failed int=0;queued int=0;
begin
 update public.noor_weekly_quizzes q set retired_at=clock_timestamp() from public.institutions i where i.id=q.institution_id and q.retired_at is null and ((q.quiz_date::timestamp at time zone i.timezone)+interval '30 days')<=clock_timestamp();
 select count(*) into pending from public.noor_weekly_quizzes q where retired_at is not null and exists(select 1 from public.noor_quiz_attempts a where a.quiz_id=q.id and a.assessment_result_id is null);
 for r in select id from public.noor_weekly_quizzes q where retired_at is not null and not exists(select 1 from public.noor_quiz_attempts a where a.quiz_id=q.id and a.assessment_result_id is null) order by retired_at limit 500 for update skip locked loop
  begin if private.noor_purge_test(r.id) then purged=purged+1;else pending=pending+1;end if;exception when others then failed=failed+1;end;
 end loop;
 insert into private.noor_retention_files(bucket,path)
 select o.bucket_id,o.name from storage.objects o where o.bucket_id='noor-learning-files' and o.created_at<=clock_timestamp()-interval '30 days'
 and o.name ~ '^[0-9a-f-]{36}/daily-homework-[0-9a-f-]{36}\.(jpg|png|webp)$'
 and not exists(select 1 from private.noor_retention_files f where f.bucket=o.bucket_id and f.path=o.name)
 order by o.created_at limit 200 on conflict do nothing;
 get diagnostics queued=row_count;
 return jsonb_build_object('tests_deleted',purged,'tests_awaiting_review',pending,'test_errors',failed,'photos_queued',queued);
end $f$;
create function public.noor_retention_prepare() returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_retention_prepare();$f$;
revoke all on function private.noor_retention_prepare(),public.noor_retention_prepare() from public,anon,authenticated;
grant execute on function private.noor_retention_prepare(),public.noor_retention_prepare() to service_role;

create function private.noor_retention_claim() returns jsonb language plpgsql security definer set search_path='' as $f$
declare output jsonb;
begin
 with selected as(select id from private.noor_retention_files where retry_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp()) order by retry_at limit 200 for update skip locked),
 claimed as(update private.noor_retention_files f set attempts=attempts+1,lease_until=clock_timestamp()+interval '10 minutes' from selected s where f.id=s.id returning f.id,f.bucket,f.path)
 select coalesce(jsonb_agg(to_jsonb(c)),'[]') into output from claimed c;return output;
end $f$;
create function public.noor_retention_claim() returns jsonb language sql security invoker set search_path='' as $f$ select private.noor_retention_claim();$f$;
revoke all on function private.noor_retention_claim(),public.noor_retention_claim() from public,anon,authenticated;
grant execute on function private.noor_retention_claim(),public.noor_retention_claim() to service_role;

create function private.noor_retention_ack(p_ids uuid[],p_success boolean) returns int language plpgsql security definer set search_path='' as $f$
declare f private.noor_retention_files;n int=0;
begin
 if cardinality(p_ids)>200 or p_success is null then raise exception 'Invalid retention acknowledgement';end if;
 for f in select * from private.noor_retention_files where id=any(p_ids) for update loop
  if p_success then
   update public.noor_learning_items set attachment_path=null,attachment_removed_at=clock_timestamp() where homework_date is not null and attachment_path=f.path;
   delete from private.noor_retention_files where id=f.id;
  else update private.noor_retention_files set lease_until=null,retry_at=clock_timestamp()+make_interval(mins=>least(1440,5*power(2,least(attempts,8))::int)) where id=f.id;
  end if;n=n+1;
 end loop;return n;
end $f$;
create function public.noor_retention_ack(p_ids uuid[],p_success boolean) returns int language sql security invoker set search_path='' as $f$ select private.noor_retention_ack(p_ids,p_success);$f$;
revoke all on function private.noor_retention_ack(uuid[],boolean),public.noor_retention_ack(uuid[],boolean) from public,anon,authenticated;
grant execute on function private.noor_retention_ack(uuid[],boolean),public.noor_retention_ack(uuid[],boolean) to service_role;

insert into private.noor_worker_credentials(name,token_hash,token_value)
select 'retention-worker',encode(extensions.digest(raw,'sha256'),'hex'),raw from(select encode(extensions.gen_random_bytes(32),'hex') raw) x on conflict(name) do nothing;
create function public.noor_validate_retention_worker(p_token text) returns boolean language sql security definer set search_path='' as $f$
 select p_token is not null and length(p_token)=64 and exists(select 1 from private.noor_worker_credentials c where c.name='retention-worker' and c.token_hash=encode(extensions.digest(p_token,'sha256'),'hex'));
$f$;
revoke all on function public.noor_validate_retention_worker(text) from public,anon,authenticated;
grant execute on function public.noor_validate_retention_worker(text) to service_role;

-- A database schedule is independent of browsers and logged-in teachers.
select cron.schedule('noor-monthly-retention','*/15 * * * *',$worker$
 select net.http_post(url:='https://ayrryemawwplguaauxij.supabase.co/functions/v1/noor-retention-worker',headers:=jsonb_build_object('Content-Type','application/json','x-noor-worker-token',(select token_value from private.noor_worker_credentials where name='retention-worker')),body:='{}'::jsonb,timeout_milliseconds:=30000);
$worker$);

create or replace function private.noor_paper_list() returns setof jsonb
language sql security definer set search_path='' as $f$
 select jsonb_build_object('id',q.id,'academic_group_id',q.academic_group_id,'title',q.title,'subject_name',q.subject_name,'quiz_date',q.quiz_date,'assessment_kind',q.assessment_kind,'duration_minutes',q.duration_minutes,'max_marks',q.max_marks,'question_count',jsonb_array_length(q.questions),'submitted',a.id is not null,'started',s.paper_token is not null,'auto_grade',q.auto_grade)
 from public.noor_weekly_quizzes q
 join public.institutions i on i.id=q.institution_id and i.status='active'
 join public.institution_memberships m on m.institution_id=q.institution_id and m.user_id=auth.uid() and m.status='active' and m.role in('student','university_student')
 left join private.noor_test_sessions s on s.quiz_id=q.id and s.membership_id=m.id
 left join public.noor_quiz_attempts a on a.quiz_id=q.id and a.student_membership_id=m.id
 where q.retired_at is null and auth.uid() is not null and private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false)
 order by q.quiz_date desc,q.id limit 150;
$f$;

create or replace function private.noor_paper_member(p_quiz uuid) returns uuid
language plpgsql security definer set search_path='' as $f$
declare q public.noor_weekly_quizzes;m uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into strict q from public.noor_weekly_quizzes where id=p_quiz;
 if q.retired_at is not null then raise exception 'This test has been removed by your teacher';end if;
 if not private.noor_quiz_group_access(q.institution_id,q.academic_group_id,false) then raise exception 'Only your enrolled class paper can be opened' using errcode='42501';end if;
 select id into strict m from public.institution_memberships where institution_id=q.institution_id and user_id=auth.uid() and status='active' and role in('student','university_student') for update;
 return m;
end $f$;
