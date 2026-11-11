create table if not exists private.noor_worker_credentials(
 name text primary key,token_hash text not null,token_value text not null,created_at timestamptz not null default now()
);
revoke all on private.noor_worker_credentials from public,anon,authenticated;
insert into private.noor_worker_credentials(name,token_hash,token_value)
select 'email-worker',encode(extensions.digest(raw,'sha256'),'hex'),raw
from (select encode(extensions.gen_random_bytes(32),'hex') raw) x
on conflict(name) do nothing;
create or replace function public.noor_validate_worker_token(p_token text)
returns boolean language sql security definer set search_path=''
as $$
 select p_token is not null and length(p_token)=64 and exists(
  select 1 from private.noor_worker_credentials c
  where c.name='email-worker' and c.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 )
$$;
revoke all on function public.noor_validate_worker_token(text) from public,anon,authenticated;
grant execute on function public.noor_validate_worker_token(text) to service_role;
create or replace function public.noor_refresh_campaign_counts(p_campaign uuid)
returns void language sql security definer set search_path=''
as $$
 update public.noor_school_campaigns c set
  accepted_count=(select count(*) from public.noor_email_queue q where q.campaign_id=c.id and q.status='accepted'),
  failed_count=(select count(*) from public.noor_email_queue q where q.campaign_id=c.id and q.status in ('failed','skipped')),
  updated_at=now()
 where c.id=p_campaign
$$;
revoke all on function public.noor_refresh_campaign_counts(uuid) from public,anon,authenticated;
grant execute on function public.noor_refresh_campaign_counts(uuid) to service_role;
