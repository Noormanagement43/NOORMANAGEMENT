-- Institution self-service onboarding for NOOR.
-- Creates a school/university and grants the signed-in creator principal access.
create or replace function public.register_institution_for_current_user(
  p_name text,
  p_slug text,
  p_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_name text := pg_catalog.btrim(coalesce(p_name, ''));
  v_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_type, '')));
  v_institution_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to register an institution.';
  end if;
  if pg_catalog.length(v_name) < 2 or pg_catalog.length(v_name) > 160 then
    raise exception 'Institution name must be between 2 and 160 characters.';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or pg_catalog.length(v_slug) > 80 then
    raise exception 'Use a valid URL slug with lowercase letters, numbers, and hyphens.';
  end if;
  if v_type not in ('school', 'university') then
    raise exception 'Institution type must be school or university.';
  end if;
  if exists (select 1 from public.institution_memberships m where m.user_id = v_user_id and m.status = 'active') then
    raise exception 'Your account already has an active institution membership.';
  end if;
  insert into public.institutions
    (name, slug, institution_type, country_code, timezone, default_language, status, created_by)
  values
    (v_name, v_slug, v_type, 'IN', 'Asia/Kolkata', 'en', 'active', v_user_id)
  returning id into v_institution_id;
  insert into public.institution_memberships
    (institution_id, user_id, role, status, invited_by, joined_at)
  values
    (v_institution_id, v_user_id, 'principal', 'active', v_user_id, pg_catalog.now());
  return pg_catalog.jsonb_build_object(
    'institution_id', v_institution_id, 'name', v_name, 'slug', v_slug,
    'institution_type', v_type, 'role', 'principal'
  );
end;
$function$;
revoke all on function public.register_institution_for_current_user(text, text, text) from public;
revoke all on function public.register_institution_for_current_user(text, text, text) from anon;
grant execute on function public.register_institution_for_current_user(text, text, text) to authenticated;
