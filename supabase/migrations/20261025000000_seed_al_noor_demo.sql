-- =========================================================================
-- NOOR SCHOOL MANAGEMENT: BULK DEMO SEED & REPAIR SCRIPT
-- TARGET: Whole NOOR School System (Works for any Principal/Staff/Student login)
-- MULTI-TENANCY: Scoped safely to the NOOR School
-- STORAGE LIGHTWEIGHT: Exactly 10 Teachers, Exactly 100 Students (5 per section)
-- =========================================================================

-- =========================================================================
-- STEP 0: SELF-HEALING SCHEMA GUARD (ENSURE ALL REQUIRED TABLES & COLUMNS EXIST)
-- =========================================================================

-- 1. Profiles Table Columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS academic_year_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requested_class_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requested_section_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_name_submitted text;

-- 2. Classes & Sections Columns
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 1;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 3. School Memberships Columns
ALTER TABLE public.school_memberships ADD COLUMN IF NOT EXISTS employee_id text;
ALTER TABLE public.school_memberships ADD COLUMN IF NOT EXISTS username text;

-- 4. Dependent Tables
CREATE TABLE IF NOT EXISTS public.noor_staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL CHECK(status IN ('present','absent','leave','late')),
  checked_in_at timestamptz,
  UNIQUE(school_id, teacher_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.noor_teacher_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  period_number int NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  subject_name text NOT NULL,
  class_label text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  block_type text NOT NULL DEFAULT 'class',
  approval_status text NOT NULL DEFAULT 'approved',
  status text NOT NULL DEFAULT 'upcoming'
);

CREATE TABLE IF NOT EXISTS public.noor_teacher_period_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.noor_teacher_periods(id) ON DELETE CASCADE,
  class_date date NOT NULL,
  status text NOT NULL DEFAULT 'done',
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE(school_id, teacher_id, period_id, class_date)
);

