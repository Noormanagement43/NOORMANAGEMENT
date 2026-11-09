
-- NOOR foundation: secure multi-tenant core for school and university operations.
-- The existing ensure_rls event trigger remains enabled; its RPC execution is restricted.

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','hi','te','ur')),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('platform_owner','platform_admin','support')),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  institution_type text NOT NULL CHECK (institution_type IN ('school','university')),
  country_code text NOT NULL DEFAULT 'IN' CHECK (country_code ~ '^[A-Z]{2}$'),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  default_language text NOT NULL DEFAULT 'en' CHECK (default_language IN ('en','hi','te','ur')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.institution_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text,
  role text NOT NULL CHECK (role IN (
    'principal','school_admin','teacher','staff','student',
    'university_admin','faculty','university_student','academic_admin','finance_admin'
  )),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','revoked')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_has_identity CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL),
  CONSTRAINT membership_email_nonempty CHECK (invited_email IS NULL OR length(trim(invited_email)) > 3),
  CONSTRAINT membership_id_tenant_unique UNIQUE (id, institution_id)
);
CREATE UNIQUE INDEX institution_memberships_user_unique
  ON public.institution_memberships(institution_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX institution_memberships_invite_unique
  ON public.institution_memberships(institution_id, lower(invited_email))
  WHERE user_id IS NULL AND invited_email IS NOT NULL;
CREATE INDEX institution_memberships_user_status_idx
  ON public.institution_memberships(user_id, status);
CREATE INDEX institution_memberships_tenant_status_idx
  ON public.institution_memberships(institution_id, status);

CREATE TABLE public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(trim(label)) > 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, label),
  UNIQUE (id, institution_id),
  CHECK (start_date <= end_date)
);
CREATE UNIQUE INDEX academic_years_one_current_per_tenant
  ON public.academic_years(institution_id) WHERE is_current;
CREATE INDEX academic_years_tenant_dates_idx
  ON public.academic_years(institution_id, start_date, end_date);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name),
  UNIQUE (id, institution_id)
);
CREATE UNIQUE INDEX departments_tenant_code_unique
  ON public.departments(institution_id, upper(code)) WHERE code IS NOT NULL;
CREATE INDEX departments_tenant_idx ON public.departments(institution_id);

CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  department_id uuid,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  code text,
  program_level text CHECK (program_level IS NULL OR program_level IN ('certificate','diploma','undergraduate','postgraduate','doctoral','other')),
  duration_months integer CHECK (duration_months IS NULL OR duration_months > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name),
  UNIQUE (id, institution_id),
  FOREIGN KEY (department_id, institution_id)
    REFERENCES public.departments(id, institution_id) ON DELETE SET NULL (department_id)
);
CREATE UNIQUE INDEX programs_tenant_code_unique
  ON public.programs(institution_id, upper(code)) WHERE code IS NOT NULL;
CREATE INDEX programs_tenant_idx ON public.programs(institution_id);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  department_id uuid,
  program_id uuid,
  course_code text NOT NULL CHECK (length(trim(course_code)) > 0),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  credits numeric(5,2) NOT NULL DEFAULT 0 CHECK (credits >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, course_code),
  UNIQUE (id, institution_id),
  FOREIGN KEY (department_id, institution_id)
    REFERENCES public.departments(id, institution_id) ON DELETE SET NULL (department_id),
  FOREIGN KEY (program_id, institution_id)
    REFERENCES public.programs(id, institution_id) ON DELETE SET NULL (program_id)
);
CREATE INDEX courses_tenant_active_idx ON public.courses(institution_id, is_active);
CREATE INDEX courses_department_idx ON public.courses(department_id) WHERE department_id IS NOT NULL;

CREATE TABLE public.academic_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  academic_year_id uuid,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  code text,
  group_type text NOT NULL CHECK (group_type IN ('class','section','cohort','tutorial_group','course_group')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, institution_id),
  FOREIGN KEY (academic_year_id, institution_id)
    REFERENCES public.academic_years(id, institution_id) ON DELETE SET NULL (academic_year_id)
);
CREATE UNIQUE INDEX academic_groups_tenant_code_unique
  ON public.academic_groups(institution_id, academic_year_id, upper(code))
  WHERE code IS NOT NULL AND academic_year_id IS NOT NULL;
