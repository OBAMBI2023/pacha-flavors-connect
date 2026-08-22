-- Phase 7d "Driver delivery workflow": fine-grained, driver-owned delivery
-- steps (pickup -> en route -> cash collection -> delivered), independent
-- of `orders.status` (the tenant-kitchen-oriented state machine driven by
-- update_order_status). A driver may physically be en route long before a
-- tenant clicks "out_for_delivery", so the driver's own progress lives in a
-- separate nullable column, written only by the two SECURITY DEFINER RPCs
-- below -- exactly the same pattern already used for `delivery_dispatch_status`,
-- a second independent status column already living on `orders`.

create type public.driver_delivery_status as enum (
  'assigned', 'going_to_pickup', 'arrived_at_restaurant', 'collecting', 'collected',
  'en_route', 'arrived_at_customer', 'cash_collection', 'payment_confirmed', 'delivered'
);

alter table public.orders add column driver_delivery_status public.driver_delivery_status null;

-- ---------------------------------------------------------------------------
-- driver_advance_delivery_status: the only way the driver-owned steps ever
-- move forward. Strict single-next-step transition table -- no skipping.
-- The terminal step ('delivered') also flips `orders.status` directly,
-- bypassing update_order_status's tenant-kitchen v_allowed gate: the
-- driver's physical completion is authoritative regardless of whether the
-- tenant ever clicked through ready/out_for_delivery, but still applies the
-- same side effects update_order_status already does for 'delivered'
-- (timestamp, free the driver, audit log, tenant notification, history row).
-- ---------------------------------------------------------------------------
create or replace function public.driver_advance_delivery_status(p_order_id uuid, p_new_status public.driver_delivery_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_current public.driver_delivery_status;
  v_expected_next public.driver_delivery_status;
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.order_number, o.status, o.assigned_driver_id, o.driver_delivery_status, o.payment_status
    into v_order
    from public.orders o
    where o.id = p_order_id
    for update;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if v_order.assigned_driver_id is null or v_order.assigned_driver_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'Cette commande n''est plus active';
  end if;

  v_current := coalesce(v_order.driver_delivery_status, 'assigned'::public.driver_delivery_status);

  v_expected_next := case v_current
    when 'assigned' then 'going_to_pickup'
    when 'going_to_pickup' then 'arrived_at_restaurant'
    when 'arrived_at_restaurant' then 'collecting'
    when 'collecting' then 'collected'
    when 'collected' then 'en_route'
    when 'en_route' then 'arrived_at_customer'
    when 'arrived_at_customer' then
      case when v_order.payment_status = 'cash_pending' then 'cash_collection'::public.driver_delivery_status
           else 'delivered'::public.driver_delivery_status end
    when 'payment_confirmed' then 'delivered'
    else null
  end;

  if v_expected_next is null or p_new_status is distinct from v_expected_next then
    raise exception 'Transition d''étape invalide: % -> %', v_current, p_new_status;
  end if;

  update public.orders set driver_delivery_status = p_new_status where id = p_order_id;

  if p_new_status = 'delivered' then
    update public.orders set status = 'delivered', delivered_at = now() where id = p_order_id;

    insert into public.order_status_history (restaurant_id, order_id, from_status, to_status, changed_by, note)
    values (v_order.restaurant_id, p_order_id, v_order.status, 'delivered', auth.uid(), 'Livraison confirmée par le livreur');

    update public.driver_profiles set status = 'available' where id = v_order.assigned_driver_id;
  end if;

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'driver_delivery_status_changed',
    jsonb_build_object('from_status', v_current, 'to_status', p_new_status)
  );

  v_title := case p_new_status
    when 'arrived_at_restaurant' then 'Livreur arrivé au restaurant'
    when 'collected' then 'Commande récupérée par le livreur'
    when 'en_route' then 'Livreur en route'
    when 'arrived_at_customer' then 'Livreur arrivé chez le client'
    when 'delivered' then 'Commande livrée'
    else null
  end;
  if v_title is not null then
    perform public.create_notification(
      v_order.restaurant_id, p_order_id, 'driver_delivery_status_changed', v_title,
      format('Commande #%s', v_order.order_number),
      jsonb_build_object('order_number', v_order.order_number, 'driver_delivery_status', p_new_status)
    );
  end if;

  return jsonb_build_object('order_id', p_order_id, 'driver_delivery_status', p_new_status);
