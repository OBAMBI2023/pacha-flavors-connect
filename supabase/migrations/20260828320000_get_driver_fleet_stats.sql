-- Fleet-wide + per-driver stats, same style as get_restaurant_dashboard_stats:
-- resolve restaurant_id from auth.uid() via membership (caller never passes
-- one), one CTE per stat family, single jsonb_build_object return. Serves
-- both the Statistiques tab and each driver's own profile stats section, so
-- there's no second near-duplicate function.
create or replace function public.get_driver_fleet_stats(p_start_date date, p_end_date date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_tz text;
  v_range_start timestamptz;
  v_range_end timestamptz;
  v_status_counts jsonb;
  v_period_totals jsonb;
  v_by_driver jsonb;
begin
  select m.restaurant_id into v_restaurant_id
    from public.restaurant_memberships m
    where m.user_id = auth.uid() and m.status = 'active'
    order by m.created_at asc
    limit 1;

  if v_restaurant_id is null then
    raise exception 'Aucun restaurant associé à ce compte';
  end if;

  select coalesce(r.timezone, 'Africa/Abidjan') into v_tz from public.restaurants r where r.id = v_restaurant_id;
  v_range_start := p_start_date::timestamp at time zone v_tz;
  v_range_end := (p_end_date + 1)::timestamp at time zone v_tz;

  select jsonb_build_object(
    'active', count(*) filter (where is_active),
    'available', count(*) filter (where is_active and status = 'available'),
    'on_delivery', count(*) filter (where is_active and status in ('delivering', 'proposed')),
    'offline', count(*) filter (where is_active and status = 'offline'),
    'suspended', count(*) filter (where status = 'suspended')
  )
  into v_status_counts
  from public.driver_profiles
  where restaurant_id = v_restaurant_id;

  with period_orders as (
    select o.*
    from public.orders o
    where o.restaurant_id = v_restaurant_id
      and o.fulfillment_type = 'delivery'
      and o.assigned_driver_id is not null
      and o.created_at >= v_range_start and o.created_at < v_range_end
  )
  select jsonb_build_object(
    'total_deliveries', count(*),
    'completed', count(*) filter (where status = 'delivered'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'in_progress', count(*) filter (where status not in ('delivered', 'cancelled')),
    'avg_delivery_minutes', (
      select round(avg(extract(epoch from (delivered_at - confirmed_at)) / 60)::numeric, 1)
      from period_orders where status = 'delivered' and delivered_at is not null and confirmed_at is not null
    ),
    'success_rate', (
      case when count(*) filter (where status in ('delivered', 'cancelled')) = 0 then null
        else round(100.0 * count(*) filter (where status = 'delivered') / count(*) filter (where status in ('delivered', 'cancelled')), 1)
      end
    )
  )
  into v_period_totals
  from period_orders;

  with period_orders as (
    select o.*
    from public.orders o
    where o.restaurant_id = v_restaurant_id
      and o.fulfillment_type = 'delivery'
      and o.assigned_driver_id is not null
      and o.created_at >= v_range_start and o.created_at < v_range_end
  ),
  per_driver as (
    select
      dp.id as driver_id,
      dp.full_name,
      dp.status,
      count(po.id) as total_deliveries,
      count(po.id) filter (where po.status = 'delivered') as completed,
      count(po.id) filter (where po.status = 'cancelled') as cancelled,
      count(po.id) filter (where po.status not in ('delivered', 'cancelled')) as in_progress,
      count(po.id) filter (where po.created_at >= (now() at time zone v_tz)::date::timestamp at time zone v_tz) as today,
      round(avg(extract(epoch from (po.delivered_at - po.confirmed_at)) / 60)
        filter (where po.status = 'delivered' and po.delivered_at is not null and po.confirmed_at is not null)::numeric, 1) as avg_delivery_minutes,
      case when count(po.id) filter (where po.status in ('delivered', 'cancelled')) = 0 then null
        else round(100.0 * count(po.id) filter (where po.status = 'delivered') / count(po.id) filter (where po.status in ('delivered', 'cancelled')), 1)
      end as success_rate
    from public.driver_profiles dp
    left join period_orders po on po.assigned_driver_id = dp.id
    where dp.restaurant_id = v_restaurant_id
    group by dp.id, dp.full_name, dp.status
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'driver_id', driver_id, 'full_name', full_name, 'status', status,
    'total_deliveries', total_deliveries, 'completed', completed, 'cancelled', cancelled,
    'in_progress', in_progress, 'today', today, 'avg_delivery_minutes', avg_delivery_minutes, 'success_rate', success_rate
  ) order by full_name), '[]'::jsonb)
  into v_by_driver
  from per_driver;

  return jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    'driver_status_counts', v_status_counts,
    'period_totals', v_period_totals,
    'by_driver', v_by_driver
  );
end;
$function$;

revoke all on function public.get_driver_fleet_stats(date, date) from public, anon;
grant execute on function public.get_driver_fleet_stats(date, date) to authenticated;
