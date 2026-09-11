-- QR Code analytics per tenant (Admin > Paramètres > Performance du QR
-- Code). Reuses the existing visitor_sessions burst-tracking table (added
-- for the "Visiteurs" module) instead of a new events table: it already
-- gives anonymous, deduplicated, per-tenant session rows with no PII, which
-- is exactly what a "scan" and "unique visitor" count need -- it was just
-- missing a way to tag *where* a session came from. Order attribution
-- reuses the order_source column/enum-of-values create_order already
-- recognizes ('qr_code' was already a valid value, just never set by the
-- storefront checkout until now).

-- ---------------------------------------------------------------------------
-- 1) visitor_sessions: optional source tag. Set only when a brand-new
--    session burst is created -- an existing burst (same visitor, seen
--    again within 30 minutes) keeps whatever source it started with, so a
--    later plain heartbeat can never silently overwrite a real QR landing.
-- ---------------------------------------------------------------------------

alter table public.visitor_sessions
  add column source text null
    check (source is null or source = 'qr');

-- Partial index: only QR-tagged rows are ever queried by source, so there's
-- no reason to index the (overwhelmingly more common) null rows.
create index visitor_sessions_restaurant_source_started_idx
  on public.visitor_sessions (restaurant_id, started_at)
  where source = 'qr';

drop function if exists public.track_visitor_session(text, text);

create or replace function public.track_visitor_session(p_slug text, p_visitor_id text, p_source text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_session_id uuid;
  v_source text;
begin
  if p_visitor_id is null or btrim(p_visitor_id) = '' or length(p_visitor_id) > 100 then
    return;
  end if;

  -- Never trust the client value verbatim -- only the one recognized tag
  -- survives, anything else (or absent) is plain organic traffic (null).
  v_source := case when p_source = 'qr' then 'qr' else null end;

  select r.id into v_restaurant_id
    from public.restaurants r
    where r.slug = p_slug
      and r.is_public = true
      and r.status = 'active'
    limit 1;

  if v_restaurant_id is null then
    return;
  end if;

  select id into v_session_id
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id
      and visitor_id = p_visitor_id
      and last_seen_at >= now() - interval '30 minutes'
    order by last_seen_at desc
    limit 1;

  if v_session_id is not null then
    update public.visitor_sessions set last_seen_at = now() where id = v_session_id;
  else
    insert into public.visitor_sessions (restaurant_id, visitor_id, started_at, last_seen_at, source)
    values (v_restaurant_id, p_visitor_id, now(), now(), v_source);
  end if;
end;
$function$;

revoke all on function public.track_visitor_session(text, text, text) from public;
grant execute on function public.track_visitor_session(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) orders: index for the per-tenant/per-source lookups below. order_source
--    already exists (create_order already normalizes/stores it); this is
--    the first query pattern that filters on it, so it had no index yet.
-- ---------------------------------------------------------------------------

create index orders_restaurant_id_order_source_idx on public.orders (restaurant_id, order_source);

-- ---------------------------------------------------------------------------
-- 3) get_tenant_qr_stats: everything the QR performance card needs in one
--    light, tenant-scoped call -- never the full get_restaurant_dashboard_stats
--    payload (revenue series, top products, hourly/weekday breakdowns...),
--    which would be far heavier than this section needs. Same
--    resolve-tenant-from-auth.uid() pattern as get_visitor_stats /
--    get_restaurant_dashboard_stats -- never a client-supplied restaurant id.
--    Revenue uses restaurant_total (subtotal - discount), never
--    delivery_fee_amount -- same rule already applied to the encaissements
--    dashboard.
-- ---------------------------------------------------------------------------

create or replace function public.get_tenant_qr_stats()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_tz text;
  v_currency text;
  v_today_start timestamptz;
  v_scans_today integer;
  v_scans_week integer;
  v_scans_month integer;
  v_unique_visitors integer;
  v_last_scan_at timestamptz;
  v_qr_orders_count integer;
  v_qr_revenue numeric;
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

  select coalesce(r.timezone, 'Africa/Abidjan'), r.currency
    into v_tz, v_currency
    from public.restaurants r
    where r.id = v_restaurant_id;

  v_today_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;

  select count(*) into v_scans_today
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and source = 'qr' and started_at >= v_today_start;

  select count(*) into v_scans_week
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and source = 'qr' and started_at >= now() - interval '7 days';

  select count(*), count(distinct visitor_id)
    into v_scans_month, v_unique_visitors
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and source = 'qr' and started_at >= now() - interval '30 days';

  -- "Dernier scan" looks back further than the 30-day windows above -- a
  -- tenant with its last scan 40 days ago should still see when, not "--".
  select max(started_at) into v_last_scan_at
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and source = 'qr';

  select
    count(*) filter (where status != 'cancelled'),
    coalesce(sum(subtotal_amount - discount_amount) filter (where status = 'delivered'), 0)
    into v_qr_orders_count, v_qr_revenue
    from public.orders
    where restaurant_id = v_restaurant_id and order_source = 'qr_code';

  return jsonb_build_object(
    'currency', v_currency,
    'scans_today', coalesce(v_scans_today, 0),
    'scans_week', coalesce(v_scans_week, 0),
    'scans_month', coalesce(v_scans_month, 0),
    'unique_visitors_month', coalesce(v_unique_visitors, 0),
    'last_scan_at', v_last_scan_at,
    'qr_orders_count', coalesce(v_qr_orders_count, 0),
    'qr_revenue', v_qr_revenue
  );
end;
$function$;

revoke all on function public.get_tenant_qr_stats() from public;
grant execute on function public.get_tenant_qr_stats() to authenticated;
