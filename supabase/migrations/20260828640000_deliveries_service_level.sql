-- SAOVIA Delivery Phase 2B -- EXPRESS/SCHEDULED service level + pricing
-- columns on deliveries. Additive/nullable-or-defaulted only.
create type public.delivery_service_level as enum ('EXPRESS', 'SCHEDULED');

alter table public.deliveries
  add column service_level public.delivery_service_level not null default 'EXPRESS',
  add column scheduled_pickup_at timestamptz,
  add column declared_value numeric,
  add column cod_amount numeric,
  add column delivery_instructions text,
  add column pickup_point_id uuid references public.pickup_points(id) on delete set null,
  add column delivery_fee numeric,
  add column delivery_distance_km numeric,
  add column delivery_fee_calculation_method text;

alter table public.deliveries
  add constraint deliveries_service_level_schedule_xor
  check (
    (service_level = 'EXPRESS' and scheduled_pickup_at is null)
    or (service_level = 'SCHEDULED' and scheduled_pickup_at is not null)
  );
