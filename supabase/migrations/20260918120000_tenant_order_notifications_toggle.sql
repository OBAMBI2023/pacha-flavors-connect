-- SAOVIA Food: per-tenant master switch for the "nouvelle commande" alert
-- pipeline (RealtimeOrdersBubble + toast/sound/vibration client-side via
-- useOrdersAlert, and notify_restaurant_new_order's Web Push server-side).
-- Lives on restaurant_settings alongside the other tenant-configurable
-- toggles already there (delivery_enabled, pickup_enabled, dine_in_enabled,
-- reservation_enabled) rather than a new table -- same one-row-per-
-- restaurant shape, same RLS (settings_manage_owner_manager) already covers
-- writes to this new column with no policy change needed, same targeted-
-- column read/write pattern as fetchFulfillmentModes/updateFulfillmentModes
-- (src/lib/restaurantSettings.ts).
--
-- Client-side gating (useOrdersAlert's toast/sound/vibration, and whether
-- RealtimeOrdersBubble even mounts) reads this column directly from
-- /admin's own data fetch; this migration only adds the column and the
-- server-side gate inside notify_restaurant_new_order() so the Web Push
-- path can never fire for a tenant that has turned this off, even if a
-- stale push_subscriptions row or a still-granted browser permission exists.
-- Realtime itself (useRealtimeOrders / orders_select_members / the Commandes
-- tab's live order list, and the sidebar's pending-count badge) is
-- untouched -- this is a switch for the *alerting* layer, not for whether
-- the tenant can see their own orders live.

alter table public.restaurant_settings
  add column if not exists order_notifications_enabled boolean not null default true;

-- Re-declares notify_restaurant_new_order() (originally
-- 20260912160000_notify_restaurant_new_order.sql) with one added gate at the
-- top -- same "create or replace to extend a prior migration's function"
-- convention already used by 20260912130000_lock_down_enqueue_notification.sql.
-- Everything below the gate is byte-identical to the original.
create or replace function public.notify_restaurant_new_order()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_member record;
  v_enabled boolean;
begin
  select rs.order_notifications_enabled into v_enabled
  from public.restaurant_settings rs
  where rs.restaurant_id = new.restaurant_id;

  -- Defaults to "enabled" only if the settings row is somehow missing
  -- (restaurant_settings is DB-enforced one-row-per-restaurant, so this
  -- never actually happens) -- matches the column's own default rather than
  -- silently going quiet on an unexpected null.
  if coalesce(v_enabled, true) is false then
    return new;
  end if;

  for v_member in
    select m.user_id
    from public.restaurant_memberships m
    where m.restaurant_id = new.restaurant_id
      and m.status = 'active'
      -- Skip the actor who created this row (e.g. staff using the
      -- "Nouvelle commande" dialog in /admin) -- self-notifying someone for
      -- an action they just took themselves is pure noise. auth.uid() is
      -- null for a real customer checkout (create_order called anonymously),
      -- so nothing is ever excluded on that path.
      and m.user_id is distinct from auth.uid()
  loop
    perform public.enqueue_notification(
      v_member.user_id, null, new.restaurant_id, new.id, 'NEW_ORDER',
      'Nouvelle commande',
      format('Commande #%s · %s %s', new.order_number, new.total_amount, new.currency),
      '/admin'
    );
  end loop;

  return new;
end;
$function$;
