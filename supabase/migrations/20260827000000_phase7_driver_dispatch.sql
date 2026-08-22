-- Phase 7 "Driver dispatch": automatic nearest-available-driver search and
-- assignment for delivery orders. Drivers are modelled as a brand-new,
-- deliberately separate `driver_profiles` table rather than an extra
-- `restaurant_role` value on `restaurant_memberships` -- reusing that table
-- would make every driver inherit `has_restaurant_access()`, which backs
-- ~10 existing policies (menu, subscriptions, audit, notifications...) and
-- would hand every driver full read access to a tenant's entire order
-- history and financials, not just the one delivery assigned to them.
-- `has_restaurant_access`/`has_restaurant_role` are used exactly as-is,
-- unmodified, everywhere below.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.driver_status as enum ('offline', 'available', 'proposed', 'busy', 'delivering');
create type public.delivery_proposal_status as enum ('pending', 'accepted', 'rejected', 'expired', 'cancelled');
create type public.delivery_dispatch_status as enum ('not_started', 'searching', 'assigned', 'no_driver_available');

-- ---------------------------------------------------------------------------
-- restaurants: origin coordinates. Nothing computes a distance without
-- these, so they're required infrastructure, not scope creep.
-- ---------------------------------------------------------------------------
alter table public.restaurants add column lat double precision;
alter table public.restaurants add column lng double precision;

-- ---------------------------------------------------------------------------
-- restaurant_settings: configurable dispatch parameters, same convention as
-- the existing delivery_fee/minimum_order columns on this table.
-- ---------------------------------------------------------------------------
alter table public.restaurant_settings
  add column driver_proposal_timeout_seconds integer not null default 60 check (driver_proposal_timeout_seconds > 0),
  add column driver_location_freshness_minutes integer not null default 15 check (driver_location_freshness_minutes > 0);

-- ---------------------------------------------------------------------------
-- driver_profiles
-- ---------------------------------------------------------------------------
create table public.driver_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  full_name text not null,
  phone text not null,
  is_active boolean not null default true,
  status public.driver_status not null default 'offline',
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index driver_profiles_restaurant_id_status_idx on public.driver_profiles (restaurant_id, status);

create trigger driver_profiles_set_updated_at
  before update on public.driver_profiles
  for each row execute function public.set_updated_at();

-- A driver updating their own row (the only self-service path, e.g. toggling
-- availability or pushing a location ping) must not be able to also rewrite
-- full_name/phone/is_active/restaurant_id -- those stay owner/manager-only.
-- Column-level GRANTs can't express this because drivers and owner/manager
-- share the same `authenticated` Postgres role; a BEFORE UPDATE trigger that
-- pins the non-self-editable columns back to their old values unless the
-- actor is owner/manager is the standard way to do this.
create or replace function public.driver_profiles_restrict_self_update() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_restaurant_role(old.restaurant_id, array['owner', 'manager']::public.restaurant_role[]) then
    new.full_name := old.full_name;
    new.phone := old.phone;
    new.is_active := old.is_active;
    new.restaurant_id := old.restaurant_id;
  end if;
  return new;
end;
$$;

create trigger driver_profiles_restrict_self_update
  before update on public.driver_profiles
  for each row execute function public.driver_profiles_restrict_self_update();

alter table public.driver_profiles enable row level security;

create policy driver_profiles_select_own
  on public.driver_profiles for select
  to authenticated
  using (id = auth.uid());

create policy driver_profiles_select_tenant_staff
  on public.driver_profiles for select
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager', 'staff']::public.restaurant_role[]));

create policy driver_profiles_insert_owner_manager
  on public.driver_profiles for insert
  to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::public.restaurant_role[]));

create policy driver_profiles_update
  on public.driver_profiles for update
  to authenticated
  using (id = auth.uid() or public.has_restaurant_role(restaurant_id, array['owner', 'manager']::public.restaurant_role[]))
  with check (id = auth.uid() or public.has_restaurant_role(restaurant_id, array['owner', 'manager']::public.restaurant_role[]));

create policy driver_profiles_delete_owner_manager
  on public.driver_profiles for delete
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::public.restaurant_role[]));

-- ---------------------------------------------------------------------------
-- delivery_proposals -- also the proposal history the brief asks for.
-- No insert/update/delete policy for `authenticated`: every write goes
-- through the SECURITY DEFINER RPCs below, exactly like `orders` rows are
-- only ever written via create_order/update_order_status.
-- ---------------------------------------------------------------------------
create table public.delivery_proposals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  driver_id uuid not null references public.driver_profiles(id),
  distance_km numeric,
  status public.delivery_proposal_status not null default 'pending',
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index delivery_proposals_order_id_idx on public.delivery_proposals (order_id);
create index delivery_proposals_driver_id_status_idx on public.delivery_proposals (driver_id, status);

