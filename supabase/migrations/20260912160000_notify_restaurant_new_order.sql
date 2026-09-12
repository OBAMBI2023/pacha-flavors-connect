-- SAOVIA Food: tenant-side "nouvelle commande" alert. Extends the existing
-- generalized notification engine (20260912120000_notification_engine.sql)
-- with the one event type it didn't yet cover: a restaurant's own staff
-- being alerted when a new order lands, whether or not /admin is open.
--
-- Realtime already handles the "admin open" case end to end (see
-- useRealtimeOrders.ts / orders_select_members + the supabase_realtime
-- publication on public.orders -- confirmed working, untouched here). This
-- migration is purely the "admin closed" Web Push path, additive alongside
-- it, never a replacement for it.
--
-- Recipients are resolved entirely server-side from NEW.restaurant_id (the
-- row Postgres just inserted by create_order, never a client-supplied
-- value) joined against restaurant_memberships -- the exact same authority
-- has_restaurant_access() already uses everywhere else. No new RPC is
-- exposed: this is a trigger, never directly callable by anon/authenticated,
-- so it cannot be abused the way notify_driver_nearby(p_order_id) can (see
-- that function's own grants -- left untouched and unused here on purpose).

alter table public.notification_events drop constraint notification_events_type_check;
alter table public.notification_events add constraint notification_events_type_check
  check (type in (
    'ORDER_ACCEPTED', 'ORDER_READY', 'DRIVER_ASSIGNED', 'DRIVER_NEARBY',
    'ORDER_DELIVERED', 'ORDER_CANCELLED', 'RESTAURANT_MESSAGE', 'SYSTEM_NOTIFICATION',
    'NEW_ORDER'
  ));

create or replace function public.notify_restaurant_new_order()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_member record;
begin
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

create trigger orders_notify_restaurant_new_order
  after insert on public.orders
  for each row execute function public.notify_restaurant_new_order();
