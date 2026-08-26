-- Fixes "Top produits" / "Plats populaires" ranking in
-- get_restaurant_dashboard_stats: top_products was selected (LIMIT 10) and
-- ordered by revenue, while every consumer (DashboardHome's "Plats
-- populaires" N° badge, StatisticsPanel's "Top produits" list) ranks and
-- numbers the list assuming it's already sorted by order count (quantity).
-- A product with more orders but less revenue than another could therefore
-- outrank it in the UI, or get excluded from the top 10 entirely by the
-- revenue-based LIMIT. Only the ORDER BY clauses change here -- no counters,
-- orders, or other stats are touched.
create or replace function public.get_restaurant_dashboard_stats(p_start_date date, p_end_date date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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

  -- Ranked by order count (quantity) first, matching what every UI consumer
  -- assumes when it numbers this list N°1/N°2/... -- revenue is only a
  -- secondary tie-breaker, and product name gives a final, fully
  -- deterministic order for genuine ties.
  with top as (
    select oi.product_name_snapshot as name, sum(oi.quantity) as quantity, sum(oi.line_total) as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.restaurant_id = v_restaurant_id
      and o.status = 'delivered'
      and o.created_at >= v_start and o.created_at < v_end
    group by oi.product_name_snapshot
    order by sum(oi.quantity) desc, sum(oi.line_total) desc, oi.product_name_snapshot asc
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'revenue', revenue) order by quantity desc, revenue desc, name asc), '[]'::jsonb)
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
    'refunded_amount', v_refunded
  );
end;
$function$;
