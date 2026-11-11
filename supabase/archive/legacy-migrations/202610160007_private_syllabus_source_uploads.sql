-- NOOR AI Task 5: private syllabus-source uploads.
-- Intended for the already-migrated NOOR AI project; does not delete or overwrite existing records.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('noor-syllabus-source','noor-syllabus-source',false,4194304,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=4194304,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create table if not exists public.syllabus_uploads(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete restrict,
 academic_year_id uuid not null references public.academic_years(id) on delete restrict,
 uploaded_by uuid not null references public.profiles(id) on delete restrict,
 class_id uuid not null references public.classes(id) on delete restrict,
 section_id uuid references public.sections(id) on delete set null,
 subject_id uuid not null references public.subjects(id) on delete restrict,
 unit_id uuid references public.syllabus_units(id) on delete set null,
 note_id uuid references public.smart_notes(id) on delete set null,
 storage_path text not null unique,
 original_file_name text not null check(char_length(original_file_name) between 1 and 255),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 file_size_bytes integer not null check(file_size_bytes between 1 and 4194304),
 extracted_text text,
 extraction_confidence text check(extraction_confidence is null or extraction_confidence in ('high','medium','low','needs_review','not_run')),
 uploaded_at timestamptz not null default now()
);
create index if not exists syllabus_uploads_context_idx on public.syllabus_uploads(school_id,academic_year_id,class_id,section_id,subject_id,uploaded_at desc);
create index if not exists syllabus_uploads_uploaded_by_idx on public.syllabus_uploads(uploaded_by);
create index if not exists syllabus_uploads_unit_idx on public.syllabus_uploads(unit_id);
create index if not exists syllabus_uploads_note_idx on public.syllabus_uploads(note_id);
alter table public.syllabus_uploads enable row level security;
grant select,insert,update,delete on public.syllabus_uploads to authenticated;
alter table public.smart_notes add column if not exists source_file_ids uuid[] not null default '{}';

create or replace function private.noor_validate_syllabus_upload()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.uploaded_by is distinct from (select auth.uid()) then raise exception 'Upload owner must be the signed-in user' using errcode='42501'; end if;
 if not exists(select 1 from public.academic_years y where y.id=new.academic_year_id and y.school_id=new.school_id) then raise exception 'Academic year does not belong to this school' using errcode='23514'; end if;
 if not exists(select 1 from public.classes c where c.id=new.class_id and c.school_id=new.school_id and c.is_active) then raise exception 'Class does not belong to this school' using errcode='23514'; end if;
 if new.section_id is not null and not exists(select 1 from public.sections s where s.id=new.section_id and s.class_id=new.class_id and s.is_active) then raise exception 'Section does not belong to this class' using errcode='23514'; end if;
 if not exists(select 1 from public.subjects s where s.id=new.subject_id and s.school_id=new.school_id and (s.class_id is null or s.class_id=new.class_id)) then raise exception 'Subject does not belong to this class' using errcode='23514'; end if;
 if new.unit_id is not null and not exists(select 1 from public.syllabus_units u where u.id=new.unit_id and u.school_id=new.school_id and u.academic_year_id=new.academic_year_id and u.class_id=new.class_id and u.subject_id=new.subject_id and (u.section_id is null or u.section_id is not distinct from new.section_id)) then raise exception 'Curriculum unit does not match upload context' using errcode='23514'; end if;
 if new.note_id is not null and not exists(select 1 from public.smart_notes n where n.id=new.note_id and n.school_id=new.school_id and n.teacher_id=new.uploaded_by and n.class_id=new.class_id and n.subject_id=new.subject_id) then raise exception 'Source file note link is not authorized' using errcode='42501'; end if;
 if not (private.noor_can_school_permission(new.school_id,'manage_syllabus') or private.noor_is_assigned_teacher(new.school_id,new.class_id,new.section_id,new.subject_id)) then raise exception 'You are not assigned to upload curriculum sources for this class/subject' using errcode='42501'; end if;
 return new;
end;
$$;
drop trigger if exists syllabus_uploads_validate on public.syllabus_uploads;
create trigger syllabus_uploads_validate before insert or update on public.syllabus_uploads for each row execute function private.noor_validate_syllabus_upload();

drop policy if exists syllabus_uploads_read on public.syllabus_uploads;
create policy syllabus_uploads_read on public.syllabus_uploads for select to authenticated using (
 private.noor_can_school_permission(school_id,'view_academic_reports')
 or uploaded_by=(select auth.uid()) and private.noor_active_school_access(school_id)
 or private.noor_is_assigned_teacher(school_id,class_id,section_id,subject_id)
);
drop policy if exists syllabus_uploads_insert on public.syllabus_uploads;
create policy syllabus_uploads_insert on public.syllabus_uploads for insert to authenticated with check (
 uploaded_by=(select auth.uid()) and private.noor_active_school_access(school_id)
 and (private.noor_can_school_permission(school_id,'manage_syllabus') or private.noor_is_assigned_teacher(school_id,class_id,section_id,subject_id))
);
drop policy if exists syllabus_uploads_update on public.syllabus_uploads;
create policy syllabus_uploads_update on public.syllabus_uploads for update to authenticated using (
 private.noor_can_school_permission(school_id,'manage_syllabus') or (uploaded_by=(select auth.uid()) and private.noor_active_school_access(school_id))
) with check (
 private.noor_can_school_permission(school_id,'manage_syllabus') or (uploaded_by=(select auth.uid()) and private.noor_active_school_access(school_id))
);
drop policy if exists syllabus_uploads_delete on public.syllabus_uploads;
create policy syllabus_uploads_delete on public.syllabus_uploads for delete to authenticated using (
 private.noor_can_school_permission(school_id,'manage_syllabus') or (uploaded_by=(select auth.uid()) and private.noor_active_school_access(school_id))
);

drop policy if exists noor_syllabus_storage_insert on storage.objects;
create policy noor_syllabus_storage_insert on storage.objects for insert to authenticated with check (
 bucket_id='noor-syllabus-source'
 and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and private.noor_active_school_access(((storage.foldername(name))[1])::uuid)
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('teacher','owner','principal','creator') and p.status='active')
);
drop policy if exists noor_syllabus_storage_select on storage.objects;
create policy noor_syllabus_storage_select on storage.objects for select to authenticated using (
 bucket_id='noor-syllabus-source'
 and exists(select 1 from public.syllabus_uploads u where u.storage_path=storage.objects.name
  and private.noor_active_school_access(u.school_id)
  and (u.uploaded_by=(select auth.uid()) or private.noor_can_school_permission(u.school_id,'view_academic_reports') or private.noor_is_assigned_teacher(u.school_id,u.class_id,u.section_id,u.subject_id)))
);
drop policy if exists noor_syllabus_storage_delete on storage.objects;
create policy noor_syllabus_storage_delete on storage.objects for delete to authenticated using (
 bucket_id='noor-syllabus-source'
 and exists(select 1 from public.syllabus_uploads u where u.storage_path=storage.objects.name
  and private.noor_active_school_access(u.school_id)
  and (u.uploaded_by=(select auth.uid()) or private.noor_can_school_permission(u.school_id,'manage_syllabus')))
);
