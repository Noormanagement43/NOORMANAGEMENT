-- Use existing leadership, with all temporary switches rolled back. No new accounts.
begin;
do $$
declare leader public.institution_memberships; other_school uuid; result jsonb;
begin
 if has_function_privilege('anon','public.noor_manager_save_attendance(uuid,uuid,date,jsonb)','execute') then raise exception 'Anonymous attendance execution granted';end if;
 select m.* into leader from public.institution_memberships m join public.institutions i on i.id=m.institution_id
 where m.status='active' and i.status='active' and m.role in('principal','school_admin','university_admin','academic_admin') limit 1;
 if leader.id is null then raise exception 'Existing active leadership required for transactional check';end if;
 select i.id into other_school from public.institutions i where i.status='active' and i.id<>leader.institution_id and not exists(select 1 from public.institution_memberships m where m.institution_id=i.id and m.user_id=leader.user_id and m.status='active') limit 1;
 insert into public.noor_feature_overrides(institution_id,feature_key,enabled) values(leader.institution_id,'manager_tools',false)
 on conflict(institution_id,feature_key) do update set enabled=false;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader.user_id,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 result:=public.noor_feature_access(leader.institution_id);
 if (result->'features'->>'manager_tools')::boolean is distinct from false then raise exception 'Effective OFF state missing';end if;
 begin perform public.noor_manager_overview(leader.institution_id);raise exception 'OFF overview returned data';exception when insufficient_privilege then null;end;
 begin perform public.noor_manager_save_marks(leader.institution_id,null,current_date,'Math','Test','monthly',100,'[]');raise exception 'OFF marks reached writer';exception when insufficient_privilege then null;end;
 begin perform public.noor_manager_save_attendance(leader.institution_id,null,current_date,'[]');raise exception 'OFF attendance reached writer';exception when insufficient_privilege then null;end;
 if other_school is not null then
  begin perform public.noor_feature_access(other_school);raise exception 'Cross-school access succeeded';exception when insufficient_privilege then null;end;
  begin perform public.noor_manager_save_attendance(other_school,null,current_date,'[]');raise exception 'Cross-school manager attendance succeeded';exception when insufficient_privilege then null;end;
 end if;
 execute 'reset role';
 update public.noor_feature_overrides set enabled=true where institution_id=leader.institution_id and feature_key='manager_tools';
 execute 'set local role authenticated';
 result:=public.noor_manager_overview(leader.institution_id);
 if jsonb_typeof(result->'activities')<>'array' then raise exception 'ON overview did not reopen';end if;
 execute 'reset role';
end $$;
rollback;
