-- Cutlery was only ever written into orders.source_metadata (a jsonb grab
-- bag), which nothing in the admin UI ever reads -- the restaurant had no
-- way to see it regardless of what the customer selected. Promoted to a
-- real, always-populated, queryable column instead.

alter table public.orders add column cutlery_requested boolean not null default false;

CREATE OR REPLACE FUNCTION public.create_order(p_slug text, p_fulfillment_type order_fulfillment_type, p_customer_name text, p_customer_phone text, p_items jsonb, p_delivery_commune text DEFAULT NULL::text, p_delivery_address text DEFAULT NULL::text, p_delivery_instructions text DEFAULT NULL::text, p_customer_notes text DEFAULT NULL::text, p_order_source text DEFAULT 'direct'::text, p_source_metadata jsonb DEFAULT '{}'::jsonb, p_payment_method text DEFAULT 'cash'::text, p_delivery_latitude double precision DEFAULT NULL::double precision, p_delivery_longitude double precision DEFAULT NULL::double precision, p_delivery_neighborhood text DEFAULT NULL::text, p_delivery_city text DEFAULT NULL::text, p_delivery_landmark text DEFAULT NULL::text, p_offer_id uuid DEFAULT NULL::uuid, p_visitor_id text DEFAULT NULL::text, p_is_for_someone_else boolean DEFAULT false, p_recipient_name text DEFAULT NULL::text, p_recipient_phone text DEFAULT NULL::text, p_recipient_address text DEFAULT NULL::text, p_recipient_city text DEFAULT NULL::text, p_recipient_neighborhood text DEFAULT NULL::text, p_recipient_landmark text DEFAULT NULL::text, p_recipient_additional_info text DEFAULT NULL::text, p_allergy_information text DEFAULT NULL::text, p_driver_note text DEFAULT NULL::text, p_customer_profile_address text DEFAULT NULL::text, p_cutlery_requested boolean DEFAULT false)
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
  v_offer record;
  v_offer_applied boolean := false;
  v_offer_id_to_store uuid;
  v_distance_km numeric;
  v_for_someone_else boolean;
  v_recipient_name text;
  v_recipient_phone text;
  v_recipient_address text;
  v_allergy_information text;
  v_notif_body text;
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

  v_for_someone_else := coalesce(p_is_for_someone_else, false);
  v_recipient_name := nullif(btrim(coalesce(p_recipient_name, '')), '');
  v_recipient_phone := nullif(btrim(coalesce(p_recipient_phone, '')), '');
  v_recipient_address := nullif(btrim(coalesce(p_recipient_address, '')), '');
  v_allergy_information := nullif(btrim(coalesce(p_allergy_information, '')), '');

  if v_for_someone_else and (v_recipient_name is null or v_recipient_phone is null or v_recipient_address is null) then
    raise exception 'Les informations du destinataire sont requises';
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

  select r.id, r.currency, r.lat, r.lng
    into v_restaurant
    from public.restaurants r
    where r.slug = p_slug
      and r.is_public = true
      and r.status = 'active'
    limit 1;

  if v_restaurant.id is null then
    raise exception 'Restaurant introuvable ou indisponible';
  end if;

  select o.id, o.product_id, o.offer_price, o.title
    into v_offer
    from public.offers o
    where o.id = p_offer_id
      and o.restaurant_id = v_restaurant.id
      and o.status = 'active'
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at >= now());

  if p_offer_id is not null and v_offer.id is null then
    raise exception 'Cette offre n''est plus disponible';
  end if;

  v_availability := public.get_restaurant_availability(v_restaurant.id);
  if not coalesce((v_availability->>'is_open')::boolean, false) then
    raise exception 'Ce restaurant est actuellement fermé. Les commandes ne sont pas acceptées pour le moment.';
  end if;

  select s.delivery_enabled, s.pickup_enabled, s.delivery_fee, s.delivery_fee_fallback, s.minimum_order
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

    if v_offer.id is not null and v_offer.product_id = v_product.id then
      v_unit_price := v_offer.offer_price;
      v_discount_amount := v_discount_amount + (v_product.price - v_unit_price) * v_qty;
      v_offer_applied := true;
    else
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
    end if;

    v_line_total := (v_unit_price + v_options_price) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + v_qty;
  end loop;

  v_offer_id_to_store := case when v_offer_applied then v_offer.id else null end;

  if v_settings.minimum_order is not null and v_subtotal < v_settings.minimum_order then
    raise exception 'Montant minimum de commande non atteint (% %)', v_settings.minimum_order, v_restaurant.currency;
  end if;

  if p_fulfillment_type = 'delivery' and not v_free_delivery then
    if v_restaurant.lat is not null and v_restaurant.lng is not null
       and p_delivery_latitude is not null and p_delivery_longitude is not null then
      v_distance_km := public.haversine_km(v_restaurant.lat, v_restaurant.lng, p_delivery_latitude, p_delivery_longitude);
      v_delivery_fee := least(round(v_distance_km * 300), 2000);
    else
      v_delivery_fee := coalesce(v_settings.delivery_fee_fallback, 1500);
    end if;
  end if;
  v_total := v_subtotal + v_delivery_fee;

  v_phone_normalized := public.normalize_phone(p_customer_phone);
  v_delivery_address_clean := case when p_fulfillment_type = 'delivery' then nullif(btrim(coalesce(p_delivery_address, '')), '') else null end;

  if v_phone_normalized is not null then
    select id into v_customer_id
      from public.customers
      where restaurant_id = v_restaurant.id and phone = v_phone_normalized
      limit 1;

    if v_customer_id is null then
      insert into public.customers (restaurant_id, full_name, phone, address, orders_count, total_spent, first_order_at, last_order_at)
      values (v_restaurant.id, btrim(p_customer_name), v_phone_normalized, v_delivery_address_clean, 1, v_total, now(), now())
      returning id into v_customer_id;
    else
      update public.customers
      set
        full_name = coalesce(nullif(btrim(p_customer_name), ''), full_name),
        address = coalesce(v_delivery_address_clean, address),
        orders_count = orders_count + 1,
        total_spent = total_spent + v_total,
        last_order_at = now(),
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
    order_source, source_metadata, payment_method, payment_status,
    offer_id, offer_title_snapshot, visitor_id,
    is_for_someone_else, recipient_name, recipient_phone, recipient_address, recipient_city,
    recipient_neighborhood, recipient_landmark, recipient_additional_info,
    allergy_information, driver_note, customer_profile_address,
    delivery_distance_km, delivery_fee_calculation_method,
    restaurant_lat_snapshot, restaurant_lng_snapshot, cutlery_requested
  ) values (
    v_restaurant.id, v_order_number, 'pending', p_fulfillment_type, btrim(p_customer_name), btrim(p_customer_phone), v_customer_id,
    nullif(btrim(coalesce(p_delivery_commune, '')), ''), nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), nullif(btrim(coalesce(p_customer_notes, '')), ''),
    p_delivery_latitude, p_delivery_longitude,
    nullif(btrim(coalesce(p_delivery_neighborhood, '')), ''), nullif(btrim(coalesce(p_delivery_city, '')), ''),
    nullif(btrim(coalesce(p_delivery_landmark, '')), ''),
    v_estimated_prep_minutes,
    v_restaurant.currency, v_subtotal, v_delivery_fee, v_discount_amount, v_total, v_item_count,
    v_order_source, coalesce(p_source_metadata, '{}'::jsonb), v_payment_method, v_payment_status,
    v_offer_id_to_store, case when v_offer_id_to_store is not null then v_offer.title else null end,
    nullif(btrim(coalesce(p_visitor_id, '')), ''),
    v_for_someone_else, v_recipient_name, v_recipient_phone, v_recipient_address,
    nullif(btrim(coalesce(p_recipient_city, '')), ''), nullif(btrim(coalesce(p_recipient_neighborhood, '')), ''),
    nullif(btrim(coalesce(p_recipient_landmark, '')), ''), nullif(btrim(coalesce(p_recipient_additional_info, '')), ''),
    v_allergy_information, nullif(btrim(coalesce(p_driver_note, '')), ''),
    nullif(btrim(coalesce(p_customer_profile_address, '')), ''),
    v_distance_km,
    case when p_fulfillment_type = 'delivery' then (case when v_distance_km is not null then 'distance' else 'fallback' end) else null end,
    v_restaurant.lat, v_restaurant.lng, coalesce(p_cutlery_requested, false)
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

    if v_offer_id_to_store is not null and v_offer.product_id = v_product.id then
      v_unit_price := v_offer.offer_price;
    else
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

  v_notif_body := format('Commande #%s · %s %s · %s article(s)', v_order_number, v_total, v_restaurant.currency, v_item_count);
  if v_allergy_information is not null then
    v_notif_body := v_notif_body || format(' · ⚠️ Allergie : %s', v_allergy_information);
  end if;
  v_notif_body := v_notif_body || format(' · Couverts : %s', case when coalesce(p_cutlery_requested, false) then 'OUI' else 'NON' end);
  v_notif_body := v_notif_body || format(' · Livraison : %s', case when p_fulfillment_type = 'delivery' then 'OUI' else 'NON' end);

  perform public.create_notification(
    v_restaurant.id, v_order_id, 'new_order', 'Nouvelle commande',
    v_notif_body,
    jsonb_build_object(
      'order_number', v_order_number, 'total_amount', v_total, 'item_count', v_item_count,
      'has_allergy', v_allergy_information is not null, 'cutlery_requested', coalesce(p_cutlery_requested, false),
      'is_delivery', p_fulfillment_type = 'delivery'
    )
  );

  if p_visitor_id is not null and btrim(p_visitor_id) <> '' then
    insert into public.client_notifications (restaurant_id, visitor_id, type, title, body, link_type, link_id)
    values (
      v_restaurant.id, btrim(p_visitor_id), 'order_confirmed', 'Commande reçue',
      format('Commande #%s · %s %s', v_order_number, v_total, v_restaurant.currency),
      'order', v_order_id
    );
  end if;

  if v_offer_id_to_store is not null then
    perform public.create_notification(
      v_restaurant.id, v_order_id, 'order_from_offer', 'Commande via une offre',
      format('Commande #%s générée par l''offre « %s »', v_order_number, v_offer.title),
      jsonb_build_object('order_number', v_order_number, 'offer_id', v_offer_id_to_store)
    );
  end if;

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
    'payment_status', v_payment_status,
    'offer_id', v_offer_id_to_store,
    'distance_km', v_distance_km,
    'cutlery_requested', coalesce(p_cutlery_requested, false)
  );
end;
$function$;

drop function if exists public.create_order(text, order_fulfillment_type, text, text, jsonb, text, text, text, text, text, jsonb, text, double precision, double precision, text, text, text, uuid, text, boolean, text, text, text, text, text, text, text, text, text, text);