-- The anti-double-proposal guarantee lives at the constraint level, not just
-- in application logic: at most one 'pending' proposal can ever exist for a
-- given order at a time.
create unique index delivery_proposals_one_pending_per_order
  on public.delivery_proposals (order_id)
  where status = 'pending';

alter table public.delivery_proposals enable row level security;

create policy delivery_proposals_select_driver_own
  on public.delivery_proposals for select
  to authenticated
  using (driver_id = auth.uid());

create policy delivery_proposals_select_tenant_staff
  on public.delivery_proposals for select
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager', 'staff']::public.restaurant_role[]));

alter publication supabase_realtime add table public.delivery_proposals;
alter publication supabase_realtime add table public.driver_profiles;

-- ---------------------------------------------------------------------------
-- orders: additive columns only.
-- ---------------------------------------------------------------------------
alter table public.orders add column assigned_driver_id uuid references public.driver_profiles(id);
alter table public.orders add column delivery_dispatch_status public.delivery_dispatch_status not null default 'not_started';

create index orders_assigned_driver_id_idx on public.orders (assigned_driver_id) where assigned_driver_id is not null;

-- A driver's only path to reading order data (delivery address, customer
-- phone) is through this narrow policy, and only for the one order
-- currently assigned to them -- "les coordonnées client ne doivent être
-- révélées qu'au moment approprié". `orders_select_members`
-- (has_restaurant_access, staff-only) is untouched.
create policy orders_select_assigned_driver
  on public.orders for select
  to authenticated
  using (assigned_driver_id = auth.uid());

-- ---------------------------------------------------------------------------
-- haversine_km: plain SQL, no extra extension needed for the distance calc
-- itself (pg_cron below is the one genuinely new piece of infrastructure).
-- ---------------------------------------------------------------------------
create or replace function public.haversine_km(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    sin(radians(p_lat2 - p_lat1) / 2) ^ 2 +
    cos(radians(p_lat1)) * cos(radians(p_lat2)) * sin(radians(p_lng2 - p_lng1) / 2) ^ 2
  ));
$$;

