-- A private plan must not turn another teacher's object path into a readable photo.
ALTER TABLE public.noor_teacher_weekly_plans ADD CONSTRAINT weekly_photo_author CHECK(attachment_path IS NULL OR (split_part(attachment_path,'/',1)=created_by::text AND attachment_path NOT LIKE '%..%'));
NOTIFY pgrst,'reload schema';
