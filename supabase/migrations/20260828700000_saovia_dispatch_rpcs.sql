-- SAOVIA Delivery -- dispatch read-side RPCs. Reuses assign_agent_to_delivery()
-- unchanged for the actual assignment action; these three are read-only and
-- feed the Super Admin dispatch screen + the SAOVIA agent's own mission view.
-- Origin (RESTAURANT vs HORS_RESTAURANT) is derived from
-- organizations.restaurant_id, never stored -- no new column, no new table.
create or replace function public.list_deliveries_for_dispatch(
  p_origin text default null,
  p_service_level public.delivery_service_level default null,
  p_status public.delivery_status default null
)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  origin text,
  delivery_provider public.delivery_provider,
  service_level public.delivery_service_level,
  order_id text,
  external_reference text,
  status public.delivery_status,
  pickup_name text,
  pickup_address text,
  destination_name text,
  destination_address text,
  scheduled_pickup_at timestamptz,
  delivery_fee numeric,
  delivery_distance_km numeric,
  delivery_fee_calculation_method text,
  assigned_pickup_agent_id uuid,
  assigned_pickup_agent_name text,
  assigned_delivery_agent_id uuid,
  assigned_delivery_agent_name text,
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
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;
  if p_origin is not null and p_origin not in ('RESTAURANT', 'HORS_RESTAURANT') then
    raise exception 'Origine invalide';
  end if;

  return query
    select
      d.id, d.organization_id, o.name,
      case when o.restaurant_id is not null then 'RESTAURANT' else 'HORS_RESTAURANT' end,
      d.delivery_provider, d.service_level, d.order_id, d.external_reference, d.status,
      d.pickup_name, d.pickup_address, d.destination_name, d.destination_address,
      d.scheduled_pickup_at, d.delivery_fee, d.delivery_distance_km, d.delivery_fee_calculation_method,
      d.assigned_pickup_agent_id, pa.full_name, d.assigned_delivery_agent_id, da.full_name,
      d.created_at
    from public.deliveries d
    join public.organizations o on o.id = d.organization_id
    left join public.driver_profiles pa on pa.id = d.assigned_pickup_agent_id
    left join public.driver_profiles da on da.id = d.assigned_delivery_agent_id
    where (p_origin is null or (case when o.restaurant_id is not null then 'RESTAURANT' else 'HORS_RESTAURANT' end) = p_origin)
      and (p_service_level is null or d.service_level = p_service_level)
      and (p_status is null or d.status = p_status)
    order by d.created_at desc;
end;
$function$;

revoke all on function public.list_deliveries_for_dispatch(text, public.delivery_service_level, public.delivery_status) from public, anon;
grant execute on function public.list_deliveries_for_dispatch(text, public.delivery_service_level, public.delivery_status) to authenticated;

-- vehicles.restaurant_id is NOT NULL, and a SAOVIA agent structurally has
-- restaurant_id = NULL (driver_profiles_ownership_xor) -- a SAOVIA agent
-- can never have a vehicles row today, so vehicle info is deliberately
-- omitted rather than left/joined into an always-empty column.
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
        select count(*)::integer from public.delivery_assignments da
        join public.deliveries d2 on d2.id = da.delivery_id
        where da.agent_id = dp.id
          and da.status = 'accepted'
          and d2.status not in ('delivered', 'delivery_failed', 'cancelled', 'returned')
      )
    from public.driver_profiles dp
    where dp.is_saovia_agent = true
    order by dp.full_name asc;
end;
$function$;

revoke all on function public.list_saovia_agents_for_dispatch() from public, anon;
grant execute on function public.list_saovia_agents_for_dispatch() to authenticated;

-- Agent's own missions -- scoped to auth.uid(), same delivery shape as
-- list_deliveries_for_dispatch() minus organization-admin-only fields.
create or replace function public.get_agent_assigned_deliveries()
returns table (
  id uuid,
  origin text,
  delivery_provider public.delivery_provider,
  service_level public.delivery_service_level,
  order_id text,
  status public.delivery_status,
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
      d.id,
      case when o.restaurant_id is not null then 'RESTAURANT' else 'HORS_RESTAURANT' end,
      d.delivery_provider, d.service_level, d.order_id, d.status,
      d.pickup_name, d.pickup_address, d.destination_name, d.destination_address,
      d.scheduled_pickup_at, d.delivery_fee, d.delivery_fee_calculation_method,
      case when d.assigned_pickup_agent_id = auth.uid() then 'pickup'::public.delivery_assignment_role else 'delivery'::public.delivery_assignment_role end,
      d.created_at
    from public.deliveries d
    join public.organizations o on o.id = d.organization_id
    where d.assigned_pickup_agent_id = auth.uid() or d.assigned_delivery_agent_id = auth.uid()
    order by d.created_at desc;
end;
$function$;

revoke all on function public.get_agent_assigned_deliveries() from public, anon;
grant execute on function public.get_agent_assigned_deliveries() to authenticated;
