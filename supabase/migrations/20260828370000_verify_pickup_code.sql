-- Server-side verification of the 2-digit pickup code the restaurant gives
-- the driver at handoff. Never trusts a frontend-only check. Wrong-code
-- attempts do NOT raise (a raised exception would roll back the attempts
-- increment too) -- they return {success:false} from a normal, committed
-- code path instead. Every other rejection (wrong driver, wrong tenant via
-- assigned_driver_id, cancelled/delivered order, wrong workflow moment,
-- already verified, 5+ attempts) legitimately raises since nothing needs
-- to persist in those cases.
create or replace function public.verify_pickup_code(p_order_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order record;
  v_code_clean text;
  v_new_attempts integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.order_number, o.status, o.fulfillment_type,
         o.assigned_driver_id, o.driver_delivery_status,
         o.pickup_code, o.pickup_code_verified_at, o.pickup_code_attempts
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

  if v_order.fulfillment_type <> 'delivery' or v_order.pickup_code is null then
    raise exception 'Cette commande ne nécessite pas de code de collecte';
  end if;

  if v_order.pickup_code_verified_at is not null then
    raise exception 'Code déjà vérifié pour cette commande';
  end if;

  if coalesce(v_order.driver_delivery_status, 'assigned') not in ('arrived_at_restaurant', 'collecting') then
    raise exception 'Étape invalide pour la vérification du code';
  end if;

  if coalesce(v_order.pickup_code_attempts, 0) >= 5 then
    raise exception 'Nombre maximal de tentatives atteint. Contactez le restaurant.';
  end if;

  v_code_clean := btrim(coalesce(p_code, ''));

  if v_code_clean = '' or v_code_clean <> v_order.pickup_code then
    update public.orders
      set pickup_code_attempts = coalesce(pickup_code_attempts, 0) + 1
      where id = p_order_id
      returning pickup_code_attempts into v_new_attempts;

    return jsonb_build_object(
      'success', false,
      'message', 'Code incorrect. Vérifiez le code communiqué par le restaurant.',
      'attempts_remaining', greatest(5 - v_new_attempts, 0)
    );
  end if;

  update public.orders
    set driver_delivery_status = 'collected',
        pickup_code_verified_at = now(),
        pickup_code_verified_by = auth.uid()
    where id = p_order_id;

  perform public.log_audit_event(v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'pickup_code_verified',
    jsonb_build_object('order_number', v_order.order_number));

  perform public.create_notification(
    v_order.restaurant_id, p_order_id, 'driver_delivery_status_changed', 'Commande récupérée par le livreur',
    format('Commande #%s', v_order.order_number),
    jsonb_build_object('order_number', v_order.order_number, 'driver_delivery_status', 'collected')
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Code correct. Commande collectée.',
    'order_id', p_order_id,
    'driver_delivery_status', 'collected'
  );
end;
$function$;

revoke all on function public.verify_pickup_code(uuid, text) from public, anon;
grant execute on function public.verify_pickup_code(uuid, text) to authenticated;
