-- The internal worker rechecks recipient membership, sender authority and school status.
-- service_role is server-only; no browser role gains privileges.
grant select on public.institution_memberships,public.institutions to service_role;
