-- SAOVIA Delivery -- Phase 2A: create_delivery, the single entry point that
-- creates a `deliveries` row. Same shape as assign_driver_to_order /
-- create_order: auth check -> lock/validate -> insert -> history -> audit
-- -> return jsonb. No API/Edge Function/webhook/UI, no dispatch touched.
--
-- Authorization never trusts the caller-supplied organization_id as fact --
-- has_organization_access() re-derives access server-side from the
-- caller's own restaurant_memberships (or is_super_admin()), exactly like
-- every other tenant-scoped RPC in this codebase.
--
-- delivery_provider is a typed enum parameter, not text: an invalid raw
-- value is rejected by Postgres at the call boundary before the function
-- body even runs. TENANT is a valid enum member but is explicitly refused
-- here -- see migration comment / report for why.
--
-- audit_logs.restaurant_id is NOT NULL, but organizations.restaurant_id is
-- nullable (a genuine external merchant has no restaurant row). The audit
-- entry is skipped, not fabricated, when the organization has no linked
-- restaurant -- audit_logs itself is not widened.
create or replace function public.create_delivery(
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
  p_external_reference text default null,
  p_delivery_provider public.delivery_provider default 'SAOVIA'::public.delivery_provider,
  p_pickup_latitude double precision default null,
  p_pickup_longitude double precision default null,
  p_destination_latitude double precision default null,
  p_destination_longitude double precision default null,
  p_package_description text default null,
  p_package_weight numeric default null,
  p_package_quantity integer default 1,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
  -- Independent of the underlying restaurant's own status: SAOVIA can
  -- suspend an organization's API access without suspending the tenant
  -- itself. Applies uniformly, including to Super Admin, matching how
  -- create_order's own availability checks apply unconditionally.
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

  if v_org.restaurant_id is not null then
    perform public.log_audit_event(
      v_org.restaurant_id, auth.uid(), 'delivery', v_delivery_id, 'delivery_created',
      jsonb_build_object('organization_id', p_organization_id, 'order_id', p_order_id, 'delivery_provider', p_delivery_provider)
    );
  end if;

  return jsonb_build_object(
    'delivery_id', v_delivery_id,
    'organization_id', p_organization_id,
    'order_id', p_order_id,
    'status', 'pending',
    'delivery_provider', p_delivery_provider
  );
end;
$function$;

revoke all on function public.create_delivery(
  uuid, text, text, text, text, text, text, text, text, text,
  text, public.delivery_provider, double precision, double precision,
  double precision, double precision, text, numeric, integer, jsonb
) from public, anon;

grant execute on function public.create_delivery(
  uuid, text, text, text, text, text, text, text, text, text,
  text, public.delivery_provider, double precision, double precision,
  double precision, double precision, text, numeric, integer, jsonb
) to authenticated;
