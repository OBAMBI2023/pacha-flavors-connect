-- SAOVIA Delivery -- Phase 1 (DB foundations only, no live API/RPCs/UI yet).
-- `organizations` is the new API-tenant boundary, independent of `restaurants`
-- so a future external merchant site can exist here with no `restaurants`
-- row at all. Every EXISTING restaurant gets one automatically (1:1,
-- restaurant_id nullable+unique) so current tenants are API-ready without
-- any behavior change -- `restaurants` itself is not altered by this file.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  -- null = a genuine external merchant with no restaurant row (future use).
  restaurant_id uuid unique references public.restaurants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;

-- Phase 1 posture: read access mirrors restaurant membership (via the
-- backlink) for the tenants that already have one; every other action is
-- super-admin-only until the actual API/RPC layer ships in a later phase --
-- same "schema first, RPC-gated writes later" posture already used for
-- delivery_proposals/driver_assignment_history.
create policy organizations_select_scoped on public.organizations
  for select to authenticated
  using (public.is_super_admin() or (restaurant_id is not null and public.has_restaurant_access(restaurant_id)));

create policy organizations_manage_super_admin on public.organizations
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Read-scoping helper for every future SAOVIA Delivery table keyed by
-- organization_id -- mirrors has_restaurant_access's shape exactly.
create or replace function public.has_organization_access(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.is_super_admin() or exists (
    select 1 from public.organizations o
    where o.id = _organization_id
      and o.restaurant_id is not null
      and public.has_restaurant_access(o.restaurant_id)
  );
$function$;

revoke all on function public.has_organization_access(uuid) from public;
grant execute on function public.has_organization_access(uuid) to authenticated, anon;

-- Backfill: one organization per existing restaurant.
insert into public.organizations (name, slug, restaurant_id)
select r.name, r.slug, r.id
from public.restaurants r
where not exists (select 1 from public.organizations o where o.restaurant_id = r.id);

-- Keeps the mapping silent for every future tenant too -- zero changes to
-- super_admin_create_tenant or any other restaurant-creation code path.
create or replace function public.organizations_auto_create_for_restaurant()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.organizations (name, slug, restaurant_id)
  values (new.name, new.slug, new.id)
  on conflict (restaurant_id) do nothing;
  return new;
end;
$function$;

create trigger restaurants_auto_create_organization
  after insert on public.restaurants
  for each row execute function public.organizations_auto_create_for_restaurant();
