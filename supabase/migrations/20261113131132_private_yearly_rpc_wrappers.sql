-- Keep privileged implementations out of the Data API; public entry points use invoker rights.
alter function public.noor_class_update_status(uuid) set schema private;
alter function public.noor_set_class_update_window(uuid,integer,boolean) set schema private;
alter function public.noor_manageable_members(uuid,text) set schema private;
create function public.noor_class_update_status(p_institution uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.noor_class_update_status(p_institution); $$;
create function public.noor_set_class_update_window(p_institution uuid,p_start_year integer,p_open boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.noor_set_class_update_window(p_institution,p_start_year,p_open); $$;
create function public.noor_manageable_members(p_institution uuid,p_search text default '') returns jsonb language sql stable security invoker set search_path='' as $$ select private.noor_manageable_members(p_institution,p_search); $$;
revoke all on function public.noor_class_update_status(uuid),public.noor_set_class_update_window(uuid,integer,boolean),public.noor_manageable_members(uuid,text),private.noor_class_update_status(uuid),private.noor_set_class_update_window(uuid,integer,boolean),private.noor_manageable_members(uuid,text) from public,anon;
grant execute on function public.noor_class_update_status(uuid),public.noor_set_class_update_window(uuid,integer,boolean),public.noor_manageable_members(uuid,text),private.noor_class_update_status(uuid),private.noor_set_class_update_window(uuid,integer,boolean),private.noor_manageable_members(uuid,text) to authenticated;
