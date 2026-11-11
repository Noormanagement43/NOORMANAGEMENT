create table if not exists public.noor_school_campaigns(
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  request_key uuid not null,
  kind text not null check(kind in ('notice','meeting','email')),
  title text not null check(length(btrim(title)) between 1 and 180),
  body text not null check(length(btrim(body)) between 1 and 20000),
  audience text[] not null check(cardinality(audience)>0 and audience<@array['student','staff','manager','parent']::text[]),
  channels text[] not null check(cardinality(channels)>0 and channels<@array['in_app','email']::text[]),
  starts_at timestamptz,
  sender_email text,
  sender_name text,
  reply_to_email text,
  message_id uuid references public.noor_school_messages(id),
  queued_count integer not null default 0,
  accepted_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,created_by,request_key),
  constraint noor_campaign_meeting_time check(kind<>'meeting' or starts_at is not null)
);
alter table public.noor_school_campaigns enable row level security;
revoke all on public.noor_school_campaigns from anon,authenticated;
grant select on public.noor_school_campaigns to authenticated;
grant all on public.noor_school_campaigns to service_role;
drop policy if exists noor_school_campaigns_leadership_read on public.noor_school_campaigns;
create policy noor_school_campaigns_leadership_read on public.noor_school_campaigns
for select to authenticated using (
 private.has_institution_role(institution_id,array['principal','school_admin','university_admin','academic_admin']::text[])
);
create table if not exists public.noor_email_queue(
 id bigint generated always as identity primary key,
 campaign_id uuid not null references public.noor_school_campaigns(id) on delete cascade,
 institution_id uuid not null references public.institutions(id) on delete cascade,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'queued' check (status in ('queued','sending','accepted','failed','skipped')),
 attempts integer not null default 0 check(attempts between 0 and 10),
 retry_at timestamptz not null default now(),
 claimed_until timestamptz,
 provider_message_id text,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(campaign_id,recipient_user_id)
);
create index if not exists noor_email_queue_status_retry_idx on public.noor_email_queue(status,retry_at,id);
create index if not exists noor_email_queue_institution_idx on public.noor_email_queue(institution_id,campaign_id);
alter table public.noor_email_queue enable row level security;
revoke all on public.noor_email_queue from anon,authenticated;
grant all on public.noor_email_queue to service_role;
alter table public.noor_school_messages drop constraint if exists noor_school_messages_audience_check;
do $$
declare r record;
begin
 for r in
 select conname from pg_constraint
 where conrelid='public.noor_school_messages'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%audience%'
 loop execute format('alter table public.noor_school_messages drop constraint %I',r.conname); end loop;
end $$;
alter table public.noor_school_messages
 add constraint noor_school_messages_audience_check check(
 cardinality(audience)>0 and audience<@array['all','student','teacher','staff','manager','parent']::text[]
);
create or replace function private.noor_message_visible(p_inst uuid,p_audience text[])
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.institution_memberships m
  join public.institutions i on i.id=m.institution_id
  where m.institution_id=p_inst and m.user_id=(select auth.uid())
    and m.status='active' and i.status='active' and (
       private.can_manage_academics(p_inst)
       or 'all'=any(p_audience)
       or ('student'=any(p_audience) and m.role in ('student','university_student'))
       or (('teacher'=any(p_audience) or 'staff'=any(p_audience)) and m.role in ('teacher','faculty','staff'))
       or ('parent'=any(p_audience) and m.role='parent')
       or ('manager'=any(p_audience) and m.role in ('school_admin','university_admin','academic_admin','finance_admin'))
    )
 )
