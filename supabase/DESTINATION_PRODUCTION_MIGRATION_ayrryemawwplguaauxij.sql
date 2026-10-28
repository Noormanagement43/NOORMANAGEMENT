-- ============================================================================
-- NOOR MANAGEMENT (نور) — MASTER DESTINATION DATABASE MIGRATION SCRIPT
-- Project: Noormanagement43's Project (ayrryemawwplguaauxij)
-- Organization: Noormanagement43's Org
-- Generated: 2026-10-28T17:25:11.733Z
--
-- Instructions:
-- Run this script in the Supabase SQL Editor for ayrryemawwplguaauxij:
-- https://supabase.com/dashboard/project/ayrryemawwplguaauxij/sql
-- ============================================================================

-- SECTION 1: UNIFIED SCHEMA (INSTITUTIONS + SCHOOLS DUAL COMPATIBILITY)
-- ============================================================================
-- NOOR SaaS: Schema Unification & Multi-Tenant Migration
-- Destination Project: ayrryemawwplguaauxij (Noormanagement43's Project)
-- Seamless Compatibility: Supports both 'institutions' and 'schools' schemas
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure institutions table has all needed fields
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  code TEXT UNIQUE,
  institution_type TEXT DEFAULT 'school',
  staff_join_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  country_code TEXT DEFAULT 'IN',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  default_language TEXT DEFAULT 'en',
  attendance_target_pct NUMERIC(5,2) NOT NULL DEFAULT 75.00,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Core schools table (mapped directly to institutions or standalone)
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  school_code TEXT UNIQUE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  academic_year_label TEXT DEFAULT '2026-2027',
  logo_url TEXT,
  join_code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT DEFAULT 'active',
  subscription_amount NUMERIC,
  setup_fee NUMERIC,
  billing_cycle TEXT DEFAULT 'monthly',
  subscription_due_date DATE,
  grace_period_days INT DEFAULT 7,
  last_payment_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public-safe school directory for active search
CREATE TABLE IF NOT EXISTS public.school_directory (
  id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  mobile_number TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT NOT NULL DEFAULT 'active',
  roll_number TEXT,
  admission_number TEXT,
  class_id UUID,
  section_id UUID,
  parent_name TEXT,
  parent_phone TEXT,
  avatar_url TEXT,
  avatar_path TEXT,
  school_name_submitted TEXT,
  is_platform_creator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Memberships tables
CREATE TABLE IF NOT EXISTS public.school_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'teacher',
  status TEXT NOT NULL DEFAULT 'active',
  employee_id TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS public.institution_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'principal',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id, role)
);

-- 5. Classes & Sections
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Teacher Schedules & Timetables
CREATE TABLE IF NOT EXISTS public.noor_teacher_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  period_number INT NOT NULL DEFAULT 1,
  weekday INT NOT NULL DEFAULT 1,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_name TEXT NOT NULL DEFAULT 'General',
  class_label TEXT NOT NULL DEFAULT 'Class 1 · Section A',
  block_type TEXT NOT NULL DEFAULT 'class',
  approval_status TEXT NOT NULL DEFAULT 'approved',
  status TEXT DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.noor_teacher_period_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id UUID REFERENCES public.noor_teacher_periods(id) ON DELETE CASCADE,
  class_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'ongoing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  UNIQUE (school_id, teacher_id, period_id, class_date)
);

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.noor_teacher_profile_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT,
  qualification TEXT,
  joined_on DATE,
  date_of_birth DATE,
  address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, teacher_id)
);

-- 7. Staff & Student Attendance
CREATE TABLE IF NOT EXISTS public.noor_staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'present',
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, teacher_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  taken_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present',
  remarks TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Academic Notes, Notices, Calendar & Tasks
CREATE TABLE IF NOT EXISTS public.smart_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  published_to_students BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_roles TEXT[] DEFAULT ARRAY['all'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'event',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  target_roles TEXT[] DEFAULT ARRAY['all'],
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'academic',
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.school_tasks(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, task_id, assignee_id)
);