CREATE INDEX academic_groups_tenant_idx ON public.academic_groups(institution_id, academic_year_id);

CREATE TABLE public.academic_group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  group_role text NOT NULL CHECK (group_role IN ('student','teacher','faculty','staff')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, membership_id),
  FOREIGN KEY (group_id, institution_id)
    REFERENCES public.academic_groups(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, institution_id)
    REFERENCES public.institution_memberships(id, institution_id) ON DELETE CASCADE
);
CREATE INDEX academic_group_memberships_member_idx
  ON public.academic_group_memberships(membership_id, status);
CREATE INDEX academic_group_memberships_tenant_group_idx
  ON public.academic_group_memberships(institution_id, group_id, status);

CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','completed','withdrawn','pending')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, membership_id),
  FOREIGN KEY (course_id, institution_id)
    REFERENCES public.courses(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, institution_id)
    REFERENCES public.institution_memberships(id, institution_id) ON DELETE CASCADE
);
CREATE INDEX course_enrollments_member_idx ON public.course_enrollments(membership_id, status);
CREATE INDEX course_enrollments_tenant_course_idx ON public.course_enrollments(institution_id, course_id, status);

-- Placeholder queue for Smart Note and Question Paper generation. Model/API secrets are never stored here.
CREATE TABLE public.ai_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type text NOT NULL CHECK (generation_type IN ('smart_note','question_paper')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_payload) = 'object'),
  result_payload jsonb CHECK (result_payload IS NULL OR jsonb_typeof(result_payload) = 'object'),
  provider text,
  model text,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_generation_jobs_tenant_created_idx
  ON public.ai_generation_jobs(institution_id, created_at DESC);
CREATE INDEX ai_generation_jobs_requester_created_idx
  ON public.ai_generation_jobs(requested_by, created_at DESC);

-- All authorization helpers live in a non-exposed schema, use a pinned empty search_path,
-- and query memberships as the function owner to prevent RLS recursion.
CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles pr
    WHERE pr.user_id = (SELECT auth.uid())
      AND pr.role IN ('platform_owner','platform_admin')
  );
$$;

