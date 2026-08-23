-- Offers / Marketing module. Deliberately kept separate from the existing
-- product_promotions/PromotionsPanel system: that system is an automatic
-- per-product discount applied silently whenever a product is ordered.
-- "Offres" here is a distinct campaign layer -- a titled, described,
-- imaged broadcast that clients actively see, open and act on, with its
-- own read tracking and conversion attribution. Neither system is
-- modified or removed by this migration.
--
-- This app has no real customer authentication (guest checkout only,
-- see create_order's p_customer_name/p_customer_phone). The spec's
-- "client_id" for offer distribution/read-tracking is therefore mapped
-- onto this app's actual anonymous identity primitive: the localStorage
-- visitor_id already established by useVisitorTracking (see
-- visitor_sessions). A visitor becomes a "recipient" the first time an
-- active offer is listed for them; that recipient row is what read/unread
-- and open counts are computed from -- no separate offer_views table, to
-- avoid a redundant event log the recipient row already answers.
--
-- An offer always targets exactly one product (this app sells food
-- products only -- there is no abstract "service" entity to link to
-- instead).

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.restaurant_products(id) on delete cascade,
  title text not null,
  description text,
  image_path text,
  original_price numeric not null check (original_price > 0),
  offer_price numeric not null check (offer_price > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  views_count integer not null default 0,
  clicks_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_price_check check (offer_price < original_price),
  constraint offers_window_check check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index offers_restaurant_id_idx on public.offers (restaurant_id);
create index offers_status_idx on public.offers (restaurant_id, status);

alter table public.offers enable row level security;

-- Same model as product_promotions/restaurant_products: tenant staff have
-- full direct CRUD via RLS. Public/anonymous storefront reads never hit
-- this table directly -- they go through get_tenant_offers (SECURITY
-- DEFINER), matching every other public read in this app (get_public_menu,
-- get_restaurant_availability).
create policy offers_select_members on public.offers
  for select using (public.has_restaurant_access(restaurant_id));

create policy offers_insert_members on public.offers
  for insert with check (public.has_restaurant_access(restaurant_id));

create policy offers_update_members on public.offers
  for update using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

create policy offers_delete_members on public.offers
  for delete using (public.has_restaurant_access(restaurant_id));

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- One row per (offer, visitor): the anti-duplicate constraint the spec
-- asks for. is_read=false rows are the "received but unread" state,
-- created lazily by get_tenant_offers the first time the offer becomes
-- visible to that visitor; mark_offer_read flips it.
create table public.offer_recipients (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  visitor_id text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (offer_id, visitor_id)
);

create index offer_recipients_offer_id_idx on public.offer_recipients (offer_id);
create index offer_recipients_visitor_id_idx on public.offer_recipients (visitor_id);

alter table public.offer_recipients enable row level security;

-- Read-only for tenant staff (analytics); all writes happen inside the
-- SECURITY DEFINER RPCs below, bypassing RLS -- anonymous visitors have
-- no session to grant a direct-write policy to in the first place.
create policy offer_recipients_select_members on public.offer_recipients
  for select using (
    exists (select 1 from public.offers o where o.id = offer_recipients.offer_id and public.has_restaurant_access(o.restaurant_id))
  );

-- Attribution on the order itself, mirroring customer_id's pattern:
-- nullable, no backfill. offer_title_snapshot preserves the campaign name
-- even if the offer is later edited or deleted.
alter table public.orders add column if not exists offer_id uuid references public.offers(id) on delete set null;
alter table public.orders add column if not exists offer_title_snapshot text;
create index if not exists orders_offer_id_idx on public.orders (offer_id);

-- ---------------------------------------------------------------------------
-- Storefront-facing RPCs (anonymous, slug + visitor_id scoped)
-- ---------------------------------------------------------------------------

-- Lists this restaurant's currently active, in-window offers. Lazily
-- creates an unread offer_recipients row for each one the first time this
-- visitor sees it -- this is what makes the unread badge accurate from the
-- very first render, not just after an explicit "open".
create or replace function public.get_tenant_offers(p_slug text, p_visitor_id text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_result jsonb;
begin
  select r.id into v_restaurant_id
    from public.restaurants r
    where r.slug = p_slug and r.is_public = true and r.status = 'active'
    limit 1;

  if v_restaurant_id is null then
    return '[]'::jsonb;
  end if;

  if p_visitor_id is not null and btrim(p_visitor_id) <> '' then
    insert into public.offer_recipients (offer_id, visitor_id)
    select o.id, p_visitor_id
      from public.offers o
      where o.restaurant_id = v_restaurant_id
        and o.status = 'active'
        and (o.starts_at is null or o.starts_at <= now())
        and (o.ends_at is null or o.ends_at >= now())
    on conflict (offer_id, visitor_id) do nothing;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'title', o.title,
      'description', o.description,
      'image_url', o.image_path,
      'product_id', o.product_id,
      'product_name', p.name,
      'product_image_path', p.image_path,
      'original_price', o.original_price,
      'offer_price', o.offer_price,
      'discount_percent', round((1 - o.offer_price / o.original_price) * 100),
      'ends_at', o.ends_at,
      'is_read', coalesce(r.is_read, false)
    ) order by o.created_at desc), '[]'::jsonb)
    into v_result
    from public.offers o
    join public.restaurant_products p on p.id = o.product_id
    left join public.offer_recipients r on r.offer_id = o.id and r.visitor_id = p_visitor_id
    where o.restaurant_id = v_restaurant_id
      and o.status = 'active'
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at >= now());

  return v_result;
end;
$function$;

revoke all on function public.get_tenant_offers(text, text) from public;
grant execute on function public.get_tenant_offers(text, text) to anon, authenticated;

