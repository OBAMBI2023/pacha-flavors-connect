-- Clients / CRM module. This app has no customer login (guest checkout
-- only -- see create_order's p_customer_phone/p_customer_name), so there is
-- no user_id to match on. Phone number is the only identifier every order
-- always has, so it is the sole automatic matching key. Email has no
-- capture point in the storefront today (the checkout form doesn't collect
-- it) -- the columns exist for the admin to fill in manually via edit, and
-- are matched opportunistically if a customer already has one on file.
--
-- No "locations" (rentals) concept exists anywhere in this project (no
-- table, no RPC, no UI) -- omitted entirely rather than fabricated.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text not null,
  phone_normalized text not null,
  email text,
  email_normalized text,
  address text,
  avatar_url text,
  notes text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, phone_normalized)
);

create index if not exists customers_restaurant_id_idx on public.customers (restaurant_id);
create index if not exists customers_last_seen_at_idx on public.customers (last_seen_at);

alter table public.customers enable row level security;

-- Same access model as orders: staff of the tenant can read/update, no
-- direct insert/delete policy -- rows are only ever created by the
-- SECURITY DEFINER upsert in create_order, or removed via merge_customers.
create policy customers_select_members on public.customers
  for select using (public.has_restaurant_access(restaurant_id));

create policy customers_update_members on public.customers
  for update using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

-- Links an order to its (deduplicated) customer. Nullable and backfill-free
-- on purpose: existing historical orders simply have no customer_id, which
-- is honest (we don't know which of today's customer rows they "belong"
-- to) rather than guessed.
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists orders_customer_id_idx on public.orders (customer_id);

-- Digits only: strips spaces/dashes/dots/parentheses/plus signs, which
-- covers the "espaces, tirets, caractères spéciaux" cases the spec asks
-- for. It cannot reconcile the same number typed with vs without a country
-- code (e.g. "0708112233" vs "+2250708112233") -- that needs real phone
-- parsing (libphonenumber), out of scope here and noted rather than
-- silently pretended to be solved.
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
$function$;

