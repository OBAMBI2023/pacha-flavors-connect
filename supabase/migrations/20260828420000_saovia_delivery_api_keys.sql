-- SAOVIA Delivery -- api_keys. Key management is a Super Admin-only action
-- per spec (not listed under tenant permissions), so table RLS is
-- super-admin-only for this phase -- no client ever reads key_hash. The
-- actual key-issuance RPC (which generates the raw key, returns it once,
-- and stores only its hash -- same show-once pattern already used for
-- driver temp passwords in admin-create-driver) ships with the API layer
-- in a later phase; this migration only lays down the storage shape.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- Short, non-secret prefix shown in the dashboard for identification
  -- (e.g. "sav_live_ab12") -- the raw key itself is never stored.
  key_prefix text not null,
  key_hash text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index api_keys_key_hash_key on public.api_keys(key_hash);
create index api_keys_organization_id_idx on public.api_keys(organization_id);

create trigger api_keys_set_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;

create policy api_keys_manage_super_admin on public.api_keys
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
