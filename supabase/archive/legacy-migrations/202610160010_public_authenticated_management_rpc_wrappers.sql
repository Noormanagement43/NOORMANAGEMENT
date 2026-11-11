-- NOOR AI: public authenticated wrappers for private management RPCs.
-- Safe to apply only to the existing NOOR AI project; authorization stays in private routines.
create or replace function public.noor_create_school_owner(p_school_name text,p_username text,p_mobile text default null)
returns jsonb language sql security invoker set search_path=''
as $$ select private.noor_create_school_owner(p_school_name,p_username,p_mobile) $$;

create or replace function public.noor_accept_school_invitation(p_token text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.noor_accept_school_invitation(p_token) $$;

create or replace function public.noor_remove_school_member(p_membership_id uuid,p_reason text)
returns void language sql security invoker set search_path=''
as $$ select private.noor_remove_school_member(p_membership_id,p_reason) $$;

create or replace function public.noor_rotate_school_secret_code(p_school_id uuid)
returns text language sql security invoker set search_path=''
as $$ select private.noor_rotate_school_secret_code(p_school_id) $$;

revoke all on function public.noor_create_school_owner(text,text,text) from public,anon;
revoke all on function public.noor_accept_school_invitation(text) from public,anon;
revoke all on function public.noor_remove_school_member(uuid,text) from public,anon;
revoke all on function public.noor_rotate_school_secret_code(uuid) from public,anon;
grant execute on function public.noor_create_school_owner(text,text,text) to authenticated;
grant execute on function public.noor_accept_school_invitation(text) to authenticated;
grant execute on function public.noor_remove_school_member(uuid,text) to authenticated;
grant execute on function public.noor_rotate_school_secret_code(uuid) to authenticated;
