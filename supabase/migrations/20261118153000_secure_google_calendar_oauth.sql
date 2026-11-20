-- NOOR school-only Google OAuth state and refresh tokens.
-- Secrets are ciphertext, never visible to browser clients or members through PostgREST.
create table if not exists public.noor_google_oauth_states (
 state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 verifier text not null check (length(verifier) between 43 and 128),
 expires_at timestamptz not null default now()+interval '10 minutes',
 created_at timestamptz not null default now()
);
alter table public.noor_google_oauth_states enable row level security;
revoke all on public.noor_google_oauth_states from anon, authenticated, public;
grant select, insert, update, delete on public.noor_google_oauth_states to service_role;

create table if not exists public.noor_google_oauth_credentials (
 institution_id uuid primary key references public.institutions(id) on delete cascade,
 token_ciphertext text not null check(length(token_ciphertext)>24),
 token_iv text not null check(length(token_iv)>12),
 calendar_id text not null default 'primary' check(length(calendar_id) between 1 and 400),
 connected_by uuid not null references auth.users(id),
 outbound_enabled boolean not null default false,
 connected_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.noor_google_oauth_credentials enable row level security;
revoke all on public.noor_google_oauth_credentials from anon, authenticated, public;
grant select, insert, update, delete on public.noor_google_oauth_credentials to service_role;

create table if not exists public.noor_google_event_links (
 institution_id uuid not null references public.institutions(id) on delete cascade,
 noor_event_id uuid not null references public.noor_calendar_events(id) on delete cascade,
 google_event_id text not null check(length(google_event_id) between 1 and 400),
 created_at timestamptz not null default now(),
 primary key(institution_id,noor_event_id)
);
alter table public.noor_google_event_links enable row level security;
revoke all on public.noor_google_event_links from anon, authenticated, public;
grant select, insert, update, delete on public.noor_google_event_links to service_role;

-- Single-use nonce; atomic claim prevents OAuth callback replays.
create or replace function public.noor_claim_google_oauth_state(p_hash text)
 returns table(institution_id uuid,actor_id uuid,verifier text)
 language sql security definer set search_path = ''
 as $$
  delete from public.noor_google_oauth_states s
   where s.state_hash=p_hash and s.expires_at>now()
   returning s.institution_id,s.actor_id,s.verifier;
 $$;
revoke all on function public.noor_claim_google_oauth_state(text) from public,anon,authenticated;
grant execute on function public.noor_claim_google_oauth_state(text) to service_role;
comment on function public.noor_claim_google_oauth_state(text) is 'Server-only atomic consumption of a 10-minute Google authorization state.';