$$;
create or replace function public.noor_enqueue_communication(
 p_institution uuid,p_sender uuid,p_request_key uuid,
 p_kind text,p_title text,p_body text,p_audience text[],p_channels text[],
 p_starts_at timestamptz,p_sender_email text,p_sender_name text,p_reply_to_email text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare c_id uuid; m_id uuid; n integer:=0; inserted boolean:=false; inapp text[];
begin
 if p_request_key is null or p_institution is null or p_sender is null
    or not exists(select 1 from public.institution_memberships m join public.institutions i on i.id=m.institution_id
        where m.institution_id=p_institution and m.user_id=p_sender and m.status='active'
        and m.role in ('principal','school_admin','university_admin','academic_admin') and i.status='active')
 then raise exception 'School leadership required' using errcode='42501'; end if;
 if p_kind not in ('notice','meeting','email') or length(btrim(p_title)) not between 1 and 180
 or length(btrim(p_body)) not between 1 and 20000
 or cardinality(p_audience) is null or cardinality(p_audience)=0 or not(p_audience<@array['student','staff','manager','parent']::text[])
 or cardinality(p_channels) is null or cardinality(p_channels)=0 or not(p_channels<@array['in_app','email']::text[])
 or (p_kind='meeting' and p_starts_at is null)
 then raise exception 'Invalid campaign' using errcode='22023'; end if;
 insert into public.noor_school_campaigns(institution_id,created_by,request_key,kind,title,body,audience,channels,starts_at,sender_email,sender_name,reply_to_email)
 values (p_institution,p_sender,p_request_key,p_kind,btrim(p_title),btrim(p_body),p_audience,p_channels,p_starts_at,p_sender_email,p_sender_name,p_reply_to_email)
 on conflict(institution_id,created_by,request_key) do nothing returning id into c_id;
 inserted:=c_id is not null;
 if not inserted then
  select id into c_id from public.noor_school_campaigns
   where institution_id=p_institution and created_by=p_sender and request_key=p_request_key;
  select queued_count into n from public.noor_school_campaigns where id=c_id;
  return jsonb_build_object('campaign_id',c_id,'email_queued',n,'duplicate',true);
 end if;
 if 'in_app'=any(p_channels) then
  inapp:=array(
   select distinct case when r='staff' then 'teacher' else r end from unnest(p_audience) r
  );
  insert into public.noor_school_messages(institution_id,created_by,kind,title,body,audience,starts_at)
    values(p_institution,p_sender,p_kind,btrim(p_title),btrim(p_body),inapp,p_starts_at)
    returning id into m_id;
  update public.noor_school_campaigns set message_id=m_id where id=c_id;
 end if;
 if 'email'=any(p_channels) then
  insert into public.noor_email_queue(campaign_id,institution_id,recipient_user_id)
  select c_id,p_institution,m.user_id
  from public.institution_memberships m join auth.users u on u.id=m.user_id
  where m.institution_id=p_institution and m.status='active'
   and u.email is not null and u.email_confirmed_at is not null
   and (('student'=any(p_audience) and m.role in ('student','university_student'))
     or ('staff'=any(p_audience) and m.role in ('teacher','faculty','staff'))
     or ('manager'=any(p_audience) and m.role in ('school_admin','university_admin','academic_admin','finance_admin'))
     or ('parent'=any(p_audience) and m.role='parent'))
  on conflict(campaign_id,recipient_user_id) do nothing;
  get diagnostics n=row_count;
  update public.noor_school_campaigns set queued_count=n where id=c_id;
 end if;
 return jsonb_build_object('campaign_id',c_id,'email_queued',n,'in_app_created',m_id is not null,'duplicate',false);
end $$;
revoke all on function public.noor_enqueue_communication(uuid,uuid,uuid,text,text,text,text[],text[],timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.noor_enqueue_communication(uuid,uuid,uuid,text,text,text,text[],text[],timestamptz,text,text,text) to service_role;
create or replace function public.noor_claim_mail_batch(p_limit integer default 50)
returns table(
 queue_id bigint,campaign_id uuid,institution_id uuid,recipient_user_id uuid,
 title text,body text,kind text,starts_at timestamptz,sender_email text,sender_name text,reply_to_email text,attempts integer
) language sql security definer set search_path=''
as $$
 with picked as (
  select q.id from public.noor_email_queue q
  where (q.status='queued' and q.retry_at<=now())
     or (q.status='sending' and q.claimed_until<now() and q.attempts<4)
  order by q.id
  for update skip locked limit least(greatest(p_limit,1),50)
 ),
 claimed as (
  update public.noor_email_queue q set status='sending',attempts=q.attempts+1,
     claimed_until=now()+interval '4 minutes',updated_at=now()
  from picked where q.id=picked.id
  returning q.*
 )
 select q.id,q.campaign_id,q.institution_id,q.recipient_user_id,c.title,c.body,c.kind,c.starts_at,c.sender_email,c.sender_name,c.reply_to_email,q.attempts
 from claimed q join public.noor_school_campaigns c on c.id=q.campaign_id
$$;
revoke all on function public.noor_claim_mail_batch(integer) from public,anon,authenticated;
grant execute on function public.noor_claim_mail_batch(integer) to service_role;
