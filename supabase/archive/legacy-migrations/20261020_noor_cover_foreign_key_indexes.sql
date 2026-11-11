-- Cover every missing foreign-key index identified by the Supabase advisor; do not drop unused indexes without production traffic evidence.
CREATE INDEX IF NOT EXISTS idx_private_smart_notes_school_id_fk ON public.noor_private_smart_notes(school_id);
CREATE INDEX IF NOT EXISTS idx_private_smart_notes_teacher_id_fk ON public.noor_private_smart_notes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_teacher_id_fk ON public.noor_staff_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_paper_drafts_academic_year_id_fk ON public.noor_teacher_paper_drafts(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_teacher_paper_drafts_class_id_fk ON public.noor_teacher_paper_drafts(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_paper_drafts_school_id_fk ON public.noor_teacher_paper_drafts(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_paper_drafts_section_id_fk ON public.noor_teacher_paper_drafts(section_id);
CREATE INDEX IF NOT EXISTS idx_teacher_paper_drafts_subject_id_fk ON public.noor_teacher_paper_drafts(subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_paper_drafts_teacher_id_fk ON public.noor_teacher_paper_drafts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_period_runs_school_id_fk ON public.noor_teacher_period_runs(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_period_runs_teacher_id_fk ON public.noor_teacher_period_runs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_periods_school_id_fk ON public.noor_teacher_periods(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_periods_teacher_id_fk ON public.noor_teacher_periods(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_profile_details_teacher_id_fk ON public.noor_teacher_profile_details(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_tasks_school_id_fk ON public.noor_teacher_tasks(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_tasks_teacher_id_fk ON public.noor_teacher_tasks(teacher_id);