create table if not exists public.user_theme_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_key text not null default 'rose-gold'
    check (theme_key in ('rose-gold','pearl-ivory','ocean-blue','sage-garden','lavender-mist','teal-glass','sandstone','midnight-luxe')),
  font_scale text not null default 'normal'
    check (font_scale in ('small','normal','large')),
  reduced_motion boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_theme_preferences enable row level security;
revoke all on table public.user_theme_preferences from anon;
grant select, insert, update on table public.user_theme_preferences to authenticated;

drop policy if exists user_theme_preferences_select_own on public.user_theme_preferences;
create policy user_theme_preferences_select_own
  on public.user_theme_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_theme_preferences_insert_own on public.user_theme_preferences;
create policy user_theme_preferences_insert_own
  on public.user_theme_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists user_theme_preferences_update_own on public.user_theme_preferences;
create policy user_theme_preferences_update_own
  on public.user_theme_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
