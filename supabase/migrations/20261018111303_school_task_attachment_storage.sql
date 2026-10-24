-- Private school-scoped bucket for task attachments; no public URLs.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('school-task-files','school-task-files',false,52428800,
 array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists noor_cc_task_files_read on storage.objects;
create policy noor_cc_task_files_read on storage.objects for select to authenticated using(
 bucket_id='school-task-files' and case
  when array_length(storage.foldername(name),1)>=3
   and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
   and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  then private.noor_active_school_access(((storage.foldername(name))[1])::uuid)
   and private.can_access_task(((storage.foldername(name))[2])::uuid)
  else false end
);
drop policy if exists noor_cc_task_files_insert on storage.objects;
create policy noor_cc_task_files_insert on storage.objects for insert to authenticated with check(
 bucket_id='school-task-files' and case
  when array_length(storage.foldername(name),1)>=3
   and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
   and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
   and (storage.foldername(name))[3]=(select auth.uid())::text
  then private.noor_active_school_access(((storage.foldername(name))[1])::uuid)
   and private.can_access_task(((storage.foldername(name))[2])::uuid)
  else false end
);
drop policy if exists noor_cc_task_files_delete on storage.objects;
create policy noor_cc_task_files_delete on storage.objects for delete to authenticated using(
 bucket_id='school-task-files' and case
  when array_length(storage.foldername(name),1)>=3
   and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
   and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  then private.noor_active_school_access(((storage.foldername(name))[1])::uuid)
   and private.can_access_task(((storage.foldername(name))[2])::uuid)
   and ((storage.foldername(name))[3]=(select auth.uid())::text
    or private.has_school_role(((storage.foldername(name))[1])::uuid,array['owner','principal'])
    or private.noor_can_school_permission(((storage.foldername(name))[1])::uuid,'manage_tasks'))
  else false end
);
commit;