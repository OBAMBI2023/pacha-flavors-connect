-- Phase 4: payments, financial integrity, audit trail, in-app notifications,
-- and subscription-plan foundations. orders.status (fulfillment pipeline)
-- and payment status stay strictly independent -- payment state never rides
-- on orders.status, and orders.status never encodes payment information.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.payment_status as enum (
  'pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded', 'cash_pending'
);

create type public.payment_method as enum ('cash', 'mobile_money', 'card', 'online', 'unknown');

-- ---------------------------------------------------------------------------
-- orders: financial snapshot + payment fields
-- ---------------------------------------------------------------------------

alter table public.orders
  add column discount_amount numeric not null default 0,
  add column payment_status public.payment_status not null default 'pending',
  add column payment_method public.payment_method not null default 'unknown',
  add column payment_reference text null,
  add column paid_at timestamptz null;

create index orders_restaurant_id_payment_status_idx on public.orders (restaurant_id, payment_status);

-- Every write to `orders` already goes exclusively through SECURITY DEFINER
-- RPCs (create_order, update_order_status, and the new payment RPCs below) --
-- there is no direct client-side `.update()` anywhere in the app. Revoking
-- direct UPDATE from anon/authenticated closes the gap the existing
-- `orders_update_members` row-level policy leaves open: without this, any
-- restaurant staff member could PATCH payment_status directly via PostgREST
-- and mark an order paid with no reconciliation, no payments row, no audit
-- trail. SECURITY DEFINER functions run as the table owner and are
-- unaffected by this revoke.
revoke update on public.orders from authenticated, anon;

-- ---------------------------------------------------------------------------
-- payments: append-only ledger, one row per payment/refund event
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  amount numeric not null check (amount > 0),
  currency text not null default 'XOF',
  method public.payment_method not null,
  status public.payment_status not null,
  provider text null,
  provider_reference text null,
  created_by uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz null
);

create index payments_restaurant_id_created_at_idx on public.payments (restaurant_id, created_at desc);
create index payments_order_id_idx on public.payments (order_id);
create unique index payments_provider_reference_unique
  on public.payments (provider, provider_reference)
  where provider_reference is not null;

create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy payments_select_members on public.payments
  for select using (public.has_restaurant_access(restaurant_id));

-- No insert/update/delete policy for authenticated/anon: every payments row
-- is written exclusively by the SECURITY DEFINER RPCs below (mark_cash_payment_received,
-- create_refund), which run as the table owner and bypass this restriction --
-- exactly the same pattern already used for order_items/order_status_history.

