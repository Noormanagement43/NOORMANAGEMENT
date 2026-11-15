-- Approval-gated draft. Thirty-day paper/photo retention; marks and annual reports remain.
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.noor_weekly_quizzes add column if not exists archived_at timestamptz;
alter table public.noor_weekly_quizzes alter column questions drop not null;
alter table public.noor_weekly_quizzes add constraint noor_active_paper_questions check(questions is not null or archived_at is not null);
create policy noor_unexpired_papers on public.noor_weekly_quizzes as restrictive for select to authenticated using(archived_at is null);
create function private.noor_guard_paper_archive() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is not null then
  if tg_op='INSERT' then
   if new.archived_at is not null then raise exception 'Paper retention is managed by the internal worker' using errcode='42501';end if;
  elsif new.archived_at is distinct from old.archived_at then raise exception 'Paper retention is managed by the internal worker' using errcode='42501';end if;
 end if;
 return new;
end $$;
create trigger noor_guard_paper_archive before insert or update on public.noor_weekly_quizzes for each row execute function private.noor_guard_paper_archive();
create function private.noor_block_archived_attempt() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.noor_weekly_quizzes q where q.id=new.quiz_id and q.institution_id=new.institution_id and q.archived_at is not null) then raise exception 'This paper has expired. Its saved marks remain in your report.' using errcode='22023';end if;
 return new;
end $$;
create trigger noor_block_archived_attempt before insert on public.noor_quiz_attempts for each row execute function private.noor_block_archived_attempt();
revoke all on function private.noor_guard_paper_archive(),private.noor_block_archived_attempt() from public,anon,authenticated;
create function public.noor_archive_expired_papers(p_limit integer default 100,p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;n int:=0;begin
 for r in select q.id from public.noor_weekly_quizzes q join public.institutions i on i.id=q.institution_id
 where q.archived_at is null and greatest(q.quiz_date,q.created_at::date,coalesce(q.approved_at,q.created_at)::date)<(now() at time zone coalesce(i.timezone,'Asia/Kolkata'))::date-30
 and not exists(select 1 from public.noor_quiz_attempts a where a.quiz_id=q.id and(a.grading_status<>'completed' or a.assessment_result_id is null))
 order by q.quiz_date,q.id limit least(greatest(p_limit,1),500) for update of q skip locked loop
  if not p_dry_run then
   update public.noor_weekly_quizzes set questions=null,archived_at=now() where id=r.id;
   delete from private.noor_quiz_keys where quiz_id=r.id;
  end if;
  n:=n+1;
 end loop;
 return jsonb_build_object('papers',n,'dry_run',p_dry_run);
end $$;
create function public.noor_expired_note_photos(p_limit integer default 100)
returns table(photo_path text) language sql security definer set search_path='' as $$
 select l.attachment_path from public.noor_learning_items l
 where l.kind='smart_note' and l.attachment_path is not null and split_part(l.attachment_path,'/',1)=l.created_by::text
 and greatest(l.created_at,l.updated_at,coalesce(l.homework_date::timestamptz,l.created_at))<now()-interval '30 days'
 and not exists(select 1 from public.noor_learning_items x where x.attachment_path=l.attachment_path and(x.kind<>'smart_note' or greatest(x.created_at,x.updated_at,coalesce(x.homework_date::timestamptz,x.created_at))>=now()-interval '30 days'))
 and not exists(select 1 from public.noor_teacher_weekly_plans p where p.attachment_path=l.attachment_path)
 group by l.attachment_path order by min(l.created_at),l.attachment_path limit least(greatest(p_limit,1),100)
$$;
-- Claim/tombstone each path before Storage deletion. Writers share the same advisory lock.
create table private.noor_retention_paths(photo_path text primary key,status text not null default 'queued' check(status in ('queued','deleted')),claimed_at timestamptz not null default now(),finished_at timestamptz);
alter table private.noor_retention_paths enable row level security;
revoke all on private.noor_retention_paths from public,anon,authenticated;
create function private.noor_retention_path_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.attachment_path is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.attachment_path,909));
 if exists(select 1 from private.noor_retention_paths where photo_path=new.attachment_path) then raise exception 'This old photo is being removed. Upload a new photo to continue.' using errcode='22023';end if;
 return new;
end $$;
revoke all on function private.noor_retention_path_guard() from public,anon,authenticated;
create trigger noor_retention_path_guard before insert or update on public.noor_learning_items for each row execute function private.noor_retention_path_guard();
create trigger noor_retention_path_guard before insert or update on public.noor_teacher_weekly_plans for each row execute function private.noor_retention_path_guard();
create function public.noor_claim_expired_note_photos(p_limit integer default 100)
returns table(photo_path text) language plpgsql security definer set search_path='' as $$
declare r record;begin
 for r in select p.photo_path from public.noor_expired_note_photos(p_limit) p loop
  if r.photo_path !~ '^[0-9a-f-]{36}/class-resource-[0-9a-f-]{36}\.(jpg|png|webp)$' then continue;end if;
  perform pg_advisory_xact_lock(hashtextextended(r.photo_path,909));
  if exists(select 1 from public.noor_expired_note_photos(100) p where p.photo_path=r.photo_path) then
   insert into private.noor_retention_paths(photo_path) values(r.photo_path) on conflict do nothing;
   photo_path:=r.photo_path;return next;
  end if;
 end loop;
end $$;
create function public.noor_finish_note_photo_retention(p_paths text[])
returns integer language plpgsql security definer set search_path='' as $$
declare n int;begin
 update public.noor_learning_items set attachment_path=null where kind='smart_note' and attachment_path=any(p_paths)
 and attachment_path in(select photo_path from private.noor_retention_paths where status='queued');
 get diagnostics n=row_count;
 update private.noor_retention_paths set status='deleted',finished_at=now() where photo_path=any(p_paths) and status='queued';
 return n;
end $$;
revoke all on function public.noor_archive_expired_papers(integer,boolean),public.noor_expired_note_photos(integer),public.noor_claim_expired_note_photos(integer),public.noor_finish_note_photo_retention(text[]) from public,anon,authenticated;
grant execute on function public.noor_archive_expired_papers(integer,boolean),public.noor_expired_note_photos(integer),public.noor_claim_expired_note_photos(integer),public.noor_finish_note_photo_retention(text[]) to service_role;
create index if not exists noor_retention_paper_date on public.noor_weekly_quizzes(quiz_date,id) where archived_at is null;
create index if not exists noor_retention_note_date on public.noor_learning_items(created_at) where kind='smart_note' and attachment_path is not null;
-- Invoke only the authenticated internal worker; the token stays inside the database.
select cron.schedule('noor-monthly-content-retention','37 * * * *',$job$
 select net.http_post(url:='https://ayrryemawwplguaauxij.supabase.co/functions/v1/noor-content-retention',
 headers:=jsonb_build_object('Content-Type','application/json','x-noor-worker-token',(select token_value from private.noor_worker_credentials where name='email-worker')),
 body:='{"dry_run":false}'::jsonb,timeout_milliseconds:=60000);
$job$);
