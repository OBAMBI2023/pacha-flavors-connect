-- Step 5 "Marketing & Acquisition": one new read-only RPC, platform-wide.
-- No second attribution system: reuses orders.order_source exactly as
-- create_order/get_tenant_qr_stats already write and read it ('qr_code' is
-- the only QR marker anywhere in this schema), reuses restaurant_settings.
-- meta_pixel_id/meta_pixel_enabled exactly as metaPixel.ts already reads
-- them, and reuses visitor_sessions.source = 'qr' exactly as get_tenant_qr_stats
-- already does for scan counts. "CA attribué"/"CA QR" use the same
-- (subtotal_amount - discount_amount) restaurant-revenue formula as
-- get_tenant_qr_stats' own qr_revenue -- delivery fee was never a marketing
-- channel's doing, so it stays excluded here too, for both.
--
-- There is no 'meta' value in order_source and no Meta-attributed order
-- anywhere in this schema (Meta Pixel today only fires client-side events to
-- Facebook, never anything that comes back into `orders`) -- so this RPC
-- never reports a Meta-attributed order/revenue figure. Meta Pixel coverage
-- (tenants active/inactive/none) is a configuration count, never presented
-- as a conversion count.

create or replace function public.get_super_admin_acquisition_overview(
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
  v_qr_scans integer;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  select count(*) into v_qr_scans
    from public.visitor_sessions
    where source = 'qr' and started_at >= v_start;

  with base as (
    select o.id, o.restaurant_id, o.status, o.order_source, o.total_amount,
           o.subtotal_amount, o.discount_amount, o.customer_id, o.created_at
    from public.orders o
    where o.created_at >= v_start
  )
  select jsonb_build_object(
    'period_days', v_period_days,
    'kpis', jsonb_build_object(
      'attributed_orders', (select count(*) filter (where status != 'cancelled' and order_source != 'unknown') from base),
      'attributed_revenue', (
        select coalesce(sum(subtotal_amount - discount_amount) filter (where status = 'delivered' and order_source != 'unknown'), 0)
        from base
      ),
      'acquired_clients', (
        select count(distinct customer_id) from base where order_source != 'unknown' and customer_id is not null
      ),
      'qr_orders', (select count(*) filter (where status != 'cancelled' and order_source = 'qr_code') from base),
      'qr_revenue', (
        select coalesce(sum(subtotal_amount - discount_amount) filter (where status = 'delivered' and order_source = 'qr_code'), 0)
        from base
      ),
      'qr_clients', (
        select count(distinct customer_id) from base where order_source = 'qr_code' and customer_id is not null
      ),
      'qr_scans', coalesce(v_qr_scans, 0),
      'qr_conversion_rate', (
        case when coalesce(v_qr_scans, 0) > 0
        then round((select count(*) filter (where status != 'cancelled' and order_source = 'qr_code') from base)::numeric / v_qr_scans * 100, 1)
        else null end
      ),
      'tenants_with_measurable_acquisition', (
        select count(*) from (
          select restaurant_id from base where order_source != 'unknown' and status != 'cancelled' group by restaurant_id
        ) t
      )
    ),
    'source_breakdown', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'source', s.order_source,
          'orders_count', s.orders_count,
          'revenue', s.revenue
        ) order by s.orders_count desc), '[]'::jsonb)
      from (
        select order_source,
          count(*) filter (where status != 'cancelled') as orders_count,
          coalesce(sum(subtotal_amount - discount_amount) filter (where status = 'delivered'), 0) as revenue
        from base
        group by order_source
      ) s
    ),
    'attributed_series', (
      with days as (
        select generate_series(v_start::date, (now() at time zone 'Africa/Abidjan')::date, interval '1 day')::date as day
      ),
      daily as (
        select (date_trunc('day', created_at at time zone 'Africa/Abidjan'))::date as day,
          sum(subtotal_amount - discount_amount) filter (where status = 'delivered' and order_source != 'unknown') as revenue,
          count(*) filter (where status != 'cancelled' and order_source != 'unknown') as orders
        from base
        group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object('date', days.day, 'revenue', coalesce(daily.revenue, 0), 'orders', coalesce(daily.orders, 0)) order by days.day), '[]'::jsonb)
      from days left join daily on daily.day = days.day
    ),
    'qr_series', (
      with days as (
        select generate_series(v_start::date, (now() at time zone 'Africa/Abidjan')::date, interval '1 day')::date as day
      ),
      daily as (
        select (date_trunc('day', created_at at time zone 'Africa/Abidjan'))::date as day,
          sum(subtotal_amount - discount_amount) filter (where status = 'delivered' and order_source = 'qr_code') as revenue,
          count(*) filter (where status != 'cancelled' and order_source = 'qr_code') as orders
        from base
        group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object('date', days.day, 'revenue', coalesce(daily.revenue, 0), 'orders', coalesce(daily.orders, 0)) order by days.day), '[]'::jsonb)
      from days left join daily on daily.day = days.day
    ),
    'meta_pixel', (
      select jsonb_build_object(
        'active_count', count(*) filter (where s.meta_pixel_enabled = true),
        'inactive_count', count(*) filter (where s.meta_pixel_enabled = false and s.meta_pixel_id is not null),
        'none_count', count(*) filter (where s.meta_pixel_id is null),
        'total_tenants', count(*),
        'coverage_pct', case when count(*) > 0 then round(count(*) filter (where s.meta_pixel_enabled = true)::numeric / count(*) * 100, 1) else 0 end
      )
      from public.restaurant_settings s
      join public.restaurants r on r.id = s.restaurant_id
      where r.status != 'archived'
    ),
    -- Starts from `restaurants`, not from `base` -- a tenant with zero
    -- orders in the period must still appear here (as all-zero), otherwise
    -- "Tenants sans acquisition mesurable" (Module 4) would silently miss
    -- exactly the tenants that most belong on that list.
    'tenant_breakdown', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'restaurant_id', r.id,
          'restaurant_name', r.name,
          'currency', r.currency,
          'attributed_orders', coalesce(t.attributed_orders, 0),
          'attributed_revenue', coalesce(t.attributed_revenue, 0),
          'qr_orders', coalesce(t.qr_orders, 0),
          'qr_revenue', coalesce(t.qr_revenue, 0),
          'meta_pixel_enabled', coalesce(s.meta_pixel_enabled, false),
          'meta_pixel_configured', s.meta_pixel_id is not null
        ) order by coalesce(t.attributed_revenue, 0) desc), '[]'::jsonb)
      from public.restaurants r
      left join public.restaurant_settings s on s.restaurant_id = r.id
      left join (
        select
          restaurant_id,
          count(*) filter (where status != 'cancelled' and order_source != 'unknown') as attributed_orders,
          coalesce(sum(subtotal_amount - discount_amount) filter (where status = 'delivered' and order_source != 'unknown'), 0) as attributed_revenue,
          count(*) filter (where status != 'cancelled' and order_source = 'qr_code') as qr_orders,
          coalesce(sum(subtotal_amount - discount_amount) filter (where status = 'delivered' and order_source = 'qr_code'), 0) as qr_revenue
        from base
        group by restaurant_id
      ) t on t.restaurant_id = r.id
      where r.status != 'archived'
    )
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_super_admin_acquisition_overview(integer) from public, anon;
grant execute on function public.get_super_admin_acquisition_overview(integer) to authenticated;