end;
$$;

revoke all on function public.driver_advance_delivery_status(uuid, public.driver_delivery_status) from public, anon;
grant execute on function public.driver_advance_delivery_status(uuid, public.driver_delivery_status) to authenticated;

-- ---------------------------------------------------------------------------
-- driver_confirm_cash_payment: the only client-callable path from
-- cash_pending -> paid for the assigned driver (mirrors the existing
-- tenant-side mark_cash_payment_received -- same payments insert shape,
-- same notification type/copy). The amount charged always comes from
-- `orders.total_amount`, never from the caller -- p_amount_received is kept
-- only as audit metadata for the change-due calculation, so a driver can
-- never alter what's actually recorded as paid.
-- ---------------------------------------------------------------------------
create or replace function public.driver_confirm_cash_payment(p_order_id uuid, p_amount_received numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.order_number, o.status, o.assigned_driver_id, o.driver_delivery_status,
         o.payment_status, o.total_amount, o.currency
    into v_order
    from public.orders o
    where o.id = p_order_id
    for update;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if v_order.assigned_driver_id is null or v_order.assigned_driver_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'Cette commande n''est plus active';
  end if;
  if v_order.driver_delivery_status is distinct from 'cash_collection' then
    raise exception 'Cette commande n''est pas à l''étape d''encaissement (étape actuelle: %)', v_order.driver_delivery_status;
  end if;
  if v_order.payment_status != 'cash_pending' then
    raise exception 'Cette commande n''est pas en attente d''encaissement cash (statut actuel: %)', v_order.payment_status;
  end if;

  update public.orders
    set payment_status = 'paid', paid_at = now(), driver_delivery_status = 'payment_confirmed'
    where id = p_order_id;

  insert into public.payments (order_id, restaurant_id, amount, currency, method, status, created_by, paid_at, metadata)
  values (
    p_order_id, v_order.restaurant_id, v_order.total_amount, v_order.currency, 'cash', 'paid', auth.uid(), now(),
    jsonb_build_object('collected_by_driver_id', auth.uid(), 'amount_received', p_amount_received)
  );

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'payment_status_changed',
    jsonb_build_object(
      'from_status', 'cash_pending', 'to_status', 'paid', 'method', 'cash', 'amount', v_order.total_amount,
      'collected_by_driver_id', auth.uid(), 'amount_received', p_amount_received
    )
  );

  perform public.create_notification(
    v_order.restaurant_id, p_order_id, 'payment_confirmed', 'Paiement confirmé',
    format('Commande #%s · %s %s encaissés par le livreur', v_order.order_number, v_order.total_amount, v_order.currency),
    jsonb_build_object('order_number', v_order.order_number, 'amount', v_order.total_amount, 'collected_by_driver', true)
  );

  return jsonb_build_object('order_id', p_order_id, 'payment_status', 'paid', 'driver_delivery_status', 'payment_confirmed');
end;
$$;

