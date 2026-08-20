-- Denormalized total quantity across an order's lines, so the dashboard's
-- order list/cards can show "N articles" without an N+1 query per order on
-- every load and every Realtime update.
alter table public.orders
  add column item_count integer not null default 0 check (item_count >= 0);

create or replace function public.create_order(
  p_slug text,
  p_fulfillment_type public.order_fulfillment_type,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_delivery_commune text default null,
  p_delivery_address text default null,
  p_delivery_instructions text default null,
  p_customer_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  if p_fulfillment_type = 'delivery' and (btrim(coalesce(p_delivery_commune, '')) = '' or btrim(coalesce(p_delivery_address, '')) = '') then
    raise exception 'Adresse de livraison requise';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Quantité invalide pour un article';
    end if;

    select p.id, p.name, p.price, p.is_active, p.is_available
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

    v_unit_price := v_product.price;
    v_line_total := (v_unit_price + v_options_price) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + v_qty;
  end loop;

  if v_settings.minimum_order is not null and v_subtotal < v_settings.minimum_order then
    raise exception 'Montant minimum de commande non atteint (% %)', v_settings.minimum_order, v_restaurant.currency;
  end if;

  if p_fulfillment_type = 'delivery' then
    v_delivery_fee := coalesce(v_settings.delivery_fee, 0);
  end if;
  v_total := v_subtotal + v_delivery_fee;

  update public.restaurants
    set next_order_number = next_order_number + 1
    where id = v_restaurant.id
    returning next_order_number - 1 into v_order_number;

  insert into public.orders (
    restaurant_id, order_number, status, fulfillment_type, customer_name, customer_phone,
    delivery_commune, delivery_address, delivery_instructions, customer_notes,
    currency, subtotal_amount, delivery_fee_amount, total_amount, item_count
  ) values (
    v_restaurant.id, v_order_number, 'pending', p_fulfillment_type, btrim(p_customer_name), btrim(p_customer_phone),
    nullif(btrim(coalesce(p_delivery_commune, '')), ''), nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), nullif(btrim(coalesce(p_customer_notes, '')), ''),
    v_restaurant.currency, v_subtotal, v_delivery_fee, v_total, v_item_count
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

    v_options_price := 0;

    insert into public.order_items (
      order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot,
      options_price_snapshot, quantity, line_total, item_notes
    ) values (
      v_order_id, v_restaurant.id, v_product.id, v_product.name, v_product.price,
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

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'currency', v_restaurant.currency,
    'subtotal_amount', v_subtotal,
    'delivery_fee_amount', v_delivery_fee,
    'total_amount', v_total,
    'item_count', v_item_count
  );
end;
$$;
