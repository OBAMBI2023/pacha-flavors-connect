-- SAOVIA Delivery -- zones (pricing/coverage areas, platform-wide for now:
-- no polygon/geo matching engine in this phase, just the named-zone +
-- flat/per-km fee shape the "Zones"/"Tarification" dashboard sections will
-- read from once built) and pickup_points (a merchant's saved collection
-- location, distinct from the ad-hoc pickup object sent per-delivery-request
-- in the future create-delivery payload).
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_fee numeric not null default 0,
  per_km_fee numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger delivery_zones_set_updated_at
  before update on public.delivery_zones
  for each row execute function public.set_updated_at();

alter table public.delivery_zones enable row level security;

-- Pricing/coverage is platform-wide, not per-organization -- any signed-in
-- tenant can read active zones (needed to show delivery pricing), only
-- Super Admin manages them, per the spec's permission list.
create policy delivery_zones_select_authenticated on public.delivery_zones
  for select to authenticated
  using (true);

create policy delivery_zones_manage_super_admin on public.delivery_zones
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create table public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  contact_name text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pickup_points_organization_id_idx on public.pickup_points(organization_id);

create trigger pickup_points_set_updated_at
  before update on public.pickup_points
  for each row execute function public.set_updated_at();

alter table public.pickup_points enable row level security;

create policy pickup_points_select_scoped on public.pickup_points
  for select to authenticated
  using (public.has_organization_access(organization_id));

create policy pickup_points_manage_super_admin on public.pickup_points
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
