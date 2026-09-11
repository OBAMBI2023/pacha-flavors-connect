-- Encaissements des commandes: separates the restaurant's product revenue
-- from the delivery fee and the (currently unused) Saovia commission, and
-- closes a gap where a restaurant staff member could mark a delivery
-- order's cash payment (product + delivery fee) as received on the
-- driver's behalf. No new payments architecture: this extends the existing
-- append-only `payments` ledger and the existing mark_cash_payment_received
-- / driver_confirm_cash_payment RPCs additively, exactly like every prior
-- phase in this schema.

-- ---------------------------------------------------------------------------
-- 1) Saovia commission: per-restaurant rate, Super Admin-only. Defaults to 0
--    (no commission charged) until a Super Admin explicitly sets one -- there
--    was no commission configuration anywhere in this schema before this
--    migration (Saovia currently monetizes via flat subscription plans).
-- ---------------------------------------------------------------------------

alter table public.restaurant_settings
  add column commission_rate numeric not null default 0
    check (commission_rate >= 0 and commission_rate <= 1);

-- restaurant_settings is otherwise updated by a plain client-side .update()
-- from the restaurant's own owner/manager (see restaurantSettings.ts) -- that
-- path never sends commission_rate today, but this guard makes it impossible
-- even if it did: only a Super Admin (or the RPC below, itself Super
-- Admin-gated) may ever change this column.
create or replace function public.trg_guard_commission_rate() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.commission_rate is distinct from old.commission_rate and not public.is_super_admin() then
    raise exception 'Seul le Super Admin peut modifier le taux de commission';
  end if;
  return new;
end;
$$;

create trigger restaurant_settings_guard_commission_rate before update on public.restaurant_settings
  for each row execute function public.trg_guard_commission_rate();

create or replace function public.set_restaurant_commission_rate(p_restaurant_id uuid, p_rate numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 1 then
    raise exception 'Taux de commission invalide (doit être entre 0 et 1)';
  end if;

  update public.restaurant_settings set commission_rate = p_rate where restaurant_id = p_restaurant_id;
  if not found then
    raise exception 'Réglages introuvables pour ce restaurant';
  end if;

  perform public.log_audit_event(
    p_restaurant_id, auth.uid(), 'restaurant_settings', p_restaurant_id, 'commission_rate_changed',
    jsonb_build_object('new_rate', p_rate)
  );

  return jsonb_build_object('restaurant_id', p_restaurant_id, 'commission_rate', p_rate);
end;
$$;

revoke all on function public.set_restaurant_commission_rate(uuid, numeric) from public, anon;
grant execute on function public.set_restaurant_commission_rate(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) payments: identify which rows a driver personally collected, so a
--    driver can read their own collection history under RLS. Today
--    `payments` grants select only via has_restaurant_access (restaurant
--    staff) -- a driver has no access at all, even to payments they
--    themselves collected via driver_confirm_cash_payment (that RPC only
--    ever recorded the collecting driver inside opaque `metadata`).
-- ---------------------------------------------------------------------------

alter table public.payments
  add column collected_by_driver_id uuid null references public.driver_profiles(id) on delete set null;

create index payments_collected_by_driver_id_idx on public.payments (collected_by_driver_id, created_at desc);

create policy payments_select_own_driver_collections on public.payments
  for select using (collected_by_driver_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) mark_cash_payment_received: restaurant-side cash confirmation is now
--    restricted to pickup orders. A delivery order's cash is physically
--    collected by the assigned driver, never by restaurant staff -- so the
--    restaurant must never be able to encaisser it (that flow already exists
--    and stays exclusively on driver_confirm_cash_payment below). Everything
--    else in this function is unchanged from Phase 4.
-- ---------------------------------------------------------------------------

create or replace function public.mark_cash_payment_received(p_order_id uuid)
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
  if v_order.fulfillment_type = 'delivery' then
    raise exception 'Cette commande est en livraison : seul le livreur assigné peut confirmer cet encaissement.';
  end if;
  if v_order.payment_status != 'cash_pending' then
    raise exception 'Cette commande n''est pas en attente d''encaissement cash (statut actuel: %)', v_order.payment_status;
  end if;

  update public.orders set payment_status = 'paid', paid_at = now() where id = p_order_id;

  insert into public.payments (order_id, restaurant_id, amount, currency, method, status, created_by, paid_at)
  values (p_order_id, v_order.restaurant_id, v_order.total_amount, v_order.currency, 'cash', 'paid', auth.uid(), now());

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'payment_status_changed',
    jsonb_build_object('from_status', 'cash_pending', 'to_status', 'paid', 'method', 'cash', 'amount', v_order.total_amount)
  );

  perform public.create_notification(
    v_order.restaurant_id, p_order_id, 'payment_confirmed', 'Paiement confirmé',
    format('Commande #%s · %s %s encaissés', v_order.order_number, v_order.total_amount, v_order.currency),
    jsonb_build_object('order_number', v_order.order_number, 'amount', v_order.total_amount)
  );

  return jsonb_build_object('order_id', p_order_id, 'payment_status', 'paid');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) driver_confirm_cash_payment: now also stamps the real