-- Combines two duplicate customer rows for the same restaurant: order
-- history moves to the primary, any field the primary is missing is
-- filled in from the duplicate (never the reverse -- the primary's
-- existing valid data is never overwritten by the duplicate's), and the
-- duplicate row is removed. Manual, admin-triggered -- this project's
-- phone-only matching key means a *created* duplicate is already rare, but
-- the spec explicitly asks for a manual merge tool as a safety net.
create or replace function public.merge_customers(p_primary_id uuid, p_duplicate_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_primary record;
  v_duplicate record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_primary_id = p_duplicate_id then
    raise exception 'Impossible de fusionner un client avec lui-même';
  end if;

  select * into v_primary from public.customers where id = p_primary_id;
  select * into v_duplicate from public.customers where id = p_duplicate_id;

  if v_primary.id is null or v_duplicate.id is null then
    raise exception 'Client introuvable';
  end if;
  if v_primary.restaurant_id <> v_duplicate.restaurant_id then
    raise exception 'Les deux clients doivent appartenir au même restaurant';
  end if;
  if not public.has_restaurant_access(v_primary.restaurant_id) then
    raise exception 'Forbidden';
  end if;

  update public.orders set customer_id = p_primary_id where customer_id = p_duplicate_id;

  update public.customers
  set
    email = coalesce(v_primary.email, v_duplicate.email),
    email_normalized = coalesce(v_primary.email_normalized, v_duplicate.email_normalized),
    address = coalesce(v_primary.address, v_duplicate.address),
    avatar_url = coalesce(v_primary.avatar_url, v_duplicate.avatar_url),
    notes = coalesce(v_primary.notes, v_duplicate.notes),
    first_seen_at = least(v_primary.first_seen_at, v_duplicate.first_seen_at),
    last_seen_at = greatest(v_primary.last_seen_at, v_duplicate.last_seen_at),
    updated_at = now()
  where id = p_primary_id;

  delete from public.customers where id = p_duplicate_id;
end;
$function$;

revoke all on function public.merge_customers(uuid, uuid) from public;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;

-- Per-customer order count/spend, computed live (never a stored,
-- driftable counter) so a cancelled/refunded order or an edited total is
-- always reflected correctly. security_invoker means it runs with the
-- querying user's own permissions, so it's covered by the same RLS as the
-- customers/orders tables underneath -- no separate policy needed.
create or replace view public.customer_summary
with (security_invoker = true) as
select
  c.id,
  c.restaurant_id,
  c.name,
  c.phone,
  c.email,
  c.address,
  c.avatar_url,
  c.notes,
  c.first_seen_at,
  c.last_seen_at,
  coalesce(o.orders_count, 0) as orders_count,
  coalesce(o.total_spent, 0) as total_spent
from public.customers c
left join (
  select customer_id, count(*) as orders_count, sum(total_amount) filter (where status <> 'cancelled') as total_spent
  from public.orders
  where customer_id is not null
  group by customer_id
) o on o.customer_id = c.id;

-- Additive change to create_order's *body* only (same signature -- the
-- upsert below uses params it already has, no new one needed): after the
-- order is created, find-or-create the customer by normalized phone and
-- link the order to it. Runs inside the same transaction as order
-- creation, so it can never leave an order linked to a half-written
-- customer row.
CREATE OR REPLACE FUNCTION public.create_order(p_slug text, p_fulfillment_type order_fulfillment_type, p_customer_name text, p_customer_phone text, p_items jsonb, p_delivery_commune text DEFAULT NULL::text, p_delivery_address text DEFAULT NULL::text, p_delivery_instructions text DEFAULT NULL::text, p_customer_notes text DEFAULT NULL::text, p_order_source text DEFAULT 'direct'::text, p_source_metadata jsonb DEFAULT '{}'::jsonb, p_payment_method text DEFAULT 'cash'::text, p_delivery_latitude double precision DEFAULT NULL::double precision, p_delivery_longitude double precision DEFAULT NULL::double precision, p_delivery_neighborhood text DEFAULT NULL::text, p_delivery_city text DEFAULT NULL::text, p_delivery_landmark text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_restaurant record;
  v_settings record;
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
  v_item_count integer := 0;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_unit_price numeric;
  v_options_price numeric;
  v_line_total numeric;
  v_order_item_id uuid;
  v_option text;
  v_option_id uuid;
  v_option_row record;
  v_group record;
  v_selected_count integer;
  v_order_source text;
  v_payment_method public.payment_method;
  v_payment_status public.payment_status;
  v_promo public.product_promotions;
  v_discount_amount numeric := 0;
  v_free_delivery boolean := false;
  v_availability jsonb;
  v_estimated_prep_minutes integer;
  v_phone_normalized text;
  v_customer_id uuid;
  v_delivery_address_clean text;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'Le nom du client est requis';
  end if;
  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'Le téléphone du client est requis';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La commande doit contenir au moins un article';
  end if;
  if p_delivery_latitude is not null and (p_delivery_latitude < -90 or p_delivery_latitude > 90) then
    raise exception 'Latitude de livraison invalide';
  end if;
  if p_delivery_longitude is not null and (p_delivery_longitude < -180 or p_delivery_longitude > 180) then
    raise exception 'Longitude de livraison invalide';
  end if;

  v_order_source := case
    when p_order_source in ('direct', 'marketplace', 'qr_code', 'unknown') then p_order_source
    else 'unknown'
  end;
  v_payment_method := case
    when p_payment_method in ('cash', 'mobile_money', 'card', 'online') then p_payment_method::public.payment_method
    else 'unknown'::public.payment_method
  end;
  v_payment_status := case when v_payment_method = 'cash' then 'cash_pending'::public.payment_status else 'pending'::public.payment_status end;

  select r.id, r.currency
    into v_restaurant
    from public.restaurants r
    where r.slug = p_slug
      and r.is_public = true
      and r.status = 'active'
    limit 1;

  if v_restaurant.id is null then
    raise exception 'Restaurant introuvable ou indisponible';
  end if;

  v_availability := public.get_restaurant_availability(v_restaurant.id);
  if not coalesce((v_availability->>'is_open')::boolean, false) then
    raise exception 'Ce restaurant est actuellement fermé. Les commandes ne sont pas acceptées pour le moment.';
  end if;

  select s.delivery_enabled, s.pickup_enabled, s.delivery_fee, s.minimum_order
    into v_settings
    from public.restaurant_settings s
    where s.restaurant_id = v_restaurant.id;

  if p_fulfillment_type = 'delivery' and coalesce(v_settings.delivery_enabled, true) = false then
    raise exception 'La livraison n''est pas disponible pour ce restaurant';
  end if;
  if p_fulfillment_type = 'pickup' and coalesce(v_settings.pickup_enabled, true) = false then
    raise exception 'Le retrait sur place n''est pas disponible pour ce restaurant';
  end if;
  if p_fulfillment_type = 'delivery' and btrim(coalesce(p_delivery_address, '')) = '' then
    raise exception 'Adresse de livraison requise';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Quantité invalide pour un article';
    end if;

    select p.id, p.name, p.price, p.is_active, p.is_available, p.prep_time_minutes
      into v_product
      from public.restaurant_products p
      where p.id = (v_item->>'product_id')::uuid
        and p.restaurant_id = v_restaurant.id;

    if v_product.id is null then
      raise exception 'Produit introuvable: %', (v_item->>'product_id');
    end if;
    if v_product.is_active = false or v_product.is_available = false then
      raise exception 'Produit indisponible: %', v_product.name;
    end if;
    if v_product.price is null then
      raise exception 'Ce produit n''a pas de prix défini: %', v_product.name;
    end if;

    if v_product.prep_time_minutes is not null then
      v_estimated_prep_minutes := greatest(coalesce(v_estimated_prep_minutes, 0), v_product.prep_time_minutes);
    end if;

    v_options_price := 0;

    for v_group in
      select g.id, g.name, g.is_required, g.selection_type, g.min_select, g.max_select
        from public.product_option_groups g
        where g.product_id = v_product.id
          and g.restaurant_id = v_restaurant.id
          and g.is_active = true
    loop
      select count(*)
        into v_selected_count
        from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb)) sel(option_id)
        join public.product_options po
          on po.id = sel.option_id::uuid
         and po.option_group_id = v_group.id
         and po.is_active = true;

      if v_group.is_required and v_selected_count < greatest(v_group.min_select, 1) then
        raise exception 'Sélection requise pour: %', v_group.name;
      end if;
      if v_selected_count < v_group.min_select then
        raise exception 'Sélection insuffisante pour: %', v_group.name;
      end if;
      if v_group.selection_type = 'single' and v_selected_count > 1 then
        raise exception 'Une seule option autorisée pour: %', v_group.name;
      end if;
      if v_group.max_select is not null and v_selected_count > v_group.max_select then
        raise exception 'Trop d''options sélectionnées pour: %', v_group.name;
      end if;
    end loop;

    for v_option in select * from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb)) as t(value)
    loop
      v_option_id := v_option::uuid;

      select po.id, po.name, po.extra_price, g.name as group_name
        into v_option_row
        from public.product_options po
        join public.product_option_groups g on g.id = po.option_group_id
        where po.id = v_option_id
          and po.restaurant_id = v_restaurant.id
          and g.product_id = v_product.id
          and po.is_active = true;

      if v_option_row.id is null then
        raise exception 'Option invalide pour le produit %', v_product.name;
      end if;

      v_options_price := v_options_price + v_option_row.extra_price;
    end loop;

    v_promo := public.get_active_promotion(v_product.id);
    if v_promo.id is not null then
      v_unit_price := case
        when v_promo.type = 'fixed_amount' then greatest(v_product.price - v_promo.value, 0)
        when v_promo.type = 'percentage' then round(v_product.price * (1 - v_promo.value / 100.0))
        else v_product.price
      end;
      if v_promo.type = 'free_delivery' then
        v_free_delivery := true;
      end if;
      v_discount_amount := v_discount_amount + (v_product.price - v_unit_price) * v_qty;
    else
      v_unit_price := v_product.price;
    end if;

    v_line_total := (v_unit_price + v_options_price) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + v_qty;
  end loop;

  if v_settings.minimum_order is not null and v_subtotal < v_settings.minimum_order then
    raise exception 'Montant minimum de commande non atteint (% %)', v_settings.minimum_order, v_restaurant.currency;
  end if;

  if p_fulfillment_type = 'delivery' and not v_free_delivery then
    v_delivery_fee := coalesce(v_settings.delivery_fee, 0);
  end if;
  v_total := v_subtotal + v_delivery_fee;

  -- Find-or-create the customer by normalized phone before inserting the
  -- order, so the order can be linked to it in the same insert as every
  -- other snapshot field.
  v_phone_normalized := public.normalize_phone(p_customer_phone);
  v_delivery_address_clean := case when p_fulfillment_type = 'delivery' then nullif(btrim(coalesce(p_delivery_address, '')), '') else null end;

  if v_phone_normalized is not null then
    select id into v_customer_id
      from public.customers
      where restaurant_id = v_restaurant.id and phone_normalized = v_phone_normalized
      limit 1;

    if v_customer_id is null then
      insert into public.customers (restaurant_id, name, phone, phone_normalized, address, first_seen_at, last_seen_at)
      values (v_restaurant.id, btrim(p_customer_name), btrim(p_customer_phone), v_phone_normalized, v_delivery_address_clean, now(), now())
      returning id into v_customer_id;
    else
      -- Never overwrite an existing valid value with an empty one: a newer
      -- non-blank name/address replaces the old one, but a blank new value
      -- never blanks out a previously-saved one.
      update public.customers
      set
        name = coalesce(nullif(btrim(p_customer_name), ''), name),
        phone = btrim(p_customer_phone),
        address = coalesce(v_delivery_address_clean, address),
        last_seen_at = now(),
        updated_at = now()
      where id = v_customer_id;
    end if;
  end if;

  update public.restaurants
    set next_order_number = next_order_number + 1
    where id = v_restaurant.id
    returning next_order_number - 1 into v_order_number;

  insert into public.orders (
    restaurant_id, order_number, status, fulfillment_type, customer_name, customer_phone, customer_id,
    delivery_commune, delivery_address, delivery_instructions, customer_notes,
    delivery_latitude, delivery_longitude, delivery_neighborhood, delivery_city, delivery_landmark,
    estimated_preparation_minutes,
    currency, subtotal_amount, delivery_fee_amount, discount_amount, total_amount, item_count,
    order_source, source_metadata, payment_method, payment_status
  ) values (
    v_restaurant.id, v_order_number, 'pending', p_fulfillment_type, btrim(p_customer_name), btrim(p_customer_phone), v_customer_id,
    nullif(btrim(coalesce(p_delivery_commune, '')), ''), nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), nullif(btrim(coalesce(p_customer_notes, '')), ''),
    p_delivery_latitude, p_delivery_longitude,
    nullif(btrim(coalesce(p_delivery_neighborhood, '')), ''), nullif(btrim(coalesce(p_delivery_city, '')), ''),
    nullif(btrim(coalesce(p_delivery_landmark, '')), ''),
    v_estimated_prep_minutes,
    v_restaurant.currency, v_subtotal, v_delivery_fee, v_discount_amount, v_total, v_item_count,
    v_order_source, coalesce(p_source_metadata, '{}'::jsonb), v_payment_method, v_payment_status
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;

    select p.id, p.name, p.price
      into v_product
      from public.restaurant_products p
      where p.id = (v_item->>'product_id')::uuid
        and p.restaurant_id = v_restaurant.id;

    v_promo := public.get_active_promotion(v_product.id);
    if v_promo.id is not null then
      v_unit_price := case
        when v_promo.type = 'fixed_amount' then greatest(v_product.price - v_promo.value, 0)
        when v_promo.type = 'percentage' then round(v_product.price * (1 - v_promo.value / 100.0))
        else v_product.price
      end;
    else
      v_unit_price := v_product.price;
    end if;

    v_options_price := 0;

    insert into public.order_items (
      order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot,
      options_price_snapshot, quantity, line_total, item_notes
    ) values (
      v_order_id, v_restaurant.id, v_product.id, v_product.name, v_unit_price,
      0, v_qty, 0, nullif(btrim(coalesce(v_item->>'notes', '')), '')
    )
    returning id into v_order_item_id;

    for v_option in select * from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb)) as t(value)
    loop
      v_option_id := v_option::uuid;

      select po.id, po.name, po.extra_price, g.name as group_name
        into v_option_row
        from public.product_options po
        join public.product_option_groups g on g.id = po.option_group_id
        where po.id = v_option_id
          and po.restaurant_id = v_restaurant.id;

      insert into public.order_item_options (
        order_item_id, restaurant_id, option_id, option_group_name_snapshot,
        option_name_snapshot, extra_price_snapshot
      ) values (
        v_order_item_id, v_restaurant.id, v_option_row.id, v_option_row.group_name,
        v_option_row.name, v_option_row.extra_price
      );

      v_options_price := v_options_price + v_option_row.extra_price;
    end loop;

    update public.order_items
      set options_price_snapshot = v_options_price,
          line_total = (unit_price_snapshot + v_options_price) * quantity
      where id = v_order_item_id;
  end loop;

  insert into public.order_status_history (restaurant_id, order_id, from_status, to_status, changed_by, note)
  values (v_restaurant.id, v_order_id, null, 'pending', null, 'Commande créée');

  perform public.create_notification(
    v_restaurant.id, v_order_id, 'new_order', 'Nouvelle commande',
    format('Commande #%s · %s %s', v_order_number, v_total, v_restaurant.currency),
    jsonb_build_object('order_number', v_order_number, 'total_amount', v_total)
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'currency', v_restaurant.currency,
    'subtotal_amount', v_subtotal,
    'delivery_fee_amount', v_delivery_fee,
    'discount_amount', v_discount_amount,
    'total_amount', v_total,
    'item_count', v_item_count,
    'order_source', v_order_source,
    'payment_method', v_payment_method,
    'payment_status', v_payment_status
  );
end;
$function$;
