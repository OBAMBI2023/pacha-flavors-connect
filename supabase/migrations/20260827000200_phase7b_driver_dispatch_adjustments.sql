-- Phase 7b: tighten driver data exposure and location freshness per review.
--
-- 1. driver_location_freshness_minutes: 15 -> 5. A driver whose last known
--    position is more than 5 minutes old must never be treated as "nearest".
-- 2. get_driver_active_delivery(): the only way the driver frontend reads
--    its assigned order's details. Returns a curated JSON payload (order
--    number, customer name/phone, delivery address/commune, fulfillment
--    type, amount, a minimal item list) instead of relying on a blanket
--    order_items RLS grant, which was never added for drivers in the first
--    place -- this RPC is what replaces "the driver reads order_items
--    directly" as an approach entirely.
-- The narrow `orders_select_assigned_driver` policy from phase7 is kept
-- as-is: it's still needed so the driver's realtime subscription on
-- `orders` (e.g. tenant cancels mid-delivery) keeps working, and it was
-- already scoped to exactly the assigned order, nothing broader.

update public.restaurant_settings
  set driver_location_freshness_minutes = 5
  where driver_location_freshness_minutes = 15;

alter table public.restaurant_settings
  alter column driver_location_freshness_minutes set default 5;

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

  select coalesce(s.driver_proposal_timeout_seconds, 60), coalesce(s.driver_location_freshness_minutes, 5)
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
-- get_driver_active_delivery: curated read of the driver's current
-- assignment. No parameters -- always resolves from auth.uid(), so there's
-- no order_id to forge. Queries order_items internally (SECURITY DEFINER)
-- rather than exposing it to the driver via RLS at all.
-- ---------------------------------------------------------------------------
create or replace function public.get_driver_active_delivery()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.order_number, o.customer_name, o.customer_phone, o.delivery_address, o.delivery_commune,
         o.fulfillment_type, o.total_amount, o.currency, o.status, o.restaurant_id
    into v_order
    from public.orders o
    where o.assigned_driver_id = auth.uid()
      and o.status not in ('delivered', 'cancelled')
    order by o.confirmed_at desc nulls last
    limit 1;

  if v_order.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('product_name', oi.product_name_snapshot, 'quantity', oi.quantity)), '[]'::jsonb)
    into v_items
    from public.order_items oi
    where oi.order_id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'delivery_address', v_order.delivery_address,
    'delivery_commune', v_order.delivery_commune,
    'fulfillment_type', v_order.fulfillment_type,
    'total_amount', v_order.total_amount,
    'currency', v_order.currency,
    'status', v_order.status,
    'restaurant_name', (select name from public.restaurants where id = v_order.restaurant_id),
    'items', v_items
  );
end;
$$;

revoke all on function public.get_driver_active_delivery() from public, anon;
grant execute on function public.get_driver_active_delivery() to authenticated;
