-- =========================================================================
-- NOOR SCHOOL MANAGEMENT: AL-NOOR DEMO & BULK SEED SCRIPT
-- STRICT MULTI-TENANCY: Strictly scoped to "Al-Noor" school (v_school_id)
-- 100% IDEMPOTENT & LIGHTWEIGHT (10 Teachers, 100 Students across 20 Sections)
-- =========================================================================

DO $$
DECLARE
  v_school_id uuid;
  v_acad_id uuid;
  v_principal_id uuid;
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
  
  -- Helper IDs
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
  day_offset int;
  
  -- Teacher names matching dashboard mockups
  t_names text[] := ARRAY[
    'Ms. Fathima Ali', 'Mr. Aamir Khan', 'Dr. Sarah Khan',
    'Mrs. Sana Begum', 'Mr. Imran Siddiqui', 'Mrs. Nida Ahmed',
    'Mrs. Sharma', 'Ms. Patil', 'Mr. Roy'
  ];
  t_quals text[] := ARRAY[
    'M.Sc. Mathematics', 'M.A. History', 'Ph.D. Physics',
    'M.A. English, B.Ed.', 'M.Sc. Chemistry', 'M.A. Urdu',
    'B.A. English, B.Ed.', 'M.Sc. Biology', 'M.A. Geography'
  ];
  teacher_uuids uuid[] := ARRAY[]::uuid[];
  
  -- Student Names for Class 8B (matching Teacher Dashboard screenshot)
  c8b_names text[] := ARRAY['Ayesha Khan', 'Mohammad Zaid', 'Sana Fatima', 'Arjun Mehta'];
  c8b_rolls text[] := ARRAY['801', '802', '803', '804'];
  
  sec_students uuid[];
  all_classes_cursor record;
  all_secs_cursor record;
