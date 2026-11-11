-- Keep student rosters private while preserving assigned teacher and leadership access.
alter policy group_memberships_select_self_or_manager
on public.academic_group_memberships
using (
 private.is_my_membership(membership_id)
 or private.noor_group_access(institution_id,group_id,true)
 or private.is_platform_admin()
);

-- Ownership alone must never retain access after leaving/pausing a school.
create policy ai_jobs_active_tenant_guard
on public.ai_generation_jobs as restrictive
for select to authenticated
using (
 private.is_active_member(institution_id)
 or private.is_platform_admin()
);