CREATE OR REPLACE FUNCTION private.is_active_member(_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institution_memberships m
    JOIN public.institutions i ON i.id = m.institution_id
    WHERE m.institution_id = _institution_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND i.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.has_institution_role(_institution_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institution_memberships m
    JOIN public.institutions i ON i.id = m.institution_id
    WHERE m.institution_id = _institution_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND i.status = 'active'
      AND m.role = ANY (_roles)
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_academics(_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_platform_admin()
    OR private.has_institution_role(
      _institution_id,
      ARRAY['principal','school_admin','university_admin','academic_admin']::text[]
    );
$$;

CREATE OR REPLACE FUNCTION private.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT auth.uid()) = _profile_id
    OR private.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.institution_memberships viewer
      JOIN public.institution_memberships subject
        ON subject.institution_id = viewer.institution_id
      JOIN public.institutions i ON i.id = viewer.institution_id
      WHERE viewer.user_id = (SELECT auth.uid())
        AND viewer.status = 'active'
        AND subject.user_id = _profile_id
        AND subject.status = 'active'
        AND i.status = 'active'
        AND viewer.role IN ('principal','school_admin','university_admin','academic_admin')
    );
$$;

CREATE OR REPLACE FUNCTION private.is_my_membership(_membership_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institution_memberships m
    JOIN public.institutions i ON i.id = m.institution_id
    WHERE m.id = _membership_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND i.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.academic_group_memberships gm
    JOIN public.institution_memberships m
      ON m.id = gm.membership_id AND m.institution_id = gm.institution_id
    JOIN public.institutions i ON i.id = gm.institution_id
    WHERE gm.group_id = _group_id
      AND gm.status = 'active'
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND i.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULLIF(pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'NOOR User'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_institution_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_academics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_my_membership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_group_member(uuid) TO authenticated;

CREATE TRIGGER noor_handle_new_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

CREATE TRIGGER noor_profiles_touch_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER noor_institutions_touch_updated_at BEFORE UPDATE ON public.institutions
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER noor_memberships_touch_updated_at BEFORE UPDATE ON public.institution_memberships
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER noor_academic_years_touch_updated_at BEFORE UPDATE ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER noor_departments_touch_updated_at BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER noor_programs_touch_updated_at BEFORE UPDATE ON public.programs
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER noor_courses_touch_updated_at BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER noor_academic_groups_touch_updated_at BEFORE UPDATE ON public.academic_groups
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER noor_ai_jobs_touch_updated_at BEFORE UPDATE ON public.ai_generation_jobs
FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;

-- No unauthenticated access. Authenticated grants are intentionally least-privilege.
REVOKE ALL ON TABLE
  public.profiles, public.platform_roles, public.institutions, public.institution_memberships,
  public.academic_years, public.departments, public.programs, public.courses,
  public.academic_groups, public.academic_group_memberships, public.course_enrollments,
  public.ai_generation_jobs
FROM anon, authenticated;

GRANT SELECT ON public.profiles, public.platform_roles, public.institutions,
  public.institution_memberships, public.academic_years, public.departments, public.programs,
  public.courses, public.academic_groups, public.academic_group_memberships,
  public.course_enrollments, public.ai_generation_jobs TO authenticated;

GRANT INSERT (id, full_name, avatar_url, preferred_language, timezone)
  ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, preferred_language, timezone)
  ON public.profiles TO authenticated;

GRANT UPDATE (name, timezone, default_language)
  ON public.institutions TO authenticated;

GRANT INSERT (institution_id, invited_email, role, invited_by)
  ON public.institution_memberships TO authenticated;
GRANT DELETE ON public.institution_memberships TO authenticated;

GRANT INSERT (institution_id, label, start_date, end_date, is_current)
  ON public.academic_years TO authenticated;
GRANT UPDATE (label, start_date, end_date, is_current)
  ON public.academic_years TO authenticated;
GRANT DELETE ON public.academic_years TO authenticated;

GRANT INSERT (institution_id, name, code) ON public.departments TO authenticated;
GRANT UPDATE (name, code) ON public.departments TO authenticated;
GRANT DELETE ON public.departments TO authenticated;

GRANT INSERT (institution_id, department_id, name, code, program_level, duration_months, is_active)
  ON public.programs TO authenticated;
GRANT UPDATE (department_id, name, code, program_level, duration_months, is_active)
  ON public.programs TO authenticated;
GRANT DELETE ON public.programs TO authenticated;

GRANT INSERT (institution_id, department_id, program_id, course_code, title, description, credits, is_active)
  ON public.courses TO authenticated;
GRANT UPDATE (title, description, credits, is_active)
  ON public.courses TO authenticated;
GRANT DELETE ON public.courses TO authenticated;

GRANT INSERT (institution_id, academic_year_id, name, code, group_type)
  ON public.academic_groups TO authenticated;
GRANT UPDATE (academic_year_id, name, code, group_type)
  ON public.academic_groups TO authenticated;
GRANT DELETE ON public.academic_groups TO authenticated;

GRANT INSERT (institution_id, group_id, membership_id, group_role, status)
  ON public.academic_group_memberships TO authenticated;
GRANT DELETE ON public.academic_group_memberships TO authenticated;

GRANT INSERT (institution_id, course_id, membership_id, status)
  ON public.course_enrollments TO authenticated;
GRANT DELETE ON public.course_enrollments TO authenticated;

GRANT INSERT (institution_id, requested_by, generation_type, request_payload)
  ON public.ai_generation_jobs TO authenticated;

-- Profile policies
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT private.can_view_profile(id)));
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Platform roles are read-only to application users; assignment requires trusted server/database administration.
CREATE POLICY platform_roles_select_self ON public.platform_roles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT private.is_platform_admin()));

-- Tenant visibility and administrative changes
CREATE POLICY institutions_select_member ON public.institutions
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_member(id)) OR (SELECT private.is_platform_admin()));
CREATE POLICY institutions_insert_platform_admin ON public.institutions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_platform_admin()));
CREATE POLICY institutions_update_manager ON public.institutions
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_platform_admin())
    OR (SELECT private.has_institution_role(id, ARRAY['principal','school_admin','university_admin']::text[]))
  )
  WITH CHECK (
    (SELECT private.is_platform_admin())
    OR (SELECT private.has_institution_role(id, ARRAY['principal','school_admin','university_admin']::text[]))
  );

