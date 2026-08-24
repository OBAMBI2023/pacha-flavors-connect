-- SAOVIA Delivery -- create_delivery now audits unconditionally via
-- log_organization_audit_event(p_organization_id, ...) instead of the
-- previous `if v_org.restaurant_id is not null` gate around log_audit_event.
-- log_organization_audit_event resolves restaurant_id internally from
-- organizations (populated when available, left null otherwise) -- the
-- exact fix the organization-scoped audit migration (20260828500000) was
-- built for. Every other line of the function -- signature, SECURITY
-- DEFINER, search_path, every validation and the has_organization_access
-- cross-tenant guard -- is byte-identical to the live definition.
create or replace function public.create_delivery(p_organization_id uuid, p_order_id text, p_customer_name text, p_customer_phone text, p_pickup_name text, p_pickup_phone text, p_pickup_address text, p_destination_name text, p_destination_phone text, p_destination_address text, p_external_reference text DEFAULT NULL::text, p_delivery_provider delivery_provider DEFAULT 'SAOVIA'::delivery_provider, p_pickup_latitude double precision DEFAULT NULL::double precision, p_pickup_longitude double precision DEFAULT NULL::double precision, p_destination_latitude double precision DEFAULT NULL::double precision, p_destination_longitude double precision DEFAULT NULL::double precision, p_package_description text DEFAULT NULL::text, p_package_weight numeric DEFAULT NULL::numeric, p_package_quantity integer DEFAULT 1, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org record;
  v_delivery_id uuid;
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

  insert into public.deliveries (
    organization_id, order_id, external_reference, delivery_provider, status,
    customer_name, customer_phone,
    pickup_name, pickup_phone, pickup_address, pickup_latitude, pickup_longitude,
    destination_name, destination_phone, destination_address, destination_latitude, destination_longitude,
    package_description, package_weight, package_quantity,
    metadata
  ) values (
    p_organization_id, btrim(p_order_id), nullif(btrim(coalesce(p_external_reference, '')), ''), p_delivery_provider, 'pending',
    btrim(p_customer_name), btrim(p_customer_phone),
    btrim(p_pickup_name), btrim(p_pickup_phone), btrim(p_pickup_address), p_pickup_latitude, p_pickup_longitude,
    btrim(p_destination_name), btrim(p_destination_phone), btrim(p_destination_address), p_destination_latitude, p_destination_longitude,
    nullif(btrim(coalesce(p_package_description, '')), ''), p_package_weight, p_package_quantity,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_delivery_id;

  insert into public.delivery_status_history (delivery_id, from_status, to_status, changed_by, note)
  values (v_delivery_id, null, 'pending', auth.uid(), 'Livraison créée via API');

  perform public.log_organization_audit_event(
    p_organization_id, auth.uid(), 'delivery', v_delivery_id, 'delivery_created',
    jsonb_build_object('organization_id', p_organization_id, 'order_id', p_order_id, 'delivery_provider', p_delivery_provider)
  );

  return jsonb_build_object(
    'delivery_id', v_delivery_id,
    'organization_id', p_organization_id,
    'order_id', p_order_id,
    'status', 'pending',
    'delivery_provider', p_delivery_provider
  );
end;
$function$;
