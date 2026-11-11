create table if not exists public.noor_school_appearance (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  theme_key text not null default 'pastel-aurora' check (theme_key in ('simple-clean','rose-gold','pastel-aurora','linen-pearl','porcelain-blue','rose-whisper','ocean-blue','sage-garden')),
  color_mode text not null default 'light' check (color_mode in ('light','dark')),
  font_scale text not null default 'normal' check (font_scale in ('small','normal','large')),
  reduced_motion boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.noor_school_appearance enable row level security;
revoke all on public.noor_school_appearance from anon;
grant select,insert,update on public.noor_school_appearance to authenticated;
drop policy if exists noor_school_appearance_read on public.noor_school_appearance;
create policy noor_school_appearance_read on public.noor_school_appearance for select to authenticated using (private.is_active_member(institution_id));
drop policy if exists noor_school_appearance_principal_create on public.noor_school_appearance;
create policy noor_school_appearance_principal_create on public.noor_school_appearance for insert to authenticated with check (private.has_institution_role(institution_id,ARRAY['principal']::text[]));
drop policy if exists noor_school_appearance_principal_update on public.noor_school_appearance;
create policy noor_school_appearance_principal_update on public.noor_school_appearance for update to authenticated using (private.has_institution_role(institution_id,ARRAY['principal']::text[])) with check (private.has_institution_role(institution_id,ARRAY['principal']::text[]));