--    collected_by_driver_id column (in addition to the existing metadata
--    field, kept for the amount_received audit trail) so the driver can read
--    this row back via the new RLS policy above.
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

  insert into public.payments (order_id, restaurant_id, amount, currency, method, status, created_by, paid_at, metadata, collected_by_driver_id)
  values (
    p_order_id, v_order.restaurant_id, v_order.total_amount, v_order.currency, 'cash', 'paid', auth.uid(), now(),
    jsonb_build_object('collected_by_driver_id', auth.uid(), 'amount_received', p_amount_received),
    auth.uid()
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

-- ---------------------------------------------------------------------------
-- 5) get_driver_active_delivery: additive field so the driver's cash-
--    collection screen can show the delivery-fee/product split of what
--    they're about to collect, without a second round trip.
-- ---------------------------------------------------------------------------

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
         o.fulfillment_type, o.total_amount, o.delivery_fee_amount, o.currency, o.status, o.restaurant_id,
         o.driver_delivery_status, o.payment_status, o.payment_method,
         o.is_for_someone_else, o.recipient_name, o.recipient_phone,
         o.delivery_landmark, o.delivery_neighborhood, o.delivery_instructions, o.driver_note,
         o.allergy_information, o.delivery_distance_km
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
    'delivery_fee_amount', v_order.delivery_fee_amount,
    'currency', v_order.currency,
    'status', v_order.status,
    'restaurant_name', (select name from public.restaurants where id = v_order.restaurant_id),
    'items', v_items,
    'driver_delivery_status', v_order.driver_delivery_status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'is_for_someone_else', v_order.is_for_someone_else,
    'recipient_name', v_order.recipient_name,
    'recipient_phone', v_order.recipient_phone,
    'delivery_landmark', v_order.delivery_landmark,
    'delivery_neighborhood', v_order.delivery_neighborhood,
    'delivery_instructions', v_order.delivery_instructions,
    'driver_note', v_order.driver_note,
    'allergy_information', v_order.allergy_information,
    'delivery_distance_km', v_order.delivery_distance_km
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) get_order_financial_breakdown: server-computed financial detail for one
--    order, restaurant-staff only (mirrors fetchOrderDetail's own security
--    boundary). restaurant_total/saovia_commission/restaurant_net are never
--    stored -- they're cheap, always-consistent derivations of columns
--    create_order/validate_promo_code already compute authoritatively
--    (restaurant_total = subtotal_amount - discount_amount, matching the
--    exact arithmetic create_order uses for total_amount). Amounts are
--    rounded to whole XOF, never left fractional.
-- ---------------------------------------------------------------------------

create or replace function public.get_order_financial_breakdown(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_commission_rate numeric;
  v_restaurant_total numeric;
  v_saovia_commission numeric;
  v_payments jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.currency, o.subtotal_amount, o.discount_amount, o.delivery_fee_amount,
         o.total_amount, o.payment_status, o.payment_method, o.fulfillment_type
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if not public.has_restaurant_access(v_order.restaurant_id) then
    raise exception 'Forbidden';
  end if;

  select coalesce(s.commission_rate, 0) into v_commission_rate
    from public.restaurant_settings s
    where s.restaurant_id = v_order.restaurant_id;

  v_restaurant_total := v_order.subtotal_amount - v_order.discount_amount;
  v_saovia_commission := round(v_restaurant_total * coalesce(v_commission_rate, 0));

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'amount', p.amount, 'method', p.method, 'status', p.status,
      'collected_by_driver', p.collected_by_driver_id is not null,
      'created_at', p.created_at, 'paid_at', p.paid_at
    ) order by p.created_at desc), '[]'::jsonb)
    into v_payments
    from public.payments p
    where p.order_id = p_order_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'currency', v_order.currency,
    'subtotal_amount', v_order.subtotal_amount,
    'discount_amount', v_order.discount_amount,
    'restaurant_total', v_restaurant_total,
    'delivery_fee_amount', v_order.delivery_fee_amount,
    'customer_total', v_order.total_amount,
    'commission_rate', v_commission_rate,
    'saovia_commission', v_saovia_commission,
    'restaurant_net', v_restaurant_total - v_saovia_commission,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'fulfillment_type', v_order.fulfillment_type,
    'payments', v_payments
  );
end;
$$;

