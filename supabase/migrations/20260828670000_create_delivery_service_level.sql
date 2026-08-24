-- SAOVIA Delivery Phase 2B -- evolves create_delivery to accept
-- service_level/scheduled_pickup_at/declared_value/cod_amount/
-- delivery_instructions/pickup_point_id and to compute+store the
-- authoritative price server-side via compute_delivery_pricing(). Adding
-- parameters changes the function's identity (name + arg-type list) --
-- CREATE OR REPLACE would silently create a second overload alongside the
-- old 20-arg one instead of replacing it. Explicit DROP of the exact old
-- signature first, exactly like the create_order overload fixes earlier in
-- this project (20260828080000, 20260828220000).
drop function public.create_delivery(uuid, text, text, text, text, text, text, text, text, text, text, delivery_provider, double precision, double precision, double precision, double precision, text, numeric, integer, jsonb);

create function public.create_delivery(
  p_organization_id uuid,
  p_order_id text,
  p_customer_name text,
  p_customer_phone text,
  p_pickup_name text,
  p_pickup_phone text,
  p_pickup_address text,
  p_destination_name text,
  p_destination_phone text,
  p_destination_address text,
  p_external_reference text DEFAULT NULL::text,
  p_delivery_provider delivery_provider DEFAULT 'SAOVIA'::delivery_provider,
  p_pickup_latitude double precision DEFAULT NULL::double precision,
  p_pickup_longitude double precision DEFAULT NULL::double precision,
  p_destination_latitude double precision DEFAULT NULL::double precision,
  p_destination_longitude double precision DEFAULT NULL::double precision,
  p_package_description text DEFAULT NULL::text,
  p_package_weight numeric DEFAULT NULL::numeric,
  p_package_quantity integer DEFAULT 1,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_service_level delivery_service_level DEFAULT 'EXPRESS'::delivery_service_level,
  p_scheduled_pickup_at timestamptz DEFAULT NULL::timestamptz,
  p_declared_value numeric DEFAULT NULL::numeric,
  p_cod_amount numeric DEFAULT NULL::numeric,
  p_delivery_instructions text DEFAULT NULL::text,
  p_pickup_point_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org record;
  v_delivery_id uuid;
  v_pricing record;
  v_pickup_point record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_organization_access(p_organization_id) then
    raise exception 'Forbidden';
  end if;

  select o.id, o.restaurant_id, o.status
    into v_org
    from public.organizations o
    where o.id = p_organization_id
    for update;

  if v_org.id is null then
    raise exception 'Organisation introuvable';
  end if;
  if v_org.status <> 'active' then
    raise exception 'Cette organisation est suspendue';
  end if;

  if p_delivery_provider <> 'SAOVIA' then
    raise exception 'Seul le mode SAOVIA est pris en charge par cette API pour le moment';
  end if;

  if p_order_id is null or btrim(p_order_id) = '' then
    raise exception 'order_id est requis';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'Le nom du client est requis';
  end if;
  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'Le téléphone du client est requis';
  end if;
  if p_pickup_name is null or btrim(p_pickup_name) = '' then
    raise exception 'Le nom du point de collecte est requis';
  end if;
  if p_pickup_phone is null or btrim(p_pickup_phone) = '' then
    raise exception 'Le téléphone du point de collecte est requis';
  end if;
  if p_pickup_address is null or btrim(p_pickup_address) = '' then
    raise exception 'L''adresse de collecte est requise';
  end if;
  if p_destination_name is null or btrim(p_destination_name) = '' then
    raise exception 'Le nom du destinataire est requis';
  end if;
  if p_destination_phone is null or btrim(p_destination_phone) = '' then
    raise exception 'Le téléphone du destinataire est requis';
  end if;
  if p_destination_address is null or btrim(p_destination_address) = '' then
    raise exception 'L''adresse de livraison est requise';
  end if;
  if p_package_quantity is null or p_package_quantity < 1 then
    raise exception 'La quantité de colis doit être au moins 1';
  end if;
  if p_package_weight is not null and p_package_weight < 0 then
    raise exception 'Le poids du colis ne peut pas être négatif';
  end if;
  if p_declared_value is not null and p_declared_value < 0 then
    raise exception 'La valeur déclarée ne peut pas être négative';
  end if;
  if p_cod_amount is not null and p_cod_amount < 0 then
    raise exception 'Le montant à encaisser ne peut pas être négatif';
  end if;

  -- Service level / scheduling: server-side, never trusts the client's own
  -- date-picker constraint. J+1 relative to Africa/Abidjan, matching the
  -- rest of this app's default business timezone.
  if p_service_level = 'EXPRESS' then
    if p_scheduled_pickup_at is not null then
      raise exception 'Une livraison EXPRESS ne doit pas avoir de créneau programmé';
    end if;
  elsif p_service_level = 'SCHEDULED' then
    if p_scheduled_pickup_at is null then
      raise exception 'Une collecte programmée nécessite un créneau';
    end if;
    if (p_scheduled_pickup_at at time zone 'Africa/Abidjan')::date < ((now() at time zone 'Africa/Abidjan')::date + 1) then
      raise exception 'La collecte programmée doit être au minimum le lendemain';
    end if;
  end if;

  -- Pickup point: if supplied, must belong to the same organization --
  -- never trust a pickup_point_id from another tenant.
  if p_pickup_point_id is not null then
    select pp.id into v_pickup_point
      from public.pickup_points pp
      where pp.id = p_pickup_point_id and pp.organization_id = p_organization_id;
    if v_pickup_point.id is null then
      raise exception 'Point de collecte introuvable pour cette organisation';
    end if;
  end if;

  -- Authoritative price -- computed here, never accepted from the caller.
  select * into v_pricing
    from public.compute_delivery_pricing(p_pickup_latitude, p_pickup_longitude, p_destination_latitude, p_destination_longitude);

  insert into public.deliveries (
    organization_id, order_id, external_reference, delivery_provider, status,
    customer_name, customer_phone,
    pickup_name, pickup_phone, pickup_address, pickup_latitude, pickup_longitude,
    destination_name, destination_phone, destination_address, destination_latitude, destination_longitude,
    package_description, package_weight, package_quantity,
    metadata,
    service_level, scheduled_pickup_at, declared_value, cod_amount, delivery_instructions, pickup_point_id,
    delivery_fee, delivery_distance_km, delivery_fee_calculation_method
  ) values (
    p_organization_id, btrim(p_order_id), nullif(btrim(coalesce(p_external_reference, '')), ''), p_delivery_provider, 'pending',
    btrim(p_customer_name), btrim(p_customer_phone),
    btrim(p_pickup_name), btrim(p_pickup_phone), btrim(p_pickup_address), p_pickup_latitude, p_pickup_longitude,
    btrim(p_destination_name), btrim(p_destination_phone), btrim(p_destination_address), p_destination_latitude, p_destination_longitude,
    nullif(btrim(coalesce(p_package_description, '')), ''), p_package_weight, p_package_quantity,
    coalesce(p_metadata, '{}'::jsonb),
    p_service_level, p_scheduled_pickup_at, p_declared_value, p_cod_amount, nullif(btrim(coalesce(p_delivery_instructions, '')), ''), p_pickup_point_id,
    v_pricing.fee, v_pricing.distance_km, v_pricing.method
  )
  returning id into v_delivery_id;

  insert into public.delivery_status_history (delivery_id, from_status, to_status, changed_by, note)
  values (v_delivery_id, null, 'pending', auth.uid(), 'Livraison créée via API');

  perform public.log_organization_audit_event(
    p_organization_id, auth.uid(), 'delivery', v_delivery_id, 'delivery_created',
    jsonb_build_object('organization_id', p_organization_id, 'order_id', p_order_id, 'delivery_provider', p_delivery_provider, 'service_level', p_service_level)
  );

  return jsonb_build_object(
    'delivery_id', v_delivery_id,
    'organization_id', p_organization_id,
    'order_id', p_order_id,
    'status', 'pending',
    'delivery_provider', p_delivery_provider,
    'service_level', p_service_level,
    'scheduled_pickup_at', p_scheduled_pickup_at,
    'delivery_fee', v_pricing.fee,
    'delivery_distance_km', v_pricing.distance_km,
    'delivery_fee_calculation_method', v_pricing.method
  );
end;
$function$;

revoke all on function public.create_delivery(
  uuid, text, text, text, text, text, text, text, text, text, text, delivery_provider,
  double precision, double precision, double precision, double precision, text, numeric, integer, jsonb,
  delivery_service_level, timestamptz, numeric, numeric, text, uuid
) from public, anon;
grant execute on function public.create_delivery(
  uuid, text, text, text, text, text, text, text, text, text, text, delivery_provider,
  double precision, double precision, double precision, double precision, text, numeric, integer, jsonb,
  delivery_service_level, timestamptz, numeric, numeric, text, uuid
) to authenticated;
