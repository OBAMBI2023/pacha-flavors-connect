-- Manual driver assignment, deliberately separate from the propose/accept
-- automatic-dispatch flow (dispatch_find_and_propose_driver /
-- driver_respond_to_proposal), which is untouched. Writes the exact same
-- orders/driver_profiles columns driver_respond_to_proposal's accept branch
-- already does, so the driver's existing realtime subscription in
-- livreur.tsx (watching orders UPDATE on assigned_driver_id) picks this up
-- with zero changes to the driver app -- this is how "notify the driver" is
-- satisfied without a push pipeline (none exists yet in this codebase).
-- Handles both first assignment and reassignment in one function.
create or replace function public.assign_driver_to_order(p_order_id uuid, p_driver_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order record;
  v_driver record;
  v_previous_driver_id uuid;
  v_cancelled_proposal_driver_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.fulfillment_type, o.status, o.assigned_driver_id
    into v_order
    from public.orders o
    where o.id = p_order_id
    for update;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if not public.has_restaurant_access(v_order.restaurant_id) then
    raise exception 'Forbidden';
  end if;
  if v_order.fulfillment_type <> 'delivery' then
    raise exception 'Cette commande n''est pas une livraison';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'Cette commande n''est plus active';
  end if;

  -- Tenant isolation: the driver must belong to this order's own
  -- restaurant_id, or it's structurally unfindable -- a cross-tenant driver
  -- id can never resolve here, same guarantee resolve_promo_code already
  -- gives for promo codes.
  select dp.id, dp.is_active, dp.status
    into v_driver
    from public.driver_profiles dp
    where dp.id = p_driver_id and dp.restaurant_id = v_order.restaurant_id
    for update;

  if v_driver.id is null then
    raise exception 'Livreur introuvable pour ce restaurant';
  end if;
  if not v_driver.is_active then
    raise exception 'Ce livreur est désactivé';
  end if;
  if v_driver.status = 'suspended' then
    raise exception 'Ce livreur est suspendu';
  end if;

  v_previous_driver_id := v_order.assigned_driver_id;

  -- Cancel any pending auto-dispatch proposal for this order so a stale
  -- proposal can't still be accepted after this manual override.
  select p.driver_id into v_cancelled_proposal_driver_id
    from public.delivery_proposals p
    where p.order_id = p_order_id and p.status = 'pending'
    for update;

  if v_cancelled_proposal_driver_id is not null then
    update public.delivery_proposals set status = 'cancelled', responded_at = now()
      where order_id = p_order_id and status = 'pending';
    update public.driver_profiles set status = 'available'
      where id = v_cancelled_proposal_driver_id and status = 'proposed';
  end if;

  -- Reassignment: free the previously assigned driver.
  if v_previous_driver_id is not null and v_previous_driver_id <> p_driver_id then
    update public.driver_profiles set status = 'available' where id = v_previous_driver_id;
  end if;

  update public.orders
    set assigned_driver_id = p_driver_id, delivery_dispatch_status = 'assigned', driver_delivery_status = 'assigned'
    where id = p_order_id;

  update public.driver_profiles set status = 'delivering' where id = p_driver_id;

  insert into public.driver_assignment_history (restaurant_id, order_id, previous_driver_id, new_driver_id, assignment_type, performed_by)
  values (v_order.restaurant_id, p_order_id, v_previous_driver_id, p_driver_id, 'manual', auth.uid());

  perform public.create_notification(
    v_order.restaurant_id, p_order_id, 'driver_assigned_manual',
    case when v_previous_driver_id is null then 'Livreur assigné manuellement' else 'Livreur réassigné' end,
    (select full_name from public.driver_profiles where id = p_driver_id)
  );

  return jsonb_build_object('order_id', p_order_id, 'driver_id', p_driver_id, 'previous_driver_id', v_previous_driver_id);
end;
$function$;

grant execute on function public.assign_driver_to_order(uuid, uuid) to authenticated;
