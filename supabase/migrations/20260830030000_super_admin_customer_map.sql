-- Carte des clients (Super Admin > Carte des clients). Reuses the GPS
-- coordinates already captured per-order (orders.delivery_latitude/
-- longitude, see customer_delivery_location) -- there is no per-customer
-- lat/lng column anywhere in the schema, and none is added here: a
-- customer's map position is simply their most recent delivery order that
-- actually has coordinates (pickup-only customers, or customers whose
-- orders never captured GPS, are silently excluded -- never guessed).
--
-- Cross-tenant reads like this always go through a dedicated, explicitly
-- is_super_admin()-gated RPC in this codebase (see super_admin_dashboard,
-- super_admin_tenant_fiche) even though has_restaurant_access() already
-- resolves true for a super admin -- same convention, so the read stays
-- server-aggregated (one round trip, one curated payload) instead of the
-- client pulling every order row across every tenant to compute this
-- itself.

create or replace function public.get_super_admin_customer_map(
  p_restaurant_id uuid default null,
  p_status text default null,
  p_period_days integer default null,
  p_search text default null
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

  with latest_geo_order as (
    -- One row per customer: their most recent order that actually carries
    -- delivery coordinates. A customer who only ever picked up in-store,
    -- or whose delivery orders never resolved GPS, has no row here and is
    -- therefore never in the result -- exactly the "ignorer proprement les
    -- clients sans coordonnées GPS" requirement, enforced by the join
    -- below rather than a null-coalesced fake position.
    select distinct on (o.customer_id)
      o.customer_id,
      o.delivery_latitude,
      o.delivery_longitude,
      o.delivery_neighborhood,
      o.delivery_commune,
      o.delivery_city
    from public.orders o
    where o.customer_id is not null
      and o.delivery_latitude is not null
      and o.delivery_longitude is not null
      -- Defensive: a stray out-of-range value could only ever come from a
      -- bug elsewhere (create_order already rejects these at insert time),
      -- never from a legitimate customer -- excluded rather than plotted.
      and o.delivery_latitude between -90 and 90
      and o.delivery_longitude between -180 and 180
    order by o.customer_id, o.created_at desc
  ),
  base as (
    select
      c.id,
      c.full_name,
      c.phone,
      c.orders_count,
      c.total_spent,
      c.last_order_at,
      c.restaurant_id,
      r.name as restaurant_name,
      r.slug as restaurant_slug,
      r.currency as restaurant_currency,
      g.delivery_latitude,
      g.delivery_longitude,
      coalesce(g.delivery_neighborhood, g.delivery_commune, g.delivery_city) as zone,
      -- Actif: commandé dans les 14 derniers jours. À relancer: 14-30
      -- jours (encore récupérable). Inactif: plus de 30 jours, ou jamais
      -- commandé. Mêmes seuils que le segment marketing "Clients
      -- inactifs" existant (14 jours), étendus d'un palier intermédiaire
      -- pour ce module.
      case
        when c.last_order_at is null then 'inactive'
        when c.last_order_at >= now() - interval '14 days' then 'active'
        when c.last_order_at >= now() - interval '30 days' then 'to_reactivate'
        else 'inactive'
      end as status
    from public.customers c
    join latest_geo_order g on g.customer_id = c.id
    join public.restaurants r on r.id = c.restaurant_id
    where (p_restaurant_id is null or c.restaurant_id = p_restaurant_id)
      and (p_period_days is null or c.last_order_at >= now() - make_interval(days => p_period_days))
      and (
        p_search is null or btrim(p_search) = ''
        or c.full_name ilike '%' || btrim(p_search) || '%'
        or (regexp_replace(p_search, '[^0-9]', '', 'g') <> '' and c.phone ilike '%' || regexp_replace(p_search, '[^0-9]', '', 'g') || '%')
      )
  ),
  filtered as (
    select * from base where (p_status is null or status = p_status)
  )
  select jsonb_build_object(
    'customers', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', f.id,
          'name', f.full_name,
          'phone', f.phone,
          'orders_count', f.orders_count,
          'total_spent', f.total_spent,
          'last_order_at', f.last_order_at,
          'zone', f.zone,
          'lat', f.delivery_latitude,
          'lng', f.delivery_longitude,
          'status', f.status,
          'restaurant_id', f.restaurant_id,
          'restaurant_name', f.restaurant_name,
          'restaurant_slug', f.restaurant_slug,
          'currency', f.restaurant_currency
        ))
        -- Safety cap, not a pagination mechanism: this map is a density/
        -- overview tool, not a customer list -- 2000 markers is already far
        -- more than a single viewport usefully renders (clustering handles
        -- the visual density on top of this), and protects against ever
        -- shipping every customer across every tenant in one response as
        -- the platform grows.
        from (select * from filtered order by last_order_at desc nulls last limit 2000) f
      ),
      '[]'::jsonb
    ),
    'kpis', jsonb_build_object(
      'geolocated', (select count(*) from filtered),
      -- Uniquement les zones réellement déterminées (quartier/commune/
      -- ville capturés sur une vraie commande) -- un client sans aucune de
      -- ces trois valeurs (zone null ici) ne compte pour aucune zone,
      -- jamais regroupé dans une zone inventée.
      'zones_covered', (select count(distinct zone) from filtered where zone is not null),
      'total_orders', (select coalesce(sum(orders_count), 0) from filtered),
      'total_revenue', (select coalesce(sum(total_spent), 0) from filtered)
    ),
    -- Zones les plus actives: uniquement des zones réelles (jamais "Zone
    -- inconnue"), classées par nombre de clients géolocalisés. Réutilise
    -- exactement la même colonne "zone" que les marqueurs -- aucun second
    -- calcul de zone.
    'zones', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'zone', z.zone,
          'customers_count', z.customers_count,
          'orders_count', z.orders_count,
          'total_revenue', z.total_revenue
        ) order by z.customers_count desc)
        from (
          select
            zone,
            count(*) as customers_count,
            coalesce(sum(orders_count), 0) as orders_count,
            coalesce(sum(total_spent), 0) as total_revenue
          from filtered
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

revoke all on function public.get_super_admin_customer_map(uuid, text, integer, text) from public;
grant execute on function public.get_super_admin_customer_map(uuid, text, integer, text) to authenticated;
