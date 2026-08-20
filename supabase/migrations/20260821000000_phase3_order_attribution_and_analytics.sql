-- Phase 3 "Pilotage, statistiques et attribution": order source attribution
-- (order_source/source_metadata) and the tenant-scoped analytics RPC that
-- powers the dashboard Home + Statistiques pages. Nothing here changes the
-- order pipeline's business rules -- create_order gains two trailing,
-- server-validated parameters; update_order_status is untouched.

-- ---------------------------------------------------------------------------
-- Order source attribution
-- ---------------------------------------------------------------------------
alter table public.orders
  add column order_source text not null default 'direct',
  add column source_metadata jsonb not null default '{}'::jsonb;

alter table public.orders
  add constraint orders_order_source_check
  check (order_source in ('direct', 'marketplace', 'qr_code', 'unknown'));

create index orders_restaurant_id_source_created_at_idx
  on public.orders (restaurant_id, order_source, created_at desc);

-- ---------------------------------------------------------------------------
-- create_order: extended with order_source/source_metadata. The source is
-- never trusted verbatim from the client -- any value outside the known
-- allow-list is normalized to 'unknown' server-side.
-- ---------------------------------------------------------------------------
drop function if exists public.create_order(text, public.order_fulfillment_type, text, text, jsonb, text, text, text, text);

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
  p_source_metadata jsonb default '{}'::jsonb
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
  v_order_source text;
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
    currency, subtotal_amount, delivery_fee_amount, total_amount, item_count,
    order_source, source_metadata
  ) values (
    v_restaurant.id, v_order_number, 'pending', p_fulfillment_type, btrim(p_customer_name), btrim(p_customer_phone),
    nullif(btrim(coalesce(p_delivery_commune, '')), ''), nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), nullif(btrim(coalesce(p_customer_notes, '')), ''),
    v_restaurant.currency, v_subtotal, v_delivery_fee, v_total, v_item_count,
    v_order_source, coalesce(p_source_metadata, '{}'::jsonb)
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
    'item_count', v_item_count,
    'order_source', v_order_source
  );
end;
$$;

