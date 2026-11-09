-- Parent follow-up by student can grow; provide a student-leading FK index.
CREATE INDEX IF NOT EXISTS idx_noor_parent_contact_logs_student_id ON public.noor_parent_contact_logs(student_id);
