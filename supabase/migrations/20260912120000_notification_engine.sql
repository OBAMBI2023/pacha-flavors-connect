-- SAOVIA Food Notification Engine: generalizes the existing driver-only push
-- pipeline (push_subscriptions/send-push, phase8_driver_push_architecture +
-- delivery_proposals_notify_push_trigger) to also cover the anonymous
-- customer identity this app already uses everywhere else (visitor_id --
-- see client_notifications.sql: "this app still has no real customer
-- authentication"), plus any other authenticated user (staff, drivers).
--
-- Nothing here touches orders/create_order/update_order_status,
-- assign_driver_to_order, driver_respond_to_proposal, RLS on existing
-- tables, or the send-push/admin-create-driver/admin-resend-driver-invite
-- edge functions. Every new trigger is a purely additive AFTER UPDATE OF
-- status listener alongside the ones already there.

-- ---------------------------------------------------------------------------
-- 1. push_subscriptions: extend the existing driver-only table rather than
--    fork a second one. driver_id stays exactly as-is (still NOT enforced
--    nullable for existing rows, still what send-push/push.ts read and
--    write) -- user_id is backfilled from it so old driver rows are also
--    reachable through the new general-purpose columns without any
--    dual-path query logic.
-- ---------------------------------------------------------------------------

alter table public.push_subscriptions alter column driver_id drop not null;

alter table public.push_subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists visitor_id text,
  add column if not exists platform text,
  add column if not exists browser text,
  add column if not exists device_name text,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamptz not null default now();

update public.push_subscriptions set user_id = driver_id where user_id is null and driver_id is not null;

alter table public.push_subscriptions
  add constraint push_subscriptions_identity_check
  check (user_id is not null or driver_id is not null or visitor_id is not null);

-- Additive alongside the existing driver_id = auth.uid() policies -- RLS
-- policies for the same command are OR'd, so a driver's own row (which now
-- also has user_id = driver_id via the backfill above) simply matches both,
-- never a conflict. Anonymous visitor_id rows get no direct RLS grant at
-- all here, same reasoning as client_notifications: anon has no session to
-- scope a policy to, so access is only ever through the SECURITY DEFINER
-- RPCs below.
create policy push_subscriptions_select_own_user on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy push_subscriptions_insert_own_user on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy push_subscriptions_update_own_user on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete_own_user on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. notification_preferences: authenticated users only (owner/manager/
--    staff/drivers). Anonymous visitors get an implicit opt-in for their own
--    order-tracking events only (no granular toggles) -- a per-browser
--    visitor_id has no durable identity worth building a preferences UI
--    around, same judgment call already made for client_notifications.
-- ---------------------------------------------------------------------------

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  order_updates boolean not null default true,
  delivery_updates boolean not null default true,
  restaurant_messages boolean not null default true,
  promotions boolean not null default false,
  system_notifications boolean not null default true,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select using (user_id = auth.uid());
create policy notification_preferences_insert_own on public.notification_preferences
  for insert with check (user_id = auth.uid());
create policy notification_preferences_update_own on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. notification_events: audit trail, dedup key (id = event_id used as the
--    Web Push `tag`, so the OS coalesces a redelivered/duplicate push with
--    whatever's already showing -- exact pattern already proven by
--    delivery_proposals' push trigger and useDriverProposalAlert.ts), and
--    the single row a notification-sending edge function reads to know
--    exactly what to send and to whom. visitor_id is additive beyond the
--    brief's own column list, needed for the anonymous-customer case
--    decided above -- exactly one of user_id/visitor_id is set per row that
--    targets somebody (rows may also have neither, for a future untargeted/
--    broadcast type, hence no NOT NULL / check constraint forcing either).
-- ---------------------------------------------------------------------------

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  visitor_id text null,
  tenant_id uuid null references public.restaurants(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete set null,
  type text not null check (type in (
    'ORDER_ACCEPTED', 'ORDER_READY', 'DRIVER_ASSIGNED', 'DRIVER_NEARBY',
    'ORDER_DELIVERED', 'ORDER_CANCELLED', 'RESTAURANT_MESSAGE', 'SYSTEM_NOTIFICATION'
  )),
  title text not null,
  body text not null,
  url text null,
  channel text not null default 'push' check (channel in ('push', 'realtime')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index notification_events_user_id_idx on public.notification_events (user_id, created_at desc) where user_id is not null;
create index notification_events_visitor_id_idx on public.notification_events (visitor_id, created_at desc) where visitor_id is not null;
create index notification_events_order_id_idx on public.notification_events (order_id);
create index notification_events_tenant_id_idx on public.notification_events (tenant_id, created_at desc) where tenant_id is not null;

alter table public.notification_events enable row level security;

-- Staff can see their own tenant's events (support/debugging), an
-- authenticated recipient can see their own -- same has_restaurant_access
-- helper every other tenant-scoped table already uses. No policy at all for
-- visitor_id rows: anonymous customers never query this table directly,
-- only client_notifications (existing, unchanged) for their in-app inbox.
create policy notification_events_select_members on public.notification_events
  for select using (
    (tenant_id is not null and public.has_restaurant_access(tenant_id))
    or user_id = auth.uid()
  );

-- No insert/update/delete policy for authenticated/anon: every row is
-- written exclusively by the SECURITY DEFINER functions below, exactly the
-- same pattern as notifications/payments/audit_logs.

-- ---------------------------------------------------------------------------
-- 4. Subscription management RPCs -- the only way anon (visitor_id) or an
--    authenticated user ever reads/writes their own push_subscriptions row.
-- ---------------------------------------------------------------------------

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_visitor_id text default null,
  p_platform text default null,
  p_browser text default null,
  p_device_name text default null
) returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_visitor_id text;
begin
  if p_endpoint is null or btrim(p_endpoint) = '' or p_p256dh is null or p_auth is null then
    raise exception 'Abonnement push incomplet';
  end if;

  if auth.uid() is not null then
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, platform, browser, device_name, is_active, last_seen_at)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_platform, p_browser, p_device_name, true, now())
    on conflict (endpoint) do update set
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      platform = coalesce(excluded.platform, public.push_subscriptions.platform),
      browser = coalesce(excluded.browser, public.push_subscriptions.browser),
      device_name = coalesce(excluded.device_name, public.push_subscriptions.device_name),
      is_active = true,
      last_seen_at = now();
    return;
  end if;

  v_visitor_id := nullif(btrim(coalesce(p_visitor_id, '')), '');
  if v_visitor_id is null then
    raise exception 'visitor_id requis pour un abonnement anonyme';
  end if;

  insert into public.push_subscriptions (visitor_id, endpoint, p256dh, auth, platform, browser, device_name, is_active, last_seen_at)
  values (v_visitor_id, p_endpoint, p_p256dh, p_auth, p_platform, p_browser, p_device_name, true, now())
  on conflict (endpoint) do update set
    visitor_id = excluded.visitor_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    platform = coalesce(excluded.platform, public.push_subscriptions.platform),
    browser = coalesce(excluded.browser, public.push_subscriptions.browser),
    device_name = coalesce(excluded.device_name, public.push_subscriptions.device_name),
    is_active = true,
    last_seen_at = now();
end;
$function$;

revoke all on function public.register_push_subscription(text, text, text, text, text, text, text) from public;
grant execute on function public.register_push_subscription(text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.unregister_push_subscription(p_endpoint text, p_visitor_id text default null)
returns void
language sql
security definer
set search_path to ''
as $function$
  delete from public.push_subscriptions
  where endpoint = p_endpoint
    and (
      (auth.uid() is not null and user_id = auth.uid())
      or (auth.uid() is null and p_visitor_id is not null and visitor_id = p_visitor_id)
    );
$function$;

revoke all on function public.unregister_push_subscription(text, text) from public;
grant execute on function public.unregister_push_subscription(text, text) to anon, authenticated;

create or replace function public.get_notification_preferences()
returns public.notification_preferences
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row public.notification_preferences;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.notification_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select * into v_row from public.notification_preferences where user_id = auth.uid();
  return v_row;
end;
$function$;

revoke all on function public.get_notification_preferences() from public, anon;
grant execute on function public.get_notification_preferences() to authenticated;

create or replace function public.update_notification_preferences(
  p_order_updates boolean default null,
  p_delivery_updates boolean default null,
  p_restaurant_messages boolean default null,
  p_promotions boolean default null,
  p_system_notifications boolean default null,
  p_enabled boolean default null
) returns public.notification_preferences
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row public.notification_preferences;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.notification_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.notification_preferences set
    order_updates = coalesce(p_order_updates, order_updates),
    delivery_updates = coalesce(p_delivery_updates, delivery_updates),
    restaurant_messages = coalesce(p_restaurant_messages, restaurant_messages),
    promotions = coalesce(p_promotions, promotions),
    system_notifications = coalesce(p_system_notifications, system_notifications),
    enabled = coalesce(p_enabled, enabled)
  where user_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function public.update_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Engine core: insert the audit/dedup row, then fire-and-forget the
--    delivery edge function -- exact same shape as
--    notify_delivery_proposal_push (pg_net + vault secret + exception
--    swallowed so a broken push pipeline can never block the real business
--    transaction the trigger is attached to). Internal only: no execute
--    grant, callable only from other SECURITY DEFINER functions/triggers
--    that already run as the owner.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_visitor_id text,
  p_tenant_id uuid,
  p_order_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_url text default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event_id uuid;
  v_secret text;
begin
  if p_user_id is null and p_visitor_id is null then
    return null;
  end if;

  insert into public.notification_events (user_id, visitor_id, tenant_id, order_id, type, title, body, url)
  values (p_user_id, p_visitor_id, p_tenant_id, p_order_id, p_type, p_title, p_body, p_url)
  returning id into v_event_id;

  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'notification_trigger_secret'
    limit 1;

    if v_secret is not null then
      perform net.http_post(
        url := 'https://haamomdggdubdzsmbwoq.supabase.co/functions/v1/send-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-notification-secret', v_secret
        ),
        body := jsonb_build_object('event_id', v_event_id)
      );
    end if;
  exception when others then
    -- Same defense-in-depth as notify_delivery_proposal_push: a broken/
    -- unreachable push pipeline must never block the order/proposal update
    -- this is attached to.
    null;
  end;

  return v_event_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Real triggers for the events this schema can already compute from
--    existing state transitions. DRIVER_NEARBY, RESTAURANT_MESSAGE and
--    SYSTEM_NOTIFICATION are supported types with callable entry points
--    below but no automatic trigger -- there is no geofencing/proximity
--    computation, restaurant-to-customer messaging feature, or "system
--    event" concept anywhere in this schema to hook into, and fabricating
--    one is a separate feature, not this engine. Same "schema-ready,
--    channel unused" judgment call already made for notifications.channel.
-- ---------------------------------------------------------------------------

create or replace function public.notify_customer_order_status_push()
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

  -- Same status -> copy mapping as notify_client_order_status_change
  -- (client_notifications.sql), so the in-app inbox and the push
  -- notification a customer receives for the same event always agree.
  v_type := case new.status
    when 'confirmed' then 'ORDER_ACCEPTED'
    when 'ready' then 'ORDER_READY'
    when 'delivered' then 'ORDER_DELIVERED'
    when 'cancelled' then 'ORDER_CANCELLED'
    else null
  end;
  if v_type is null then
    return new;
  end if;

  v_title := case new.status
    when 'confirmed' then 'Commande confirmée par le restaurant'
    when 'ready' then 'Votre commande est prête'
    when 'delivered' then 'Votre commande a été livrée'
    when 'cancelled' then 'Votre commande a été annulée'
  end;

  perform public.enqueue_notification(
    null, new.visitor_id, new.restaurant_id, new.id, v_type, v_title,
    format('Commande #%s', new.order_number),
    format('/commande/%s/confirmation', new.id)
  );

  return new;
end;
$function$;

create trigger orders_notify_customer_status_push
  after update of status on public.orders
  for each row execute function public.notify_customer_order_status_push();

create or replace function public.notify_customer_driver_assigned_push()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order record;
begin
  if new.status is distinct from 'accepted'::public.delivery_proposal_status or old.status = new.status then
    return new;
  end if;

  select o.id, o.restaurant_id, o.order_number, o.visitor_id
    into v_order
    from public.orders o
    where o.id = new.order_id;

  if v_order.id is null or v_order.visitor_id is null then
    return new;
  end if;

  perform public.enqueue_notification(
    null, v_order.visitor_id, v_order.restaurant_id, v_order.id, 'DRIVER_ASSIGNED',
    'Un livreur a été assigné à votre commande',
    format('Commande #%s', v_order.order_number),
    format('/commande/%s/confirmation', v_order.id)
  );

  return new;
end;
$function$;

create trigger delivery_proposals_notify_driver_assigned_push
  after update of status on public.delivery_proposals
  for each row execute function public.notify_customer_driver_assigned_push();

-- Callable, not auto-fired -- see comment above. has_restaurant_access
-- keeps this staff-only (owner/manager/staff of the order's own restaurant),
-- exactly like every other order-scoped RPC in this schema.
create or replace function public.send_restaurant_message_notification(p_order_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order record;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_message is null or btrim(p_message) = '' then
    raise exception 'Message requis';
  end if;

  select o.id, o.restaurant_id, o.order_number, o.visitor_id
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if not public.has_restaurant_access(v_order.restaurant_id) then
    raise exception 'Forbidden';
  end if;
  if v_order.visitor_id is null then
    raise exception 'Cette commande n''a pas de client joignable par notification';
  end if;

  v_event_id := public.enqueue_notification(
    null, v_order.visitor_id, v_order.restaurant_id, v_order.id, 'RESTAURANT_MESSAGE',
    'Message du restaurant', btrim(p_message),
    format('/commande/%s/confirmation', v_order.id)
  );

  return v_event_id;
end;
$function$;

revoke all on function public.send_restaurant_message_notification(uuid, text) from public, anon;
grant execute on function public.send_restaurant_message_notification(uuid, text) to authenticated;

-- Callable, not auto-fired -- no proximity/geofencing computation exists
-- anywhere in this schema yet. Ready for a future driver-location trigger
-- (see super_admin_orders_and_driver_locations.sql) to call once that logic
-- exists, without any further engine changes.
create or replace function public.notify_driver_nearby(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order record;
  v_event_id uuid;
begin
  select o.id, o.restaurant_id, o.order_number, o.visitor_id
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null or v_order.visitor_id is null then
    return null;
  end if;

  v_event_id := public.enqueue_notification(
    null, v_order.visitor_id, v_order.restaurant_id, v_order.id, 'DRIVER_NEARBY',
    'Votre livreur arrive bientôt',
    format('Commande #%s', v_order.order_number),
    format('/commande/%s/confirmation', v_order.id)
  );

  return v_event_id;
end;
$function$;

revoke all on function public.notify_driver_nearby(uuid) from public, anon;
grant execute on function public.notify_driver_nearby(uuid) to authenticated;