CREATE TABLE IF NOT EXISTS public.noor_teacher_profile_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code text,
  qualification text,
  joined_on date,
  address text,
  UNIQUE(school_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS public.noor_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  max_marks numeric NOT NULL DEFAULT 100,
  due_at timestamptz,
  published_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.noor_principal_dashboard_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  insight text NOT NULL DEFAULT 'Leadership in education builds brighter tomorrows.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- STEP 1: RPC FUNCTIONS FOR STUDENT & SECTION MANAGEMENT
-- =========================================================================

CREATE OR REPLACE FUNCTION public.noor_add_student(
  p_school_id uuid,
  p_full_name text,
  p_roll_number text,
  p_class_id uuid,
  p_section_id uuid,
  p_mobile_number text DEFAULT NULL,
  p_parent_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_new_id uuid := gen_random_uuid();
  v_clean_email text;
  v_acad_id uuid;
BEGIN
  v_clean_email := 'student_' || lower(regexp_replace(p_roll_number, '[^a-zA-Z0-9]', '', 'g')) || '_' || substr(v_new_id::text, 1, 6) || '@alnoor.demo';

  SELECT id INTO v_acad_id FROM public.academic_years WHERE school_id = p_school_id AND is_current = true LIMIT 1;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_new_id, 'authenticated', 'authenticated',
    v_clean_email, crypt('Demo123!Pass', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'school_id', p_school_id),
    false, now(), now()
  );

  INSERT INTO public.profiles (
    id, email, full_name, role, status, school_id, class_id, section_id,
    roll_number, mobile_number, parent_name, academic_year_id, updated_at
  ) VALUES (
    v_new_id, v_clean_email, p_full_name, 'student', 'active', p_school_id, p_class_id, p_section_id,
    p_roll_number, p_mobile_number, p_parent_name, v_acad_id, now()
  );

  INSERT INTO public.school_memberships (school_id, user_id, role, status)
  VALUES (p_school_id, v_new_id, 'student', 'active')
  ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = 'student';

  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.noor_add_student(uuid, text, text, uuid, uuid, text, text) TO authenticated, anon;


CREATE OR REPLACE FUNCTION public.noor_remove_student(
  p_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM public.attendance_records WHERE student_id = p_student_id;
  DELETE FROM public.assessment_results WHERE student_id = p_student_id;
  DELETE FROM public.school_memberships WHERE user_id = p_student_id;
  DELETE FROM public.profiles WHERE id = p_student_id;
  DELETE FROM auth.users WHERE id = p_student_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.noor_remove_student(uuid) TO authenticated, anon;


CREATE OR REPLACE FUNCTION public.noor_add_teacher(
  p_school_id uuid,
  p_full_name text,
  p_email text,
  p_subject_name text,
  p_class_label text,
  p_start_time time DEFAULT '09:00:00',
  p_end_time time DEFAULT '10:00:00',
  p_employee_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_new_id uuid := gen_random_uuid();
  v_emp_code text := COALESCE(p_employee_code, 'TCH-' || substr(v_new_id::text, 1, 6));
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_new_id, 'authenticated', 'authenticated',
    p_email, crypt('Demo123!Pass', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'school_id', p_school_id),
    false, now(), now()
  );

  INSERT INTO public.profiles (
    id, email, full_name, role, status, school_id, updated_at
  ) VALUES (
    v_new_id, p_email, p_full_name, 'teacher', 'active', p_school_id, now()
  );

  INSERT INTO public.school_memberships (school_id, user_id, role, status, employee_id)
  VALUES (p_school_id, v_new_id, 'teacher', 'active', v_emp_code)
  ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = 'teacher';

  INSERT INTO public.noor_teacher_profile_details (school_id, teacher_id, employee_code, qualification, joined_on, address)
  VALUES (p_school_id, v_new_id, v_emp_code, 'B.Ed. Faculty', CURRENT_DATE, 'Al Noor Campus')
  ON CONFLICT (school_id, teacher_id) DO UPDATE SET employee_code = EXCLUDED.employee_code;

  INSERT INTO public.noor_teacher_periods (
    school_id, teacher_id, weekday, period_number, start_time, end_time,
    subject_name, class_label, approval_status, status
  ) VALUES (
    p_school_id, v_new_id, EXTRACT(DOW FROM CURRENT_DATE)::int, 1,
    p_start_time, p_end_time, p_subject_name, p_class_label, 'approved', 'upcoming'
  );

  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.noor_add_teacher(uuid, text, text, text, text, time, time, text) TO authenticated, anon;


CREATE OR REPLACE FUNCTION public.noor_remove_teacher(
  p_teacher_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM public.noor_teacher_period_runs WHERE teacher_id = p_teacher_id;
  DELETE FROM public.noor_teacher_periods WHERE teacher_id = p_teacher_id;
  DELETE FROM public.noor_staff_attendance WHERE teacher_id = p_teacher_id;
  DELETE FROM public.noor_teacher_profile_details WHERE teacher_id = p_teacher_id;
  DELETE FROM public.teacher_assignments WHERE teacher_id = p_teacher_id;
  DELETE FROM public.school_memberships WHERE user_id = p_teacher_id;
  DELETE FROM public.profiles WHERE id = p_teacher_id;
  DELETE FROM auth.users WHERE id = p_teacher_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.noor_remove_teacher(uuid) TO authenticated, anon;


CREATE OR REPLACE FUNCTION public.noor_create_section(
  p_class_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_sec_id uuid;
BEGIN
  INSERT INTO public.sections (class_id, name, is_active)
  VALUES (p_class_id, trim(p_name), true)
  RETURNING id INTO v_new_sec_id;
  RETURN v_new_sec_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.noor_create_section(uuid, text) TO authenticated, anon;


-- =========================================================================
-- STEP 2: DYNAMIC POPULATION BLOCK ACROSS THE NOOR SCHOOL
-- =========================================================================

DO $$
DECLARE
  v_school_id uuid;
  v_acad_id uuid;
  v_teacher_id uuid;
  v_student_id uuid;
  
  -- Classes & Sections
  v_class_id uuid;
  v_sec_a_id uuid;
  v_sec_b_id uuid;
  
  -- Key Class References
  v_class_7_id uuid; v_sec_7b_id uuid;
  v_class_8_id uuid; v_sec_8a_id uuid; v_sec_8b_id uuid;
  v_class_9_id uuid; v_sec_9a_id uuid;
  v_class_10_id uuid; v_sec_10a_id uuid; v_sec_10b_id uuid;
  
  -- Subjects
  v_subj_math uuid; v_subj_eng uuid; v_subj_sci uuid;
  v_subj_sst uuid; v_subj_urdu uuid;
  
  -- Dynamic Times
  v_now_time time := CURRENT_TIME;
  v_p2_start text;
  v_p2_end text;
  
  -- Helper IDs & Counters
  v_session_id uuid;
  v_assessment_id uuid;
  v_period_id uuid;
  v_uid uuid;
  v_email text;
  v_name text;
  v_emp_code text;
  v_roll text;
  v_status text;
  
  v_today date := CURRENT_DATE;
  v_weekday int := EXTRACT(DOW FROM CURRENT_DATE);
  
  c_idx int;
  s_idx int;
  w_idx int;
  day_offset int;
  
  t_names text[] := ARRAY[
    'Ms. Fathima Ali', 'Mr. Aamir Khan', 'Dr. Sarah Khan',
    'Mrs. Sana Begum', 'Mr. Imran Siddiqui', 'Mrs. Nida Ahmed',
    'Mrs. Sharma', 'Ms. Patil', 'Mr. Roy',
    'Dr. Ayesha Rehman', 'Mr. Tariq Anwar', 'Ms. Farah Ali',
    'Mr. Faisal Siddiqui', 'Mrs. Hina Tariq', 'Prof. Zubair Ahmed',
    'Ms. Nadia Qureshi', 'Mr. Kamran Baig', 'Mrs. Zainab Bilgrami',
    'Mr. Salman Qureshi', 'Ms. Bushra Tabassum', 'Mr. Zeeshan Haider'
  ];
  t_quals text[] := ARRAY[
    'M.Sc. Mathematics', 'M.A. History', 'Ph.D. Physics',
    'M.A. English, B.Ed.', 'M.Sc. Chemistry', 'M.A. Urdu',
    'B.A. English, B.Ed.', 'M.Sc. Biology', 'M.A. Geography',
    'Ph.D. Physics', 'M.Sc. Mathematics', 'M.A. English Literature',
    'M.A. Political Science', 'M.Sc. Botany, B.Ed.', 'M.Tech Computer Science',
    'M.Sc. Statistics', 'M.P.Ed. Physical Education', 'M.A. Hindi, B.Ed.',
    'M.F.A. Fine Arts', 'M.A. Islamic Studies', 'M.A. Economics, B.Ed.'
  ];
  t_subs text[] := ARRAY[
    'Mathematics', 'History', 'Physics',
    'English', 'Chemistry', 'Urdu',
    'English', 'Science', 'Social Studies',
    'Physics', 'Mathematics', 'English',
    'Social Studies', 'Science', 'Computer Science',
    'Mathematics', 'Physical Education', 'Hindi',
    'Art & Design', 'Islamic Studies', 'Economics'
  ];
  t_classes text[] := ARRAY[
    'Class 8 - Section A', 'Class 10 - Section B', 'Class 10 - Section A',
    'Class 7 - Section B', 'Class 9 - Section A', 'Class 6 - Section A',
    'Class 8 - Section B', 'Class 8 - Section B', 'Class 8 - Section B',
    'Class 9 - Section A', 'Class 5 - Section A', 'Class 2 - Section B',
    'Class 6 - Section B', 'Class 4 - Section A', 'Class 10 - Section A',
    'Class 7 - Section A', 'Class 8 - Section A', 'Class 5 - Section B',
    'Class 3 - Section B', 'Class 2 - Section A', 'Class 10 - Section B'
  ];
  teacher_uuids uuid[] := ARRAY[]::uuid[];
  
  c8b_names text[] := ARRAY['Ayesha Khan', 'Mohammad Zaid', 'Sana Fatima', 'Arjun Mehta', 'Ibrahim Ali'];
  c8b_rolls text[] := ARRAY['801', '802', '803', '804', '805'];
  
  sec_students uuid[];
  all_classes_cursor record;
  all_secs_cursor record;
BEGIN
  -- =========================================================================
  -- 1. RESOLVE THE NOOR SCHOOL (NOT TIED TO ANY SINGLE EMAIL)
  -- =========================================================================
  SELECT id INTO v_school_id FROM public.schools 
  WHERE name ILIKE '%noor%' OR name ILIKE '%al%noor%' 
  ORDER BY created_at ASC LIMIT 1;

  IF v_school_id IS NULL THEN
    SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_school_id IS NULL THEN
    INSERT INTO public.schools (name, verification_status, account_status, is_active)
    VALUES ('Al noor', 'verified', 'active', true)
    RETURNING id INTO v_school_id;
  ELSE
    UPDATE public.schools
    SET verification_status = 'verified', account_status = 'active', is_active = true
    WHERE id = v_school_id;
  END IF;

  -- =========================================================================
  -- 2. ENSURE ALL PRINCIPALS / OWNERS ARE ACTIVE FOR THIS SCHOOL
  -- =========================================================================
  UPDATE public.profiles
  SET school_id = v_school_id, status = 'active'
  WHERE role IN ('principal', 'owner', 'manager');

  INSERT INTO public.school_memberships (school_id, user_id, role, status)
  SELECT v_school_id, p.id, p.role, 'active'
  FROM public.profiles p
  WHERE p.role IN ('principal', 'owner', 'manager')
  ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = EXCLUDED.role;

  -- Principal Dashboard Weekly Insight
  INSERT INTO public.noor_principal_dashboard_settings (school_id, insight, updated_at)
  VALUES (v_school_id, 'Leadership in education builds brighter tomorrows.', now())
  ON CONFLICT (school_id) DO UPDATE SET insight = EXCLUDED.insight, updated_at = now();

  -- =========================================================================
  -- 3. ENSURE CURRENT ACADEMIC YEAR
  -- =========================================================================
  SELECT id INTO v_acad_id FROM public.academic_years 
  WHERE school_id = v_school_id AND is_current = true LIMIT 1;

  IF v_acad_id IS NULL THEN
    INSERT INTO public.academic_years (school_id, label, starts_on, ends_on, is_current)
    VALUES (v_school_id, '2026-2027', v_today - INTERVAL '6 months', v_today + INTERVAL '6 months', true)
    ON CONFLICT (school_id, label) DO UPDATE SET is_current = true
    RETURNING id INTO v_acad_id;
  END IF;

  -- =========================================================================
  -- 4. CREATE CLASSES 1 TO 10, SECTIONS (A & B) & CORE SUBJECTS
  -- =========================================================================
  FOR c_idx IN 1..10 LOOP
    INSERT INTO public.classes (school_id, name, sort_order, is_active)
    VALUES (v_school_id, 'Class ' || c_idx, c_idx, true)
    ON CONFLICT (school_id, name) DO UPDATE SET is_active = true
    RETURNING id INTO v_class_id;

    IF c_idx = 7 THEN v_class_7_id := v_class_id; END IF;
    IF c_idx = 8 THEN v_class_8_id := v_class_id; END IF;
    IF c_idx = 9 THEN v_class_9_id := v_class_id; END IF;
    IF c_idx = 10 THEN v_class_10_id := v_class_id; END IF;

    -- Section A
    INSERT INTO public.sections (class_id, name, is_active)
    VALUES (v_class_id, 'Section A', true)
    ON CONFLICT (class_id, name) DO UPDATE SET is_active = true
    RETURNING id INTO v_sec_a_id;

    -- Section B
    INSERT INTO public.sections (class_id, name, is_active)
    VALUES (v_class_id, 'Section B', true)
    ON CONFLICT (class_id, name) DO UPDATE SET is_active = true
    RETURNING id INTO v_sec_b_id;

    IF c_idx = 7 THEN v_sec_7b_id := v_sec_b_id; END IF;
    IF c_idx = 8 THEN v_sec_8a_id := v_sec_a_id; v_sec_8b_id := v_sec_b_id; END IF;
    IF c_idx = 9 THEN v_sec_9a_id := v_sec_a_id; END IF;
    IF c_idx = 10 THEN v_sec_10a_id := v_sec_a_id; v_sec_10b_id := v_sec_b_id; END IF;

    -- Subjects per class
    INSERT INTO public.subjects (school_id, class_id, name, is_active)
    VALUES 
      (v_school_id, v_class_id, 'Mathematics', true),
      (v_school_id, v_class_id, 'English', true),
      (v_school_id, v_class_id, 'Science', true),
      (v_school_id, v_class_id, 'Social Studies', true),
      (v_school_id, v_class_id, 'Urdu', true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- =========================================================================
  -- 5. TOTAL 10 TEACHERS (1 EXISTING + 9 DUMMY TEACHERS)
  -- =========================================================================
  SELECT id INTO v_teacher_id FROM public.profiles 
  WHERE role = 'teacher' AND email NOT LIKE '%@alnoor.demo'
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    SELECT id INTO v_teacher_id FROM public.profiles 
    WHERE role = 'teacher'
    LIMIT 1;
  END IF;

  -- Configure Existing Teacher
  IF v_teacher_id IS NOT NULL THEN
    UPDATE public.profiles
    SET status = 'active', role = 'teacher', school_id = v_school_id,
        mobile_number = COALESCE(mobile_number, '+91 98765 43210')
    WHERE id = v_teacher_id;

    INSERT INTO public.school_memberships (school_id, user_id, role, status, employee_id)
    VALUES (v_school_id, v_teacher_id, 'teacher', 'active', 'TCH-2026-014')
    ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = 'teacher';

    INSERT INTO public.noor_teacher_profile_details (school_id, teacher_id, employee_code, qualification, joined_on, address)
    VALUES (v_school_id, v_teacher_id, 'TCH-2026-014', 'M.Sc. Mathematics, B.Ed.', v_today - INTERVAL '2 years', 'Al Noor International School')
    ON CONFLICT (school_id, teacher_id) DO UPDATE 
    SET employee_code = EXCLUDED.employee_code, qualification = EXCLUDED.qualification;

    -- Teacher checked in today at 08:02 AM
    INSERT INTO public.noor_staff_attendance (school_id, teacher_id, attendance_date, status, checked_in_at)
    VALUES (v_school_id, v_teacher_id, v_today, 'present', v_today + TIME '08:02:00')
    ON CONFLICT (school_id, teacher_id, attendance_date) DO UPDATE 
    SET status = 'present', checked_in_at = EXCLUDED.checked_in_at;

    INSERT INTO public.teacher_assignments (school_id, teacher_id, class_id, section_id, is_active)
    VALUES (v_school_id, v_teacher_id, v_class_8_id, v_sec_8b_id, true)
    ON CONFLICT DO NOTHING;
    
    teacher_uuids := array_append(teacher_uuids, v_teacher_id);
  END IF;

  -- Generate 21 Additional Teachers (Total 22 Teachers for AL Noor Demo Hub)
  FOR i IN 1..21 LOOP
    v_email := 'demo_tch_' || i || '@alnoor.demo';
    v_name := t_names[i];
    v_emp_code := 'TCH-ALN-0' || lpad(i::text, 2, '0');

    SELECT id INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;
    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, crypt('Demo123!Pass', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', v_name, 'school_id', v_school_id),
        false, now(), now()
      );
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, status, school_id, updated_at)
    VALUES (v_uid, v_email, v_name, 'teacher', 'active', v_school_id, now())
    ON CONFLICT (id) DO UPDATE SET 
      full_name = EXCLUDED.full_name, role = 'teacher', status = 'active', school_id = v_school_id, updated_at = now();

    INSERT INTO public.school_memberships (school_id, user_id, role, status, employee_id)
    VALUES (v_school_id, v_uid, 'teacher', 'active', v_emp_code)
    ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = 'teacher';

    INSERT INTO public.noor_teacher_profile_details (school_id, teacher_id, employee_code, qualification, joined_on, address)
    VALUES (v_school_id, v_uid, v_emp_code, t_quals[i], v_today - INTERVAL '1 year', 'Al Noor International School')
    ON CONFLICT (school_id, teacher_id) DO UPDATE SET employee_code = EXCLUDED.employee_code, qualification = EXCLUDED.qualification;

    -- Staff Attendance: 18 teachers present, 2 on leave, 1 absent (Total 22 teachers in AL Noor)
    v_status := CASE WHEN i in (7, 13, 19) THEN 'leave' WHEN i in (9, 17) THEN 'absent' ELSE 'present' END;
    INSERT INTO public.noor_staff_attendance (school_id, teacher_id, attendance_date, status, checked_in_at)
    VALUES (v_school_id, v_uid, v_today, v_status, CASE WHEN v_status = 'present' THEN v_today + TIME '08:05:00' ELSE NULL END)
    ON CONFLICT (school_id, teacher_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, checked_in_at = EXCLUDED.checked_in_at;

    teacher_uuids := array_append(teacher_uuids, v_uid);
  END LOOP;

  -- =========================================================================
  -- 6. EXACTLY 5 STUDENTS PER SECTION (TOTAL 100 STUDENTS ACROSS 20 SECTIONS)
  -- =========================================================================
  SELECT id INTO v_student_id FROM public.profiles 
  WHERE role = 'student' AND email NOT LIKE '%@alnoor.demo'
  LIMIT 1;

  IF v_student_id IS NULL THEN
    SELECT id INTO v_student_id FROM public.profiles 
    WHERE role = 'student'
    LIMIT 1;
  END IF;

  FOR all_classes_cursor IN 
    SELECT id, name, sort_order FROM public.classes WHERE school_id = v_school_id ORDER BY sort_order
  LOOP
    FOR all_secs_cursor IN 
      SELECT id, name FROM public.sections WHERE class_id = all_classes_cursor.id ORDER BY name
    LOOP
      FOR s_idx IN 1..5 LOOP
        IF all_classes_cursor.sort_order = 8 AND all_secs_cursor.name = 'Section B' THEN
          v_name := c8b_names[s_idx];
          v_roll := c8b_rolls[s_idx];
          v_email := 'demo_stu_8b_' || s_idx || '@alnoor.demo';
        ELSE
          v_name := 'Student ' || all_classes_cursor.sort_order || SUBSTRING(all_secs_cursor.name FROM 9 FOR 1) || '-' || s_idx;
          v_roll := 'R-' || all_classes_cursor.sort_order || SUBSTRING(all_secs_cursor.name FROM 9 FOR 1) || '0' || s_idx;
          v_email := 'demo_stu_c' || all_classes_cursor.sort_order || '_' || lower(SUBSTRING(all_secs_cursor.name FROM 9 FOR 1)) || '_' || s_idx || '@alnoor.demo';
        END IF;
          v_roll := 'R-' || all_classes_cursor.sort_order || SUBSTRING(all_secs_cursor.name FROM 9 FOR 1) || '0' || s_idx;
          v_email := 'demo_stu_c' || all_classes_cursor.sort_order || '_' || lower(SUBSTRING(all_secs_cursor.name FROM 9 FOR 1)) || '_' || s_idx || '@alnoor.demo';
        END IF;

        SELECT id INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;
        IF v_uid IS NULL THEN
          v_uid := gen_random_uuid();
          INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
          ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
            v_email, crypt('Demo123!Pass', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', v_name, 'school_id', v_school_id),
            false, now(), now()
          );
        END IF;

        INSERT INTO public.profiles (
          id, email, full_name, role, status, school_id, class_id, section_id, roll_number, academic_year_id, updated_at
        ) VALUES (
          v_uid, v_email, v_name, 'student', 'active', v_school_id, all_classes_cursor.id, all_secs_cursor.id, v_roll, v_acad_id, now()
        )
        ON CONFLICT (id) DO UPDATE SET 
          full_name = EXCLUDED.full_name, role = 'student', status = 'active',
          school_id = v_school_id, class_id = all_classes_cursor.id, section_id = all_secs_cursor.id,
          roll_number = EXCLUDED.roll_number, academic_year_id = v_acad_id, updated_at = now();

        INSERT INTO public.school_memberships (school_id, user_id, role, status)
        VALUES (v_school_id, v_uid, 'student', 'active')
        ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = 'student';
      END LOOP;
    END LOOP;
  END LOOP;

  -- =========================================================================
  -- 7. TODAY & PAST 7 DAYS ATTENDANCE
  -- =========================================================================
  FOR day_offset IN REVERSE 6..0 LOOP
    FOR all_classes_cursor IN 
      SELECT id, name, sort_order FROM public.classes WHERE school_id = v_school_id ORDER BY sort_order
    LOOP
      FOR all_secs_cursor IN 
        SELECT id, name FROM public.sections WHERE class_id = all_classes_cursor.id ORDER BY name
      LOOP
        INSERT INTO public.attendance_sessions (school_id, class_id, section_id, attendance_date, status, taken_by)
        VALUES (v_school_id, all_classes_cursor.id, all_secs_cursor.id, v_today - (day_offset || ' days')::interval, 'submitted', v_teacher_id)
        ON CONFLICT (school_id, class_id, section_id, attendance_date) DO UPDATE SET status = 'submitted'
        RETURNING id INTO v_session_id;

        IF v_session_id IS NULL THEN
          SELECT id INTO v_session_id FROM public.attendance_sessions
          WHERE school_id = v_school_id AND class_id = all_classes_cursor.id 
            AND section_id = all_secs_cursor.id AND attendance_date = v_today - (day_offset || ' days')::interval
          LIMIT 1;
        END IF;

        SELECT array_agg(id ORDER BY roll_number) INTO sec_students
        FROM public.profiles
        WHERE school_id = v_school_id AND class_id = all_classes_cursor.id AND section_id = all_secs_cursor.id AND role = 'student';

        IF sec_students IS NOT NULL AND array_length(sec_students, 1) > 0 THEN
          FOR i IN 1..array_length(sec_students, 1) LOOP
            IF all_classes_cursor.sort_order = 8 AND all_secs_cursor.name = 'Section B' AND day_offset = 0 THEN
              v_status := CASE WHEN i = 3 THEN 'leave' WHEN i = 4 THEN 'absent' ELSE 'present' END;
            ELSE
              v_status := CASE 
                WHEN (i = 5 AND (all_classes_cursor.sort_order + day_offset) % 3 = 0) THEN 'absent'
                WHEN (i = 4 AND (all_classes_cursor.sort_order + day_offset) % 5 = 0) THEN 'leave'
                ELSE 'present'
              END;
            END IF;

            INSERT INTO public.attendance_records (school_id, session_id, student_id, status, marked_at, updated_at)
            VALUES (v_school_id, v_session_id, sec_students[i], v_status, now(), now())
            ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now();
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 30-Day Attendance history for existing student (Sofiya Imran)
  IF v_student_id IS NOT NULL THEN
    FOR day_offset IN 7..30 LOOP
      INSERT INTO public.attendance_sessions (school_id, class_id, section_id, attendance_date, status, taken_by)
      VALUES (v_school_id, v_class_8_id, v_sec_8b_id, v_today - (day_offset || ' days')::interval, 'submitted', v_teacher_id)
      ON CONFLICT (school_id, class_id, section_id, attendance_date) DO UPDATE SET status = 'submitted'
      RETURNING id INTO v_session_id;

      IF v_session_id IS NULL THEN
        SELECT id INTO v_session_id FROM public.attendance_sessions
        WHERE school_id = v_school_id AND class_id = v_class_8_id AND section_id = v_sec_8b_id AND attendance_date = v_today - (day_offset || ' days')::interval LIMIT 1;
      END IF;

      IF v_session_id IS NOT NULL THEN
        INSERT INTO public.attendance_records (school_id, session_id, student_id, status, marked_at)
        VALUES (v_school_id, v_session_id, v_student_id, CASE WHEN day_offset = 12 THEN 'absent' WHEN day_offset = 20 THEN 'leave' ELSE 'present' END, now())
        ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status;
      END IF;
    END LOOP;
  END IF;

  -- =========================================================================
  -- 8. DYNAMIC ONGOING PERIOD (ACTIVE CLASSES NOW > 0)
  -- =========================================================================
  DELETE FROM public.noor_teacher_periods WHERE school_id = v_school_id;

  v_p2_start := to_char(GREATEST(TIME '00:00:00', v_now_time - INTERVAL '30 minutes'), 'HH24:MI');
  v_p2_end := to_char(LEAST(TIME '23:59:00', v_now_time + INTERVAL '45 minutes'), 'HH24:MI');

  FOR w_idx IN 0..6 LOOP
    IF v_teacher_id IS NOT NULL THEN
      INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
      VALUES (v_school_id, v_teacher_id, w_idx, 1, '08:00', '08:45', 'English', 'Class 8 - Section B', v_class_8_id, v_sec_8b_id, 'class', 'approved', 'done')
      RETURNING id INTO v_period_id;
      IF w_idx = v_weekday THEN
        INSERT INTO public.noor_teacher_period_runs (school_id, teacher_id, period_id, class_date, status, started_at, finished_at)
        VALUES (v_school_id, v_teacher_id, v_period_id, v_today, 'done', v_today + TIME '08:00:00', v_today + TIME '08:45:00')
        ON CONFLICT (school_id, teacher_id, period_id, class_date) DO UPDATE SET status = 'done';
      END IF;

      INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
      VALUES (v_school_id, v_teacher_id, w_idx, 2, v_p2_start, v_p2_end, 'Mathematics', 'Class 9 - Section A', v_class_9_id, v_sec_9a_id, 'class', 'approved', 'ongoing')
      RETURNING id INTO v_period_id;
      IF w_idx = v_weekday THEN
        INSERT INTO public.noor_teacher_period_runs (school_id, teacher_id, period_id, class_date, status, started_at)
        VALUES (v_school_id, v_teacher_id, v_period_id, v_today, 'ongoing', now() - INTERVAL '25 minutes')
        ON CONFLICT (school_id, teacher_id, period_id, class_date) DO UPDATE SET status = 'ongoing';
      END IF;

      INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
      VALUES 
        (v_school_id, v_teacher_id, w_idx, 3, '11:45', '12:30', 'Science', 'Class 8 - Section A', v_class_8_id, v_sec_8a_id, 'class', 'approved', 'upcoming'),
        (v_school_id, v_teacher_id, w_idx, 4, '12:45', '13:30', 'English', 'Class 7 - Section B', v_class_7_id, v_sec_7b_id, 'class', 'approved', 'upcoming'),
        (v_school_id, v_teacher_id, w_idx, 5, '13:35', '14:20', 'Mathematics', 'Class 10 - Section A', v_class_10_id, v_sec_10a_id, 'class', 'approved', 'upcoming');
    END IF;

    -- Populate schedule for all 22 teachers
    FOR idx IN 2..array_length(teacher_uuids, 1) LOOP
      INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, block_type, approval_status, status)
      VALUES (v_school_id, teacher_uuids[idx], w_idx, ((idx % 6) + 1),
        to_char(TIME '08:00:00' + (((idx - 1) % 6) * INTERVAL '55 minutes'), 'HH24:MI'),
        to_char(TIME '08:45:00' + (((idx - 1) % 6) * INTERVAL '55 minutes'), 'HH24:MI'),
        t_subs[idx - 1], t_classes[idx - 1], 'class', 'approved', 
        CASE WHEN idx = 2 THEN 'ongoing' ELSE 'upcoming' END)
      RETURNING id INTO v_period_id;

      IF w_idx = v_weekday AND idx = 2 THEN
        INSERT INTO public.noor_teacher_period_runs (school_id, teacher_id, period_id, class_date, status, started_at)
        VALUES (v_school_id, teacher_uuids[idx], v_period_id, v_today, 'ongoing', now() - INTERVAL '20 minutes')
        ON CONFLICT (school_id, teacher_id, period_id, class_date) DO UPDATE SET status = 'ongoing';
      END IF;
    END LOOP;
  END LOOP;

  -- =========================================================================
  -- 9. EXISTING STUDENT 5 SUBJECTS MARKS & HOMEWORK
  -- =========================================================================
  IF v_student_id IS NOT NULL THEN
    SELECT id INTO v_subj_math FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'Mathematics' LIMIT 1;
    SELECT id INTO v_subj_sci FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'Science' LIMIT 1;
    SELECT id INTO v_subj_eng FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'English' LIMIT 1;
    SELECT id INTO v_subj_sst FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'Social Studies' LIMIT 1;
    SELECT id INTO v_subj_urdu FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'Urdu' LIMIT 1;

    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_math, 'Mathematics - Unit Test', 'unit_test', v_today - INTERVAL '5 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 85, 'A', 'Strong analytical understanding', now() - INTERVAL '4 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 85, grade_label = 'A';

    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_sci, 'Science - Chapter Test', 'chapter_test', v_today - INTERVAL '10 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 78, 'B+', 'Good grasp of photosynthesis concepts', now() - INTERVAL '9 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 78, grade_label = 'B+';

    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_eng, 'English - Reading Test', 'quiz', v_today - INTERVAL '15 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 92, 'A+', 'Outstanding vocabulary and expression', now() - INTERVAL '14 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 92, grade_label = 'A+';

    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_sst, 'Social Studies - Periodic Assessment', 'term_test', v_today - INTERVAL '20 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 70, 'B', 'Focus on medieval history timelines', now() - INTERVAL '19 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 70, grade_label = 'B';

    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_urdu, 'Urdu - Language Assessment', 'quiz', v_today - INTERVAL '25 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 88, 'A', 'Nasta’liq script and poetry analysis is great', now() - INTERVAL '24 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 88, grade_label = 'A';

    INSERT INTO public.noor_student_assignments (school_id, class_id, section_id, subject_id, title, max_marks, due_at, published_at, is_active)
    VALUES 
      (v_school_id, v_class_8_id, v_sec_8b_id, v_subj_eng, 'English Essay: My Favourite Book', 20, now() + INTERVAL '1 day', now() - INTERVAL '1 day', true),
      (v_school_id, v_class_8_id, v_sec_8b_id, v_subj_math, 'Maths Worksheet: Linear Equations', 25, now() + INTERVAL '2 days', now() - INTERVAL '1 day', true),
      (v_school_id, v_class_8_id, v_sec_8b_id, v_subj_sci, 'Science Project: Plant Cell Model', 50, now() + INTERVAL '5 days', now(), true),
      (v_school_id, v_class_8_id, v_sec_8b_id, v_subj_sst, 'Social Studies: Map Work', 25, now() + INTERVAL '7 days', now(), true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- =========================================================================
  -- 10. NOTICES & CALENDAR EVENTS
  -- =========================================================================
  INSERT INTO public.school_notices (school_id, title, body, starts_at, ends_at, is_active, target_roles)
  VALUES 
    (v_school_id, 'Parent-Teacher Meeting', 'Parent-Teacher Meeting for Classes 6-10 in the main auditorium today at 4:00 PM.', now() - INTERVAL '2 hours', now() + INTERVAL '10 days', true, ARRAY['student','teacher','principal']),
    (v_school_id, 'School Assembly', 'All students and staff to assemble in the main ground tomorrow at 8:30 AM.', now() - INTERVAL '1 hour', now() + INTERVAL '5 days', true, ARRAY['student','teacher','principal']),
    (v_school_id, 'Holiday Announcement', 'School will remain closed on Friday for the upcoming holiday.', now(), now() + INTERVAL '7 days', true, ARRAY['student','teacher','principal'])
  ON CONFLICT DO NOTHING;

  INSERT INTO public.calendar_events (school_id, title, description, event_type, starts_at, status, target_roles)
  VALUES 
    (v_school_id, 'Academic Review Meeting', 'With Academic Coordinators', 'meeting', v_today + TIME '12:30:00', 'confirmed', ARRAY['principal','teacher']),
    (v_school_id, 'Infrastructure Planning', 'With Management Team', 'meeting', v_today + INTERVAL '1 day' + TIME '11:00:00', 'confirmed', ARRAY['principal']),
    (v_school_id, 'Curriculum Update', 'With Senior Teachers', 'meeting', v_today + INTERVAL '2 days' + TIME '14:00:00', 'confirmed', ARRAY['principal','teacher'])
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'NOOR School bulk data populated successfully across the entire institution!';
END $$;
