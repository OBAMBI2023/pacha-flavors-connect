-- Step 3 "Centre opérationnel Super Admin": two new read-only RPCs so the
-- Super Admin can see orders and driver GPS across every tenant, without
-- ever granting the Super Admin role direct table access to `orders` or
-- `driver_profiles` and without touching any existing RLS policy. Both
-- functions are SECURITY DEFINER and re-check is_super_admin() themselves
-- (same pattern as get_super_admin_tenant_map / get_super_admin_customer_map
-- / list_saovia_agents_for_dispatch, all already shipped) -- a caller who
-- isn't Super Admin gets a raised exception, not an empty result. Neither
-- function writes anything, adds a column, or changes an existing policy.

-- ---------------------------------------------------------------------------
-- get_super_admin_orders: paginated, filtered order list + KPIs, joined only
-- to the tenant name and (if any) the assigned driver's name -- no customer
-- phone/address/notes, no payment_reference, nothing beyond what the Step 3
-- brief's "champs_minimaux" asks for.
-- ---------------------------------------------------------------------------
create or replace function public.get_super_admin_orders(
  p_restaurant_id uuid default null,
  p_status public.order_status default null,
  p_period_days integer default null,
  p_search text default null,
  p_page integer default 0,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_page integer := greatest(coalesce(p_page, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  -- KPIs reflect the tenant/period/search slice regardless of the status
  -- filter, so they stay stable as the status pill is toggled on the list
  -- below (same rationale as get_super_admin_tenant_map's single `base`).
  with kpi_base as (
    select o.status, o.total_amount, o.created_at
    from public.orders o
    where (p_restaurant_id is null or o.restaurant_id = p_restaurant_id)
      and (p_period_days is null or o.created_at >= now() - (p_period_days || ' days')::interval)
      and (
        v_search is null
        or o.customer_name ilike '%' || v_search || '%'
        or o.order_number::text = v_search
      )
  ),
  list_base as (
    select
      o.id, o.order_number, o.restaurant_id, r.name as restaurant_name,
      o.status, o.payment_status, o.payment_method, o.total_amount, o.currency,
      o.customer_name, o.created_at, o.assigned_driver_id, dp.full_name as assigned_driver_name,
      o.delivery_dispatch_status, o.driver_delivery_status
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    left join public.driver_profiles dp on dp.id = o.assigned_driver_id
    where (p_restaurant_id is null or o.restaurant_id = p_restaurant_id)
      and (p_status is null or o.status = p_status)
      and (p_period_days is null or o.created_at >= now() - (p_period_days || ' days')::interval)
      and (
        v_search is null
        or o.customer_name ilike '%' || v_search || '%'
        or o.order_number::text = v_search
      )
  )
  select jsonb_build_object(
    'orders', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', b.id,
          'order_number', b.order_number,
          'restaurant_id', b.restaurant_id,
          'restaurant_name', b.restaurant_name,
          'status', b.status::text,
          'payment_status', b.payment_status::text,
          'payment_method', b.payment_method::text,
          'total_amount', b.total_amount,
          'currency', b.currency,
          'customer_name', b.customer_name,
          'created_at', b.created_at,
          'assigned_driver_id', b.assigned_driver_id,
          'assigned_driver_name', b.assigned_driver_name,
          'delivery_dispatch_status', b.delivery_dispatch_status::text,
          'driver_delivery_status', b.driver_delivery_status::text
        ) order by b.created_at desc)
        from (
          select * from list_base
          order by created_at desc
          limit v_page_size offset (v_page * v_page_size)
        ) b
      ),
      '[]'::jsonb
    ),
    'total_count', (select count(*) from list_base),
    'page', v_page,
    'page_size', v_page_size,
    'kpis', jsonb_build_object(
      'today', (select count(*) from kpi_base where created_at >= date_trunc('day', now())),
      'in_progress', (select count(*) from kpi_base where status not in ('delivered', 'cancelled')),
      'delivered', (select count(*) from kpi_base where status = 'delivered'),
      'cancelled', (select count(*) from kpi_base where status = 'cancelled'),
      'revenue', (select coalesce(sum(total_amount), 0) from kpi_base where status = 'delivered')
    )
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_super_admin_orders(uuid, public.order_status, integer, text, integer, integer) from public, anon;
grant execute on function public.get_super_admin_orders(uuid, public.order_status, integer, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- get_super_admin_driver_locations: every tenant-owned driver (SAOVIA's own
-- network agents -- restaurant_id is null for those -- are out of scope
-- here, they already have their own roster via list_saovia_agents_for_dispatch)
-- with their last known GPS ping and, if any, their current non-terminal
-- order number. Same "never invent a position" rule as the tenant-scoped
-- fleet map: last_lat/last_lng pass through exactly as stored, null stays
-- null, the frontend is what decides not to render a marker for that.
-- ---------------------------------------------------------------------------
create or replace function public.get_super_admin_driver_locations(
  p_restaurant_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  with active_orders as (
    select assigned_driver_id, min(order_number) as order_number
    from public.orders
    where assigned_driver_id is not null
      and status not in ('delivered', 'cancelled')
    group by assigned_driver_id
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', d.id,
      'restaurant_id', d.restaurant_id,
      'restaurant_name', r.name,
      'full_name', d.full_name,
      'status', d.status::text,
      'is_active', d.is_active,
      'last_lat', d.last_lat,
      'last_lng', d.last_lng,
      'last_location_at', d.last_location_at,
      'active_order_number', ao.order_number
    ) order by r.name, d.full_name),
    '[]'::jsonb
  )
  into v_result
  from public.driver_profiles d
  join public.restaurants r on r.id = d.restaurant_id
  left join active_orders ao on ao.assigned_driver_id = d.id
  where d.restaurant_id is not null
    and d.is_active = true
    and (p_restaurant_id is null or d.restaurant_id = p_restaurant_id);

  return v_result;
end;
$function$;

revoke all on function public.get_super_admin_driver_locations(uuid) from public, anon;
grant execute on function public.get_super_admin_driver_locations(uuid) to authenticated;
