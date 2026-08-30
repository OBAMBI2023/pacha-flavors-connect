-- Règle métier définitive : le restaurant est l'unique encaisseur, le
-- livreur ne fait plus aucun encaissement. Implémentée en réutilisant
-- exactement l'architecture déjà en place (restaurant_settings.cash_
-- collection_mode, payments.collector_type, payments.collected_by_driver_id,
-- les RPC mark_cash_payment_received / driver_confirm_cash_payment /
-- driver_advance_delivery_status) -- aucune nouvelle table, aucun second
-- système financier. Ni le sous-total, ni la réduction, ni les frais de
-- livraison, ni la commission Saovia, ni le stock ne sont touchés : cette
-- migration ne change QUI peut confirmer un encaissement cash, jamais
-- combien.

-- ---------------------------------------------------------------------------
-- 1) Bascule tous les tenants existants sur le nouveau régime, et en fait
--    le défaut pour tout nouveau tenant. La colonne reste un réglage par
--    tenant (jamais supprimée) -- 'driver'/'both' restent des valeurs
--    valides pour la contrainte existante, réservées à un usage support
--    exceptionnel via SQL direct ; aucune UI n'expose plus ce choix.
-- ---------------------------------------------------------------------------

alter table public.restaurant_settings
  alter column cash_collection_mode set default 'restaurant';

update public.restaurant_settings
  set cash_collection_mode = 'restaurant'
  where cash_collection_mode = 'driver';

-- ---------------------------------------------------------------------------
-- 2) mark_cash_payment_received: le blocage "livraison => seul le livreur"
--    (introduit par order_encaissements) est retiré. Le restaurant peut
--    désormais encaisser cash n'importe quelle commande cash_pending, quel
--    que soit fulfillment_type. collector_type = 'restaurant' est
--    maintenant renseigné (jusqu'ici seul collected_by_driver_id existait
--    pour distinguer l'acteur -- cette ligne était donc déjà implicitement
--    "restaurant" par élimination, ceci le rend explicite).
-- ---------------------------------------------------------------------------

create or replace function public.mark_cash_payment_received(p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_order record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.total_amount, o.currency, o.payment_status, o.order_number, o.fulfillment_type
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if not public.has_restaurant_access(v_order.restaurant_id) then
    raise exception 'Forbidden';
  end if;
  if v_order.payment_status != 'cash_pending' then
    raise exception 'Cette commande n''est pas en attente d''encaissement cash (statut actuel: %)', v_order.payment_status;
  end if;

  update public.orders set payment_status = 'paid', paid_at = now() where id = p_order_id;

  insert into public.payments (order_id, restaurant_id, amount, currency, method, status, created_by, paid_at, collector_type)
  values (p_order_id, v_order.restaurant_id, v_order.total_amount, v_order.currency, 'cash', 'paid', auth.uid(), now(), 'restaurant');

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'payment_status_changed',
    jsonb_build_object('from_status', 'cash_pending', 'to_status', 'paid', 'method', 'cash', 'amount', v_order.total_amount, 'collector_type', 'restaurant')
  );

  perform public.create_notification(
    v_order.restaurant_id, p_order_id, 'payment_confirmed', 'Paiement confirmé',
    format('Commande #%s · %s %s encaissés', v_order.order_number, v_order.total_amount, v_order.currency),
    jsonb_build_object('order_number', v_order.order_number, 'amount', v_order.total_amount)
  );

  return jsonb_build_object('order_id', p_order_id, 'payment_status', 'paid');
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3) driver_confirm_cash_payment: bloqué pour tout tenant en mode
--    'restaurant' (le nouveau défaut universel) -- réutilise la colonne
--    plutôt qu'un booléen câblé en dur, donc réversible pour un tenant
--    donné par un simple UPDATE support si jamais nécessaire, sans nouveau
--    déploiement de code.
-- ---------------------------------------------------------------------------

create or replace function public.driver_confirm_cash_payment(p_order_id uuid, p_amount_received numeric DEFAULT NULL::numeric)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_order record;
  v_collection_mode text;
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

  select s.cash_collection_mode into v_collection_mode
    from public.restaurant_settings s
    where s.restaurant_id = v_order.restaurant_id;

  if coalesce(v_collection_mode, 'restaurant') not in ('driver', 'both') then
    raise exception 'Les livreurs ne peuvent plus encaisser -- seul le restaurant confirme les paiements cash.';
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

  insert into public.payments (order_id, restaurant_id, amount, currency, method, status, created_by, paid_at, metadata, collected_by_driver_id, collector_type)
  values (
    p_order_id, v_order.restaurant_id, v_order.total_amount, v_order.currency, 'cash', 'paid', auth.uid(), now(),
    jsonb_build_object('collected_by_driver_id', auth.uid(), 'amount_received', p_amount_received),
    auth.uid(), 'driver'
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
$function$;

-- ---------------------------------------------------------------------------
-- 4) driver_advance_delivery_status: le passage automatique par l'étape
--    'cash_collection' à l'arrivée chez le client ne se produit plus que si
--    le tenant est explicitement en mode 'driver'/'both' -- pour tout le
--    monde en mode 'restaurant' (le défaut désormais universel), le livreur
--    va directement de 'arrived_at_customer' à 'delivered', que la commande
--    soit cash_pending ou non. Aucune autre étape du parcours livreur
--    n'est modifiée (collecte au restaurant, code de retrait, trajet...).
-- ---------------------------------------------------------------------------

create or replace function public.driver_advance_delivery_status(p_order_id uuid, p_new_status driver_delivery_status)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_order record; v_current public.driver_delivery_status; v_expected_next public.driver_delivery_status; v_title text;
  v_collection_mode text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select o.id, o.restaurant_id, o.order_number, o.status, o.assigned_driver_id, o.driver_delivery_status, o.payment_status,
         o.pickup_code, o.pickup_code_verified_at
    into v_order from public.orders o where o.id = p_order_id for update;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.assigned_driver_id is null or v_order.assigned_driver_id <> auth.uid() then raise exception 'Forbidden'; end if;
  if v_order.status in ('delivered', 'cancelled') then raise exception 'Cette commande n''est plus active'; end if;

  select s.cash_collection_mode into v_collection_mode
    from public.restaurant_settings s
    where s.restaurant_id = v_order.restaurant_id;

  v_current := coalesce(v_order.driver_delivery_status, 'assigned'::public.driver_delivery_status);
  v_expected_next := case v_current
    when 'assigned' then 'going_to_pickup'
    when 'going_to_pickup' then 'arrived_at_restaurant'
    when 'arrived_at_restaurant' then 'collecting'
    when 'collecting' then 'collected'
    when 'collected' then 'en_route'
    when 'en_route' then 'arrived_at_customer'
    when 'arrived_at_customer' then case
      when v_order.payment_status = 'cash_pending' and coalesce(v_collection_mode, 'restaurant') in ('driver', 'both')
        then 'cash_collection'::public.driver_delivery_status
      else 'delivered'::public.driver_delivery_status
    end
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
