-- Client-facing notifications inbox (distinct from the existing
-- `notifications` table, which is tenant/staff-only). This app still has
-- no real customer authentication, so the identity key is the same
-- anonymous visitor_id already used for the Offers module.
--
-- Two sources feed the unified feed, read at query time rather than
-- duplicated into one table:
--  - New offers: already fully tracked by offer_recipients/offers (see
--    the Offers/Marketing migration) -- reused as-is, not duplicated.
--  - Order lifecycle events (confirmation, status changes, delivery
--    updates): this new client_notifications table.
--
-- "Information concernant une location" (rentals) from the request is
-- omitted -- as established when the Clients/CRM module was built, no
-- rental/location concept exists anywhere in this app's schema, so this
-- notification type is not fabricated.

create table public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  visitor_id text not null,
  type text not null check (type in ('order_confirmed', 'order_status_update', 'delivery_update')),
  title text not null,
  body text,
  link_type text check (link_type in ('order')),
  link_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index client_notifications_visitor_idx on public.client_notifications (restaurant_id, visitor_id, created_at desc);

alter table public.client_notifications enable row level security;

-- Same model as offer_recipients: tenant staff can read for support/
-- debugging visibility; anonymous visitors read/write only through the
-- SECURITY DEFINER RPCs below (they have no session to grant a direct
-- policy to).
create policy client_notifications_select_members on public.client_notifications
  for select using (public.has_restaurant_access(restaurant_id));

-- Orders need a visitor_id to attribute lifecycle notifications back to the
-- browser that placed them -- same anonymous identity as offer_recipients,
-- nullable and backfill-free (existing orders simply get no client
-- notifications, which is honest).
alter table public.orders add column if not exists visitor_id text;
create index if not exists orders_visitor_id_idx on public.orders (visitor_id) where visitor_id is not null;

-- Fires on every status transition (not on the initial insert -- that's
-- handled directly inside create_order, which already knows the visitor_id
-- and mirrors its own existing tenant-notification call). Silently no-ops
-- when the order has no visitor_id (order not placed with client-side
-- notification support, or placed through another channel).
create or replace function public.notify_client_order_status_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_type text;
  v_title text;
begin
  if new.visitor_id is null or old.status = new.status then
    return new;
  end if;

  v_type := case when new.status in ('out_for_delivery', 'delivered') then 'delivery_update' else 'order_status_update' end;
  v_title := case new.status
    when 'confirmed' then 'Commande confirmée par le restaurant'
    when 'preparing' then 'Votre commande est en préparation'
    when 'ready' then 'Votre commande est prête'
    when 'out_for_delivery' then 'Votre commande est en cours de livraison'
    when 'delivered' then 'Votre commande a été livrée'
    when 'cancelled' then 'Votre commande a été annulée'
    else null
  end;

  if v_title is null then
    return new;
  end if;

  insert into public.client_notifications (restaurant_id, visitor_id, type, title, body, link_type, link_id)
  values (new.restaurant_id, new.visitor_id, v_type, v_title, format('Commande #%s', new.order_number), 'order', new.id);

  return new;
end;
$function$;

create trigger orders_notify_client_status_change
  after update of status on public.orders
  for each row execute function public.notify_client_order_status_change();

-- ---------------------------------------------------------------------------
-- Storefront-facing RPCs
-- ---------------------------------------------------------------------------

-- Unified feed: order-lifecycle notifications from client_notifications,
-- unioned with new-offer notifications derived live from offer_recipients/
-- offers (not duplicated into client_notifications).
create or replace function public.get_client_notifications(p_slug text, p_visitor_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_result jsonb;
begin
  if p_visitor_id is null or btrim(p_visitor_id) = '' then
    return '[]'::jsonb;
  end if;

  select r.id into v_restaurant_id
    from public.restaurants r
    where r.slug = p_slug and r.is_public = true and r.status = 'active'
    limit 1;

  if v_restaurant_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        n.id,
        n.type,
        n.title,
        n.body,
        n.link_type,
        n.link_id,
        n.is_read,
        n.created_at,
        jsonb_build_object(
          'id', n.id, 'type', n.type, 'title', n.title, 'body', n.body,
          'link_type', n.link_type, 'link_id', n.link_id, 'is_read', n.is_read, 'created_at', n.created_at
        ) as row_data
      from public.client_notifications n
      where n.restaurant_id = v_restaurant_id and n.visitor_id = p_visitor_id

      union all

      select
        o.id, 'new_offer', o.title,
        format('Profitez de -%s%% sur %s', round((1 - o.offer_price / o.original_price) * 100), p.name),
        'offer', o.id, coalesce(r.is_read, false), o.created_at,
        jsonb_build_object(
          'id', o.id, 'type', 'new_offer', 'title', o.title,
          'body', format('Profitez de -%s%% sur %s', round((1 - o.offer_price / o.original_price) * 100), p.name),
          'link_type', 'offer', 'link_id', o.id, 'is_read', coalesce(r.is_read, false), 'created_at', o.created_at
        ) as row_data
      from public.offers o
      join public.restaurant_products p on p.id = o.product_id
      join public.offer_recipients r on r.offer_id = o.id and r.visitor_id = p_visitor_id
      where o.restaurant_id = v_restaurant_id
    ) feed;

  return v_result;
end;
$function$;

revoke all on function public.get_client_notifications(text, text) from public;
grant execute on function public.get_client_notifications(text, text) to anon, authenticated;

-- Combined unread count across both sources, for the header/bottom-nav badge.
create or replace function public.get_unread_client_notifications_count(p_slug text, p_visitor_id text)
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

  select
    (select count(*) from public.client_notifications n where n.restaurant_id = v_restaurant_id and n.visitor_id = p_visitor_id and n.is_read = false)
    +
    (select count(*)
       from public.offers o
       left join public.offer_recipients rec on rec.offer_id = o.id and rec.visitor_id = p_visitor_id
       where o.restaurant_id = v_restaurant_id
         and o.status = 'active'
         and (o.starts_at is null or o.starts_at <= now())
         and (o.ends_at is null or o.ends_at >= now())
         and (rec.id is null or rec.is_read = false))
    into v_count;

  return v_count;
end;
$function$;

revoke all on function public.get_unread_client_notifications_count(text, text) from public;
grant execute on function public.get_unread_client_notifications_count(text, text) to anon, authenticated;

-- Marks a single client_notifications row read (order-lifecycle
-- notifications only -- offer notifications use the existing
-- mark_offer_read, which already handles offer_recipients).
create or replace function public.mark_client_notification_read(p_notification_id uuid, p_visitor_id text)
returns void
language sql
security definer
set search_path to ''
as $function$
  update public.client_notifications
    set is_read = true
    where id = p_notification_id and visitor_id = p_visitor_id;
$function$;

revoke all on function public.mark_client_notification_read(uuid, text) from public;
grant execute on function public.mark_client_notification_read(uuid, text) to anon, authenticated;
