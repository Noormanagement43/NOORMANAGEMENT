-- OAuth callbacks have no user JWT. Only the server may check their persisted actor.
-- Use the same Creator + school preference + pause predicate as the school app.
create function private.noor_calendar_actor_access(p_institution uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_actor is not null and p_institution is not null
 and exists(select 1 from public.institution_memberships m
   where m.institution_id=p_institution and m.user_id=p_actor and m.status='active')
 and private.noor_feature_enabled(p_institution,'calendar')
$$;
create function public.noor_calendar_actor_access(p_institution uuid,p_actor uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select private.noor_calendar_actor_access(p_institution,p_actor)
$$;
revoke all on function private.noor_calendar_actor_access(uuid,uuid),public.noor_calendar_actor_access(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.noor_calendar_actor_access(uuid,uuid),public.noor_calendar_actor_access(uuid,uuid) to service_role;