-- ---------------------------------------------------------------------------
-- dispatch_find_and_propose_driver: the matching engine. Internal-only
-- (no grant to authenticated) -- called from update_order_status, from
-- itself on cascade, and from the pg_cron sweep.
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_find_and_propose_driver(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_restaurant record;
  v_timeout_seconds integer;
  v_freshness_minutes integer;
  v_candidate record;
begin
  -- Locks the order for the duration of this dispatch attempt so a
  -- concurrent call (cascade + cron sweep racing) can't both act on it.
  select o.id, o.restaurant_id, o.status, o.fulfillment_type, o.assigned_driver_id
    into v_order
    from public.orders o
    where o.id = p_order_id
    for update;

  if v_order.id is null then
    return;
  end if;

  if v_order.fulfillment_type <> 'delivery'
     or v_order.status in ('delivered', 'cancelled')
     or v_order.assigned_driver_id is not null then
    return;
  end if;

  if exists (select 1 from public.delivery_proposals p where p.order_id = p_order_id and p.status = 'pending') then
    return;
  end if;

  select r.lat, r.lng into v_restaurant from public.restaurants r where r.id = v_order.restaurant_id;

  select coalesce(s.driver_proposal_timeout_seconds, 60), coalesce(s.driver_location_freshness_minutes, 15)
    into v_timeout_seconds, v_freshness_minutes
    from public.restaurant_settings s
    where s.restaurant_id = v_order.restaurant_id;

  if v_restaurant.lat is null or v_restaurant.lng is null then
    update public.orders set delivery_dispatch_status = 'no_driver_available' where id = p_order_id;
    perform public.create_notification(
      v_order.restaurant_id, p_order_id, 'delivery_dispatch_blocked',
      'Coordonnées du restaurant manquantes',
      'Impossible de rechercher un livreur : configurez la position du restaurant dans les paramètres.'
    );
    return;
  end if;

  -- Never selects on distance alone without also gating on real
  -- availability, a fresh-enough position, and no prior refusal/timeout
  -- from this exact driver for this exact order.
  select dp.id, dp.last_lat, dp.last_lng
    into v_candidate
    from public.driver_profiles dp
    where dp.restaurant_id = v_order.restaurant_id
      and dp.is_active
      and dp.status = 'available'
      and dp.last_location_at is not null
      and dp.last_location_at > now() - (v_freshness_minutes || ' minutes')::interval
      and not exists (
        select 1 from public.delivery_proposals prev
        where prev.order_id = p_order_id and prev.driver_id = dp.id
          and prev.status in ('rejected', 'expired')
      )
    order by public.haversine_km(v_restaurant.lat, v_restaurant.lng, dp.last_lat, dp.last_lng) asc
    for update skip locked
    limit 1;

  if v_candidate.id is null then
    update public.orders set delivery_dispatch_status = 'no_driver_available' where id = p_order_id;
    perform public.create_notification(
      v_order.restaurant_id, p_order_id, 'delivery_dispatch_no_driver',
      'Aucun livreur disponible',
      'La recherche continue automatiquement.'
    );
    return;
  end if;

  insert into public.delivery_proposals (order_id, restaurant_id, driver_id, distance_km, expires_at)
  values (
    p_order_id, v_order.restaurant_id, v_candidate.id,
    public.haversine_km(v_restaurant.lat, v_restaurant.lng, v_candidate.last_lat, v_candidate.last_lng),
    now() + (v_timeout_seconds || ' seconds')::interval
  );

  update public.driver_profiles set status = 'proposed' where id = v_candidate.id;
  update public.orders set delivery_dispatch_status = 'searching' where id = p_order_id;
end;
$$;

revoke all on function public.dispatch_find_and_propose_driver(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- driver_respond_to_proposal: the only way a proposal's outcome is ever
-- written. Re-verifies `assigned_driver_id is null` under lock immediately
-- before assigning -- this, not application logic, is what makes two
-- concurrent acceptances impossible.
-- ---------------------------------------------------------------------------
create or replace function public.driver_respond_to_proposal(p_proposal_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal record;
  v_order record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select p.id, p.order_id, p.driver_id, p.restaurant_id, p.status, p.expires_at
    into v_proposal
    from public.delivery_proposals p
    where p.id = p_proposal_id
    for update;

  if v_proposal.id is null then
    raise exception 'Proposition introuvable';
  end if;
  if v_proposal.driver_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'Cette proposition n''est plus active';
  end if;

  if v_proposal.expires_at <= now() then
    update public.delivery_proposals set status = 'expired', responded_at = now() where id = p_proposal_id;
    update public.driver_profiles set status = 'available' where id = v_proposal.driver_id;
    perform public.dispatch_find_and_propose_driver(v_proposal.order_id);
    raise exception 'Cette proposition a expiré';
  end if;

  if not p_accept then
    update public.delivery_proposals set status = 'rejected', responded_at = now() where id = p_proposal_id;
    update public.driver_profiles set status = 'available' where id = v_proposal.driver_id;
    perform public.dispatch_find_and_propose_driver(v_proposal.order_id);
    return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'rejected');
  end if;

  select o.id, o.assigned_driver_id into v_order from public.orders o where o.id = v_proposal.order_id for update;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if v_order.assigned_driver_id is not null then
    update public.delivery_proposals set status = 'expired', responded_at = now() where id = p_proposal_id;
    update public.driver_profiles set status = 'available' where id = v_proposal.driver_id;
    raise exception 'Cette commande a déjà été assignée à un autre livreur';
  end if;

  update public.delivery_proposals set status = 'accepted', responded_at = now() where id = p_proposal_id;
  update public.orders set assigned_driver_id = v_proposal.driver_id, delivery_dispatch_status = 'assigned' where id = v_proposal.order_id;
  update public.driver_profiles set status = 'delivering' where id = v_proposal.driver_id;

  perform public.create_notification(
    v_proposal.restaurant_id, v_proposal.order_id, 'driver_assigned',
    'Livreur assigné',
    (select full_name from public.driver_profiles where id = v_proposal.driver_id) || ' a accepté la livraison.'
  );

  return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'accepted', 'order_id', v_proposal.order_id);
end;
$$;

revoke all on function public.driver_respond_to_proposal(uuid, boolean) from public, anon;
grant execute on function public.driver_respond_to_proposal(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- dispatch_expire_stale_proposals: the pg_cron target. Expires timed-out
-- proposals and cascades, and separately retries any delivery order that's
-- stuck without a candidate ("ne pas perdre la commande").
-- ---------------------------------------------------------------------------
create or replace function public.dispatch_expire_stale_proposals()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired record;
  v_retry record;
begin
  for v_expired in
    select p.id, p.order_id, p.driver_id
    from public.delivery_proposals p
    where p.status = 'pending' and p.expires_at <= now()
    for update skip locked
  loop
    update public.delivery_proposals set status = 'expired', responded_at = now() where id = v_expired.id;
    update public.driver_profiles set status = 'available' where id = v_expired.driver_id and status = 'proposed';
    perform public.dispatch_find_and_propose_driver(v_expired.order_id);
  end loop;

  for v_retry in
    select o.id
    from public.orders o
    where o.fulfillment_type = 'delivery'
      and o.status not in ('delivered', 'cancelled')
      and o.assigned_driver_id is null
      and o.delivery_dispatch_status in ('searching', 'no_driver_available')
      and not exists (select 1 from public.delivery_proposals p where p.order_id = o.id and p.status = 'pending')
  loop
    perform public.dispatch_find_and_propose_driver(v_retry.id);
  end loop;
end;
$$;

revoke all on function public.dispatch_expire_stale_proposals() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'dispatch-expire-stale-proposals',
  '15 seconds',
  $$select public.dispatch_expire_stale_proposals();$$
);

-- ---------------------------------------------------------------------------
-- update_order_status: extended, signature unchanged. Exact live body
-- preserved (log_audit_event + create_notification calls untouched); three
-- additions only: (1) a driver assigned to this order may also advance it
-- through out_for_delivery/delivered, (2) accepting a delivery order kicks
-- off dispatch, (3) cancelling/delivering frees the driver.
-- ---------------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_allowed boolean;
  v_notif_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.status, o.order_number, o.fulfillment_type, o.assigned_driver_id
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;

  if not (
    public.has_restaurant_access(v_order.restaurant_id)
    or (auth.uid() = v_order.assigned_driver_id and p_new_status in ('out_for_delivery', 'delivered'))
  ) then
    raise exception 'Forbidden';
  end if;

  v_allowed := case v_order.status
    when 'pending' then p_new_status in ('confirmed', 'cancelled')
    when 'confirmed' then p_new_status in ('preparing', 'cancelled')
    when 'preparing' then p_new_status in ('ready', 'cancelled')
    when 'ready' then p_new_status in ('out_for_delivery', 'delivered', 'cancelled')
    when 'out_for_delivery' then p_new_status in ('delivered', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'Transition de statut invalide: % -> %', v_order.status, p_new_status;
  end if;

  update public.orders
    set status = p_new_status,
        cancel_reason = case when p_new_status = 'cancelled' then p_note else cancel_reason end,
        confirmed_at = case when p_new_status = 'confirmed' then now() else confirmed_at end,
        preparing_at = case when p_new_status = 'preparing' then now() else preparing_at end,
        ready_at = case when p_new_status = 'ready' then now() else ready_at end,
        out_for_delivery_at = case when p_new_status = 'out_for_delivery' then now() else out_for_delivery_at end,
        delivered_at = case when p_new_status = 'delivered' then now() else delivered_at end,
        cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end
    where id = p_order_id;

  insert into public.order_status_history (restaurant_id, order_id, from_status, to_status, changed_by, note)
  values (v_order.restaurant_id, p_order_id, v_order.status, p_new_status, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id,
    case when p_new_status = 'cancelled' then 'order_cancelled' else 'order_status_changed' end,
    jsonb_build_object('from_status', v_order.status, 'to_status', p_new_status, 'note', p_note)
  );

  v_notif_title := case p_new_status
    when 'confirmed' then 'Commande acceptée'
    when 'cancelled' then 'Commande refusée'
    when 'ready' then 'Commande prête'
    when 'delivered' then 'Commande livrée'
    else null
  end;
  if v_notif_title is not null then
    perform public.create_notification(
      v_order.restaurant_id, p_order_id, 'order_status_changed', v_notif_title,
      format('Commande #%s', v_order.order_number),
      jsonb_build_object('order_number', v_order.order_number, 'status', p_new_status)
    );
  end if;

  if p_new_status = 'confirmed' and v_order.fulfillment_type = 'delivery' then
    perform public.dispatch_find_and_propose_driver(p_order_id);
  end if;

  if p_new_status = 'cancelled' then
    update public.driver_profiles
      set status = 'available'
      where id in (select driver_id from public.delivery_proposals where order_id = p_order_id and status = 'pending');
    update public.delivery_proposals
      set status = 'cancelled', responded_at = now()
      where order_id = p_order_id and status = 'pending';
    if v_order.assigned_driver_id is not null then
      update public.driver_profiles set status = 'available' where id = v_order.assigned_driver_id;
    end if;
  end if;

  if p_new_status = 'delivered' and v_order.assigned_driver_id is not null then
    update public.driver_profiles set status = 'available' where id = v_order.assigned_driver_id;
  end if;

  return jsonb_build_object('order_id', p_order_id, 'status', p_new_status);
end;
$$;

revoke all on function public.update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
