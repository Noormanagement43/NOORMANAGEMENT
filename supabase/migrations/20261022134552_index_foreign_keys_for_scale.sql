-- Cover foreign-key lookups identified by Supabase's performance advisor.
-- These indexes do not alter application data or access policies.
create index if not exists academic_group_memberships_group_tenant_fk_idx on public.academic_group_memberships (group_id, institution_id);
create index if not exists academic_group_memberships_membership_tenant_fk_idx on public.academic_group_memberships (membership_id, institution_id);
create index if not exists academic_groups_year_tenant_fk_idx on public.academic_groups (academic_year_id, institution_id);
create index if not exists academic_groups_teacher_tenant_fk_idx on public.academic_groups (homeroom_teacher_membership_id, institution_id) where homeroom_teacher_membership_id is not null;
create index if not exists attendance_records_marked_by_fk_idx on public.attendance_records (marked_by) where marked_by is not null;
create index if not exists attendance_records_session_tenant_fk_idx on public.attendance_records (session_id, institution_id);
create index if not exists attendance_records_student_tenant_fk_idx on public.attendance_records (student_membership_id, institution_id);
create index if not exists class_sessions_group_tenant_fk_idx on public.class_sessions (academic_group_id, institution_id) where academic_group_id is not null;
create index if not exists class_sessions_course_tenant_fk_idx on public.class_sessions (course_id, institution_id) where course_id is not null;
create index if not exists class_sessions_created_by_fk_idx on public.class_sessions (created_by) where created_by is not null;
create index if not exists class_sessions_teacher_tenant_fk_idx on public.class_sessions (teacher_membership_id, institution_id) where teacher_membership_id is not null;
create index if not exists course_enrollments_course_tenant_fk_idx on public.course_enrollments (course_id, institution_id);
create index if not exists course_enrollments_membership_tenant_fk_idx on public.course_enrollments (membership_id, institution_id);
create index if not exists courses_department_tenant_fk_idx on public.courses (department_id, institution_id) where department_id is not null;
create index if not exists courses_program_tenant_fk_idx on public.courses (program_id, institution_id) where program_id is not null;
create index if not exists memberships_invited_by_fk_idx on public.institution_memberships (invited_by) where invited_by is not null;
create index if not exists institutions_created_by_fk_idx on public.institutions (created_by) where created_by is not null;
create index if not exists platform_roles_assigned_by_fk_idx on public.platform_roles (assigned_by) where assigned_by is not null;
create index if not exists programs_department_tenant_fk_idx on public.programs (department_id, institution_id) where department_id is not null;
