-- Carte des tenants (Super Admin > Carte géographique, mode "Tenants").
-- Reuses the existing restaurants.lat/lng columns (already used by
-- AddressMapPicker/TenantLocationModal for the storefront map, and already
-- exposed in super_admin_list_tenants) -- no new coordinate storage is
-- added here: a tenant without lat/lng (never set by the owner) simply has
-- no row in the result, never a guessed position (same "ignorer proprement"
-- convention as get_super_admin_customer_map).
--
-- Kept as its own function rather than folding into
-- get_super_admin_customer_map: that RPC's result is one row per customer
-- (keyed off each customer's latest geolocated order), while this one is
-- one row per restaurant aggregated across all of its orders/customers --
-- different grain, different joins. Branching the same function on a mode
-- flag would just interleave two unrelated queries behind an if/else.

create or replace function public.get_super_admin_tenant_map()
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

  with base as (
    select
      r.id,
      r.name,
      r.slug,
      r.status,
      r.lat,
      r.lng,
      r.currency,
      coalesce(r.commune, r.city) as zone,
      (select count(*) from public.customers c where c.restaurant_id = r.id) as customers_count,
      (select count(*) from public.orders o where o.restaurant_id = r.id and o.status <> 'cancelled') as orders_count,
      (select coalesce(sum(o.total_amount), 0) from public.orders o where o.restaurant_id = r.id and o.status = 'delivered') as total_revenue
    from public.restaurants r
    where r.lat is not null
      and r.lng is not null
      -- Defensive, same rationale as the customer map: a stray out-of-range
      -- value can only come from a bug, never a legitimate tenant location.
      and r.lat between -90 and 90
      and r.lng between -180 and 180
  )
  select jsonb_build_object(
    'tenants', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'slug', b.slug,
          'status', b.status::text,
          'lat', b.lat,
          'lng', b.lng,
          'zone', b.zone,
          'customers_count', b.customers_count,
          'orders_count', b.orders_count,
          'total_revenue', b.total_revenue,
          'currency', b.currency
        ))
        from base b
      ),
      '[]'::jsonb
    ),
    'kpis', jsonb_build_object(
      'located', (select count(*) from base),
      'zones_covered', (select count(distinct zone) from base where zone is not null),
      'total_orders', (select coalesce(sum(orders_count), 0) from base),
      'total_revenue', (select coalesce(sum(total_revenue), 0) from base)
    ),
    -- Zones les plus actives (mode Tenants): mêmes zones réelles
    -- (commune/ville), classées par nombre de tenants géolocalisés --
    -- jamais de zone inventée pour un tenant sans commune/ville renseignée.
    'zones', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'zone', z.zone,
          'tenants_count', z.tenants_count,
          'orders_count', z.orders_count,
          'total_revenue', z.total_revenue
        ) order by z.tenants_count desc)
        from (
          select
            zone,
            count(*) as tenants_count,
            coalesce(sum(orders_count), 0) as orders_count,
            coalesce(sum(total_revenue), 0) as total_revenue
          from base
          where zone is not null
          group by zone
          order by count(*) desc
          limit 10
        ) z
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_super_admin_tenant_map() from public;
grant execute on function public.get_super_admin_tenant_map() to authenticated;
