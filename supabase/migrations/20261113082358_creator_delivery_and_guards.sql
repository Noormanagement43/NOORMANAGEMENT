-- Three-day billing reminders are opt-in per institute. Creator messages stay separate
-- from school campaigns and can reach the principal while school access is paused.
alter table public.noor_institute_billing add column reminder_enabled boolean not null default false,add column reminder_days integer not null default 3 check(reminder_days between 1 and 30);
create table private.noor_creator_reminder_history(institution_id uuid references public.institutions,due_date date,broadcast_id uuid references public.noor_creator_broadcasts,primary key(institution_id,due_date));
revoke all on private.noor_creator_reminder_history from public,anon,authenticated;
do $$declare def text;begin
 def=pg_get_functiondef('private.noor_creator_dispatch(text,jsonb)'::regprocedure);
 def=replace(def,'b.grace_days,b.pause_reason,','b.grace_days,b.pause_reason,b.reminder_enabled,b.reminder_days,');
 def=replace(def,'elsif p_action=''payment'' then',
 'update public.noor_institute_billing set reminder_enabled=coalesce((p->>''reminder_enabled'')::boolean,reminder_enabled),reminder_days=coalesce((p->>''reminder_days'')::integer,reminder_days) where institution_id=inst; elsif p_action=''payment'' then');
 execute def;
 -- All single-sitting paper reads use this checked entry point.
 def=pg_get_functiondef('private.noor_paper_member(uuid)'::regprocedure);
 def=regexp_replace(def,'\mBEGIN\M','BEGIN if not exists(select 1 from public.noor_weekly_quizzes q where q.id=p_quiz and private.noor_feature_enabled(q.institution_id,case q.assessment_kind when ''monthly'' then ''monthly_tests'' when ''exam'' then ''exams'' else ''weekly_tests'' end)) then raise exception ''Test access disabled by NOOR'' using errcode=''42501''; end if;','i');execute def;
end $$;
create function private.noor_creator_prepare_reminders() returns void language plpgsql security definer set search_path='' as $$
 declare r record; bid uuid; owner_id uuid;begin
 select c.user_id into owner_id from private.noor_creator_account c join auth.users u on u.id=c.user_id and lower(u.email)=c.email and u.email_confirmed_at is not null where c.singleton and exists(select 1 from public.platform_roles p where p.user_id=c.user_id and p.role='platform_owner');
 if owner_id is null then return;end if;
 for r in select b.*,i.name from public.noor_institute_billing b join public.institutions i on i.id=b.institution_id
 where b.reminder_enabled and b.next_due>=(now() at time zone 'Asia/Kolkata')::date
 and (b.next_due-b.reminder_days)<=(now() at time zone 'Asia/Kolkata')::date
 and (b.last_paid_due is null or b.last_paid_due<b.next_due)
 and not exists(select 1 from private.noor_creator_reminder_history h where h.institution_id=b.institution_id and h.due_date=b.next_due)
 for update of b skip locked loop
 insert into public.noor_creator_broadcasts(created_by,request_key,title,body,channels,institution_ids)
 values(owner_id,gen_random_uuid(),'Payment reminder · '||left(r.name,130),
 'Dear Principal, your NOOR subscription payment of ₹'||r.monthly_fee||' is due on '||to_char(r.next_due,'DD Mon YYYY')||'. Please complete your payment before the due date. Thank you.','{in_app,email}',array[r.institution_id]) returning id into bid;
 insert into public.noor_creator_deliveries(broadcast_id,institution_id,recipient_id,published_at,email_status)
 select bid,r.institution_id,m.user_id,now(),'queued' from public.institution_memberships m where m.institution_id=r.institution_id and m.status='active' and m.user_id is not null and m.role in ('principal','university_admin');
 insert into private.noor_creator_reminder_history values(r.institution_id,r.next_due,bid);
 end loop;
 end $$;
revoke all on function private.noor_creator_prepare_reminders() from public,anon,authenticated;
do $$declare def text;begin
 def=pg_get_functiondef('private.noor_creator_claim_mail()'::regprocedure);
 def=regexp_replace(def,'\mBEGIN\M','BEGIN perform private.noor_creator_prepare_reminders();','i');execute def;
end $$;
-- Triggers keep existing definer writes under the creator's feature constraints. Core
-- institution settings also need a guard to stop unpausing via a tenant update endpoint.
create function private.noor_creator_institution_write() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is not null and not private.is_platform_admin() and not private.noor_feature_enabled(old.id,'school_settings') then raise exception 'Institute settings or access disabled by NOOR' using errcode='42501';end if;
 return new;end $$;
revoke all on function private.noor_creator_institution_write() from public,anon,authenticated;
create trigger noor_creator_institution_write before update on public.institutions for each row execute function private.noor_creator_institution_write();
-- Explicit deny policies document API-only access without broad client grants.
do $$declare t text;begin
 foreach t in array array['noor_feature_catalog','noor_feature_defaults','noor_feature_overrides','noor_institute_billing','noor_creator_payments','noor_creator_activity','noor_creator_broadcasts','noor_creator_deliveries','noor_creator_support'] loop
 execute format('create policy noor_creator_api_only on public.%I for all to authenticated using(false) with check(false)',t);
 end loop;
end $$;
select cron.schedule('noor-creator-principal-mail','* * * * *',$worker$
 select net.http_post(url:='https://ayrryemawwplguaauxij.supabase.co/functions/v1/noor-creator-mail-worker',headers:=jsonb_build_object('Content-Type','application/json','x-noor-worker-token',(select token_value from private.noor_worker_credentials where name='email-worker')),body:='{}'::jsonb,timeout_milliseconds:=15000);
$worker$);
