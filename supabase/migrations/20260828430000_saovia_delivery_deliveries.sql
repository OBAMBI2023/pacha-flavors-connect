-- SAOVIA Delivery -- the core `deliveries` entity. Deliberately decoupled
-- from `orders`: an external merchant site has no row in `orders` at all,
-- so this table stands on its own, keyed to `organizations` (the new API
-- tenant boundary) rather than `restaurants`. `delivery_provider` is the
-- TENANT/SAOVIA business-model split from the spec -- TENANT-mode
-- deliveries are just a record of what the shop is already handling
-- itself via the existing orders/driver_profiles pipeline (untouched by
-- this phase); SAOVIA-mode deliveries are the new centralized-logistics
-- path this table exists to support.
--
-- `order_id`/`external_reference` are plain text (the calling shop's own
-- identifiers), never a FK to `public.orders` -- that table remains
-- entirely the existing tenant marketplace's, unmodified.
create type public.delivery_status as enum (
  'pending',
  'pending_pickup',
  'assigned_pickup',
  'picked_up',
  'ready_for_delivery',
  'assigned_delivery',
  'in_transit',
  'delivered',
  'delivery_failed',
  'cancelled',
  'returned'
);

create type public.delivery_provider as enum ('TENANT', 'SAOVIA');

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id text not null,
  external_reference text,
  delivery_provider public.delivery_provider not null default 'SAOVIA',
  status public.delivery_status not null default 'pending',

  customer_name text not null,
  customer_phone text not null,

  pickup_name text not null,
  pickup_phone text not null,
  pickup_address text not null,
  pickup_latitude double precision,
  pickup_longitude double precision,

  destination_name text not null,
  destination_phone text not null,
  destination_address text not null,
  destination_latitude double precision,
  destination_longitude double precision,

  package_description text,
  package_weight numeric,
  package_quantity integer not null default 1,

  assigned_pickup_agent_id uuid references public.driver_profiles(id) on delete set null,
  assigned_delivery_agent_id uuid references public.driver_profiles(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deliveries_organization_id_idx on public.deliveries(organization_id);
create index deliveries_status_idx on public.deliveries(status);
-- A shop looking up its own order by its own reference is the expected
-- read pattern for GET /v1/deliveries?order_id=... once the API ships.
create index deliveries_organization_order_id_idx on public.deliveries(organization_id, order_id);

create trigger deliveries_set_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

alter table public.deliveries enable row level security;

-- Phase 1 posture: read-only for the owning organization's tenant staff
-- (once wired into a UI in a later phase); all writes are super-admin-only
-- until the create/assign/webhook RPCs ship, following the same
-- "RPC-only mutation" lockdown already used for delivery_proposals.
create policy deliveries_select_scoped on public.deliveries
  for select to authenticated
  using (public.has_organization_access(organization_id));

create policy deliveries_manage_super_admin on public.deliveries
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
