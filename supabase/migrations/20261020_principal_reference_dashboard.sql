-- Principal-owned presentation text; data metrics remain derived from school records.
create table if not exists public.noor_principal_dashboard_settings (
 school_id uuid primary key references public.schools(id) on delete cascade,
 insight text not null default 'Leadership in education builds brighter tomorrows.' check (char_length(insight) between 1 and 500),
 updated_at timestamptz not null default now()
);
alter table public.noor_principal_dashboard_settings enable row level security;
revoke all on public.noor_principal_dashboard_settings from anon;
grant select,insert,update on public.noor_principal_dashboard_settings to authenticated;
create policy "principal dashboard settings read" on public.noor_principal_dashboard_settings for select to authenticated using (private.noor_active_school_access(school_id) and private.has_school_role(school_id,array['owner','principal']));
create policy "principal dashboard settings insert" on public.noor_principal_dashboard_settings for insert to authenticated with check (private.noor_active_school_access(school_id) and private.has_school_role(school_id,array['owner','principal']));
create policy "principal dashboard settings update" on public.noor_principal_dashboard_settings for update to authenticated using (private.noor_active_school_access(school_id) and private.has_school_role(school_id,array['owner','principal'])) with check (private.noor_active_school_access(school_id) and private.has_school_role(school_id,array['owner','principal']));
do $$ declare t text; begin
 foreach t in array array['classes','sections','profiles','school_tasks','noor_principal_dashboard_settings'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
