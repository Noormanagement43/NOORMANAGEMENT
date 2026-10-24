-- Revoke access to uploaded student work for paused students and teachers, even with
-- a JWT issued before suspension. Existing files are not deleted.
alter policy noor_student_file_select on storage.objects
using (
  bucket_id='noor-student-work'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and private.noor_active_school_access(((storage.foldername(name))[1])::uuid)
  and (
    (storage.foldername(name))[2]=((select auth.uid()))::text
    or exists (
      select 1 from public.noor_student_assignments a
      where a.id::text=(storage.foldername(name))[3]
        and a.teacher_id=(select auth.uid())
        and a.school_id::text=(storage.foldername(name))[1]
    )
  )
);