BEGIN
  -- =========================================================================
  -- STEP 1: RESOLVE AL-NOOR SCHOOL & STRICT ACTIVE MULTI-TENANCY STATUS
  -- =========================================================================
  SELECT id INTO v_school_id FROM public.schools 
  WHERE name ILIKE '%Al%Noor%' OR name ILIKE '%NOOR%' 
  ORDER BY created_at ASC LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School "Al-Noor" not found! Please create the school first.';
  END IF;

  -- Ensure Al-Noor is active and verified for RLS policies
  UPDATE public.schools
  SET verification_status = 'verified', account_status = 'active', is_active = true
  WHERE id = v_school_id;

  -- =========================================================================
  -- STEP 2: ENSURE CURRENT ACADEMIC YEAR
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
  -- STEP 3: CONFIGURE EXISTING PRINCIPAL (Syeda Husna Tabassum)
  -- =========================================================================
  SELECT id INTO v_principal_id FROM public.profiles 
  WHERE school_id = v_school_id AND role IN ('principal','owner','creator') LIMIT 1;

  IF v_principal_id IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = 'Syeda Husna Tabassum', mobile_number = '+91 98765 43210', status = 'active'
    WHERE id = v_principal_id AND school_id = v_school_id;

    INSERT INTO public.school_memberships (school_id, user_id, role, status)
    VALUES (v_school_id, v_principal_id, 'principal', 'active')
    ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active';
  END IF;

  -- Principal Dashboard Weekly Insight
  INSERT INTO public.noor_principal_dashboard_settings (school_id, insight, updated_at)
  VALUES (v_school_id, 'Leadership in education builds brighter tomorrows.', now())
  ON CONFLICT (school_id) DO UPDATE SET insight = EXCLUDED.insight, updated_at = now();

  -- =========================================================================
  -- STEP 4: CREATE CLASSES 1 TO 10, SECTIONS (A & B) & CORE SUBJECTS
  -- =========================================================================
  FOR c_idx IN 1..10 LOOP
    INSERT INTO public.classes (school_id, name, sort_order, is_active)
    VALUES (v_school_id, 'Class ' || c_idx, c_idx, true)
    ON CONFLICT (school_id, name) DO UPDATE SET is_active = true
    RETURNING id INTO v_class_id;

    -- Store key classes
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
  -- STEP 5: TOTAL 10 TEACHERS (1 EXISTING + 9 DUMMY TEACHERS)
  -- =========================================================================
  SELECT id INTO v_teacher_id FROM public.profiles 
  WHERE school_id = v_school_id AND role = 'teacher' LIMIT 1;

  -- Configure Existing Teacher (Syeda Aafra Fathima - Class 8B)
  IF v_teacher_id IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = 'Syeda Aafra Fathima', mobile_number = '+91 98765 43210', status = 'active'
    WHERE id = v_teacher_id AND school_id = v_school_id;

    INSERT INTO public.school_memberships (school_id, user_id, role, status, employee_id)
    VALUES (v_school_id, v_teacher_id, 'teacher', 'active', 'TCH-2026-014')
    ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = 'teacher';

    INSERT INTO public.noor_teacher_profile_details (school_id, teacher_id, employee_code, qualification, joined_on, address)
    VALUES (v_school_id, v_teacher_id, 'TCH-2026-014', 'M.Sc. Mathematics, B.Ed.', v_today - INTERVAL '2 years', 'Al Noor International School')
    ON CONFLICT (school_id, teacher_id) DO UPDATE 
    SET employee_code = EXCLUDED.employee_code, qualification = EXCLUDED.qualification;

    -- Existing Teacher checked in today at 08:02 AM
    INSERT INTO public.noor_staff_attendance (school_id, teacher_id, attendance_date, status, checked_in_at)
    VALUES (v_school_id, v_teacher_id, v_today, 'present', v_today + TIME '08:02:00')
    ON CONFLICT (school_id, teacher_id, attendance_date) DO UPDATE 
    SET status = 'present', checked_in_at = EXCLUDED.checked_in_at;

    INSERT INTO public.teacher_assignments (school_id, teacher_id, class_id, section_id, is_active)
    VALUES (v_school_id, v_teacher_id, v_class_8_id, v_sec_8b_id, true)
    ON CONFLICT DO NOTHING;
    
    teacher_uuids := array_append(teacher_uuids, v_teacher_id);
  END IF;

  -- Generate the remaining 9 Dummy Teachers
  FOR i IN 1..9 LOOP
    v_email := 'demo_tch_' || i || '@alnoor.demo';
    v_name := t_names[i];
    v_emp_code := 'TCH-ALN-00' || (i + 1);

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

    -- Staff Attendance: 8 teachers present, 1 on leave (Principal KPI = 9/10 present)
    v_status := CASE WHEN i = 7 THEN 'leave' ELSE 'present' END;
    INSERT INTO public.noor_staff_attendance (school_id, teacher_id, attendance_date, status, checked_in_at)
    VALUES (v_school_id, v_uid, v_today, v_status, CASE WHEN v_status = 'present' THEN v_today + TIME '08:05:00' ELSE NULL END)
    ON CONFLICT (school_id, teacher_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, checked_in_at = EXCLUDED.checked_in_at;

    teacher_uuids := array_append(teacher_uuids, v_uid);
  END LOOP;

  -- =========================================================================
  -- STEP 6: EXACTLY 5 STUDENTS PER SECTION (TOTAL 100 STUDENTS ACROSS 20 SECTIONS)
  -- =========================================================================
  SELECT id INTO v_student_id FROM public.profiles 
  WHERE school_id = v_school_id AND role = 'student' LIMIT 1;

  FOR all_classes_cursor IN 
    SELECT id, name, sort_order FROM public.classes WHERE school_id = v_school_id ORDER BY sort_order
  LOOP
    FOR all_secs_cursor IN 
      SELECT id, name FROM public.sections WHERE class_id = all_classes_cursor.id ORDER BY name
    LOOP
      FOR s_idx IN 1..5 LOOP
        -- Case A: Class 8 Section B (Where existing Student + named mock classmates live)
        IF all_classes_cursor.sort_order = 8 AND all_secs_cursor.name = 'Section B' THEN
          IF s_idx = 5 AND v_student_id IS NOT NULL THEN
            -- Existing Student: Syeda Sofiya Imran
            UPDATE public.profiles
            SET full_name = 'Syeda Sofiya Imran', roll_number = 'STU-2026-402',
                class_id = all_classes_cursor.id, section_id = all_secs_cursor.id,
                mobile_number = '+91 98765 43210', parent_name = 'Syed Imran',
                status = 'active', academic_year_id = v_acad_id, school_id = v_school_id
            WHERE id = v_student_id;

            INSERT INTO public.school_memberships (school_id, user_id, role, status)
            VALUES (v_school_id, v_student_id, 'student', 'active')
            ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = 'student';
            CONTINUE;
          ELSE
            v_name := c8b_names[s_idx];
            v_roll := c8b_rolls[s_idx];
            v_email := 'demo_stu_8b_' || s_idx || '@alnoor.demo';
          END IF;
        ELSE
          -- Generic realistic students for all other sections
          v_name := 'Student ' || all_classes_cursor.sort_order || all_secs_cursor.name || '-' || s_idx;
          v_roll := 'R-' || all_classes_cursor.sort_order || SUBSTRING(all_secs_cursor.name FROM 9 FOR 1) || '0' || s_idx;
          v_email := 'demo_stu_c' || all_classes_cursor.sort_order || '_' || lower(SUBSTRING(all_secs_cursor.name FROM 9 FOR 1)) || '_' || s_idx || '@alnoor.demo';
        END IF;

        -- Ensure User in auth.users
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

        -- Insert Profile
        INSERT INTO public.profiles (
          id, email, full_name, role, status, school_id, class_id, section_id, roll_number, academic_year_id, updated_at
        ) VALUES (
          v_uid, v_email, v_name, 'student', 'active', v_school_id, all_classes_cursor.id, all_secs_cursor.id, v_roll, v_acad_id, now()
        )
        ON CONFLICT (id) DO UPDATE SET 
          full_name = EXCLUDED.full_name, role = 'student', status = 'active',
          school_id = v_school_id, class_id = all_classes_cursor.id, section_id = all_secs_cursor.id,
          roll_number = EXCLUDED.roll_number, academic_year_id = v_acad_id, updated_at = now();

        -- Membership
        INSERT INTO public.school_memberships (school_id, user_id, role, status)
        VALUES (v_school_id, v_uid, 'student', 'active')
        ON CONFLICT (school_id, user_id) DO UPDATE SET status = 'active', role = 'student';
      END LOOP;
    END LOOP;
  END LOOP;

  -- =========================================================================
  -- STEP 7: TODAY & PAST 7 DAYS ATTENDANCE (POPULATING BAR CHARTS & TRENDLINES)
  -- =========================================================================
  FOR day_offset IN REVERSE 6..0 LOOP
    FOR all_classes_cursor IN 
      SELECT id, name, sort_order FROM public.classes WHERE school_id = v_school_id ORDER BY sort_order
    LOOP
      FOR all_secs_cursor IN 
        SELECT id, name FROM public.sections WHERE class_id = all_classes_cursor.id ORDER BY name
      LOOP
        -- Create Attendance Session
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

        -- Fetch the 5 students of this section
        SELECT array_agg(id ORDER BY roll_number) INTO sec_students
        FROM public.profiles
        WHERE school_id = v_school_id AND class_id = all_classes_cursor.id AND section_id = all_secs_cursor.id AND role = 'student';

        IF sec_students IS NOT NULL AND array_length(sec_students, 1) > 0 THEN
          FOR i IN 1..array_length(sec_students, 1) LOOP
            IF all_classes_cursor.sort_order = 8 AND all_secs_cursor.name = 'Section B' AND day_offset = 0 THEN
              -- Match Teacher Dashboard Table exactly:
              -- Student 1 (Ayesha): Present
              -- Student 2 (Zaid): Present
              -- Student 3 (Sana Fatima): Leave (Sick leave)
              -- Student 4 (Arjun Mehta): Absent
              -- Student 5 (Sofiya Imran): Present
              v_status := CASE 
                WHEN i = 3 THEN 'leave' 
                WHEN i = 4 THEN 'absent' 
                ELSE 'present' 
              END;
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

  -- 30-Day Attendance history for existing student (Sofiya Imran) to hit 94% rate
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
  -- STEP 8: TEACHER TIMETABLES & DAILY PERIODS (PRINCIPAL & TEACHER PORTALS)
  -- =========================================================================
  DELETE FROM public.noor_teacher_periods WHERE school_id = v_school_id AND weekday = v_weekday;

  -- 1. Existing Teacher (Syeda Aafra Fathima): 5 Periods for today
  IF v_teacher_id IS NOT NULL THEN
    -- Period 1: English (Class 8 - Sec B) [Completed]
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES (v_school_id, v_teacher_id, v_weekday, 1, '08:00', '08:45', 'English', 'Class 8 - Section B', v_class_8_id, v_sec_8b_id, 'class', 'approved', 'done')
    RETURNING id INTO v_period_id;
    INSERT INTO public.noor_teacher_period_runs (school_id, teacher_id, period_id, class_date, status, started_at, finished_at)
    VALUES (v_school_id, v_teacher_id, v_period_id, v_today, 'done', v_today + TIME '08:00:00', v_today + TIME '08:45:00')
    ON CONFLICT (school_id, teacher_id, period_id, class_date) DO UPDATE SET status = 'done';

    -- Period 2: Mathematics (Class 9 - Sec A) [Ongoing]
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES (v_school_id, v_teacher_id, v_weekday, 2, '08:50', '09:35', 'Mathematics', 'Class 9 - Section A', v_class_9_id, v_sec_9a_id, 'class', 'approved', 'ongoing')
    RETURNING id INTO v_period_id;
    INSERT INTO public.noor_teacher_period_runs (school_id, teacher_id, period_id, class_date, status, started_at)
    VALUES (v_school_id, v_teacher_id, v_period_id, v_today, 'ongoing', v_today + TIME '08:50:00')
    ON CONFLICT (school_id, teacher_id, period_id, class_date) DO UPDATE SET status = 'ongoing';

    -- Periods 3, 4, 5 [Upcoming]
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES 
      (v_school_id, v_teacher_id, v_weekday, 3, '09:45', '10:30', 'Science', 'Class 8 - Section A', v_class_8_id, v_sec_8a_id, 'class', 'approved', 'upcoming'),
      (v_school_id, v_teacher_id, v_weekday, 4, '10:45', '11:30', 'English', 'Class 7 - Section B', v_class_7_id, v_sec_7b_id, 'class', 'approved', 'upcoming'),
      (v_school_id, v_teacher_id, v_weekday, 5, '11:35', '12:20', 'Mathematics', 'Class 10 - Section A', v_class_10_id, v_sec_10a_id, 'class', 'approved', 'upcoming');
  END IF;

  -- 2. Other Teachers' active periods matching Principal Dashboard Schedule table
  IF array_length(teacher_uuids, 1) >= 7 THEN
    -- Ms. Fathima Ali | Mathematics | Class 8 | Sec A | 09:00 - 10:00 | Teaching
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES (v_school_id, teacher_uuids[2], v_weekday, 2, '09:00', '10:00', 'Mathematics', 'Class 8 - Section A', v_class_8_id, v_sec_8a_id, 'class', 'approved', 'ongoing')
    RETURNING id INTO v_period_id;
    INSERT INTO public.noor_teacher_period_runs (school_id, teacher_id, period_id, class_date, status, started_at)
    VALUES (v_school_id, teacher_uuids[2], v_period_id, v_today, 'ongoing', v_today + TIME '09:00:00')
    ON CONFLICT (school_id, teacher_id, period_id, class_date) DO UPDATE SET status = 'ongoing';

    -- Mr. Aamir Khan | History | Class 10 | Sec B | 10:00 - 11:00 | Teaching
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES (v_school_id, teacher_uuids[3], v_weekday, 3, '10:00', '11:00', 'History', 'Class 10 - Section B', v_class_10_id, v_sec_10b_id, 'class', 'approved', 'ongoing')
    RETURNING id INTO v_period_id;
    INSERT INTO public.noor_teacher_period_runs (school_id, teacher_id, period_id, class_date, status, started_at)
    VALUES (v_school_id, teacher_uuids[3], v_period_id, v_today, 'ongoing', v_today + TIME '10:00:00')
    ON CONFLICT (school_id, teacher_id, period_id, class_date) DO UPDATE SET status = 'ongoing';

    -- Dr. Sarah Khan | Physics | Class 10 | Sec A | 09:00 - 10:00 | Teaching
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES (v_school_id, teacher_uuids[4], v_weekday, 2, '09:00', '10:00', 'Physics', 'Class 10 - Section A', v_class_10_id, v_sec_10a_id, 'class', 'approved', 'ongoing')
    RETURNING id INTO v_period_id;
    INSERT INTO public.noor_teacher_period_runs (school_id, teacher_id, period_id, class_date, status, started_at)
    VALUES (v_school_id, teacher_uuids[4], v_period_id, v_today, 'ongoing', v_today + TIME '09:00:00')
    ON CONFLICT (school_id, teacher_id, period_id, class_date) DO UPDATE SET status = 'ongoing';

    -- Mrs. Sana Begum | English | Class 7 | Sec B | 11:00 - 12:00 | Available
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES (v_school_id, teacher_uuids[5], v_weekday, 4, '11:00', '12:00', 'English', 'Class 7 - Section B', v_class_7_id, v_sec_7b_id, 'class', 'approved', 'upcoming');

    -- Mr. Imran Siddiqui | Chemistry | Class 9 | Sec A | 12:00 - 13:00 | Teaching
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES (v_school_id, teacher_uuids[6], v_weekday, 5, '12:00', '13:00', 'Chemistry', 'Class 9 - Section A', v_class_9_id, v_sec_9a_id, 'class', 'approved', 'upcoming');

    -- Mrs. Nida Ahmed | Urdu | Class 6 | Sec A | 10:00 - 11:00 | Available
    INSERT INTO public.noor_teacher_periods (school_id, teacher_id, weekday, period_number, start_time, end_time, subject_name, class_label, class_id, section_id, block_type, approval_status, status)
    VALUES (v_school_id, teacher_uuids[7], v_weekday, 3, '10:00', '11:00', 'Urdu', 'Class 6 - Section A', v_class_10_id, v_sec_10a_id, 'class', 'approved', 'upcoming');
  END IF;

  -- =========================================================================
  -- STEP 9: ALL 5 SUBJECT MARKS & HOMEWORK (STUDENT SYEDA SOFIYA IMRAN)
  -- =========================================================================
  IF v_student_id IS NOT NULL THEN
    SELECT id INTO v_subj_math FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'Mathematics' LIMIT 1;
    SELECT id INTO v_subj_sci FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'Science' LIMIT 1;
    SELECT id INTO v_subj_eng FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'English' LIMIT 1;
    SELECT id INTO v_subj_sst FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'Social Studies' LIMIT 1;
    SELECT id INTO v_subj_urdu FROM public.subjects WHERE school_id = v_school_id AND class_id = v_class_8_id AND name = 'Urdu' LIMIT 1;

    -- 1. Mathematics: 85/100 (Grade A)
    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_math, 'Mathematics - Unit Test', 'unit_test', v_today - INTERVAL '5 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 85, 'A', 'Strong analytical understanding', now() - INTERVAL '4 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 85, grade_label = 'A';

    -- 2. Science: 78/100 (Grade B+)
    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_sci, 'Science - Chapter Test', 'chapter_test', v_today - INTERVAL '10 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 78, 'B+', 'Good grasp of photosynthesis concepts', now() - INTERVAL '9 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 78, grade_label = 'B+';

    -- 3. English: 92/100 (Grade A+)
    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_eng, 'English - Reading Test', 'quiz', v_today - INTERVAL '15 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 92, 'A+', 'Outstanding vocabulary and expression', now() - INTERVAL '14 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 92, grade_label = 'A+';

    -- 4. Social Studies: 70/100 (Grade B)
    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_sst, 'Social Studies - Periodic Assessment', 'term_test', v_today - INTERVAL '20 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 70, 'B', 'Focus on medieval history timelines', now() - INTERVAL '19 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 70, grade_label = 'B';

    -- 5. Urdu: 88/100 (Grade A)
    INSERT INTO public.school_assessments (school_id, academic_year_id, class_id, section_id, subject_id, title, assessment_type, assessment_date, max_marks, status)
    VALUES (v_school_id, v_acad_id, v_class_8_id, v_sec_8b_id, v_subj_urdu, 'Urdu - Language Assessment', 'quiz', v_today - INTERVAL '25 days', 100, 'marked')
    RETURNING id INTO v_assessment_id;
    INSERT INTO public.assessment_results (school_id, assessment_id, student_id, marks_obtained, grade_label, teacher_feedback, marked_at)
    VALUES (v_school_id, v_assessment_id, v_student_id, 88, 'A', 'Nasta’liq script and poetry analysis is great', now() - INTERVAL '24 days')
    ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks_obtained = 88, grade_label = 'A';

    -- Upcoming Assignments
    INSERT INTO public.noor_student_assignments (school_id, class_id, section_id, subject_id, title, max_marks, due_at, published_at, is_active)
    VALUES 
      (v_school_id, v_class_8_id, v_sec_8b_id, v_subj_eng, 'English Essay: My Favourite Book', 20, now() + INTERVAL '1 day', now() - INTERVAL '1 day', true),
      (v_school_id, v_class_8_id, v_sec_8b_id, v_subj_math, 'Maths Worksheet: Linear Equations', 25, now() + INTERVAL '2 days', now() - INTERVAL '1 day', true),
      (v_school_id, v_class_8_id, v_sec_8b_id, v_subj_sci, 'Science Project: Plant Cell Model', 50, now() + INTERVAL '5 days', now(), true),
      (v_school_id, v_class_8_id, v_sec_8b_id, v_subj_sst, 'Social Studies: Map Work', 25, now() + INTERVAL '7 days', now(), true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- =========================================================================
  -- STEP 10: NOTICES & CALENDAR EVENTS (ALL ROLES)
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

  RAISE NOTICE 'Al-Noor School demo data populated successfully with strict lightweight limits!';
END $$;
