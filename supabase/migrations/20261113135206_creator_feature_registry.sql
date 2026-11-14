-- Feature declarations sync on Creator sign-in. This adds metadata and missing ON
-- defaults only; it never replaces a saved default, school override or pause state.
create function private.noor_register_features(p_features jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb; n integer := 0; added text[] := '{}'; affected integer;
begin
 if auth.uid() is null or not private.is_platform_admin() then
  raise exception 'Platform Creator required' using errcode='42501';
 end if;
 if jsonb_typeof(p_features) is distinct from 'array' then
  raise exception 'Feature definitions must be an array' using errcode='22023';
 end if;
 if jsonb_array_length(p_features) not between 1 and 256 then
  raise exception 'Provide between 1 and 256 feature definitions' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(p_features) x
  where jsonb_typeof(x) is distinct from 'object'
   or jsonb_typeof(x->'feature_key') is distinct from 'string'
   or coalesce(x->>'feature_key','') !~ '^[a-z][a-z0-9_]{0,63}$'
   or jsonb_typeof(x->'label') is distinct from 'string'
   or length(btrim(coalesce(x->>'label',''))) not between 1 and 120
   or jsonb_typeof(x->'category') is distinct from 'string'
   or length(btrim(coalesce(x->>'category',''))) not between 1 and 60
   or jsonb_typeof(x->'description') is distinct from 'string'
   or length(btrim(coalesce(x->>'description',''))) not between 1 and 500) then
  raise exception 'Invalid feature definition' using errcode='22023';
 end if;
 if (select count(distinct x->>'feature_key') from jsonb_array_elements(p_features) x) <> jsonb_array_length(p_features) then
  raise exception 'Duplicate feature key' using errcode='22023';
 end if;
 for f in select value from jsonb_array_elements(p_features) order by value->>'feature_key' loop
  insert into public.noor_feature_catalog(feature_key,label,category,description)
  values(f->>'feature_key',btrim(f->>'label'),btrim(f->>'category'),btrim(f->>'description'))
  on conflict(feature_key) do nothing;
  get diagnostics affected = row_count;
  if affected > 0 then added := array_append(added,f->>'feature_key'); end if;
  update public.noor_feature_catalog set label=btrim(f->>'label'),category=btrim(f->>'category'),description=btrim(f->>'description')
  where feature_key=f->>'feature_key' and (label,category,description) is distinct from (btrim(f->>'label'),btrim(f->>'category'),btrim(f->>'description'));
  insert into public.noor_feature_defaults(feature_key,enabled) values(f->>'feature_key',true)
  on conflict(feature_key) do nothing;
  n := n + 1;
 end loop;
 if cardinality(added)>0 then
  insert into public.noor_creator_activity(actor_id,action,details)
  values(auth.uid(),'feature_registration',jsonb_build_object('feature_keys',added));
 end if;
 return jsonb_build_object('registered',n,'added',to_jsonb(added));
end $$;
revoke all on function private.noor_register_features(jsonb) from public,anon,authenticated;
grant execute on function private.noor_register_features(jsonb) to authenticated;
create function public.noor_creator_register_features(p_features jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.noor_register_features(p_features)
$$;
revoke all on function public.noor_creator_register_features(jsonb) from public,anon,authenticated;
grant execute on function public.noor_creator_register_features(jsonb) to authenticated;