revoke all on function public.create_order(text, public.order_fulfillment_type, text, text, jsonb, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(text, public.order_fulfillment_type, text, text, jsonb, text, text, text, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_restaurant_dashboard_stats: tenant-scoped analytics for a [start_date,
-- end_date] window (inclusive, interpreted in the restaurant's own
-- timezone). The tenant is resolved from auth.uid() exactly like
-- update_order_status does -- the caller never supplies a restaurant_id.
-- Revenue is always "delivered" orders only, using the immutable
-- subtotal/total snapshots already on `orders`; cancelled orders are always
-- excluded from revenue and reported separately.
-- ---------------------------------------------------------------------------
create or replace function public.get_restaurant_dashboard_stats(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant_id uuid;
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_days integer;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_current jsonb;
  v_previous jsonb;
  v_revenue_series jsonb;
  v_top_products jsonb;
  v_hourly jsonb;
  v_weekday jsonb;
  v_sources jsonb;
  v_operational jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select m.restaurant_id
    into v_restaurant_id
    from public.restaurant_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
    order by m.created_at asc
    limit 1;

  if v_restaurant_id is null then
    raise exception 'Aucun restaurant associé à cet utilisateur';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'Période invalide';
  end if;

  select coalesce(r.timezone, 'Africa/Abidjan') into v_tz from public.restaurants r where r.id = v_restaurant_id;

  v_start := (p_start_date::timestamp) at time zone v_tz;
  v_end := ((p_end_date + 1)::timestamp) at time zone v_tz;
  v_days := (p_end_date - p_start_date) + 1;
  v_prev_end := v_start;
  v_prev_start := v_start - (v_days || ' days')::interval;

  select jsonb_build_object(
    'revenue', coalesce(sum(total_amount) filter (where status = 'delivered'), 0),
    'orders_count', count(*) filter (where status != 'cancelled'),
    'delivered_count', count(*) filter (where status = 'delivered'),
    'average_order_value', case
      when count(*) filter (where status = 'delivered') > 0
      then round(coalesce(sum(total_amount) filter (where status = 'delivered'), 0) / count(*) filter (where status = 'delivered'), 2)
      else null
    end,
    'items_sold', coalesce(sum(item_count) filter (where status = 'delivered'), 0),
    'cancelled_orders', count(*) filter (where status = 'cancelled'),
    'cancelled_amount', coalesce(sum(total_amount) filter (where status = 'cancelled'), 0),
    'cancellation_rate', case when count(*) > 0 then round(count(*) filter (where status = 'cancelled')::numeric / count(*) * 100, 1) else 0 end,
    'in_progress_revenue', coalesce(sum(total_amount) filter (where status not in ('delivered', 'cancelled')), 0),
    'total_orders', count(*)
  )
  into v_current
  from public.orders
  where restaurant_id = v_restaurant_id
    and created_at >= v_start and created_at < v_end;

  select jsonb_build_object(
    'revenue', coalesce(sum(total_amount) filter (where status = 'delivered'), 0),
    'orders_count', count(*) filter (where status != 'cancelled'),
    'average_order_value', case
      when count(*) filter (where status = 'delivered') > 0
      then round(coalesce(sum(total_amount) filter (where status = 'delivered'), 0) / count(*) filter (where status = 'delivered'), 2)
      else null
    end
  )
  into v_previous
  from public.orders
  where restaurant_id = v_restaurant_id
    and created_at >= v_prev_start and created_at < v_prev_end;

  with days as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as day
  ),
  daily as (
    select (date_trunc('day', created_at at time zone v_tz))::date as day,
           sum(total_amount) filter (where status = 'delivered') as revenue,
           count(*) filter (where status != 'cancelled') as orders
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', days.day, 'revenue', coalesce(daily.revenue, 0), 'orders', coalesce(daily.orders, 0)
    ) order by days.day), '[]'::jsonb)
  into v_revenue_series
  from days left join daily on daily.day = days.day;

  with top as (
    select oi.product_name_snapshot as name, sum(oi.quantity) as quantity, sum(oi.line_total) as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.restaurant_id = v_restaurant_id
      and o.status = 'delivered'
      and o.created_at >= v_start and o.created_at < v_end
    group by oi.product_name_snapshot
    order by sum(oi.line_total) desc
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'revenue', revenue) order by revenue desc), '[]'::jsonb)
  into v_top_products
  from top;

  with hourly as (
    select extract(hour from created_at at time zone v_tz)::int as hour,
           count(*) filter (where status != 'cancelled') as orders_count,
           sum(total_amount) filter (where status = 'delivered') as revenue
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'hour', hour, 'orders_count', orders_count, 'revenue', coalesce(revenue, 0)
    ) order by hour), '[]'::jsonb)
  into v_hourly
  from hourly;

  with wd as (
    select extract(dow from created_at at time zone v_tz)::int as weekday,
           count(*) filter (where status != 'cancelled') as orders_count,
           sum(total_amount) filter (where status = 'delivered') as revenue
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'weekday', weekday, 'orders_count', orders_count, 'revenue', coalesce(revenue, 0)
    ) order by weekday), '[]'::jsonb)
  into v_weekday
  from wd;

  with src as (
    select order_source,
           count(*) as total_orders,
           count(*) filter (where status = 'delivered') as delivered_orders,
           sum(total_amount) filter (where status = 'delivered') as revenue
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by order_source
  ),
  grand as (
    select greatest(sum(total_orders), 1) as total from src
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'source', src.order_source,
      'orders_count', src.total_orders,
      'share', round(src.total_orders::numeric / grand.total * 100, 1),
      'revenue', coalesce(src.revenue, 0),
      'average_order_value', case when src.delivered_orders > 0 then round(src.revenue / src.delivered_orders, 2) else null end
    ) order by src.total_orders desc), '[]'::jsonb)
  into v_sources
  from src, grand;

  select jsonb_build_object(
    'avg_confirmation_minutes', (
      select round(avg(extract(epoch from (confirmed_at - created_at)) / 60)::numeric, 1)
      from public.orders
      where restaurant_id = v_restaurant_id
        and created_at >= v_start and created_at < v_end
        and confirmed_at is not null
    ),
    'avg_preparation_minutes', (
      select round(avg(extract(epoch from (ready_at - preparing_at)) / 60)::numeric, 1)
      from public.orders
      where restaurant_id = v_restaurant_id
        and created_at >= v_start and created_at < v_end
        and preparing_at is not null and ready_at is not null
    ),
    'avg_total_minutes', (
      select round(avg(extract(epoch from (delivered_at - created_at)) / 60)::numeric, 1)
      from public.orders
      where restaurant_id = v_restaurant_id
        and created_at >= v_start and created_at < v_end
        and delivered_at is not null
    )
  )
  into v_operational;

  return jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    'current', v_current,
    'previous', v_previous,
    'revenue_series', v_revenue_series,
    'top_products', v_top_products,
    'hourly_distribution', v_hourly,
    'weekday_distribution', v_weekday,
    'source_breakdown', v_sources,
    'operational_metrics', v_operational
  );
end;
$$;

revoke all on function public.get_restaurant_dashboard_stats(date, date) from public, anon;
grant execute on function public.get_restaurant_dashboard_stats(date, date) to authenticated;
