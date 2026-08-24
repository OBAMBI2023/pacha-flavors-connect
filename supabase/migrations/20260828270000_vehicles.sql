-- New table -- no vehicle entity existed anywhere before this.
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('moto', 'scooter', 'voiture', 'tricycle', 'autre')),
  make text,
  model text,
  year integer,
  color text,
  plate_number text not null,
  chassis_number text,
  photo_path text,
  insurance_expires_at date,
  inspection_expires_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforces "un livreur peut avoir un véhicule actif" -- same partial-unique-
-- index pattern as product_promotions_one_active_per_product. Désactiver a
-- vehicle (is_active = false) frees the driver up to have a new active one.
create unique index vehicles_one_active_per_driver on public.vehicles (driver_id) where is_active;

create index vehicles_restaurant_id_idx on public.vehicles (restaurant_id);
create index vehicles_driver_id_idx on public.vehicles (driver_id);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

alter table public.vehicles enable row level security;

create policy vehicles_manage_owner_manager on public.vehicles
  for all
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]));

create policy vehicles_select_tenant_staff on public.vehicles
  for select
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager', 'staff']::restaurant_role[]));
