-- ---------------------------------------------------------------------------
-- Feature: per-product promotions, tenant-managed, publicly visible only
-- while active and inside their date window. Mirrors the exact RLS shape
-- already used by restaurant_products (has_restaurant_role / has_restaurant_access)
-- so a tenant can only ever manage its own restaurant's promotions.
-- ---------------------------------------------------------------------------

create type public.promotion_type as enum ('fixed_amount', 'percentage', 'free_delivery');
create type public.promotion_status as enum ('draft', 'active', 'inactive', 'expired');

create table public.product_promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.restaurant_products(id) on delete cascade,
  title text not null,
  type public.promotion_type not null,
  value numeric,
  status public.promotion_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_promotions_dates_check check (ends_at > starts_at),
  -- Shape by type: free_delivery carries no numeric value; fixed_amount and
  -- percentage always do, with percentage capped below 100.
  constraint product_promotions_value_shape_check check (
    (type = 'free_delivery' and value is null)
    or (type = 'fixed_amount' and value is not null and value > 0)
    or (type = 'percentage' and value is not null and value > 0 and value < 100)
  )
);

create index product_promotions_product_id_idx on public.product_promotions (product_id);
create index product_promotions_restaurant_id_idx on public.product_promotions (restaurant_id);

-- "une_promotion_par_plat": at most one ACTIVE promotion per product at a
-- time (drafts/inactive/expired history rows are unaffected).
create unique index product_promotions_one_active_per_product
  on public.product_promotions (product_id)
  where status = 'active';

alter table public.product_promotions enable row level security;

create policy promotions_manage_owner_manager
  on public.product_promotions for all
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner'::public.restaurant_role, 'manager'::public.restaurant_role]))
  with check (public.has_restaurant_role(restaurant_id, array['owner'::public.restaurant_role, 'manager'::public.restaurant_role]));

create policy promotions_select_members
  on public.product_promotions for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

-- Defense in depth beyond the CHECK constraint: a fixed_amount discount can
-- never reach or exceed the product's *live* price (the constraint alone
-- can't see the product row), and the product must actually belong to the
-- restaurant_id on the promotion row.
create or replace function public.validate_product_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product record;
begin
  select p.id, p.restaurant_id, p.price into v_product
    from public.restaurant_products p
    where p.id = new.product_id;

  if v_product.id is null then
    raise exception 'Produit introuvable pour cette promotion';
  end if;
  if v_product.restaurant_id <> new.restaurant_id then
    raise exception 'Ce produit n''appartient pas à ce restaurant';
  end if;
  if new.type = 'fixed_amount' and v_product.price is not null and new.value >= v_product.price then
    raise exception 'La réduction doit être inférieure au prix du plat';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger product_promotions_validate
  before insert or update on public.product_promotions
  for each row execute function public.validate_product_promotion();

-- Single source of truth for "is this product's promotion currently
-- effective" -- independent of the stored status label so a promotion whose
-- ends_at has passed is never honored even if status still says 'active'.
-- Used by both get_public_menu (display) and create_order (server-side
-- pricing, never trusts the client).
create or replace function public.get_active_promotion(p_product_id uuid)
returns public.product_promotions
language sql
stable
security definer
set search_path = ''
as $$
  select pp.*
  from public.product_promotions pp
  where pp.product_id = p_product_id
    and pp.status = 'active'
    and now() >= pp.starts_at
    and now() <= pp.ends_at
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- get_public_menu: additive diff on the exact live function -- every existing
-- field, join, and filter is unchanged. Adds a 'promotion' object per
-- product (null when none is currently effective) with the server-computed
-- final price, so the client never (re)computes the discount itself.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $function$
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
          'cover_url', r.cover_url
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

-- ---------------------------------------------------------------------------
-- create_order: additive diff on the exact live function. Every existing
-- validation branch, join, and column is unchanged; the only new behavior is
-- looking up each item's currently-effective promotion (server-side,
-- ignoring whatever price the client sent) to compute the real unit price,
-- and waiving the delivery fee when any item carries an active
-- free_delivery promotion. discount_amount (previously always inserted as a
-- literal 0) now reflects the real total discount granted.
--
-- Note: promo lookups use direct expression assignment (`v_promo :=
-- function(...)`), not `select function() into v_promo` -- the latter
-- mis-expands a composite return value in PL/pgSQL, stringifying the whole
-- row and attempting to cast it against the first field's type.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_slug text,
  p_fulfillment_type public.order_fulfillment_type,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_delivery_commune text default null,
  p_delivery_address text default null,
  p_delivery_instructions text default null,
  p_customer_notes text default null,
  p_order_source text default 'direct',
  p_source_metadata jsonb default '{}'::jsonb,
  p_payment_method text default 'cash'
) returns jsonb
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
  v_order_source text;
  v_payment_method public.payment_method;
  v_payment_status public.payment_status;
  v_promo public.product_promotions;
  v_discount_amount numeric := 0;
  v_free_delivery boolean := false;
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

    -- Server-computed price: never trust a client-sent price. Looks up the
    -- product's currently-effective promotion (get_active_promotion already
    -- re-verifies the date window and status independently of anything the
    -- client claims).
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

  update public.restaurants
    set next_order_number = next_order_number + 1
    where id = v_restaurant.id
    returning next_order_number - 1 into v_order_number;

  insert into public.orders (
    restaurant_id, order_number, status, fulfillment_type, customer_name, customer_phone,
    delivery_commune, delivery_address, delivery_instructions, customer_notes,
    currency, subtotal_amount, delivery_fee_amount, discount_amount, total_amount, item_count,
    order_source, source_metadata, payment_method, payment_status
  ) values (
    v_restaurant.id, v_order_number, 'pending', p_fulfillment_type, btrim(p_customer_name), btrim(p_customer_phone),
    nullif(btrim(coalesce(p_delivery_commune, '')), ''), nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), nullif(btrim(coalesce(p_customer_notes, '')), ''),
    v_restaurant.currency, v_subtotal, v_delivery_fee, v_discount_amount, v_total, v_item_count,
    v_order_source, coalesce(p_source_metadata, '{}'::jsonb), v_payment_method, v_payment_status
  )
  returning id into v_order_id;

  -- Pass 2: now that the order exists, persist the same validated data as
  -- immutable snapshots (re-reading and recomputing, not trusting the pass-1
  -- values verbatim, keeps this simple and correct even though it re-queries).
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
$$;
