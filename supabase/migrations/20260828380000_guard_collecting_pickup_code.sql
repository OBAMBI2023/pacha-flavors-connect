-- Closes the old tap-through path as a bypass for the new pickup code:
-- for a delivery order that actually has a pickup_code, collecting ->
-- collected can no longer complete without prior verify_pickup_code
-- success. Orders with no pickup_code (created before this feature, or
-- pickup fulfillment) are unaffected -- same signature, replaces in place.
-- No other transition in this state machine is touched.
create or replace function public.driver_advance_delivery_status(p_order_id uuid, p_new_status driver_delivery_status)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_order record; v_current public.driver_delivery_status; v_expected_next public.driver_delivery_status; v_title text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select o.id, o.restaurant_id, o.order_number, o.status, o.assigned_driver_id, o.driver_delivery_status, o.payment_status,
         o.pickup_code, o.pickup_code_verified_at
    into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.assigned_driver_id is null or v_order.assigned_driver_id <> auth.uid() then raise exception 'Forbidden'; end if;
  if v_order.status in ('delivered', 'cancelled') then raise exception 'Cette commande n''est plus active'; end if;
  v_current := coalesce(v_order.driver_delivery_status, 'assigned'::public.driver_delivery_status);
  v_expected_next := case v_current
    when 'assigned' then 'going_to_pickup'
    when 'going_to_pickup' then 'arrived_at_restaurant'
    when 'arrived_at_restaurant' then 'collecting'
    when 'collecting' then 'collected'
    when 'collected' then 'en_route'
    when 'en_route' then 'arrived_at_customer'
    when 'arrived_at_customer' then case when v_order.payment_status = 'cash_pending' then 'cash_collection'::public.driver_delivery_status else 'delivered'::public.driver_delivery_status end
    when 'payment_confirmed' then 'delivered'
    else null
  end;
  if v_expected_next is null or p_new_status is distinct from v_expected_next then
    raise exception 'Transition d''étape invalide: % -> %', v_current, p_new_status;
  end if;
  if v_current = 'collecting' and p_new_status = 'collected'
     and v_order.pickup_code is not null and v_order.pickup_code_verified_at is null then
    raise exception 'Veuillez valider le code de collecte avant de continuer';
  end if;
  update public.orders set driver_delivery_status = p_new_status where id = p_order_id;
  if p_new_status = 'delivered' then
    update public.orders set status = 'delivered', delivered_at = now() where id = p_order_id;
    insert into public.order_status_history (restaurant_id, order_id, from_status, to_status, changed_by, note)
    values (v_order.restaurant_id, p_order_id, v_order.status, 'delivered', auth.uid(), 'Livraison confirmée par le livreur');
    update public.driver_profiles set status = 'available' where id = v_order.assigned_driver_id;
  end if;
  perform public.log_audit_event(v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'driver_delivery_status_changed',
    jsonb_build_object('from_status', v_current, 'to_status', p_new_status));
  v_title := case p_new_status
    when 'arrived_at_restaurant' then 'Livreur arrivé au restaurant'
    when 'collected' then 'Commande récupérée par le livreur'
    when 'en_route' then 'Livreur en route'
    when 'arrived_at_customer' then 'Livreur arrivé chez le client'
    when 'delivered' then 'Commande livrée'
    else null
  end;
  if v_title is not null then
    perform public.create_notification(v_order.restaurant_id, p_order_id, 'driver_delivery_status_changed', v_title,
      format('Commande #%s', v_order.order_number), jsonb_build_object('order_number', v_order.order_number, 'driver_delivery_status', p_new_status));
  end if;
  return jsonb_build_object('order_id', p_order_id, 'driver_delivery_status', p_new_status);
end;
$function$;
