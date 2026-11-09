alter table public.academic_groups
  add column if not exists description text,
  add column if not exists room_label text,
  add column if not exists capacity integer,
  add column if not exists is_active boolean not null default true,
  add column if not exists homeroom_teacher_membership_id uuid;

alter table public.academic_groups
  add constraint academic_groups_capacity_positive
    check (capacity is null or capacity > 0),
  add constraint academic_groups_description_length
    check (description is null or length(description) <= 2000);

alter table public.academic_groups
  add constraint academic_groups_homeroom_teacher_membership_fkey
  foreign key (homeroom_teacher_membership_id, institution_id)
  references public.institution_memberships (id, institution_id);

create index if not exists academic_groups_institution_type_active_idx
  on public.academic_groups (institution_id, group_type, is_active);

create index if not exists academic_groups_homeroom_teacher_idx
  on public.academic_groups (homeroom_teacher_membership_id)
  where homeroom_teacher_membership_id is not null;

comment on column public.academic_groups.room_label is 'Room or classroom assigned to this class/section.';
comment on column public.academic_groups.capacity is 'Optional planned capacity; not a live student count.';
comment on column public.academic_groups.homeroom_teacher_membership_id is 'Optional teacher/staff membership responsible for the class.';
