-- SAOVIA Delivery -- status history (mirrors order_status_history exactly)
-- and assignments (mirrors driver_assignment_history's shape, generalized
-- to cover both pickup and delivery legs per the spec's assignments.types).
-- Both are RPC-only-write tables: no INSERT/UPDATE policy exists here, same
-- lockdown pattern as delivery_proposals/driver_assignment_history -- the
-- actual create/assign RPCs (which will call log_audit_event too) ship
-- with the API layer in a later phase.
create table public.delivery_status_history (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  from_status public.delivery_status,
  to_status public.delivery_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index delivery_status_history_delivery_id_idx on public.delivery_status_history(delivery_id, created_at desc);

alter table public.delivery_status_history enable row level security;

create policy delivery_status_history_select_scoped on public.delivery_status_history
  for select to authenticated
  using (exists (
    select 1 from public.deliveries d
    where d.id = delivery_id and public.has_organization_access(d.organization_id)
  ));

create policy delivery_status_history_manage_super_admin on public.delivery_status_history
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create type public.delivery_assignment_role as enum ('pickup', 'delivery');
create type public.delivery_assignment_status as enum ('proposed', 'accepted', 'rejected', 'completed', 'cancelled');

create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  role public.delivery_assignment_role not null,
  agent_id uuid not null references public.driver_profiles(id) on delete cascade,
  status public.delivery_assignment_status not null default 'proposed',
  -- null = automatic dispatch, matching driver_assignment_history's own
  -- performed_by convention for its 'automatic' rows.
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delivery_assignments_delivery_id_idx on public.delivery_assignments(delivery_id);
create index delivery_assignments_agent_id_idx on public.delivery_assignments(agent_id);

create trigger delivery_assignments_set_updated_at
  before update on public.delivery_assignments
  for each row execute function public.set_updated_at();

alter table public.delivery_assignments enable row level security;

create policy delivery_assignments_select_scoped on public.delivery_assignments
  for select to authenticated
  using (exists (
    select 1 from public.deliveries d
    where d.id = delivery_id and public.has_organization_access(d.organization_id)
  ));

create policy delivery_assignments_manage_super_admin on public.delivery_assignments
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
