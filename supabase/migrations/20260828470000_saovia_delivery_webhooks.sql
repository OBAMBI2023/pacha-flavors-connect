-- SAOVIA Delivery -- webhook subscriptions and the outbound event log.
-- No HTTP dispatch, signing, or retry code exists anywhere in this
-- codebase today (confirmed by audit) -- this migration only lays down the
-- storage shape; the actual signing/dispatch/retry Edge Function ships
-- with the API layer in a later phase.
--
-- `secret` is stored so outgoing payloads can be HMAC-signed -- unlike
-- api_keys.key_hash, a webhook secret must be readable server-side to sign
-- with, so it is never selected by anything but the (future) dispatch
-- Edge Function running as service_role; no authenticated-role SELECT
-- policy exposes this column, mirroring the show-once-then-hide posture
-- already used for driver temp passwords.
create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhook_endpoints_organization_id_idx on public.webhook_endpoints(organization_id);

create trigger webhook_endpoints_set_updated_at
  before update on public.webhook_endpoints
  for each row execute function public.set_updated_at();

alter table public.webhook_endpoints enable row level security;

-- Super-admin-only, full stop -- no SELECT policy for ordinary tenants at
-- all in this phase, so `secret` is never reachable via PostgREST regardless
-- of role. A future tenant-facing "manage my webhooks" screen would go
-- through a dedicated RPC that never returns the secret after creation,
-- not a relaxed table policy.
create policy webhook_endpoints_manage_super_admin on public.webhook_endpoints
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Dedup key (`event_uuid`) per spec's "protection contre les doublons" --
-- delivery-attempt tracking columns live on this same row rather than a
-- 13th table, since the spec lists a single "webhook_events" table.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_uuid uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webhook_endpoint_id uuid references public.webhook_endpoints(id) on delete set null,
  delivery_id uuid references public.deliveries(id) on delete set null,
  event_type text not null check (event_type in (
    'delivery.created', 'delivery.assigned', 'delivery.picked_up',
    'delivery.in_transit', 'delivery.delivered', 'delivery.failed',
    'delivery.cancelled', 'delivery.returned'
  )),
  payload jsonb not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'delivered', 'failed')),
  attempts integer not null default 0,
  last_attempted_at timestamptz,
  next_retry_at timestamptz,
  last_response_status_code integer,
  created_at timestamptz not null default now()
);

create unique index webhook_events_event_uuid_key on public.webhook_events(event_uuid);
create index webhook_events_organization_id_idx on public.webhook_events(organization_id);
create index webhook_events_delivery_status_idx on public.webhook_events(delivery_status) where delivery_status = 'pending';

alter table public.webhook_events enable row level security;

create policy webhook_events_manage_super_admin on public.webhook_events
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