-- Unread badge count. Decoupled from get_tenant_offers's lazy-insert so the
-- badge is correct even before the list has ever been opened this visit:
-- an offer with no recipient row yet counts as unread, same as one with
-- is_read=false.
create or replace function public.get_unread_offers_count(p_slug text, p_visitor_id text)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_count integer;
begin
  if p_visitor_id is null or btrim(p_visitor_id) = '' then
    return 0;
  end if;

  select r.id into v_restaurant_id
    from public.restaurants r
    where r.slug = p_slug and r.is_public = true and r.status = 'active'
    limit 1;

  if v_restaurant_id is null then
    return 0;
  end if;

  select count(*) into v_count
    from public.offers o
    left join public.offer_recipients rec on rec.offer_id = o.id and rec.visitor_id = p_visitor_id
    where o.restaurant_id = v_restaurant_id
      and o.status = 'active'
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at >= now())
      and (rec.id is null or rec.is_read = false);

  return v_count;
end;
$function$;

revoke all on function public.get_unread_offers_count(text, text) from public;
grant execute on function public.get_unread_offers_count(text, text) to anon, authenticated;

-- Marks an offer opened by this visitor: flips is_read, stamps read_at
-- once (never overwritten by a later re-open), bumps the offer's
-- views_count only the first time, and notifies the tenant.
create or replace function public.mark_offer_read(p_offer_id uuid, p_visitor_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_offer record;
  v_already_read boolean;
begin
  if p_visitor_id is null or btrim(p_visitor_id) = '' then
    return;
  end if;

  select id, restaurant_id, title into v_offer from public.offers where id = p_offer_id;
  if v_offer.id is null then
    return;
  end if;

  select is_read into v_already_read
    from public.offer_recipients
    where offer_id = p_offer_id and visitor_id = p_visitor_id;

  insert into public.offer_recipients (offer_id, visitor_id, is_read, read_at)
  values (p_offer_id, p_visitor_id, true, now())
  on conflict (offer_id, visitor_id) do update
    set is_read = true, read_at = coalesce(public.offer_recipients.read_at, now());

  if v_already_read is distinct from true then
    update public.offers set views_count = views_count + 1 where id = p_offer_id;
    perform public.create_notification(
      v_offer.restaurant_id, null, 'offer_opened', 'Offre consultée',
      format('Un client a ouvert l''offre « %s »', v_offer.title),
      jsonb_build_object('offer_id', p_offer_id)
    );
  end if;
end;
$function$;

revoke all on function public.mark_offer_read(uuid, text) from public;
grant execute on function public.mark_offer_read(uuid, text) to anon, authenticated;

-- "Profiter de l'offre" click, fired before the checkout redirect.
create or replace function public.track_offer_click(p_offer_id uuid)
returns void
language sql
security definer
set search_path to ''
as $function$
  update public.offers set clicks_count = clicks_count + 1 where id = p_offer_id;
$function$;

revoke all on function public.track_offer_click(uuid) from public;
grant execute on function public.track_offer_click(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin analytics RPC (auth-resolved tenant, same pattern as get_visitor_stats)
-- ---------------------------------------------------------------------------

create or replace function public.get_offers_analytics()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select m.restaurant_id into v_restaurant_id
    from public.restaurant_memberships m
    where m.user_id = auth.uid() and m.status = 'active'
    order by m.created_at asc
    limit 1;

  if v_restaurant_id is null then
    raise exception 'No active restaurant membership';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'offer_id', o.id,
      'title', o.title,
      'status', o.status,
      'recipients_count', coalesce(rc.recipients, 0),
      'opened_count', coalesce(rc.opened, 0),
      'views_count', o.views_count,
      'clicks_count', o.clicks_count,
      'conversions_count', coalesce(oc.conversions, 0),
      'revenue', coalesce(oc.revenue, 0),
      'conversion_rate', case when coalesce(o.clicks_count, 0) > 0
        then round(coalesce(oc.conversions, 0)::numeric / o.clicks_count * 100, 1)
        else 0 end
    ) order by o.created_at desc), '[]'::jsonb)
    into v_result
    from public.offers o
    left join (
      select offer_id, count(*) as recipients, count(*) filter (where is_read) as opened
        from public.offer_recipients group by offer_id
    ) rc on rc.offer_id = o.id
    left join (
      select offer_id, count(*) as conversions, sum(total_amount) as revenue
        from public.orders
        where offer_id is not null and status <> 'cancelled'
        group by offer_id
    ) oc on oc.offer_id = o.id
    where o.restaurant_id = v_restaurant_id;

  return v_result;
end;
$function$;

revoke all on function public.get_offers_analytics() from public;
grant execute on function public.get_offers_analytics() to authenticated;

-- ---------------------------------------------------------------------------
-- create_order: additive p_offer_id param. Same signature preserved (new
-- param appended with a default), body extended to server-authoritatively
-- apply the offer's price to the matching line -- the client cart is only
-- ever a display hint, never trusted for pricing (same discipline as the
-- existing product_promotions lookup this mirrors). Attribution
-- (offer_id/offer_title_snapshot) is only stored if the offer's product
-- actually ended up in the order -- an offer_id that doesn't correspond to
-- anything purchased is silently ignored rather than mis-attributing the
-- order.
-- ---------------------------------------------------------------------------

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

  if p_offer_id is not null then
    select o.id, o.product_id, o.offer_price, o.title
      into v_offer
      from public.offers o
      where o.id = p_offer_id
        and o.restaurant_id = v_restaurant.id
        and o.status = 'active'
        and (o.starts_at is null or o.starts_at <= now())
        and (o.ends_at is null or o.ends_at >= now());

    if v_offer.id is null then
      raise exception 'Cette offre n''est plus disponible';
    end if;
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
    'offer_id', v_offer_id_to_store
  );
end;
$function$;
