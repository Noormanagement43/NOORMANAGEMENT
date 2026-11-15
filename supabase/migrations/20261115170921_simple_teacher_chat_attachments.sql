-- Preserve existing questions/replies and class-teacher authorization.
alter table public.noor_class_questions
  add column attachment_path text,
  add column attachment_name text,
  add column attachment_type text;
alter table public.noor_class_questions drop constraint noor_class_questions_question_check;
alter table public.noor_class_questions add constraint noor_class_questions_question_check
  check (length(btrim(question)) between 1 and 2000);
alter table public.noor_class_questions add constraint noor_chat_attachment_metadata check (
  (attachment_path is null and attachment_name is null and attachment_type is null)
  or (attachment_path is not null and attachment_name is not null and attachment_type is not null
    and length(attachment_path) between 1 and 500 and length(attachment_name) between 1 and 255
    and attachment_type in ('image/jpeg','image/png','image/webp','application/pdf'))
);
create index noor_chat_attachment_idx on public.noor_class_questions(attachment_path) where attachment_path is not null;
create index noor_chat_thread_idx on public.noor_class_questions(institution_id,student_membership_id,recipient_teacher_membership_id,created_at desc,id desc);
-- Column grants for replies remain unchanged: students cannot edit a sent message.
alter policy class_questions_ask on public.noor_class_questions with check (
  reply is null and replied_at is null and private.is_my_membership(student_membership_id)
  and private.has_institution_role(institution_id,array['student','university_student'])
  and private.noor_group_access(institution_id,academic_group_id,false)
  and private.noor_is_class_teacher(institution_id,academic_group_id,recipient_teacher_membership_id)
  and (attachment_path is null or (
    split_part(attachment_path,'/',1)=institution_id::text
    and split_part(attachment_path,'/',2)=(select auth.uid())::text
    and array_length(string_to_array(attachment_path,'/'),1)=3
  ))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('noor-chat-files','noor-chat-files',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy noor_chat_file_upload on storage.objects for insert to authenticated with check (
  bucket_id='noor-chat-files'
  and split_part(name,'/',2)=(select auth.uid())::text
  and array_length(string_to_array(name,'/'),1)=3
  and exists (select 1 from public.institution_memberships m
    where m.institution_id::text=split_part(name,'/',1) and m.user_id=(select auth.uid())
      and m.status='active' and m.role in ('student','university_student')
      and private.is_active_member(m.institution_id)
      and private.noor_feature_enabled(m.institution_id,'diary'))
);
-- A file is readable only through a question the viewer can already read under RLS.
create policy noor_chat_file_read on storage.objects for select to authenticated using (
  bucket_id='noor-chat-files' and exists (
    select 1 from public.noor_class_questions q
    where q.attachment_path=objects.name and q.institution_id::text=split_part(objects.name,'/',1)
  )
);
notify pgrst,'reload schema';