revoke all on function public.driver_confirm_cash_payment(uuid, numeric) from public, anon;
grant execute on function public.driver_confirm_cash_payment(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- driver_report_delivery_issue: "Signaler un problème de paiement" -- purely
-- an audit/notification event, no state mutation, so it can't be used to
-- bypass or fake anything. The tenant resolves manually via existing tools.
-- ---------------------------------------------------------------------------
create or replace function public.driver_report_delivery_issue(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.order_number, o.assigned_driver_id
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if v_order.assigned_driver_id is null or v_order.assigned_driver_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'driver_reported_issue',
    jsonb_build_object('reason', p_reason)
  );

  perform public.create_notification(
    v_order.restaurant_id, p_order_id, 'driver_issue_reported', 'Problème signalé par le livreur',
    p_reason, jsonb_build_object('order_number', v_order.order_number)
  );
end;
$$;

revoke all on function public.driver_report_delivery_issue(uuid, text) from public, anon;
grant execute on function public.driver_report_delivery_issue(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Curated driver reads: additive fields only, same curation policy as before
-- (never leak more than the driver app actually needs).
-- ---------------------------------------------------------------------------
create or replace function public.get_driver_pending_proposal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select p.id, p.order_id, p.distance_km, p.expires_at, p.restaurant_id, o.order_number, o.total_amount, o.currency
    into v_proposal
    from public.delivery_proposals p
    join public.orders o on o.id = p.order_id
    where p.driver_id = auth.uid()
      and p.status = 'pending'
    order by p.sent_at desc
    limit 1;

  if v_proposal.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'order_id', v_proposal.order_id,
    'order_number', v_proposal.order_number,
    'restaurant_name', (select name from public.restaurants where id = v_proposal.restaurant_id),
    'distance_km', v_proposal.distance_km,
    'expires_at', v_proposal.expires_at,
    'total_amount', v_proposal.total_amount,
    'currency', v_proposal.currency
  );
end;
$$;

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
         o.fulfillment_type, o.total_amount, o.currency, o.status, o.restaurant_id,
         o.driver_delivery_status, o.payment_status, o.payment_method
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
    'items', v_items,
    'driver_delivery_status', v_order.driver_delivery_status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer-facing read: status value only, no restaurant/driver internals.
-- ---------------------------------------------------------------------------
create or replace function public.get_customer_order(p_order_id uuid, p_customer_phone text)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  select jsonb_build_object(
    'id', ord.id,
    'order_number', ord.order_number,
    'status', ord.status,
    'fulfillment_type', ord.fulfillment_type,
    'customer_name', ord.customer_name,
    'customer_phone', ord.customer_phone,
    'delivery_address', ord.delivery_address,
    'delivery_instructions', ord.delivery_instructions,
    'currency', ord.currency,
    'subtotal_amount', ord.subtotal_amount,
    'total_amount', ord.total_amount,
    'created_at', ord.created_at,
    'driver_delivery_status', ord.driver_delivery_status,
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug),
    'items', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name_snapshot,
          'unit_price', oi.unit_price_snapshot,
          'quantity', oi.quantity,
          'line_total', oi.line_total
        ) order by oi.created_at asc
      ), '[]'::jsonb)
      from public.order_items oi
      where oi.order_id = ord.id
    )
  )
  from public.orders ord
  join public.restaurants r on r.id = ord.restaurant_id
  where ord.id = p_order_id
    and ord.customer_phone = p_customer_phone;
$$;

-- ---------------------------------------------------------------------------
-- driver_respond_to_proposal: stamp driver_delivery_status='assigned'
-- explicitly on accept, so the column never has to be treated as an
-- implicit "null-with-a-driver means assigned" baseline by every consumer.
-- Everything else in this function is unchanged.
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
  update public.orders
    set assigned_driver_id = v_proposal.driver_id, delivery_dispatch_status = 'assigned', driver_delivery_status = 'assigned'
    where id = v_proposal.order_id;
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
-- update_order_status: one-line guard closing the loophole that let a
-- driver mark 'delivered' directly through the generic tenant-status RPC,
-- bypassing the new step workflow and cash-collection gate entirely.
-- 'delivered' is now reachable by a driver only via
-- driver_advance_delivery_status. Everything else in this function
-- (v_allowed state machine, dispatch trigger on confirmed, cancel-branch
-- driver release) is byte-for-byte unchanged.
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
    or (auth.uid() = v_order.assigned_driver_id and p_new_status = 'out_for_delivery')
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