-- ---------------------------------------------------------------------------
-- audit_logs: tamper-evident trail of sensitive tenant actions
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_user_id uuid null,
  entity_type text not null,
  entity_id uuid null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_restaurant_id_created_at_idx on public.audit_logs (restaurant_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy audit_logs_select_members on public.audit_logs
  for select using (public.has_restaurant_access(restaurant_id));

-- Internal-only helper: no execute grant to authenticated/anon. Only called
-- from within other SECURITY DEFINER functions, which already run as the
-- owner and can call it regardless of grants.
create or replace function public.log_audit_event(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (restaurant_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (p_restaurant_id, p_actor_user_id, p_entity_type, p_entity_id, p_action, p_metadata);
end;
$$;

-- restaurant_settings changes happen via a plain client-side UPDATE (owner/manager,
-- already RLS-scoped) -- log them automatically via trigger rather than
-- reworking that form into an RPC.
create or replace function public.trg_log_restaurant_settings_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_audit_event(
    new.restaurant_id,
    auth.uid(),
    'restaurant_settings',
    new.restaurant_id,
    'restaurant_settings_changed',
    (to_jsonb(new) - 'created_at' - 'updated_at')
  );
  return new;
end;
$$;

create trigger restaurant_settings_audit_log after update on public.restaurant_settings
  for each row execute function public.trg_log_restaurant_settings_change();

-- ---------------------------------------------------------------------------
-- notifications: reusable in-app notification layer (email/push/sms are
-- schema-ready via `channel` but only 'in_app' rows are ever created today)
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete set null,
  type text not null,
  channel text not null default 'in_app',
  title text not null,
  body text null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add constraint notifications_channel_check check (channel in ('in_app', 'email', 'push', 'sms'));

create index notifications_restaurant_id_created_at_idx on public.notifications (restaurant_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_members on public.notifications
  for select using (public.has_restaurant_access(restaurant_id));

create policy notifications_update_members on public.notifications
  for update using (public.has_restaurant_access(restaurant_id))
  with check (public.has_restaurant_access(restaurant_id));

-- Members may only ever flip is_read -- never rewrite the notification's
-- content -- so the UPDATE grant is narrowed to that single column even
-- though the RLS row policy above is broader.
revoke update on public.notifications from authenticated, anon;
grant update (is_read) on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

create or replace function public.create_notification(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (restaurant_id, order_id, type, title, body, metadata)
  values (p_restaurant_id, p_order_id, p_type, p_title, p_body, p_metadata);
end;
$$;

-- ---------------------------------------------------------------------------
-- plans + restaurant_subscriptions: SaaS subscription foundations.
-- No real billing/invoicing is introduced -- every restaurant is simply
-- auto-enrolled on the free plan, exactly mirroring how
-- create_restaurant_settings_default() already auto-provisions settings.
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key,
  name text not null,
  description text null,
  price_amount numeric not null default 0,
  currency text not null default 'XOF',
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy plans_select_authenticated on public.plans
  for select to authenticated using (true);

insert into public.plans (id, name, description, price_amount, currency, features) values
  ('free', 'Free', 'Vitrine et commandes SAOVIA de base.', 0, 'XOF', '["Commandes SAOVIA", "Dashboard temps réel", "Statistiques de base"]'::jsonb),
  ('standard', 'Standard', 'Pour les restaurants en croissance.', 15000, 'XOF', '["Tout Free", "Statistiques avancées", "Support prioritaire"]'::jsonb),
  ('pro', 'Pro', 'Fonctionnalités avancées et paiements.', 35000, 'XOF', '["Tout Standard", "Paiements en ligne", "Multi-établissements"]'::jsonb),
  ('marketplace', 'Marketplace', 'Visibilité sur la marketplace SAOVIA.', 0, 'XOF', '["Tout Pro", "Commandes marketplace", {"commission_rate": 0.1}]'::jsonb);

create table public.restaurant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  current_period_end timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger restaurant_subscriptions_set_updated_at before update on public.restaurant_subscriptions
  for each row execute function public.set_updated_at();

alter table public.restaurant_subscriptions enable row level security;

create policy restaurant_subscriptions_select_members on public.restaurant_subscriptions
  for select using (public.has_restaurant_access(restaurant_id));

-- No insert/update/delete policy: subscriptions are only ever provisioned by
-- the trigger below or (in a future phase) a real billing backend, never by
-- a tenant directly changing their own plan/status.

create or replace function public.create_restaurant_subscription_default() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.restaurant_subscriptions (restaurant_id, plan_id, status)
  values (new.id, 'free', 'active')
  on conflict (restaurant_id) do nothing;
  return new;
end;
$$;

create trigger restaurants_create_subscription after insert on public.restaurants
  for each row execute function public.create_restaurant_subscription_default();

-- Backfill: enroll every restaurant that already existed before this migration.
insert into public.restaurant_subscriptions (restaurant_id, plan_id, status)
select r.id, 'free', 'active' from public.restaurants r
on conflict (restaurant_id) do nothing;

-- ---------------------------------------------------------------------------
-- create_order: extend with payment_method. No electronic payment is ever
-- marked successful here -- only 'cash' resolves to an operative status
-- (cash_pending); every other method sits at 'pending' until a real,
-- provider-confirmed payment RPC exists in a future phase.
-- ---------------------------------------------------------------------------

-- Minimal, additive diff on top of the exact live Phase 3 function: adds
-- p_payment_method, server-normalizes it, sets discount_amount/payment_method/
-- payment_status on the orders insert, and fires the "Nouvelle commande"
-- notification. Every validation branch, join, and column from the live
-- version is preserved unchanged to avoid regressing Phase 1-3 behavior.
drop function if exists public.create_order(text, public.order_fulfillment_type, text, text, jsonb, text, text, text, text, text, jsonb);

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
    currency, subtotal_amount, delivery_fee_amount, discount_amount, total_amount, item_count,
    order_source, source_metadata, payment_method, payment_status
  ) values (
    v_restaurant.id, v_order_number, 'pending', p_fulfillment_type, btrim(p_customer_name), btrim(p_customer_phone),
    nullif(btrim(coalesce(p_delivery_commune, '')), ''), nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), nullif(btrim(coalesce(p_customer_notes, '')), ''),
    v_restaurant.currency, v_subtotal, v_delivery_fee, 0, v_total, v_item_count,
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
    'total_amount', v_total,
    'item_count', v_item_count,
    'order_source', v_order_source,
    'payment_method', v_payment_method,
    'payment_status', v_payment_status
  );
end;
$$;

revoke all on function public.create_order(text, public.order_fulfillment_type, text, text, jsonb, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order(text, public.order_fulfillment_type, text, text, jsonb, text, text, text, text, text, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- update_order_status: unchanged transition logic, now also writes an audit
-- log entry and an in-app notification for the transitions that matter to
-- the restaurant operator. Still never touches payment_status.
-- ---------------------------------------------------------------------------

create or replace function public.update_order_status(p_order_id uuid, p_new_status public.order_status, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_allowed boolean;
  v_notif_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.status, o.order_number
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

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id,
    case when p_new_status = 'cancelled' then 'order_cancelled' else 'order_status_changed' end,
    jsonb_build_object('from_status', v_order.status, 'to_status', p_new_status, 'note', p_note)
  );

  v_notif_title := case p_new_status
    when 'confirmed' then 'Commande acceptée'
    when 'cancelled' then 'Commande refusée'
    when 'ready' then 'Commande prête'
    when 'delivered' then 'Commande livrée'
    else null
  end;
  if v_notif_title is not null then
    perform public.create_notification(
      v_order.restaurant_id, p_order_id, 'order_status_changed', v_notif_title,
      format('Commande #%s', v_order.order_number),
      jsonb_build_object('order_number', v_order.order_number, 'status', p_new_status)
    );
  end if;

  return jsonb_build_object('order_id', p_order_id, 'status', p_new_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_cash_payment_received: the only path from cash_pending -> paid.
-- Restaurant-side only (has_restaurant_access) -- a customer can never call
-- this, so a cash order can never be self-declared paid by whoever placed it.
-- ---------------------------------------------------------------------------

create or replace function public.mark_cash_payment_received(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.total_amount, o.currency, o.payment_status, o.order_number
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if not public.has_restaurant_access(v_order.restaurant_id) then
    raise exception 'Forbidden';
  end if;
  if v_order.payment_status != 'cash_pending' then
    raise exception 'Cette commande n''est pas en attente d''encaissement cash (statut actuel: %)', v_order.payment_status;
  end if;

  update public.orders set payment_status = 'paid', paid_at = now() where id = p_order_id;

  insert into public.payments (order_id, restaurant_id, amount, currency, method, status, created_by, paid_at)
  values (p_order_id, v_order.restaurant_id, v_order.total_amount, v_order.currency, 'cash', 'paid', auth.uid(), now());

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'payment_status_changed',
    jsonb_build_object('from_status', 'cash_pending', 'to_status', 'paid', 'method', 'cash', 'amount', v_order.total_amount)
  );

  perform public.create_notification(
    v_order.restaurant_id, p_order_id, 'payment_confirmed', 'Paiement confirmé',
    format('Commande #%s · %s %s encaissés', v_order.order_number, v_order.total_amount, v_order.currency),
    jsonb_build_object('order_number', v_order.order_number, 'amount', v_order.total_amount)
  );

  return jsonb_build_object('order_id', p_order_id, 'payment_status', 'paid');
end;
$$;

revoke all on function public.mark_cash_payment_received(uuid) from public, anon;
grant execute on function public.mark_cash_payment_received(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_refund: staff-only, amount always bounded server-side by what was
-- actually paid minus what was already refunded -- the client-sent amount is
-- only ever a request, never trusted verbatim.
-- ---------------------------------------------------------------------------

create or replace function public.create_refund(p_order_id uuid, p_amount numeric, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_paid numeric;
  v_refunded numeric;
  v_remaining numeric;
  v_method public.payment_method;
  v_new_status public.payment_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant de remboursement invalide';
  end if;

  select o.id, o.restaurant_id, o.currency, o.payment_status, o.order_number, o.payment_method
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if not public.has_restaurant_access(v_order.restaurant_id) then
    raise exception 'Forbidden';
  end if;
  if v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'Cette commande n''est pas payée, aucun remboursement possible (statut actuel: %)', v_order.payment_status;
  end if;

  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = p_order_id and status = 'paid';
  select coalesce(sum(amount), 0) into v_refunded from public.payments where order_id = p_order_id and status in ('refunded', 'partially_refunded');
  v_remaining := v_paid - v_refunded;

  if v_remaining <= 0 then
    raise exception 'Aucun montant remboursable restant sur cette commande';
  end if;
  if p_amount > v_remaining then
    raise exception 'Le montant demandé (%) dépasse le montant remboursable restant (%)', p_amount, v_remaining;
  end if;

  select method into v_method from public.payments where order_id = p_order_id and status = 'paid' order by created_at desc limit 1;
  v_method := coalesce(v_method, v_order.payment_method);
  v_new_status := case when p_amount >= v_remaining then 'refunded' else 'partially_refunded' end;

  insert into public.payments (order_id, restaurant_id, amount, currency, method, status, created_by, paid_at, metadata)
  values (p_order_id, v_order.restaurant_id, p_amount, v_order.currency, v_method, v_new_status, auth.uid(), now(), jsonb_build_object('reason', p_reason));

  update public.orders set payment_status = v_new_status where id = p_order_id;

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id, 'refund_created',
    jsonb_build_object('amount', p_amount, 'reason', p_reason, 'new_payment_status', v_new_status)
  );

  perform public.create_notification(
    v_order.restaurant_id, p_order_id, 'refund_created', 'Remboursement enregistré',
    format('Commande #%s · %s %s remboursés', v_order.order_number, p_amount, v_order.currency),
    jsonb_build_object('order_number', v_order.order_number, 'amount', p_amount)
  );

  return jsonb_build_object('order_id', p_order_id, 'payment_status', v_new_status, 'refunded_amount', p_amount);
end;
$$;

revoke all on function public.create_refund(uuid, numeric, text) from public, anon;
grant execute on function public.create_refund(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_restaurant_dashboard_stats: additive extension (existing keys
-- untouched) with GMV, collected/pending/refunded revenue, and
-- payment/method breakdowns. `revenue` (Phase 3, delivered-only) stays the
-- restaurant's operational CA; `gmv` is the distinct, broader "total order
-- value" figure explicitly required to stay separate from it.
-- ---------------------------------------------------------------------------

create or replace function public.get_restaurant_dashboard_stats(p_start_date date, p_end_date date)
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
  v_payment_breakdown jsonb;
  v_method_breakdown jsonb;
  v_collected numeric;
  v_refunded numeric;
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
    'total_orders', count(*),
    'gmv', coalesce(sum(total_amount) filter (where status != 'cancelled'), 0),
    'pending_collection', coalesce(sum(total_amount) filter (where payment_status in ('cash_pending', 'pending', 'authorized') and status != 'cancelled'), 0)
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

  with pb as (
    select payment_status, count(*) as orders_count, sum(total_amount) as amount
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by payment_status
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'payment_status', payment_status, 'orders_count', orders_count, 'amount', coalesce(amount, 0)
    ) order by orders_count desc), '[]'::jsonb)
  into v_payment_breakdown
  from pb;

  with mb as (
    select payment_method, count(*) as orders_count, sum(total_amount) as amount
    from public.orders
    where restaurant_id = v_restaurant_id
      and created_at >= v_start and created_at < v_end
    group by payment_method
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'payment_method', payment_method, 'orders_count', orders_count, 'amount', coalesce(amount, 0)
    ) order by orders_count desc), '[]'::jsonb)
  into v_method_breakdown
  from mb;

  select coalesce(sum(amount), 0) into v_collected
    from public.payments
    where restaurant_id = v_restaurant_id and status = 'paid' and created_at >= v_start and created_at < v_end;

  select coalesce(sum(amount), 0) into v_refunded
    from public.payments
    where restaurant_id = v_restaurant_id and status in ('refunded', 'partially_refunded') and created_at >= v_start and created_at < v_end;

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
    'operational_metrics', v_operational,
    'payment_breakdown', v_payment_breakdown,
    'method_breakdown', v_method_breakdown,
    'collected_revenue', v_collected,
    'refunded_amount', v_refunded
  );
end;
$$;

revoke all on function public.get_restaurant_dashboard_stats(date, date) from public, anon;
grant execute on function public.get_restaurant_dashboard_stats(date, date) to authenticated;
