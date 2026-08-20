-- Phase 1 "Fondation commandes": orders, order_items, product options/supplements,
-- order status history, and the two RPCs that own all writes to these tables
-- (create_order for anonymous storefront checkout, update_order_status for
-- authenticated restaurant staff). Nothing here changes existing tables'
-- semantics except one additive column (restaurants.next_order_number) used
-- to hand out sequential, per-restaurant order numbers.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'
);

create type public.order_fulfillment_type as enum ('delivery', 'pickup');

-- ---------------------------------------------------------------------------
-- Sequential per-restaurant order numbers (avoids leaking a global count and
-- avoids exposing raw UUIDs to customers/staff as the order reference).
-- ---------------------------------------------------------------------------
alter table public.restaurants
  add column next_order_number bigint not null default 1;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  order_number bigint not null,
  status public.order_status not null default 'pending',
  fulfillment_type public.order_fulfillment_type not null,
  customer_name text not null,
  customer_phone text not null,
  delivery_commune text,
  delivery_address text,
  delivery_instructions text,
  customer_notes text,
  currency text not null default 'XOF',
  subtotal_amount numeric not null check (subtotal_amount >= 0),
  delivery_fee_amount numeric not null default 0 check (delivery_fee_amount >= 0),
  total_amount numeric not null check (total_amount >= 0),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  unique (restaurant_id, order_number)
);

create index orders_restaurant_id_created_at_idx on public.orders (restaurant_id, created_at desc);
create index orders_restaurant_id_status_idx on public.orders (restaurant_id, status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items (immutable price/name snapshots, never re-derived from the
-- live menu so historical orders and statistics stay accurate even after the
-- restaurant edits or deletes a product)
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  product_id uuid references public.restaurant_products(id) on delete set null,
  product_name_snapshot text not null,
  unit_price_snapshot numeric not null check (unit_price_snapshot >= 0),
  options_price_snapshot numeric not null default 0 check (options_price_snapshot >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric not null check (line_total >= 0),
  item_notes text,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_restaurant_id_idx on public.order_items (restaurant_id);

-- ---------------------------------------------------------------------------
-- Product option groups / options (schema + backend validation land in
-- Phase 1; the admin UI to manage them is Phase 4. Until a tenant configures
-- groups, every product simply has none and orders validate trivially.)
-- ---------------------------------------------------------------------------
create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  product_id uuid not null references public.restaurant_products(id) on delete cascade,
  name text not null,
  is_required boolean not null default false,
  selection_type text not null default 'single' check (selection_type in ('single', 'multiple')),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer check (max_select is null or max_select >= min_select),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_option_groups_product_id_idx on public.product_option_groups (product_id);

create trigger product_option_groups_set_updated_at
  before update on public.product_option_groups
  for each row execute function public.set_updated_at();

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.product_option_groups(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  name text not null,
  extra_price numeric not null default 0 check (extra_price >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_options_option_group_id_idx on public.product_options (option_group_id);

create trigger product_options_set_updated_at
  before update on public.product_options
  for each row execute function public.set_updated_at();

create table public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  option_id uuid references public.product_options(id) on delete set null,
  option_group_name_snapshot text not null,
  option_name_snapshot text not null,
  extra_price_snapshot numeric not null default 0 check (extra_price_snapshot >= 0),
  created_at timestamptz not null default now()
);

create index order_item_options_order_item_id_idx on public.order_item_options (order_item_id);

-- ---------------------------------------------------------------------------
-- order_status_history
-- ---------------------------------------------------------------------------
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index order_status_history_order_id_idx on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.product_options enable row level security;
alter table public.order_item_options enable row level security;
alter table public.order_status_history enable row level security;

-- orders: members can see and progress their tenant's orders. Creation is
-- only possible through create_order() (SECURITY DEFINER), never a direct
-- client insert, and rows are never deleted (cancelled is a status).
create policy orders_select_members
  on public.orders for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

create policy orders_update_members
  on public.orders for update
  to authenticated
  using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

create policy order_items_select_members
  on public.order_items for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

create policy order_item_options_select_members
  on public.order_item_options for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

create policy order_status_history_select_members
  on public.order_status_history for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

-- product option groups/options: readable by any active member, manageable
-- by owner/manager only -- identical convention to restaurant_categories /
-- restaurant_products / restaurant_settings.
create policy product_option_groups_select_members
  on public.product_option_groups for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

create policy product_option_groups_manage_owner_manager
  on public.product_option_groups for all
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::public.restaurant_role[]));

create policy product_options_select_members
  on public.product_options for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

create policy product_options_manage_owner_manager
  on public.product_options for all
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::public.restaurant_role[]));

