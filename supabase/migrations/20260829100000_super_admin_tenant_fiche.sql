-- Super Admin Tenant module (fiche tenant): completes the existing tenant
-- detail page with sections that already have real data/RPCs behind them
-- but were never exposed to a Super Admin viewing someone else's tenant --
-- Statistiques and QR performance both hard-resolved "my own restaurant"
-- from auth.uid()'s own membership, which a Super Admin usually doesn't
-- have. Both gain an optional, super-admin-only override parameter;
-- existing calls (no p_restaurant_id) are 100% unchanged. Abonnement gains
-- the one RPC actually missing: restaurant_subscriptions has no UPDATE
-- policy for anyone (by design -- see phase4), so even a Super Admin
-- currently cannot change a tenant's plan without one.
-- No "Modules" work here -- explicitly deferred to a dedicated task.

-- ---------------------------------------------------------------------------
-- 1) get_restaurant_dashboard_stats: adds a trailing, Super Admin-only
--    p_restaurant_id override. CREATE OR REPLACE does NOT extend a
--    function's parameter list in place -- a changed signature is a new
--    function object (new default PUBLIC execute grant and all), so the old
--    2-argument signature is explicitly dropped first to avoid ending up
--    with two overloads PostgREST could pick between, and EXECUTE is
--    re-granted to authenticated only (never anon) exactly as before. Every
--    existing caller (tenant's own admin dashboard) never passes
--    p_restaurant_id and keeps resolving from their own membership exactly
--    as before, via the same 3-argument function (default null).
-- ---------------------------------------------------------------------------

drop function if exists public.get_restaurant_dashboard_stats(date, date);

create or replace function public.get_restaurant_dashboard_stats(p_start_date date, p_end_date date, p_restaurant_id uuid default null)
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

  if p_restaurant_id is not null then
    if not public.is_super_admin() then
      raise exception 'Forbidden: super_admin only';
    end if;
    v_restaurant_id := p_restaurant_id;
  else
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

revoke all on function public.get_restaurant_dashboard_stats(date, date, uuid) from public, anon;
grant execute on function public.get_restaurant_dashboard_stats(date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) get_tenant_qr_stats: same treatment -- old 0-argument signature
--    dropped, new 1-argument (default null) signature re-granted to
--    authenticated only.
-- ---------------------------------------------------------------------------

drop function if exists public.get_tenant_qr_stats();

create or replace function public.get_tenant_qr_stats(p_restaurant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant_id uuid;
  v_tz text;
  v_currency text;
  v_today_start timestamptz;
  v_scans_today integer;
  v_scans_week integer;
  v_scans_month integer;
  v_unique_visitors integer;
  v_last_scan_at timestamptz;
  v_qr_orders_count integer;
  v_qr_revenue numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_restaurant_id is not null then
    if not public.is_super_admin() then
      raise exception 'Forbidden: super_admin only';
    end if;
    v_restaurant_id := p_restaurant_id;
  else
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
  end if;

  select coalesce(r.timezone, 'Africa/Abidjan'), r.currency
    into v_tz, v_currency
    from public.restaurants r
    where r.id = v_restaurant_id;

  v_today_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;

  select count(*) into v_scans_today
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and source = 'qr' and started_at >= v_today_start;

  select count(*) into v_scans_week
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and source = 'qr' and started_at >= now() - interval '7 days';

  select count(*), count(distinct visitor_id)
    into v_scans_month, v_unique_visitors
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and source = 'qr' and started_at >= now() - interval '30 days';

  select max(started_at) into v_last_scan_at
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and source = 'qr';

  select
    count(*) filter (where status != 'cancelled'),
    coalesce(sum(subtotal_amount - discount_amount) filter (where status = 'delivered'), 0)
    into v_qr_orders_count, v_qr_revenue
    from public.orders
    where restaurant_id = v_restaurant_id and order_source = 'qr_code';

  return jsonb_build_object(
    'currency', v_currency,
    'scans_today', coalesce(v_scans_today, 0),
    'scans_week', coalesce(v_scans_week, 0),
    'scans_month', coalesce(v_scans_month, 0),
    'unique_visitors_month', coalesce(v_unique_visitors, 0),
    'last_scan_at', v_last_scan_at,
    'qr_orders_count', coalesce(v_qr_orders_count, 0),
    'qr_revenue', v_qr_revenue
  );
end;
$$;

revoke all on function public.get_tenant_qr_stats(uuid) from public, anon;
grant execute on function public.get_tenant_qr_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) super_admin_set_restaurant_plan: the one genuinely missing capability
--    for the Abonnement section -- restaurant_subscriptions has no UPDATE
--    policy for anyone (by design, see phase4), so even a Super Admin has no
--    path today to change a tenant's plan. Same pattern as the other
--    super_admin_* RPCs (is_super_admin() gate, audit-logged).
-- ---------------------------------------------------------------------------

create or replace function public.super_admin_set_restaurant_plan(_restaurant_id uuid, _plan_id text)
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
  if not exists (select 1 from public.plans where id = _plan_id and is_active = true) then
    raise exception 'Plan invalide: %', _plan_id;
  end if;

  update public.restaurant_subscriptions
    set plan_id = _plan_id
    where restaurant_id = _restaurant_id;

  if not found then
    raise exception 'Aucun abonnement trouvé pour ce restaurant';
  end if;

  perform public.log_audit_event(
    _restaurant_id, auth.uid(), 'restaurant_subscriptions', _restaurant_id, 'plan_changed_by_super_admin',
    jsonb_build_object('new_plan_id', _plan_id)
  );

  return jsonb_build_object('restaurant_id', _restaurant_id, 'plan_id', _plan_id);
end;
$$;

revoke all on function public.super_admin_set_restaurant_plan(uuid, text) from public, anon;
grant execute on function public.super_admin_set_restaurant_plan(uuid, text) to authenticated;