-- 9. Lesson Logs & Daily Reports
CREATE TABLE IF NOT EXISTS public.noor_teacher_lesson_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_name TEXT,
  topic TEXT NOT NULL,
  homework TEXT,
  class_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_teaching_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic_taught TEXT NOT NULL,
  report_status TEXT DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Assessments & Homework
CREATE TABLE IF NOT EXISTS public.school_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  assessment_type TEXT DEFAULT 'test',
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  max_marks NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  status TEXT DEFAULT 'conducted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.school_assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marks_obtained NUMERIC(5,2),
  grade_label TEXT,
  teacher_feedback TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.noor_student_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  paper_text TEXT,
  assignment_type TEXT DEFAULT 'homework',
  max_marks NUMERIC(5,2) DEFAULT 50.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.noor_student_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.noor_student_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_text TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'submitted',
  marks_obtained NUMERIC(5,2),
  teacher_feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.noor_student_study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  planned_for DATE NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.noor_student_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.noor_student_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  evidence_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  recipient_profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_theme_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_key TEXT NOT NULL DEFAULT 'burgundy-light',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sound_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_dashboard_preferences (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  theme_key TEXT DEFAULT 'burgundy-light',
  font_key TEXT DEFAULT 'dm-sans',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.noor_principal_dashboard_settings (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  attendance_threshold_pct NUMERIC(5,2) DEFAULT 75.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. Storage Buckets
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('student-photos', 'student-photos', true),
  ('school-assets', 'school-assets', true),
  ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ============================================================================
-- 12. Row Level Security Policies
-- ============================================================================
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noor_teacher_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noor_teacher_period_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noor_staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Grants for authenticated & anon
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.school_directory TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.schools TO anon, authenticated;
GRANT SELECT ON public.classes TO anon, authenticated;
GRANT SELECT ON public.sections TO anon, authenticated;
GRANT SELECT ON public.subjects TO anon, authenticated;

-- Policies for public reading of directory and public classes
DROP POLICY IF EXISTS "Public can read active school names" ON public.school_directory;
CREATE POLICY "Public can read active school names" ON public.school_directory
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users access profiles" ON public.profiles;
CREATE POLICY "Authenticated users access profiles" ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users access schools" ON public.schools;
CREATE POLICY "Authenticated users access schools" ON public.schools
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read schools" ON public.schools;
CREATE POLICY "Allow anon read schools" ON public.schools
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "Allow anon read classes" ON public.classes;
CREATE POLICY "Allow anon read classes" ON public.classes
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "Allow anon read sections" ON public.sections;
CREATE POLICY "Allow anon read sections" ON public.sections
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "Allow anon read subjects" ON public.subjects;
CREATE POLICY "Allow anon read subjects" ON public.subjects
  FOR SELECT TO anon USING (is_active = true);

-- Storage policies
DROP POLICY IF EXISTS "Public access student-photos" ON storage.objects;
CREATE POLICY "Public access student-photos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "Authenticated upload student-photos" ON storage.objects;
CREATE POLICY "Authenticated upload student-photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "Authenticated update student-photos" ON storage.objects;
CREATE POLICY "Authenticated update student-photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'student-photos');


-- SECTION 2: INSTITUTION SELF-SERVICE ONBOARDING RPC
-- Institution self-service onboarding for NOOR.
-- Creates a school/university and grants the signed-in creator principal access.
create or replace function public.register_institution_for_current_user(
  p_name text,
  p_slug text,
  p_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_name text := pg_catalog.btrim(coalesce(p_name, ''));
  v_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_type, '')));
  v_institution_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to register an institution.';
  end if;
  if pg_catalog.length(v_name) < 2 or pg_catalog.length(v_name) > 160 then
    raise exception 'Institution name must be between 2 and 160 characters.';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or pg_catalog.length(v_slug) > 80 then
    raise exception 'Use a valid URL slug with lowercase letters, numbers, and hyphens.';
  end if;
  if v_type not in ('school', 'university') then
    raise exception 'Institution type must be school or university.';
  end if;
  if exists (select 1 from public.institution_memberships m where m.user_id = v_user_id and m.status = 'active') then
    raise exception 'Your account already has an active institution membership.';
  end if;
  insert into public.institutions
    (name, slug, institution_type, country_code, timezone, default_language, status, created_by)
  values
    (v_name, v_slug, v_type, 'IN', 'Asia/Kolkata', 'en', 'active', v_user_id)
  returning id into v_institution_id;
  insert into public.institution_memberships
    (institution_id, user_id, role, status, invited_by, joined_at)
  values
    (v_institution_id, v_user_id, 'principal', 'active', v_user_id, pg_catalog.now());
  return pg_catalog.jsonb_build_object(
    'institution_id', v_institution_id, 'name', v_name, 'slug', v_slug,
    'institution_type', v_type, 'role', 'principal'
  );
