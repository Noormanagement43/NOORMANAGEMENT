-- Run after the calendar feature access migration; no Auth accounts or messages.
begin;
do $$ declare c record; begin
 assert not has_function_privilege('anon','public.noor_calendar_actor_access(uuid,uuid)','EXECUTE');
 assert not has_function_privilege('authenticated','public.noor_calendar_actor_access(uuid,uuid)','EXECUTE');
 assert has_function_privilege('service_role','public.noor_calendar_actor_access(uuid,uuid)','EXECUTE');
 assert not public.noor_calendar_actor_access(null,null);
 select m.institution_id,m.user_id into c from public.institution_memberships m
 where m.status='active' and private.noor_institute_running(m.institution_id) limit 1;
 if c is null then raise exception 'No active institute member available for reversible calendar test';end if;
 insert into public.noor_feature_overrides(institution_id,feature_key,enabled) values(c.institution_id,'calendar',true)
 on conflict(institution_id,feature_key) do update set enabled=true;
 insert into public.noor_school_feature_settings(institution_id,feature_key,enabled,updated_by) values(c.institution_id,'calendar',true,c.user_id)
 on conflict(institution_id,feature_key) do update set enabled=true;
 assert public.noor_calendar_actor_access(c.institution_id,c.user_id),'Enabled member denied';
 assert not public.noor_calendar_actor_access(c.institution_id,'00000000-0000-0000-0000-000000000000'),'Unrelated actor accepted';
 update public.noor_feature_overrides set enabled=false where institution_id=c.institution_id and feature_key='calendar';
 assert not public.noor_calendar_actor_access(c.institution_id,c.user_id),'Creator OFF bypassed';
 update public.noor_feature_overrides set enabled=true where institution_id=c.institution_id and feature_key='calendar';
 update public.noor_school_feature_settings set enabled=false where institution_id=c.institution_id and feature_key='calendar';
 assert not public.noor_calendar_actor_access(c.institution_id,c.user_id),'School OFF bypassed';
 update public.noor_school_feature_settings set enabled=true where institution_id=c.institution_id and feature_key='calendar';
 assert public.noor_calendar_actor_access(c.institution_id,c.user_id),'Reopening failed';
end $$;
set local role service_role;
do $$ begin assert not public.noor_calendar_actor_access(null,null);end $$;
reset role;
rollback;
