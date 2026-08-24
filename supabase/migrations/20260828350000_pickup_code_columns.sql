-- Secures the restaurant-to-driver handoff with a 2-digit pickup code.
-- Reuses the existing orders table and the existing driver_delivery_status
-- 'collected' value -- no new status, no second delivery system.
alter table public.orders
  add column pickup_code text,
  add column pickup_code_verified_at timestamptz,
  add column pickup_code_verified_by uuid references public.driver_profiles(id) on delete set null,
  add column pickup_code_attempts integer not null default 0;
