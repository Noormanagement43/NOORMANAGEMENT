create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_group_id uuid,
  course_id uuid,
  teacher_membership_id uuid,
  title text not null check (length(trim(title)) > 0),
  room_label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  session_status text not null default 'scheduled' check (session_status in ('scheduled','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, institution_id),
  foreign key (academic_group_id, institution_id) references public.academic_groups(id, institution_id) on delete cascade,
  foreign key (course_id, institution_id) references public.courses(id, institution_id) on delete cascade,
  foreign key (teacher_membership_id, institution_id) references public.institution_memberships(id, institution_id) on delete set null (teacher_membership_id)
);
create index if not exists class_sessions_institution_start_idx on public.class_sessions(institution_id, starts_at);
create index if not exists class_sessions_teacher_start_idx on public.class_sessions(teacher_membership_id, starts_at);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  session_id uuid not null,
  student_membership_id uuid not null,
  attendance_status text not null check (attendance_status in ('present','absent','late','leave')),
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz not null default now(),
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, institution_id) references public.class_sessions(id, institution_id) on delete cascade,
  foreign key (student_membership_id, institution_id) references public.institution_memberships(id, institution_id) on delete cascade,
  unique (session_id, student_membership_id)
);
create index if not exists attendance_records_student_marked_idx on public.attendance_records(student_membership_id, marked_at desc);
create index if not exists attendance_records_institution_marked_idx on public.attendance_records(institution_id, marked_at desc);

alter table public.class_sessions enable row level security;
alter table public.attendance_records enable row level security;

drop policy if exists class_sessions_select_member on public.class_sessions;
create policy class_sessions_select_member on public.class_sessions for select to authenticated
using ((select private.is_active_member(institution_id)) or (select private.is_platform_admin()));
drop policy if exists class_sessions_insert_manager on public.class_sessions;
create policy class_sessions_insert_manager on public.class_sessions for insert to authenticated
with check ((select private.can_manage_academics(institution_id)) or (select private.is_platform_admin()));
drop policy if exists class_sessions_update_manager on public.class_sessions;
create policy class_sessions_update_manager on public.class_sessions for update to authenticated
using ((select private.can_manage_academics(institution_id)) or (select private.is_platform_admin()))
with check ((select private.can_manage_academics(institution_id)) or (select private.is_platform_admin()));
drop policy if exists class_sessions_delete_manager on public.class_sessions;
create policy class_sessions_delete_manager on public.class_sessions for delete to authenticated
using ((select private.can_manage_academics(institution_id)) or (select private.is_platform_admin()));

drop policy if exists attendance_select_self_teacher_manager on public.attendance_records;
create policy attendance_select_self_teacher_manager on public.attendance_records for select to authenticated
using (
  (select private.can_manage_academics(institution_id))
  or (select private.is_platform_admin())
  or exists (
    select 1 from public.class_sessions s
    join public.institution_memberships tm on tm.id = s.teacher_membership_id and tm.institution_id = s.institution_id
    where s.id = attendance_records.session_id and s.institution_id = attendance_records.institution_id
      and tm.user_id = (select auth.uid()) and tm.status = 'active'
  )
  or (select private.is_my_membership(student_membership_id))
);
drop policy if exists attendance_insert_teacher_manager on public.attendance_records;
create policy attendance_insert_teacher_manager on public.attendance_records for insert to authenticated
with check (
  (select private.can_manage_academics(institution_id))
  or (select private.is_platform_admin())
  or exists (
    select 1 from public.class_sessions s
    join public.institution_memberships tm on tm.id = s.teacher_membership_id and tm.institution_id = s.institution_id
    where s.id = attendance_records.session_id and s.institution_id = attendance_records.institution_id
      and tm.user_id = (select auth.uid()) and tm.status = 'active' and tm.role in ('teacher','faculty')
  )
);
drop policy if exists attendance_update_teacher_manager on public.attendance_records;
create policy attendance_update_teacher_manager on public.attendance_records for update to authenticated
using (
  (select private.can_manage_academics(institution_id))
  or (select private.is_platform_admin())
  or exists (
    select 1 from public.class_sessions s
    join public.institution_memberships tm on tm.id = s.teacher_membership_id and tm.institution_id = s.institution_id
    where s.id = attendance_records.session_id and s.institution_id = attendance_records.institution_id
      and tm.user_id = (select auth.uid()) and tm.status = 'active' and tm.role in ('teacher','faculty')
  )
)
with check (
  (select private.can_manage_academics(institution_id))
  or (select private.is_platform_admin())
  or exists (
    select 1 from public.class_sessions s
    join public.institution_memberships tm on tm.id = s.teacher_membership_id and tm.institution_id = s.institution_id
    where s.id = attendance_records.session_id and s.institution_id = attendance_records.institution_id
      and tm.user_id = (select auth.uid()) and tm.status = 'active' and tm.role in ('teacher','faculty')
  )
);

comment on table public.class_sessions is 'Scheduled academic sessions for timetables; session times are stored with timezone.';
comment on table public.attendance_records is 'Explicitly marked attendance; no automatic attendance is recorded.';
