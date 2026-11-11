-- Ticket 07: personal Sound & Feel preferences.
-- Additive only; existing school/student records and roles are untouched.
create table if not exists public.user_sound_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  master_sound_enabled boolean not null default true,
  volume numeric(3,2) not null default 0.32 check (volume >= 0 and volume <= 0.50),
  voice_cheers_enabled boolean not null default true,
  haptic_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_sound_preferences enable row level security;

drop policy if exists "Users can read own sound preferences" on public.user_sound_preferences;
create policy "Users can read own sound preferences"
  on public.user_sound_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own sound preferences" on public.user_sound_preferences;
create policy "Users can insert own sound preferences"
  on public.user_sound_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own sound preferences" on public.user_sound_preferences;
create policy "Users can update own sound preferences"
  on public.user_sound_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.user_sound_preferences from public, anon, authenticated;
grant select, insert, update on table public.user_sound_preferences to authenticated;

comment on table public.user_sound_preferences is
  'Per-account NOOR AI Sound & Feel preferences. Defaults enable sound, voice cheers, and haptics at a soft 32% master volume.';