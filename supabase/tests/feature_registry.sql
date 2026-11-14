-- Run after the creator_feature_registry migration. No fixture survives rollback.
begin;
do $$
declare owner_id uuid; school_id uuid; r jsonb; before_settings jsonb; definitions jsonb;
begin
 if has_function_privilege('anon','public.noor_creator_register_features(jsonb)','execute')
 or has_function_privilege('anon','private.noor_register_features(jsonb)','execute') then
  raise exception 'Anonymous registration must be denied';
 end if;
 if not has_function_privilege('authenticated','public.noor_creator_register_features(jsonb)','execute') then
  raise exception 'Authenticated wrapper must be callable (authorization is checked inside)';
 end if;
 -- Both entry points reject missing and unrelated identities, including direct private calls.
 perform set_config('request.jwt.claims','{}',true);
 begin
  perform public.noor_creator_register_features('[]');
  raise exception 'Unauthenticated registration succeeded';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','aal','aal2')::text,true);
 begin
  perform private.noor_register_features('[]');
  raise exception 'Unrelated identity registered features';
 exception when insufficient_privilege then null; end;
 select user_id into owner_id from private.noor_creator_account where singleton;
 if owner_id is null then raise exception 'Configured Creator required for this transactional test'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','aal','aal2')::text,true);
 if not private.is_platform_admin() then raise exception 'Configured Creator identity is not authorized'; end if;
 select jsonb_build_object('defaults',(select jsonb_agg(to_jsonb(d) order by feature_key) from public.noor_feature_defaults d),
 'overrides',(select jsonb_agg(to_jsonb(o) order by institution_id,feature_key) from public.noor_feature_overrides o),
 'billing',(select jsonb_agg(to_jsonb(b) order by institution_id) from public.noor_institute_billing b)) into before_settings;
 select jsonb_agg(to_jsonb(c) order by feature_key) into definitions from public.noor_feature_catalog c;
 r := public.noor_creator_register_features(definitions);
 if (r->>'registered')::integer <> jsonb_array_length(definitions) or jsonb_array_length(r->'added')<>0 then
  raise exception 'Existing catalog registration must be idempotent';
 end if;
 if before_settings is distinct from jsonb_build_object('defaults',(select jsonb_agg(to_jsonb(d) order by feature_key) from public.noor_feature_defaults d),
 'overrides',(select jsonb_agg(to_jsonb(o) order by institution_id,feature_key) from public.noor_feature_overrides o),
 'billing',(select jsonb_agg(to_jsonb(b) order by institution_id) from public.noor_institute_billing b)) then
  raise exception 'Registration modified saved availability or pause settings';
 end if;
 definitions := '[{"feature_key":"registry_test_rollback_only","label":"Fixture","category":"Other","description":"Transactional test fixture"}]';
 if exists(select 1 from public.noor_feature_catalog where feature_key='registry_test_rollback_only') then raise exception 'Fixture key collision'; end if;
 r := public.noor_creator_register_features(definitions);
 if (r->>'registered')::integer<>1 or r->'added' <> '["registry_test_rollback_only"]'::jsonb then raise exception 'New feature was not registered'; end if;
 if not (select enabled from public.noor_feature_defaults where feature_key='registry_test_rollback_only') then raise exception 'New feature must preserve existing behavior by starting ON'; end if;
 update public.noor_feature_defaults set enabled=false where feature_key='registry_test_rollback_only';
 select id into school_id from public.institutions limit 1;
 if school_id is not null then insert into public.noor_feature_overrides values(school_id,'registry_test_rollback_only',false); end if;
 perform public.noor_creator_register_features(definitions);
 if (select enabled from public.noor_feature_defaults where feature_key='registry_test_rollback_only') then raise exception 'Saved OFF default overwritten'; end if;
 if school_id is not null and (select enabled from public.noor_feature_overrides where institution_id=school_id and feature_key='registry_test_rollback_only') is distinct from false then raise exception 'School OFF override overwritten'; end if;
 begin perform public.noor_creator_register_features(definitions || definitions);raise exception 'Duplicate key accepted';exception when invalid_parameter_value then null;end;
 begin perform public.noor_creator_register_features('[{"feature_key":"BAD KEY"}]');raise exception 'Invalid metadata accepted';exception when invalid_parameter_value then null;end;
 begin perform public.noor_creator_register_features('null');raise exception 'Null accepted';exception when invalid_parameter_value then null;end;
 begin perform public.noor_creator_register_features('[]');raise exception 'Empty catalog accepted';exception when invalid_parameter_value then null;end;
end $$;
rollback;
