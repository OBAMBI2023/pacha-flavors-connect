-- Shared pricing computation, called from both quote_delivery (preview) and
-- create_delivery (authoritative, stored). Internal-only, same lockdown
-- posture as log_audit_event/create_notification -- no direct grant to
-- anyone, callable only from inside other SECURITY DEFINER functions.
-- Mirrors create_order's own haversine-based fee logic, but sources the
-- rate from delivery_zones (existing table, currently unused by anything)
-- instead of create_order's hardcoded 300/km, 2000 cap -- falls back to
-- those same constants when no active zone exists yet.
create or replace function public.compute_delivery_pricing(
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_destination_lat double precision,
  p_destination_lng double precision
)
returns table(fee numeric, distance_km numeric, method text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_distance numeric;
  v_zone record;
begin
  if p_pickup_lat is not null and p_pickup_lng is not null
     and p_destination_lat is not null and p_destination_lng is not null then
    v_distance := public.haversine_km(p_pickup_lat, p_pickup_lng, p_destination_lat, p_destination_lng);

    select z.base_fee, z.per_km_fee into v_zone
      from public.delivery_zones z
      where z.is_active = true
      order by z.created_at asc
      limit 1;

    if v_zone.base_fee is not null then
      return query select (v_zone.base_fee + round(v_distance * v_zone.per_km_fee)), v_distance, 'zone'::text;
    else
      return query select least(round(v_distance * 300), 2000)::numeric, v_distance, 'distance'::text;
    end if;
  else
    return query select 1500::numeric, null::numeric, 'fallback'::text;
  end if;
end;
$function$;

revoke all on function public.compute_delivery_pricing(double precision, double precision, double precision, double precision) from public, anon, authenticated;

-- quote_delivery: read-only preview, no auth.uid()-scoped data exposure
-- risk (pure calculation over caller-supplied coordinates + delivery_zones,
-- whose own SELECT policy is already "true" for any authenticated user).
create or replace function public.quote_delivery(
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_destination_lat double precision,
  p_destination_lng double precision,
  p_service_level public.delivery_service_level default 'EXPRESS'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pricing record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_pricing from public.compute_delivery_pricing(p_pickup_lat, p_pickup_lng, p_destination_lat, p_destination_lng);

  return jsonb_build_object(
    'delivery_fee', v_pricing.fee,
    'delivery_distance_km', v_pricing.distance_km,
    'delivery_fee_calculation_method', v_pricing.method,
    'service_level', p_service_level,
    'indicative', true
  );
end;
$function$;

revoke all on function public.quote_delivery(double precision, double precision, double precision, double precision, public.delivery_service_level) from public, anon;
grant execute on function public.quote_delivery(double precision, double precision, double precision, double precision, public.delivery_service_level) to authenticated;
