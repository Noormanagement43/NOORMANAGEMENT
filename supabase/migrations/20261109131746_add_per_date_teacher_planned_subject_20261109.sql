alter table public.noor_daily_period_lessons add column if not exists planned_subject_name text;
comment on column public.noor_daily_period_lessons.planned_subject_name is 'Teacher weekly-plan subject override for this calendar date only; never changes recurring timetable slots.';