-- ---------------------------------------------------------------------------
-- create_order: the only way an order row can ever be inserted. Runs as
-- SECURITY DEFINER because storefront customers are anonymous (no auth
-- session), mirroring get_public_menu's slug-scoped, is_public/active-gated
-- pattern -- the client never supplies a restaurant_id, and every price is
-- re-read from the live product/option rows, never trusted from the caller.
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

  -- Pass 1: validate every product/option and accumulate the subtotal
  -- entirely from live, server-side data.
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

    -- Validate the selections against this product's configured option
    -- groups (required / single-vs-multiple / min / max). No groups today
    -- for any tenant means this loop is a no-op and every order passes.
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

    -- Every option_id supplied must resolve to a real, active option that
    -- belongs to this exact product (blocks cross-product/cross-tenant ids).
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
    currency, subtotal_amount, delivery_fee_amount, total_amount
  ) values (
    v_restaurant.id, v_order_number, 'pending', p_fulfillment_type, btrim(p_customer_name), btrim(p_customer_phone),
    nullif(btrim(coalesce(p_delivery_commune, '')), ''), nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), nullif(btrim(coalesce(p_customer_notes, '')), ''),
    v_restaurant.currency, v_subtotal, v_delivery_fee, v_total
  )
  returning id into v_order_id;

  -- Pass 2: now that the order exists, persist the same validated data as
  -- immutable snapshots (re-reading, not trusting the pass-1 computations
  -- verbatim, keeps this simple and correct even though it re-queries).
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
    'total_amount', v_total
  );
end;
$$;

revoke all on function public.create_order(text, public.order_fulfillment_type, text, text, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_order(text, public.order_fulfillment_type, text, text, jsonb, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- update_order_status: the only way a status can change. Encodes the
-- business pipeline as an explicit allowed-transition table rather than
-- trusting the client to send a sane (from, to) pair, and historizes every
-- change.
-- ---------------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.status
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;

  if not public.has_restaurant_access(v_order.restaurant_id) then
    raise exception 'Forbidden';
  end if;

  v_allowed := case v_order.status
    when 'pending' then p_new_status in ('confirmed', 'cancelled')
    when 'confirmed' then p_new_status in ('preparing', 'cancelled')
    when 'preparing' then p_new_status in ('ready', 'cancelled')
    when 'ready' then p_new_status in ('out_for_delivery', 'delivered', 'cancelled')
    when 'out_for_delivery' then p_new_status in ('delivered', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'Transition de statut invalide: % -> %', v_order.status, p_new_status;
  end if;

  update public.orders
    set status = p_new_status,
        cancel_reason = case when p_new_status = 'cancelled' then p_note else cancel_reason end,
        confirmed_at = case when p_new_status = 'confirmed' then now() else confirmed_at end,
        preparing_at = case when p_new_status = 'preparing' then now() else preparing_at end,
        ready_at = case when p_new_status = 'ready' then now() else ready_at end,
        out_for_delivery_at = case when p_new_status = 'out_for_delivery' then now() else out_for_delivery_at end,
        delivered_at = case when p_new_status = 'delivered' then now() else delivered_at end,
        cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end
    where id = p_order_id;

  insert into public.order_status_history (restaurant_id, order_id, from_status, to_status, changed_by, note)
  values (v_order.restaurant_id, p_order_id, v_order.status, p_new_status, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));

  return jsonb_build_object('order_id', p_order_id, 'status', p_new_status);
end;
$$;

revoke all on function public.update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