end;
$function$;
revoke all on function public.register_institution_for_current_user(text, text, text) from public;
revoke all on function public.register_institution_for_current_user(text, text, text) from anon;
grant execute on function public.register_institution_for_current_user(text, text, text) to authenticated;


-- SECTION 3: MIGRATED ACADEMIC DATA (SCHOOL, 19 CLASSES & 18 SECTIONS)
-- ============================================================================
-- NOOR SaaS: Seed Migrated 'Al noor' School, Classes & Sections
-- Destination: ayrryemawwplguaauxij
-- Source: legacy-migration-archive (Preserving exact IDs & Structures)
-- ============================================================================

-- 1. Insert or update the Al Noor School and Institution
INSERT INTO public.institutions (id, name, slug, code, institution_type, timezone, status)
VALUES (
  '18df9f46-61ba-4603-aca6-096f96f335b9',
  'Al noor',
  'al-noor',
  'SCH-ALNOOR-2026',
  'school',
  'Asia/Kolkata',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  timezone = EXCLUDED.timezone,
  status = EXCLUDED.status;

INSERT INTO public.schools (id, name, slug, school_code, institution_id, timezone, is_active, status)
VALUES (
  '18df9f46-61ba-4603-aca6-096f96f335b9',
  'Al noor',
  'al-noor',
  'SCH-ALNOOR-2026',
  '18df9f46-61ba-4603-aca6-096f96f335b9',
  'Asia/Kolkata',
  true,
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  timezone = EXCLUDED.timezone,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status;

INSERT INTO public.school_directory (id, name, is_active)
VALUES (
  '18df9f46-61ba-4603-aca6-096f96f335b9',
  'Al noor',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- 2. Insert Classes migrated from old project
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('c4749a56-44c4-4e61-9099-98cbdb1f139d', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 1', 1, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('b909744d-c282-4576-9a0b-c337bfde05a2', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 2', 2, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('071cb462-80df-4f3a-a556-b8a630310a6b', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 3', 3, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('d722173d-e66d-4316-bd2d-f8044c6ed825', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 4', 4, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('9d712cbe-b5d5-4b98-af14-592092a255a6', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 5', 5, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('0cf81c85-43b8-4ed3-906a-fb3cc595dd46', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 6', 6, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('5649c714-2034-4fba-8e5a-7fd6cd36ed93', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 7', 7, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('914711ee-227f-4d3d-a9f9-da0faf811df1', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 8', 8, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('f5e4525f-2eec-498c-88a2-f70eb414f733', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 9', 9, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('b9643ed7-2aef-4e11-8590-9c38b56b3445', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Class 10', 10, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('1b68d20f-650a-4d0a-a0d1-26ce653bf49b', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'MPC (Maths, Physics, Chemistry)', 11, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('18a8ddaf-a43b-4512-8a9c-dcb36b4caebd', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'BiPC (Biology, Physics, Chemistry)', 12, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('8ee6e6a2-30bf-4d92-a88f-274cfcf59289', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'MEC (Maths, Economics, Commerce)', 13, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('2fbe3883-279a-417e-b663-f6a616684c50', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'HEC (History, Economics, Civics)', 14, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('f1fcc4bd-cef8-496d-ab4d-8a4cca24e360', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'CEC (Commerce, Economics, Civics)', 15, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('4bed2c1e-4dc3-42d3-9fca-7f3a6b29762c', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Physics Lab', 16, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('ecd8805d-b72e-4f1a-b751-60c4ab359029', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Chemistry Lab', 17, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('1c52cb29-1ca1-4799-8515-515f104c8dc4', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Computer Science Lab', 18, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
INSERT INTO public.classes (id, school_id, institution_id, name, sort_order, is_active)
VALUES ('3028496f-d633-4584-b506-5e9909bb0f75', '18df9f46-61ba-4603-aca6-096f96f335b9', '18df9f46-61ba-4603-aca6-096f96f335b9', 'Biology Lab', 19, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 3. Insert Sections migrated from old project
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('18dcc484-30a8-408d-aa8f-1e631357eed4', '071cb462-80df-4f3a-a556-b8a630310a6b', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('6b18abdd-fe3f-456a-8f57-002eb5c28e16', '071cb462-80df-4f3a-a556-b8a630310a6b', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('20bc2f7e-51a4-4a23-a4ef-877a4676cd48', '0cf81c85-43b8-4ed3-906a-fb3cc595dd46', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('cb76f943-5a7e-4ab8-9759-816e3e27c1a4', '0cf81c85-43b8-4ed3-906a-fb3cc595dd46', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('1e4689c4-8f5c-4c42-a78d-e230ba329d76', '5649c714-2034-4fba-8e5a-7fd6cd36ed93', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('49185179-46f7-4bb3-9779-ca93b34c56df', '5649c714-2034-4fba-8e5a-7fd6cd36ed93', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('356a66a2-1dbb-4333-9e92-3e05b79a43bd', '914711ee-227f-4d3d-a9f9-da0faf811df1', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('428647f2-843e-42dc-a873-1ed5cc0e8399', '914711ee-227f-4d3d-a9f9-da0faf811df1', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('80370018-3564-47a4-90c1-e3dea883bd47', '9d712cbe-b5d5-4b98-af14-592092a255a6', 'apple', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('eb541e7e-1475-4203-9742-cd19e6c8c1d9', '9d712cbe-b5d5-4b98-af14-592092a255a6', 'mango', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('3f3eddbd-7ecc-40d5-b82d-2074e8b27cdf', 'b909744d-c282-4576-9a0b-c337bfde05a2', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('7d17727e-223e-4bc1-a993-15511f46f8e4', 'b909744d-c282-4576-9a0b-c337bfde05a2', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('31afe18e-02a7-4d6e-b077-b3cfe6598f32', 'c4749a56-44c4-4e61-9099-98cbdb1f139d', 'dimond', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('1453d66b-d340-494b-a1c7-05722eb4a080', 'c4749a56-44c4-4e61-9099-98cbdb1f139d', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('28d0e1b7-994c-4436-9c72-ebf56b35202e', 'd722173d-e66d-4316-bd2d-f8044c6ed825', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('49e1947f-4f9f-4877-956e-dc47addcf0ad', 'd722173d-e66d-4316-bd2d-f8044c6ed825', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('69162d2e-6f26-48b6-a8f7-0755e4b459e5', 'f5e4525f-2eec-498c-88a2-f70eb414f733', 'Section A', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;
INSERT INTO public.sections (id, class_id, name, is_active)
VALUES ('6d48f71c-9c5d-4ebe-8810-5fc3d300b847', 'f5e4525f-2eec-498c-88a2-f70eb414f733', 'Section B', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

