-- SAOVIA driver workflow additive RPCs.
-- This keeps `assign_agent_to_delivery()` super-admin only, but changes the
-- assignment lifecycle so a dispatch creates a proposal first, then the
-- partner explicitly accepts or rejects it, then advances the delivery.

create or replace function public.assign_agent_to_delivery(
  p_delivery_id uuid,
  p_agent_id uuid,
  p_role delivery_assignment_role
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_delivery record;
  v_agent record;
  v_engaged_count int;
  v_previous_agent_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select d.id, d.organization_id, d.status, d.delivery_provider, d.assigned_pickup_agent_id, d.assigned_delivery_agent_id
    into v_delivery
    from public.deliveries d
    where d.id = p_delivery_id
    for update;

  if v_delivery.id is null then
    raise exception 'Livraison introuvable';
  end if;

  if not public.is_super_admin() then
    raise exception 'Forbidden';
  end if;

  if v_delivery.delivery_provider <> 'SAOVIA' then
    raise exception 'Seules les livraisons en mode SAOVIA peuvent recevoir un agent SAOVIA';
  end if;

  if v_delivery.status in ('delivered', 'delivery_failed', 'cancelled', 'returned') then
    raise exception 'Cette livraison n''est plus active';
  end if;

  if p_role = 'pickup' then
    if v_delivery.status not in ('pending', 'assigned_pickup') then
      raise exception 'Étape invalide pour une affectation de collecte';
    end if;
  else
    if v_delivery.status not in ('picked_up', 'ready_for_delivery', 'assigned_delivery') then
      raise exception 'Étape invalide pour une affectation de livraison -- la collecte doit être terminée d''abord';
    end if;
  end if;

  select dp.id, dp.is_active, dp.status
    into v_agent
    from public.driver_profiles dp
    where dp.id = p_agent_id and dp.is_saovia_agent = true
    for update;

  if v_agent.id is null then
    raise exception 'Agent introuvable ou non éligible';
  end if;
  if not v_agent.is_active then
    raise exception 'Cet agent est désactivé';
  end if;
  if v_agent.status = 'suspended' then
    raise exception 'Cet agent est suspendu';
  end if;

  v_previous_agent_id := case p_role when 'pickup' then v_delivery.assigned_pickup_agent_id else v_delivery.assigned_delivery_agent_id end;

  select count(*) into v_engaged_count
    from public.delivery_assignments da
    join public.deliveries d2 on d2.id = da.delivery_id
    where da.agent_id = p_agent_id
      and da.status = 'accepted'
      and da.delivery_id <> p_delivery_id
      and d2.status not in ('delivered', 'delivery_failed', 'cancelled', 'returned');

  if v_engaged_count > 0 then
    raise exception 'Cet agent est déjà affecté à une autre livraison active';
  end if;

  update public.delivery_assignments
    set status = 'cancelled', updated_at = now()
    where delivery_id = p_delivery_id and role = p_role and status = 'accepted';

  update public.delivery_assignments
    set status = 'proposed', updated_at = now()
    where delivery_id = p_delivery_id and role = p_role and agent_id = p_agent_id and status in ('rejected', 'cancelled');

  insert into public.delivery_assignments (delivery_id, role, agent_id, status, performed_by)
  values (p_delivery_id, p_role, p_agent_id, 'proposed', auth.uid());

  if p_role = 'pickup' then
    update public.deliveries
      set assigned_pickup_agent_id = p_agent_id
      where id = p_delivery_id;
  else
    update public.deliveries
      set assigned_delivery_agent_id = p_agent_id
      where id = p_delivery_id;
  end if;

  perform public.log_organization_audit_event(
    v_delivery.organization_id, auth.uid(), 'delivery', p_delivery_id, 'agent_proposed',
    jsonb_build_object('agent_id', p_agent_id, 'role', p_role, 'previous_agent_id', v_previous_agent_id)
  );

  return jsonb_build_object(
    'delivery_id', p_delivery_id,
    'agent_id', p_agent_id,
    'role', p_role,
    'status', 'proposed',
    'previous_agent_id', v_previous_agent_id
  );
end;
$function$;

revoke all on function public.assign_agent_to_delivery(uuid, uuid, delivery_assignment_role) from public, anon;
grant execute on function public.assign_agent_to_delivery(uuid, uuid, delivery_assignment_role) to authenticated;

create or replace function public.driver_accept_saovia_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_assignment record;
  v_driver_id uuid;
  v_delivery record;
  v_next_status public.delivery_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select dp.id into v_driver_id
    from public.driver_profiles dp
    where dp.id = auth.uid() and dp.is_saovia_agent = true;
  if v_driver_id is null then
    raise exception 'Forbidden';
  end if;

  select da.id, da.delivery_id, da.role, da.agent_id, da.status
    into v_assignment
    from public.delivery_assignments da
    where da.id = p_assignment_id
    for update;

  if v_assignment.id is null then
    raise exception 'Affectation introuvable';
  end if;
  if v_assignment.agent_id <> v_driver_id then
    raise exception 'Forbidden';
  end if;
  if v_assignment.status <> 'proposed' then
    raise exception 'Cette affectation n''est plus proposée';
  end if;

  select d.id, d.organization_id, d.status, d.delivery_provider, d.assigned_pickup_agent_id, d.assigned_delivery_agent_id
    into v_delivery
    from public.deliveries d
    where d.id = v_assignment.delivery_id
    for update;

  if v_delivery.id is null then
    raise exception 'Livraison introuvable';
  end if;
  if v_delivery.delivery_provider <> 'SAOVIA' then
    raise exception 'Seules les livraisons en mode SAOVIA peuvent être acceptées';
  end if;
  if v_delivery.status in ('delivered', 'delivery_failed', 'cancelled', 'returned') then
    raise exception 'Cette livraison n''est plus active';
  end if;

  if v_assignment.role = 'pickup' then
    if v_delivery.status not in ('pending', 'assigned_pickup') then
      raise exception 'Transition de collecte invalide';
    end if;
    v_next_status := 'assigned_pickup';
  else
    if v_delivery.status not in ('picked_up', 'ready_for_delivery', 'assigned_delivery') then
      raise exception 'Transition de livraison invalide';
    end if;
    v_next_status := 'assigned_delivery';
  end if;

  if exists (
    select 1
    from public.delivery_assignments da
    where da.delivery_id = v_assignment.delivery_id
      and da.role = v_assignment.role
      and da.status = 'accepted'
      and da.id <> p_assignment_id
  ) then
    raise exception 'Cette affectation a déjà été acceptée';
  end if;

  update public.delivery_assignments
    set status = 'accepted', updated_at = now()
    where id = p_assignment_id;

  update public.deliveries
    set status = v_next_status,
        assigned_pickup_agent_id = case when v_assignment.role = 'pickup' then v_driver_id else assigned_pickup_agent_id end,
        assigned_delivery_agent_id = case when v_assignment.role = 'delivery' then v_driver_id else assigned_delivery_agent_id end
    where id = v_assignment.delivery_id;

  perform public.log_organization_audit_event(
    v_delivery.organization_id, auth.uid(), 'delivery_assignment', p_assignment_id, 'assignment_accepted',
    jsonb_build_object('delivery_id', v_assignment.delivery_id, 'role', v_assignment.role)
  );

  return jsonb_build_object(
    'assignment_id', p_assignment_id,
    'delivery_id', v_assignment.delivery_id,
    'status', 'accepted',
    'delivery_status', v_next_status,
    'role', v_assignment.role
  );
end;
$function$;

revoke all on function public.driver_accept_saovia_assignment(uuid) from public, anon;
grant execute on function public.driver_accept_saovia_assignment(uuid) to authenticated;

create or replace function public.driver_reject_saovia_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_assignment record;
  v_driver_id uuid;
  v_delivery record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select dp.id into v_driver_id
    from public.driver_profiles dp
    where dp.id = auth.uid() and dp.is_saovia_agent = true;
  if v_driver_id is null then
    raise exception 'Forbidden';
  end if;

  select da.id, da.delivery_id, da.role, da.agent_id, da.status
    into v_assignment
    from public.delivery_assignments da
    where da.id = p_assignment_id
    for update;

  if v_assignment.id is null then
    raise exception 'Affectation introuvable';
  end if;
  if v_assignment.agent_id <> v_driver_id then
    raise exception 'Forbidden';
  end if;
  if v_assignment.status <> 'proposed' then
    raise exception 'Cette affectation n''est plus proposée';
  end if;

  select d.id, d.organization_id, d.status, d.delivery_provider
    into v_delivery
    from public.deliveries d
    where d.id = v_assignment.delivery_id
    for update;

  if v_delivery.id is null then
    raise exception 'Livraison introuvable';
  end if;
  if v_delivery.delivery_provider <> 'SAOVIA' then
    raise exception 'Seules les livraisons en mode SAOVIA peuvent être refusées';
  end if;
  if v_delivery.status in ('delivered', 'delivery_failed', 'cancelled', 'returned') then
    raise exception 'Cette livraison n''est plus active';
  end if;

  update public.delivery_assignments
    set status = 'rejected', updated_at = now()
    where id = p_assignment_id;

  if v_assignment.role = 'pickup' then
    if v_delivery.assigned_pickup_agent_id = v_driver_id then
      update public.deliveries set assigned_pickup_agent_id = null where id = v_assignment.delivery_id;
    end if;
  else
    if v_delivery.assigned_delivery_agent_id = v_driver_id then
      update public.deliveries set assigned_delivery_agent_id = null where id = v_assignment.delivery_id;
    end if;
  end if;

  perform public.log_organization_audit_event(
    v_delivery.organization_id, auth.uid(), 'delivery_assignment', p_assignment_id, 'assignment_rejected',
    jsonb_build_object('delivery_id', v_assignment.delivery_id, 'role', v_assignment.role)
  );

  return jsonb_build_object(
    'assignment_id', p_assignment_id,
    'delivery_id', v_assignment.delivery_id,
    'status', 'rejected',
    'role', v_assignment.role
  );
end;
$function$;

revoke all on function public.driver_reject_saovia_assignment(uuid) from public, anon;
grant execute on function public.driver_reject_saovia_assignment(uuid) to authenticated;

create or replace function public.driver_advance_saovia_delivery(p_assignment_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_assignment record;
  v_driver_id uuid;
  v_delivery record;
  v_next_status public.delivery_status;
  v_completed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select dp.id into v_driver_id
    from public.driver_profiles dp
    where dp.id = auth.uid() and dp.is_saovia_agent = true;
  if v_driver_id is null then
    raise exception 'Forbidden';
  end if;

  select da.id, da.delivery_id, da.role, da.agent_id, da.status
    into v_assignment
    from public.delivery_assignments da
    where da.id = p_assignment_id
    for update;

  if v_assignment.id is null then
    raise exception 'Affectation introuvable';
  end if;
  if v_assignment.agent_id <> v_driver_id then
    raise exception 'Forbidden';
  end if;
  if v_assignment.status <> 'accepted' then
    raise exception 'Cette affectation n''est pas active';
  end if;

  select d.id, d.organization_id, d.status, d.delivery_provider
    into v_delivery
    from public.deliveries d
    where d.id = v_assignment.delivery_id
    for update;

  if v_delivery.id is null then
    raise exception 'Livraison introuvable';
  end if;
  if v_delivery.delivery_provider <> 'SAOVIA' then
    raise exception 'Seules les livraisons en mode SAOVIA peuvent évoluer';
  end if;
  if v_delivery.status in ('delivered', 'delivery_failed', 'cancelled', 'returned') then
    raise exception 'Cette livraison n''est plus active';
  end if;

  if v_assignment.role = 'pickup' then
    if p_action <> 'confirm_pickup' then
      raise exception 'Action invalide pour une collecte';
    end if;
    if v_delivery.status not in ('assigned_pickup', 'pending_pickup') then
      raise exception 'Transition de collecte invalide';
    end if;
    v_next_status := 'picked_up';
    v_completed := true;
  else
    if p_action = 'start_delivery' then
      if v_delivery.status not in ('assigned_delivery', 'ready_for_delivery') then
        raise exception 'Transition de livraison invalide';
      end if;
      v_next_status := 'in_transit';
    elsif p_action = 'confirm_delivery' then
      if v_delivery.status <> 'in_transit' then
        raise exception 'Transition de livraison invalide';
      end if;
      v_next_status := 'delivered';
      v_completed := true;
    else
      raise exception 'Action invalide';
    end if;
  end if;

  update public.deliveries
    set status = v_next_status
    where id = v_assignment.delivery_id;

  -- Both terminal points of a single-assignment lifecycle: pickup ends at
  -- picked_up (a separate delivery assignment, if any, is dispatched
  -- afterwards by SAOVIA -- see assign_agent_to_delivery()), delivery ends
  -- at delivered. Neither role's assignment may remain 'accepted' once its
  -- own leg is done, or it reads as an active mission / blocks re-dispatch.
  if v_completed then
    update public.delivery_assignments
      set status = 'completed', updated_at = now()
      where id = p_assignment_id;
  end if;

  if v_next_status in ('picked_up', 'in_transit', 'delivered') then
    insert into public.delivery_status_history (delivery_id, from_status, to_status, changed_by, note)
    values (v_assignment.delivery_id, v_delivery.status, v_next_status, auth.uid(), p_action);
  end if;

  perform public.log_organization_audit_event(
    v_delivery.organization_id, auth.uid(), 'delivery', v_assignment.delivery_id, case
      when v_next_status = 'picked_up' then 'pickup_confirmed'
      when v_next_status = 'in_transit' then 'delivery_started'
      else 'delivery_completed'
    end,
    jsonb_build_object('assignment_id', p_assignment_id, 'role', v_assignment.role, 'action', p_action, 'to_status', v_next_status)
  );

  return jsonb_build_object(
    'assignment_id', p_assignment_id,
    'delivery_id', v_assignment.delivery_id,
    'delivery_status', v_next_status,
    'assignment_status', case when v_completed then 'completed' else 'accepted' end,
    'role', v_assignment.role,
    'action', p_action
  );
end;
$function$;

revoke all on function public.driver_advance_saovia_delivery(uuid, text) from public, anon;
grant execute on function public.driver_advance_saovia_delivery(uuid, text) to authenticated;
