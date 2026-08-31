-- Step 4 "Intelligence Business": one new read-only RPC for the platform-
-- wide revenue/analytics views (CA total plateforme, classement des tenants,
-- série quotidienne, clients actifs, taux d'annulation). Per-tenant drill-
-- down reuses get_restaurant_dashboard_stats exactly as-is -- it already
-- accepts an explicit p_restaurant_id for a Super Admin caller (see its own
-- definition), so nothing about it changes here.
--
-- Same rules/thresholds as the RPCs already shipped: revenue = sum(total_
-- amount) on delivered orders, "CA total"/GMV = sum(total_amount) on every
-- non-cancelled order (identical to get_restaurant_dashboard_stats' `gmv`
-- field), cancellation_rate = cancelled/total*100 (identical formula), and
-- "client actif" = last_order_at within 14 days (identical threshold to
-- get_super_admin_customer_map's 'active' status and the existing marketing
-- "Clients inactifs" segment) -- computed here over every customer, not only
-- the geolocated subset that RPC is limited to.

create or replace function public.get_super_admin_revenue_analytics(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_period_days integer := greatest(coalesce(p_period_days, 30), 1);
  v_start timestamptz := (date_trunc('day', now() at time zone 'Africa/Abidjan') at time zone 'Africa/Abidjan') - (v_period_days || ' days')::interval;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  with base as (
    select o.id, o.restaurant_id, o.status, o.total_amount, o.created_at
    from public.orders o
    where o.created_at >= v_start
  )
  select jsonb_build_object(
    'period_days', v_period_days,
    'kpis', jsonb_build_object(
      'ca_total', (select coalesce(sum(total_amount) filter (where status != 'cancelled'), 0) from base),
      'ca_livre', (select coalesce(sum(total_amount) filter (where status = 'delivered'), 0) from base),
      'orders_count', (select count(*) filter (where status != 'cancelled') from base),
      'delivered_count', (select count(*) filter (where status = 'delivered') from base),
      'cancelled_count', (select count(*) filter (where status = 'cancelled') from base),
      'cancellation_rate', (
        select case when count(*) > 0 then round(count(*) filter (where status = 'cancelled')::numeric / count(*) * 100, 1) else 0 end
        from base
      ),
      'average_order_value', (
        select case
          when count(*) filter (where status = 'delivered') > 0
          then round(coalesce(sum(total_amount) filter (where status = 'delivered'), 0) / count(*) filter (where status = 'delivered'), 2)
          else null
        end
        from base
      ),
      'active_clients', (
        select count(*) from public.customers c where c.last_order_at >= now() - interval '14 days'
      )
    ),
    'revenue_series', (
      with days as (
        select generate_series(v_start::date, (now() at time zone 'Africa/Abidjan')::date, interval '1 day')::date as day
      ),
      daily as (
        select
          (date_trunc('day', created_at at time zone 'Africa/Abidjan'))::date as day,
          sum(total_amount) filter (where status = 'delivered') as revenue,
          count(*) filter (where status != 'cancelled') as orders
        from base
        group by 1
      )
      select coalesce(
        jsonb_agg(jsonb_build_object('date', days.day, 'revenue', coalesce(daily.revenue, 0), 'orders', coalesce(daily.orders, 0)) order by days.day),
        '[]'::jsonb
      )
      from days left join daily on daily.day = days.day
    ),
    'tenant_ranking', (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'restaurant_id', t.restaurant_id,
          'restaurant_name', r.name,
          'currency', r.currency,
          'revenue', t.revenue,
          'orders_count', t.orders_count,
          'average_order_value', t.average_order_value
        ) order by t.revenue desc),
        '[]'::jsonb
      )
      from (
        select
          restaurant_id,
          coalesce(sum(total_amount) filter (where status = 'delivered'), 0) as revenue,
          count(*) filter (where status != 'cancelled') as orders_count,
          case
            when count(*) filter (where status = 'delivered') > 0
            then round(coalesce(sum(total_amount) filter (where status = 'delivered'), 0) / count(*) filter (where status = 'delivered'), 2)
            else null
          end as average_order_value
        from base
        group by restaurant_id
      ) t
      join public.restaurants r on r.id = t.restaurant_id
    )
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_super_admin_revenue_analytics(integer) from public, anon;
grant execute on function public.get_super_admin_revenue_analytics(integer) to authenticated;
