-- Automatic distance-based delivery pricing: delivery_fee = min(distance_km
-- * 300, 2000) FCFA, using the restaurant's own lat/lng (restaurants.lat/
-- lng, already captured for driver matching) and the customer's delivery
-- coordinates (already required at checkout -- p_delivery_latitude/
-- longitude). Reuses the existing public.haversine_km helper (already used
-- for driver-distance matching) rather than reimplementing it.
--
-- Falls back to the tenant's flat restaurant_settings.delivery_fee when
-- either endpoint's coordinates are missing (tenant has no GPS configured,
-- or the customer's address was entered manually without a confirmed
-- pinned location) -- this preserves current behavior for those cases
-- instead of erroring out or silently charging 0.
--
-- get_public_menu additive change: exposes restaurant lat/lng so the
-- storefront can show a live "Distance / Livraison" preview before
-- submitting -- create_order remains the sole authority on the actual
-- charged amount.

CREATE OR REPLACE FUNCTION public.get_public_menu(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with restaurant_row as (
    select r.*
    from public.restaurants r
    where r.slug = p_slug
      and r.is_public = true
      and r.status = 'active'
    limit 1
  )
  select case
    when not exists (select 1 from restaurant_row) then null
    else jsonb_build_object(
      'restaurant', (
        select jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'slug', r.slug,
          'phone', r.phone,
          'whatsapp_phone', r.whatsapp_phone,
          'email', r.email,
          'address', r.address,
          'commune', r.commune,
          'city', r.city,
          'country_code', r.country_code,
          'currency', r.currency,
          'timezone', r.timezone,
          'logo_url', r.logo_url,
          'cover_url', r.cover_url,
          'lat', r.lat,
          'lng', r.lng
        )
        from restaurant_row r
      ),
      'settings', (
        select coalesce(
          jsonb_build_object(
            'description', s.description,
            'opening_hours', s.opening_hours,
            'minimum_order', s.minimum_order,
            'delivery_fee', s.delivery_fee,
            'delivery_enabled', s.delivery_enabled,
            'pickup_enabled', s.pickup_enabled,
            'dine_in_enabled', s.dine_in_enabled,
            'reservation_enabled', s.reservation_enabled,
            'default_prep_time_minutes', s.default_prep_time_minutes,
            'primary_color', s.primary_color,
            'whatsapp_message_template', s.whatsapp_message_template,
            'social_links', s.social_links
          ),
          '{}'::jsonb
        )
        from restaurant_row r
        left join public.restaurant_settings s on s.restaurant_id = r.id
      ),
      'availability', (
        select public.get_restaurant_availability(r.id)
        from restaurant_row r
      ),
      'categories', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug,
              'description', c.description,
              'sort_order', c.sort_order
            ) order by c.sort_order, c.name
          ),
          '[]'::jsonb
        )
        from public.restaurant_categories c
        join restaurant_row r on r.id = c.restaurant_id
        where c.is_active = true
      ),
      'products', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'category_id', p.category_id,
              'name', p.name,
              'slug', p.slug,
              'subtitle', p.subtitle,
              'description', p.description,
              'price', p.price,
              'image_path', p.image_path,
              'sku', p.sku,
              'is_available', p.is_available,
              'is_featured', p.is_featured,
              'is_daily_menu', p.is_daily_menu,
              'prep_time_minutes', p.prep_time_minutes,
              'sort_order', p.sort_order,
              'promotion', (
                select case when promo.id is null then null else jsonb_build_object(
                  'title', promo.title,
                  'type', promo.type,
                  'value', promo.value,
                  'final_price', case
                    when promo.type = 'fixed_amount' then greatest(p.price - promo.value, 0)
                    when promo.type = 'percentage' then round(p.price * (1 - promo.value / 100.0))
                    else p.price
                  end
                ) end
                from public.get_active_promotion(p.id) promo
              ),
              'option_groups', (
                select coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'id', g.id,
                      'name', g.name,
                      'is_required', g.is_required,
                      'selection_type', g.selection_type,
                      'min_select', g.min_select,
                      'max_select', g.max_select,
                      'options', (
                        select coalesce(
                          jsonb_agg(
                            jsonb_build_object('id', o.id, 'name', o.name, 'extra_price', o.extra_price)
                            order by o.sort_order, o.name
                          ),
                          '[]'::jsonb
                        )
                        from public.product_options o
                        where o.option_group_id = g.id and o.is_active = true
                      )
                    ) order by g.sort_order, g.name
                  ),
                  '[]'::jsonb
                )
                from public.product_option_groups g
                where g.product_id = p.id and g.is_active = true
              )
            ) order by p.sort_order, p.name
          ),
          '[]'::jsonb
        )
        from public.restaurant_products p
        join restaurant_row r on r.id = p.restaurant_id
        where p.is_active = true
      )
    )
  end;
$function$;

CREATE OR REPLACE FUNCTION public.create_order(p_slug text, p_fulfillment_type order_fulfillment_type, p_customer_name text, p_customer_phone text, p_items jsonb, p_delivery_commune text DEFAULT NULL::text, p_delivery_address text DEFAULT NULL::text, p_delivery_instructions text DEFAULT NULL::text, p_customer_notes text DEFAULT NULL::text, p_order_source text DEFAULT 'direct'::text, p_source_metadata jsonb DEFAULT '{}'::jsonb, p_payment_method text DEFAULT 'cash'::text, p_delivery_latitude double precision DEFAULT NULL::double precision, p_delivery_longitude double precision DEFAULT NULL::double precision, p_delivery_neighborhood text DEFAULT NULL::text, p_delivery_city text DEFAULT NULL::text, p_delivery_landmark text DEFAULT NULL::text, p_offer_id uuid DEFAULT NULL::uuid)
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

  -- Distance-based delivery pricing: delivery_fee = min(distance_km * 300,
  -- 2000), computed from the restaurant's own lat/lng and the delivery
  -- point. Falls back to the tenant's flat restaurant_settings.delivery_fee
  -- when either endpoint's coordinates are unavailable, and a free_delivery
  -- promotion still overrides everything to 0, exactly as before.
  if p_fulfillment_type = 'delivery' and not v_free_delivery then
    if v_restaurant.lat is not null and v_restaurant.lng is not null
       and p_delivery_latitude is not null and p_delivery_longitude is not null then
      v_distance_km := public.haversine_km(v_restaurant.lat, v_restaurant.lng, p_delivery_latitude, p_delivery_longitude);
      v_delivery_fee := least(round(v_distance_km * 300), 2000);
    else
      v_delivery_fee := coalesce(v_settings.delivery_fee, 0);
    end if;
  end if;
  v_total := v_subtotal + v_delivery_fee;

  -- Find-or-create the customer by normalized phone. `phone` on the live
  -- customers table already holds the normalized value directly (matches
  -- lookup_customer_name's own `phone = normalize_phone(p_phone)` lookup)
  -- -- there is no separate phone_normalized column. orders_count/
  -- total_spent/first_order_at/last_order_at are running counters (no
  -- trigger maintains them -- merge_customers only re-syncs them after a
  -- merge), so they're updated here on every order.
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
    offer_id, offer_title_snapshot
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
    v_offer_id_to_store, case when v_offer_id_to_store is not null then v_offer.title else null end
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

  perform public.create_notification(
    v_restaurant.id, v_order_id, 'new_order', 'Nouvelle commande',
    format('Commande #%s · %s %s', v_order_number, v_total, v_restaurant.currency),
    jsonb_build_object('order_number', v_order_number, 'total_amount', v_total)
  );

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
    'distance_km', v_distance_km
  );
end;
$function$;