CREATE POLICY memberships_select_self_or_manager ON public.institution_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT private.can_manage_academics(institution_id))
  );
CREATE POLICY memberships_invite_manager ON public.institution_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_platform_admin())
    OR (SELECT private.has_institution_role(institution_id, ARRAY['principal','school_admin','university_admin','academic_admin']::text[]))
  );
CREATE POLICY memberships_delete_manager ON public.institution_memberships
  FOR DELETE TO authenticated
  USING (
    (SELECT private.is_platform_admin())
    OR (SELECT private.has_institution_role(institution_id, ARRAY['principal','school_admin','university_admin','academic_admin']::text[]))
  );

-- Academic structure: tenant members read; designated academic admins manage.
CREATE POLICY academic_years_select_member ON public.academic_years
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_member(institution_id)) OR (SELECT private.is_platform_admin()));
CREATE POLICY academic_years_insert_manager ON public.academic_years
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY academic_years_update_manager ON public.academic_years
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)))
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY academic_years_delete_manager ON public.academic_years
  FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)));

CREATE POLICY departments_select_member ON public.departments
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_member(institution_id)) OR (SELECT private.is_platform_admin()));
CREATE POLICY departments_insert_manager ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY departments_update_manager ON public.departments
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)))
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY departments_delete_manager ON public.departments
  FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)));

CREATE POLICY programs_select_member ON public.programs
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_member(institution_id)) OR (SELECT private.is_platform_admin()));
CREATE POLICY programs_insert_manager ON public.programs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY programs_update_manager ON public.programs
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)))
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY programs_delete_manager ON public.programs
  FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)));

CREATE POLICY courses_select_member ON public.courses
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_member(institution_id)) OR (SELECT private.is_platform_admin()));
CREATE POLICY courses_insert_manager ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY courses_update_manager ON public.courses
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)))
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY courses_delete_manager ON public.courses
  FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)));

CREATE POLICY academic_groups_select_member ON public.academic_groups
  FOR SELECT TO authenticated
  USING ((SELECT private.is_active_member(institution_id)) OR (SELECT private.is_platform_admin()));
CREATE POLICY academic_groups_insert_manager ON public.academic_groups
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY academic_groups_update_manager ON public.academic_groups
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)))
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY academic_groups_delete_manager ON public.academic_groups
  FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)));

CREATE POLICY group_memberships_select_self_or_manager ON public.academic_group_memberships
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_group_member(group_id))
    OR (SELECT private.can_manage_academics(institution_id))
    OR (SELECT private.is_platform_admin())
  );
CREATE POLICY group_memberships_insert_manager ON public.academic_group_memberships
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY group_memberships_delete_manager ON public.academic_group_memberships
  FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)));

CREATE POLICY course_enrollments_select_self_or_manager ON public.course_enrollments
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_my_membership(membership_id))
    OR (SELECT private.can_manage_academics(institution_id))
    OR (SELECT private.is_platform_admin())
  );
CREATE POLICY course_enrollments_insert_manager ON public.course_enrollments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_academics(institution_id)));
CREATE POLICY course_enrollments_delete_manager ON public.course_enrollments
  FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_academics(institution_id)));

CREATE POLICY ai_jobs_select_owner_or_manager ON public.ai_generation_jobs
  FOR SELECT TO authenticated
  USING (
    requested_by = (SELECT auth.uid())
    OR (SELECT private.can_manage_academics(institution_id))
    OR (SELECT private.is_platform_admin())
  );
CREATE POLICY ai_jobs_insert_member ON public.ai_generation_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND (
      (
        generation_type = 'smart_note'
        AND (SELECT private.is_active_member(institution_id))
      )
      OR
      (
        generation_type = 'question_paper'
        AND (
          (SELECT private.has_institution_role(institution_id,
            ARRAY['principal','school_admin','teacher','university_admin','faculty','academic_admin']::text[]))
          OR (SELECT private.is_platform_admin())
        )
      )
    )
  );

