create table public.noor_student_personal_items (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 student_id uuid not null references auth.users(id),
 kind text not null check (kind in ('plan','achievement')),
 title text not null check (length(btrim(title)) between 1 and 180),
 planned_for date,
 is_done boolean not null default false,
 description text not null default '' check (length(description)<=3000),
 evidence_url text check (evidence_url is null or (evidence_url like 'https://%' and length(evidence_url)<=2000)),
 created_at timestamptz not null default now()
);
create index noor_student_personal_owner_idx on public.noor_student_personal_items(student_id,institution_id);
create index noor_student_personal_institution_idx on public.noor_student_personal_items(institution_id);
alter table public.noor_student_personal_items enable row level security;
revoke all on public.noor_student_personal_items from anon;
grant select,insert,update,delete on public.noor_student_personal_items to authenticated;
create policy student_personal_own on public.noor_student_personal_items for all to authenticated
 using (student_id=(select auth.uid()) and private.has_institution_role(institution_id,array['student','university_student']))
 with check (student_id=(select auth.uid()) and private.has_institution_role(institution_id,array['student','university_student']));
notify pgrst,'reload schema';
