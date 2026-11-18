-- Approved school working-day overrides, used by unified calendar and annual attendance.
-- This is additive: no existing calendar event or attendance record is rewritten.
create table if not exists public.noor_calendar_day_overrides (
 institution_id uuid not null references public.institutions(id) on delete cascade,
 day date not null check (day between date '2020-01-01' and date '2100-12-31'),
 is_working boolean not null,
 title text not null default '' check (char_length(title) <= 180),
 source text not null default 'manual' check (source in ('manual','pdf','google')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (institution_id, day)
);
alter table public.noor_calendar_day_overrides enable row level security;
revoke all on public.noor_calendar_day_overrides from anon;
grant select, insert, update, delete on public.noor_calendar_day_overrides to authenticated;
drop policy if exists noor_calendar_day_read on public.noor_calendar_day_overrides;
create policy noor_calendar_day_read on public.noor_calendar_day_overrides for select to authenticated
 using (private.is_active_member(institution_id) or private.is_platform_admin());
drop policy if exists noor_calendar_day_insert on public.noor_calendar_day_overrides;
create policy noor_calendar_day_insert on public.noor_calendar_day_overrides for insert to authenticated
 with check (private.can_manage_academics(institution_id) and created_by=(select auth.uid()));
drop policy if exists noor_calendar_day_update on public.noor_calendar_day_overrides;
create policy noor_calendar_day_update on public.noor_calendar_day_overrides for update to authenticated
 using (private.can_manage_academics(institution_id))
 with check (private.can_manage_academics(institution_id));
drop policy if exists noor_calendar_day_delete on public.noor_calendar_day_overrides;
create policy noor_calendar_day_delete on public.noor_calendar_day_overrides for delete to authenticated
 using (private.can_manage_academics(institution_id));

create or replace function private.noor_calendar_day_guard()
 returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='UPDATE' then
  if new.institution_id<>old.institution_id or new.day<>old.day or new.created_by<>old.created_by then
   raise exception 'Cannot reassign school, date or author of a calendar override' using errcode='42501';
  end if;
 end if;
 new.updated_at:=now();
 return new;
end; $$;
drop trigger if exists noor_calendar_day_guard_trg on public.noor_calendar_day_overrides;
create trigger noor_calendar_day_guard_trg before update on public.noor_calendar_day_overrides
 for each row execute function private.noor_calendar_day_guard();

-- A permissive generic school-member policy already exists on the calendar table.
-- Enforce leadership-only holiday creation in a trigger, independently of that policy.
create or replace function private.noor_calendar_holiday_guard()
 returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.kind='holiday' and not private.can_manage_academics(new.institution_id) then
  raise exception 'Only school leadership may publish school holidays' using errcode='42501';
 end if;
 if tg_op='UPDATE' then
  if old.kind='holiday' and not private.can_manage_academics(new.institution_id) then
   raise exception 'Only school leadership may edit school holidays' using errcode='42501';
  end if;
 end if;
 return new;
end; $$;
drop trigger if exists noor_calendar_holiday_guard_trg on public.noor_calendar_events;
create trigger noor_calendar_holiday_guard_trg before insert or update on public.noor_calendar_events
 for each row execute function private.noor_calendar_holiday_guard();

comment on table public.noor_calendar_day_overrides is 'Principal-approved exceptional working or non-working dates; checked by school attendance reports.';

-- Public Google Calendar IDs only. Never store OAuth tokens or private calendar contents here.
create table if not exists public.noor_calendar_google_sources (
 institution_id uuid primary key references public.institutions(id) on delete cascade,
 calendar_id text not null check (char_length(calendar_id) between 4 and 180 and calendar_id ~ '^[A-Za-z0-9._@%#-]+$'),
 connected_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.noor_calendar_google_sources enable row level security;
revoke all on public.noor_calendar_google_sources from anon;
grant select, insert, update, delete on public.noor_calendar_google_sources to authenticated;
drop policy if exists noor_google_calendar_read on public.noor_calendar_google_sources;
create policy noor_google_calendar_read on public.noor_calendar_google_sources for select to authenticated
 using (private.is_active_member(institution_id));
drop policy if exists noor_google_calendar_insert on public.noor_calendar_google_sources;
create policy noor_google_calendar_insert on public.noor_calendar_google_sources for insert to authenticated
 with check (private.can_manage_academics(institution_id) and connected_by=(select auth.uid()));
drop policy if exists noor_google_calendar_update on public.noor_calendar_google_sources;
create policy noor_google_calendar_update on public.noor_calendar_google_sources for update to authenticated
 using (private.can_manage_academics(institution_id))
 with check (private.can_manage_academics(institution_id) and connected_by=(select auth.uid()));
drop policy if exists noor_google_calendar_delete on public.noor_calendar_google_sources;
create policy noor_google_calendar_delete on public.noor_calendar_google_sources for delete to authenticated
 using (private.can_manage_academics(institution_id));
