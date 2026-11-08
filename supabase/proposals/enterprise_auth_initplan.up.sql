-- DRAFT ONLY. Not applied to any database. Review in staging before registering a migration.
-- Auth scalar evaluation only; roles, tenant checks and row ownership remain unchanged.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
ALTER POLICY "teacher_plans_read" ON "public"."noor_teacher_weekly_plans"
 USING (((created_by = (SELECT auth.uid())) AND private.is_active_member(institution_id) AND private.is_my_membership(teacher_membership_id)));

ALTER POLICY "teacher_plans_insert" ON "public"."noor_teacher_weekly_plans"
 WITH CHECK (((created_by = (SELECT auth.uid())) AND private.is_my_membership(teacher_membership_id) AND private.has_institution_role(institution_id, ARRAY['teacher'::text, 'faculty'::text]) AND private.noor_group_access(institution_id, academic_group_id, true)));

ALTER POLICY "teacher_plans_update" ON "public"."noor_teacher_weekly_plans"
 USING (((created_by = (SELECT auth.uid())) AND private.is_my_membership(teacher_membership_id) AND private.has_institution_role(institution_id, ARRAY['teacher'::text, 'faculty'::text])))
 WITH CHECK (((created_by = (SELECT auth.uid())) AND private.is_my_membership(teacher_membership_id) AND private.has_institution_role(institution_id, ARRAY['teacher'::text, 'faculty'::text]) AND private.noor_group_access(institution_id, academic_group_id, true)));

ALTER POLICY "school_message_create" ON "public"."noor_school_messages"
 WITH CHECK (((created_by = (SELECT auth.uid())) AND private.can_manage_academics(institution_id)));

ALTER POLICY "staff_checkins_insert" ON "public"."noor_staff_checkins"
 WITH CHECK ((private.can_manage_academics(institution_id) AND (marked_by = (SELECT auth.uid()))));

ALTER POLICY "staff_checkins_update" ON "public"."noor_staff_checkins"
 USING (private.can_manage_academics(institution_id))
 WITH CHECK ((private.can_manage_academics(institution_id) AND (marked_by = (SELECT auth.uid()))));

ALTER POLICY "principal_tasks_insert" ON "public"."noor_principal_tasks"
 WITH CHECK ((private.can_manage_academics(institution_id) AND (created_by = (SELECT auth.uid()))));
COMMIT;
