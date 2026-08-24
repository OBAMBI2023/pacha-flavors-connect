-- New table -- nothing else logs driver assignment/reassignment events.
-- order_status_history only tracks orders.status transitions, not which
-- driver was (re)assigned or whether it was automatic or manual.
create type public.driver_assignment_type as enum ('automatic', 'manual');

create table public.driver_assignment_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_driver_id uuid references public.driver_profiles(id) on delete set null,
  new_driver_id uuid references public.driver_profiles(id) on delete set null,
  assignment_type driver_assignment_type not null,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index driver_assignment_history_order_id_idx on public.driver_assignment_history (order_id);
create index driver_assignment_history_restaurant_id_created_at_idx on public.driver_assignment_history (restaurant_id, created_at desc);

alter table public.driver_assignment_history enable row level security;

create policy driver_assignment_history_select_tenant_staff on public.driver_assignment_history
  for select
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager', 'staff']::restaurant_role[]));

-- No INSERT/UPDATE/DELETE policy -- written only by SECURITY DEFINER RPCs
-- (assign_driver_to_order, driver_respond_to_proposal), same "RPC-only
-- writes" pattern already used for delivery_proposals.
