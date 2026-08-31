-- SAOVIA Step 1: tenant page view tracking. Reuses visitor_sessions entirely
-- (no new table, no RLS policy added -- stays zero-policy / SECURITY DEFINER
-- only, exactly like the existing burst-tracking functions). The one real
-- gap in the existing system: track_visitor_session is called both on page
-- mount (a real "view") and on a 60s heartbeat interval (just a presence
-- ping) with no way to tell those apart server-side, so there was no way to
-- count PAGE VIEW distinctly from UNIQUE VISITOR/ACTIVE VISITOR. This adds a
-- page_views counter (incremented only by the view path) and a separate,
-- lighter heartbeat function that only ever touches last_seen_at.

-- ---------------------------------------------------------------------------
-- 1) page_views: count of real view events inside this 30-minute burst row.
--    A refresh of the same session reuses the row (no new unique visitor)
--    but does increment this -- it *is* a new page view.
-- ---------------------------------------------------------------------------

alter table public.visitor_sessions
  add column page_views integer not null default 1;

-- ---------------------------------------------------------------------------
-- 2) track_visitor_session: unchanged tenant resolution / 30-min burst reuse
--    / source-stickiness logic, now also incrementing page_views on reuse
--    (a fresh insert already defaults to 1). This function represents one
--    page view -- callers must invoke it once per page open/refresh, never
--    on a timer.
-- ---------------------------------------------------------------------------

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
    update public.visitor_sessions
      set last_seen_at = now(), page_views = page_views + 1
      where id = v_session_id;
  else
    insert into public.visitor_sessions (restaurant_id, visitor_id, started_at, last_seen_at, source, page_views)
    values (v_restaurant_id, p_visitor_id, now(), now(), v_source, 1);
  end if;
end;
$function$;

revoke all on function public.track_visitor_session(text, text, text) from public;
grant execute on function public.track_visitor_session(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) heartbeat_visitor_session: presence-only ping for the 60s interval.
--    Only ever touches last_seen_at on an *existing* open burst -- never
--    inserts, never touches page_views. A heartbeat with no open burst to
--    touch (e.g. the tab sat past the 30-minute window since the last real
--    view) is a silent no-op: it must never fabricate a view or a session.
-- ---------------------------------------------------------------------------

create or replace function public.heartbeat_visitor_session(p_slug text, p_visitor_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
begin
  if p_visitor_id is null or btrim(p_visitor_id) = '' or length(p_visitor_id) > 100 then
    return;
  end if;

  select r.id into v_restaurant_id
    from public.restaurants r
    where r.slug = p_slug
      and r.is_public = true
      and r.status = 'active'
    limit 1;

  if v_restaurant_id is null then
    return;
  end if;

  update public.visitor_sessions
    set last_seen_at = now()
    where restaurant_id = v_restaurant_id
      and visitor_id = p_visitor_id
      and last_seen_at >= now() - interval '30 minutes';
end;
$function$;

revoke all on function public.heartbeat_visitor_session(text, text) from public;
grant execute on function public.heartbeat_visitor_session(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) get_visitor_stats: additive views_today field alongside the existing
--    unique-visitor today/week/month counts. Same tenant-from-auth.uid()
--    resolution as before.
-- ---------------------------------------------------------------------------

create or replace function public.get_visitor_stats()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_tz text;
  v_today_start timestamptz;
  v_today_count integer;
  v_week_count integer;
  v_month_count integer;
  v_views_today integer;
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
    raise exception 'Aucun restaurant associé à cet utilisateur';
  end if;

  select coalesce(r.timezone, 'Africa/Abidjan') into v_tz from public.restaurants r where r.id = v_restaurant_id;
  v_today_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;

  select count(distinct visitor_id) into v_today_count
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and started_at >= v_today_start;

  select count(distinct visitor_id) into v_week_count
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and started_at >= now() - interval '7 days';

  select count(distinct visitor_id) into v_month_count
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and started_at >= now() - interval '30 days';

  select coalesce(sum(page_views), 0) into v_views_today
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id and started_at >= v_today_start;

  return jsonb_build_object(
    'today', coalesce(v_today_count, 0),
    'week', coalesce(v_week_count, 0),
    'month', coalesce(v_month_count, 0),
    'views_today', coalesce(v_views_today, 0)
  );
end;
$function$;

revoke all on function public.get_visitor_stats() from public;
grant execute on function public.get_visitor_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) get_super_admin_pageview_overview: platform-wide prepared metrics for a
--    future /live page (not built this step). Mirrors
--    get_super_admin_acquisition_overview's shape/gating exactly. Never
--    returns visitor_id, session id, IP, or any PII -- only restaurant
--    id/name plus aggregate counts.
-- ---------------------------------------------------------------------------

create or replace function public.get_super_admin_pageview_overview(
  p_period_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_period_days integer := greatest(coalesce(p_period_days, 30), 1);
  v_today_start timestamptz := (date_trunc('day', now() at time zone 'Africa/Abidjan') at time zone 'Africa/Abidjan');
  v_start timestamptz := v_today_start - (v_period_days || ' days')::interval;
  v_total_views_today integer;
  v_unique_visitors_today integer;
  v_active_visitors_now integer;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  select coalesce(sum(page_views), 0) into v_total_views_today
    from public.visitor_sessions
    where started_at >= v_today_start;

  select count(distinct visitor_id) into v_unique_visitors_today
    from public.visitor_sessions
    where started_at >= v_today_start;

  select count(distinct visitor_id) into v_active_visitors_now
    from public.visitor_sessions
    where last_seen_at >= now() - interval '5 minutes';

  select jsonb_build_object(
    'period_days', v_period_days,
    'total_views_today', coalesce(v_total_views_today, 0),
    'unique_visitors_today', coalesce(v_unique_visitors_today, 0),
    'active_visitors_now', coalesce(v_active_visitors_now, 0),
    'views_by_tenant', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'restaurant_id', t.restaurant_id,
          'restaurant_name', r.name,
          'views', t.views,
          'unique_visitors', t.unique_visitors
        ) order by t.views desc), '[]'::jsonb)
      from (
        select restaurant_id, sum(page_views) as views, count(distinct visitor_id) as unique_visitors
        from public.visitor_sessions
        where started_at >= v_start
        group by restaurant_id
      ) t
      join public.restaurants r on r.id = t.restaurant_id
    ),
    'views_by_day', (
      with days as (
        select generate_series(v_start::date, (now() at time zone 'Africa/Abidjan')::date, interval '1 day')::date as day
      ),
      daily as (
        select (date_trunc('day', started_at at time zone 'Africa/Abidjan'))::date as day,
          sum(page_views) as views,
          count(distinct visitor_id) as unique_visitors
        from public.visitor_sessions
        where started_at >= v_start
        group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object(
          'date', days.day,
          'views', coalesce(daily.views, 0),
          'unique_visitors', coalesce(daily.unique_visitors, 0)
        ) order by days.day), '[]'::jsonb)
      from days left join daily on daily.day = days.day
    )
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_super_admin_pageview_overview(integer) from public, anon;
grant execute on function public.get_super_admin_pageview_overview(integer) to authenticated;