revoke all on function public.get_order_financial_breakdown(uuid) from public, anon;
grant execute on function public.get_order_financial_breakdown(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) get_restaurant_dashboard_stats: additive `financials` block --
--    restaurant-only revenue (delivery fee excluded), Saovia commission, and
--    restaurant net, over the same delivered-orders population as the
--    existing `revenue` figure. Every existing key is untouched.
-- ---------------------------------------------------------------------------

create or replace function public.get_restaurant_dashboard_stats(p_start_date date, p_end_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant_id uuid;
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_days integer;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_current jsonb;
  v_previous jsonb;
  v_revenue_series jsonb;
  v_top_products jsonb;
  v_hourly jsonb;
  v_weekday jsonb;
  v_sources jsonb;
  v_operational jsonb;
  v_payment_breakdown jsonb;
  v_method_breakdown jsonb;
  v_collected numeric;
  v_refunded numeric;
  v_commission_rate numeric;
  v_restaurant_revenue numeric;
  v_delivery_fee_total numeric;
  v_discount_total numeric;
  v_saovia_commission numeric;
  v_financials jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select m.restaurant_id
    into v_restaurant_id
    from public.restaurant_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
    order by m.created_at asc
    limit 1;

  if v_restaurant_id is null then
    raise exception 'Aucun restaurant associé à cet utilisateur';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'Période invalide';
  end if;

  select coalesce(r.timezone, 'Africa/Abidjan') into v_tz from public.restaurants r where r.id = v_restaurant_id;

  v_start := (p_start_date::timestamp) at time zone v_tz;
  v_end := ((p_end_date + 1)::timestamp) at time zone v_tz;
  v_days := (p_end_date - p_start_date) + 1;
  v_prev_end := v_start;
  v_prev_start := v_start - (v_days || ' days')::interval;

  select jsonb_build_object(
    'revenue', coalesce(sum(total_amount) filter (where status = 'delivered'), 0),
    'orders_count', count(*) filter (where status != 'cancelled'),
    'delivered_count', count(*) filter (where status = 'delivered'),
    'average_order_value', case
      when count(*) filter (where status = 'delivered') > 0
      then round(coalesce(sum(total_amount) filter (where status = 'delivered'), 0) / count(*) filter (where status = 'delivered'), 2)
      else null
    end,
    'items_sold', coalesce(sum(item_count) filter (where status = 'delivered'), 0),
    'cancelled_orders', count(*) filter (where status = 'cancelled'),
    'cancelled_amount', coalesce(sum(total_amount) filter (where status = 'cancelled'), 0),
    'cancellation_rate', case when count(*) > 0 then round(count(*) filter (where status = 'cancelled')::numeric / count(*) * 100, 1) else 0 end,
    'in_progress_revenue', coalesce(sum(total_amount) filter (where status not in ('delivered', 'cancelled')), 0),
    'total_orders', count(*),
    'gmv', coalesce(sum(total_amount) filter (where status != 'cancelled'), 0),
    'pending_collection', coalesce(sum(total_amount) filter (where payment_status in ('cash_pending', 'pending', 'authorized') and status != 'cancelled'), 0)
  )
  into v_current
  from public.orders
  where restaurant_id = v_restaurant_id
    and created_at >= v_start and created_at < v_end;

  select jsonb_build_object(
    'revenue', coalesce(sum(total_amount) filter (where status = 'delivered'), 0),
    'orders_count', count(*) filter (where status != 'cancelled'),
    'average_order_value', case
      when count(*) filter (where status = 'delivered') > 0
      then round(coalesce(sum(total_amount) filter (where status = 'delivered'), 0) / count(*) filter (where status = 'delivered'), 2)
      else null
    end
  )
  into v_previous
  from public.orders
  where restaurant_id = v_restaurant_id
    and created_at >= v_prev_start and created_at < v_prev_end;

  with days as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as day
  ),
  daily as (
    select (date_trunc('day', created_at at time zone v_tz))::date as day,
           sum(total_amount) filter (where status = 'delivered') as revenue,
           count(*) filter (where status != 'cancelled') as orders
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', days.day, 'revenue', coalesce(daily.revenue, 0), 'orders', coalesce(daily.orders, 0)
    ) order by days.day), '[]'::jsonb)
  into v_revenue_series
  from days left join daily on daily.day = days.day;

  with top as (
    select oi.product_name_snapshot as name, sum(oi.quantity) as quantity, sum(oi.line_total) as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.restaurant_id = v_restaurant_id
      and o.status = 'delivered'
      and o.created_at >= v_start and o.created_at < v_end
    group by oi.product_name_snapshot
    order by sum(oi.line_total) desc
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'revenue', revenue) order by revenue desc), '[]'::jsonb)
  into v_top_products
  from top;

  with hourly as (
    select extract(hour from created_at at time zone v_tz)::int as hour,
           count(*) filter (where status != 'cancelled') as orders_count,
           sum(total_amount) filter (where status = 'delivered') as revenue
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'hour', hour, 'orders_count', orders_count, 'revenue', coalesce(revenue, 0)
    ) order by hour), '[]'::jsonb)
  into v_hourly
  from hourly;

  with wd as (
    select extract(dow from created_at at time zone v_tz)::int as weekday,
           count(*) filter (where status != 'cancelled') as orders_count,
           sum(total_amount) filter (where status = 'delivered') as revenue
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'weekday', weekday, 'orders_count', orders_count, 'revenue', coalesce(revenue, 0)
    ) order by weekday), '[]'::jsonb)
  into v_weekday
  from wd;

  with src as (
    select order_source,
           count(*) as total_orders,
           count(*) filter (where status = 'delivered') as delivered_orders,
           sum(total_amount) filter (where status = 'delivered') as revenue
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by order_source
  ),
  grand as (
    select greatest(sum(total_orders), 1) as total from src
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'source', src.order_source,
      'orders_count', src.total_orders,
      'share', round(src.total_orders::numeric / grand.total * 100, 1),
      'revenue', coalesce(src.revenue, 0),
      'average_order_value', case when src.delivered_orders > 0 then round(src.revenue / src.delivered_orders, 2) else null end
    ) order by src.total_orders desc), '[]'::jsonb)
  into v_sources
  from src, grand;

  select jsonb_build_object(
    'avg_confirmation_minutes', (
      select round(avg(extract(epoch from (confirmed_at - created_at)) / 60)::numeric, 1)
      from public.orders
      where restaurant_id = v_restaurant_id
        and created_at >= v_start and created_at < v_end
        and confirmed_at is not null
    ),
    'avg_preparation_minutes', (
      select round(avg(extract(epoch from (ready_at - preparing_at)) / 60)::numeric, 1)
      from public.orders
      where restaurant_id = v_restaurant_id
        and created_at >= v_start and created_at < v_end
        and preparing_at is not null and ready_at is not null
    ),
    'avg_total_minutes', (
      select round(avg(extract(epoch from (delivered_at - created_at)) / 60)::numeric, 1)
      from public.orders
      where restaurant_id = v_restaurant_id
        and created_at >= v_start and created_at < v_end
        and delivered_at is not null
    )
  )
  into v_operational;

  with pb as (
    select payment_status, count(*) as orders_count, sum(total_amount) as amount
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by payment_status
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'payment_status', payment_status, 'orders_count', orders_count, 'amount', coalesce(amount, 0)
    ) order by orders_count desc), '[]'::jsonb)
  into v_payment_breakdown
  from pb;

  with mb as (
    select payment_method, count(*) as orders_count, sum(total_amount) as amount
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by payment_method
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'payment_method', payment_method, 'orders_count', orders_count, 'amount', coalesce(amount, 0)
    ) order by orders_count desc), '[]'::jsonb)
  into v_method_breakdown
  from mb;

  select coalesce(sum(amount), 0) into v_collected
    from public.payments
    where restaurant_id = v_restaurant_id and status = 'paid' and created_at >= v_start and created_at < v_end;

  select coalesce(sum(amount), 0) into v_refunded
    from public.payments
    where restaurant_id = v_restaurant_id and status in ('refunded', 'partially_refunded') and created_at >= v_start and created_at < v_end;

  select coalesce(s.commission_rate, 0) into v_commission_rate
    from public.restaurant_settings s
    where s.restaurant_id = v_restaurant_id;

  select
    coalesce(sum(subtotal_amount - discount_amount) filter (where status = 'delivered'), 0),
    coalesce(sum(delivery_fee_amount) filter (where status = 'delivered'), 0),
    coalesce(sum(discount_amount) filter (where status = 'delivered'), 0)
  into v_restaurant_revenue, v_delivery_fee_total, v_discount_total
  from public.orders
  where restaurant_id = v_restaurant_id
    and created_at >= v_start and created_at < v_end;

  v_saovia_commission := round(v_restaurant_revenue * coalesce(v_commission_rate, 0));

  v_financials := jsonb_build_object(
    'commission_rate', v_commission_rate,
    'restaurant_revenue', v_restaurant_revenue,
    'delivery_fee_total', v_delivery_fee_total,
    'discount_total', v_discount_total,
    'saovia_commission', v_saovia_commission,
    'restaurant_net', v_restaurant_revenue - v_saovia_commission
  );

  return jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    'current', v_current,
    'previous', v_previous,
    'revenue_series', v_revenue_series,
    'top_products', v_top_products,
    'hourly_distribution', v_hourly,
    'weekday_distribution', v_weekday,
    'source_breakdown', v_sources,
    'operational_metrics', v_operational,
    'payment_breakdown', v_payment_breakdown,
    'method_breakdown', v_method_breakdown,
    'collected_revenue', v_collected,
    'refunded_amount', v_refunded,
    'financials', v_financials
  );
end;
$$;
