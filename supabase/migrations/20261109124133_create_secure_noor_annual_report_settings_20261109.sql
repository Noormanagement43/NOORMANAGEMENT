create table if not exists public.noor_report_settings (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  subject_names text[] not null default array[]::text[],
  exam_labels jsonb not null default '{"weekly":"Weekly Tests","monthly":"Monthly Tests","term1":"Term 1 Exam","term2":"Term 2 Exam","term3":"Term 3 (Final)"}'::jsonb,
  exam_aliases jsonb not null default '{"weekly":["weekly","quiz"],"monthly":["monthly"],"term1":["term 1","first term"],"term2":["term 2","second term"],"term3":["term 3","third term","final exam"]}'::jsonb,
  non_working_weekdays int[] not null default array[0],
  updated_at timestamptz not null default now(),
  constraint report_weekday_range check (non_working_weekdays <@ array[0,1,2,3,4,5,6]::int[]),
  constraint report_subject_limit check (cardinality(subject_names) <= 30)
);
alter table public.noor_report_settings enable row level security;
revoke all on public.noor_report_settings from anon;
grant select,insert,update on public.noor_report_settings to authenticated;
drop policy if exists report_settings_read on public.noor_report_settings;
create policy report_settings_read on public.noor_report_settings for select to authenticated using (private.is_active_member(institution_id) or private.is_platform_admin());
drop policy if exists report_settings_create on public.noor_report_settings;
create policy report_settings_create on public.noor_report_settings for insert to authenticated with check (private.can_manage_academics(institution_id) or private.is_platform_admin());
drop policy if exists report_settings_update on public.noor_report_settings;
create policy report_settings_update on public.noor_report_settings for update to authenticated using (private.can_manage_academics(institution_id) or private.is_platform_admin()) with check (private.can_manage_academics(institution_id) or private.is_platform_admin());
