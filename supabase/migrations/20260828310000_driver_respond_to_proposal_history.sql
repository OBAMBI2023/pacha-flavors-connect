-- Same current body as live, with one addition to the accept branch: log a
-- driver_assignment_history row (assignment_type = 'automatic') so the new
-- delivery-history filter (Automatique/Manuelle) has data for both paths.
-- No parameter-list change, so this replaces in place. No change to the
-- proposal/accept/reject algorithm itself.
create or replace function public.driver_respond_to_proposal(p_proposal_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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

  insert into public.driver_assignment_history (restaurant_id, order_id, previous_driver_id, new_driver_id, assignment_type, performed_by)
  values (v_proposal.restaurant_id, v_proposal.order_id, null, v_proposal.driver_id, 'automatic', null);

  perform public.create_notification(
    v_proposal.restaurant_id, v_proposal.order_id, 'driver_assigned',
    'Livreur assigné',
    (select full_name from public.driver_profiles where id = v_proposal.driver_id) || ' a accepté la livraison.'
  );

  return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'accepted', 'order_id', v_proposal.order_id);
end;
$function$;
