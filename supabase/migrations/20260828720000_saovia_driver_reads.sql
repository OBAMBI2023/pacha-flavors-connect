create or replace function public.list_saovia_agents_for_dispatch()
returns table (
  id uuid,
  full_name text,
  phone text,
  status public.driver_status,
  is_active boolean,
  active_missions_count integer
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  return query
    select
      dp.id, dp.full_name, dp.phone, dp.status, dp.is_active,
      (
        select count(*)::integer
        from public.delivery_assignments da
        join public.deliveries d2 on d2.id = da.delivery_id
        where da.agent_id = dp.id
          and da.status in ('proposed', 'accepted')
          and d2.status not in ('delivered', 'delivery_failed', 'cancelled', 'returned')
      )
    from public.driver_profiles dp
    where dp.is_saovia_agent = true
    order by dp.full_name asc;
end;
$function$;

revoke all on function public.list_saovia_agents_for_dispatch() from public, anon;
grant execute on function public.list_saovia_agents_for_dispatch() to authenticated;

-- Postgres refuses CREATE OR REPLACE when the RETURNS TABLE shape changes
-- (assignment_id added, status split into assignment status + delivery_status).
-- This function is not yet applied in any environment under this shape --
-- confirmed live signature is still the 14-column one from saovia_dispatch_rpcs
-- -- so drop-then-create here is safe; it is the ONLY frontend consumer
-- (src/lib/dispatch.ts fetchAgentAssignedDeliveries -> src/routes/livreur.tsx)
-- and it already targets this new shape.
drop function if exists public.get_agent_assigned_deliveries();

create function public.get_agent_assigned_deliveries()
returns table (
  assignment_id uuid,
  id uuid,
  origin text,
  delivery_provider public.delivery_provider,
  service_level public.delivery_service_level,
  order_id text,
  status public.delivery_assignment_status,
  delivery_status public.delivery_status,
  pickup_name text,
  pickup_address text,
  destination_name text,
  destination_address text,
  scheduled_pickup_at timestamptz,
  delivery_fee numeric,
  delivery_fee_calculation_method text,
  role public.delivery_assignment_role,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.driver_profiles dp where dp.id = auth.uid() and dp.is_saovia_agent = true) then
    raise exception 'Forbidden: SAOVIA agent only';
  end if;

  return query
    select
      da.id,
      d.id,
      case when o.restaurant_id is not null then 'RESTAURANT' else 'HORS_RESTAURANT' end,
      d.delivery_provider,
      d.service_level,
      d.order_id,
      da.status,
      d.status,
      d.pickup_name,
      d.pickup_address,
      d.destination_name,
      d.destination_address,
      d.scheduled_pickup_at,
      d.delivery_fee,
      d.delivery_fee_calculation_method,
      da.role,
      da.created_at
    from public.delivery_assignments da
    join public.deliveries d on d.id = da.delivery_id
    join public.organizations o on o.id = d.organization_id
    where da.agent_id = auth.uid()
      and da.status in ('proposed', 'accepted', 'rejected', 'completed')
    order by da.created_at desc;
end;
$function$;

revoke all on function public.get_agent_assigned_deliveries() from public, anon;
grant execute on function public.get_agent_assigned_deliveries() to authenticated;
