-- SAOVIA Delivery -- assign_agent_to_delivery. Same overall shape as
-- assign_driver_to_order (lock primary entity -> permission check ->
-- business guards -> lock actor -> mutate -> historize -> audit -> notify),
-- adapted for a cross-organization SAOVIA agent pool instead of a
-- restaurant-owned driver.
--
-- Two corrections from review, both load-bearing:
--
-- 1. driver_profiles.status is never written here. "Affecté" (responsible
--    for this delivery) is not the same fact as "en train de livrer"
--    (physically in transit) -- the existing 'delivering' value is reserved
--    for that later, real operational state (set by the driver-side RPCs
--    once they're extended to SAOVIA agents in a later phase). 'busy' was
--    considered and rejected: it's a currently dead enum value with no
--    reader anywhere in the codebase, so repurposing it here would invent
--    semantics nothing else agrees on. "Already engaged" is instead
--    derived from delivery_assignments itself (an accepted, non-terminal
--    assignment row is the single source of truth for occupancy) --
--    zero new state to keep in sync, and it naturally supports the same
--    agent holding both pickup and delivery roles on one delivery without
--    special-casing.
--
-- 2. The engagement check only runs AFTER driver_profiles is locked
--    (`for update`), never before. Two concurrent calls targeting the same
--    agent serialize on that row lock: the second call's SELECT against
--    delivery_assignments only executes once it has acquired the lock,
--    which under READ COMMITTED only happens after the first call's
--    transaction has committed (or rolled back) and released it -- so the
--    second call's read is guaranteed to see the first call's outcome.
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
  v_new_status public.delivery_status;
  v_restaurant_id uuid;
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

  if not public.has_organization_access(v_delivery.organization_id) then
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

  -- Lock the agent BEFORE any availability decision -- correction 2.
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

  -- Evaluated only now that the agent row is locked. Any accepted,
  -- non-terminal assignment on a DIFFERENT delivery blocks; assignments on
  -- THIS delivery (same slot being reconfirmed, or the other role already
  -- held by the same agent) never conflict.
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

  insert into public.delivery_assignments (delivery_id, role, agent_id, status, performed_by)
  values (p_delivery_id, p_role, p_agent_id, 'accepted', auth.uid());

  if p_role = 'pickup' then
    v_new_status := case when v_delivery.status = 'pending' then 'assigned_pickup'::public.delivery_status else v_delivery.status end;
    update public.deliveries set assigned_pickup_agent_id = p_agent_id, status = v_new_status where id = p_delivery_id;
  else
    v_new_status := case when v_delivery.status in ('picked_up', 'ready_for_delivery') then 'assigned_delivery'::public.delivery_status else v_delivery.status end;
    update public.deliveries set assigned_delivery_agent_id = p_agent_id, status = v_new_status where id = p_delivery_id;
  end if;

  perform public.log_organization_audit_event(
    v_delivery.organization_id, auth.uid(), 'delivery', p_delivery_id, 'agent_assigned',
    jsonb_build_object('agent_id', p_agent_id, 'role', p_role, 'previous_agent_id', v_previous_agent_id)
  );

  -- order_id is always null: deliveries.order_id is plain text, not an
  -- orders(id) FK, and notifications.order_id requires a real orders row
  -- when non-null. Skipped entirely for organizations with no restaurant --
  -- documented technical debt, validated in the prior audit, not fixed here.
  select restaurant_id into v_restaurant_id from public.organizations where id = v_delivery.organization_id;
  if v_restaurant_id is not null then
    perform public.create_notification(
      v_restaurant_id, null, 'delivery_agent_assigned',
      case when p_role = 'pickup' then 'Agent de collecte affecté' else 'Livreur affecté' end,
      (select full_name from public.driver_profiles where id = p_agent_id)
    );
  end if;

  return jsonb_build_object(
    'delivery_id', p_delivery_id,
    'agent_id', p_agent_id,
    'role', p_role,
    'status', v_new_status,
    'previous_agent_id', v_previous_agent_id
  );
end;
$function$;

revoke all on function public.assign_agent_to_delivery(uuid, uuid, delivery_assignment_role) from public, anon;
grant execute on function public.assign_agent_to_delivery(uuid, uuid, delivery_assignment_role) to authenticated;
