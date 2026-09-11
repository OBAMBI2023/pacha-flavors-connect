-- SAOVIA Step 2 "Live Dashboard": extends (does not recreate)
-- get_super_admin_pageview_overview from Step 1 with a per-tenant breakdown --
-- the Live page's "tenants actuellement actifs" and "classement par vues
-- aujourd'hui" sections both need today/active-now numbers per restaurant,
-- which the Step 1 shape (period-only, tenants-with-a-session-only) doesn't
-- have. Tracking logic (track_visitor_session/heartbeat_visitor_session) is
-- untouched -- only this read-side aggregation function's body changes.
--
-- `views_by_tenant` is replaced by `tenants`, built the same "start from
-- restaurants, LEFT JOIN aggregates" way get_super_admin_acquisition_overview
-- already does for its own tenant_breakdown, so a tenant with zero views
-- today still appears (never silently dropped). Scope is is_public=true and
-- status='active' -- the exact same "trackable tenant" definition
-- track_visitor_session itself already uses, so "tenants suivis" (computed
-- client-side as this array's length) is a real, non-fabricated count.

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
    'tenants', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'restaurant_id', r.id,
          'restaurant_name', r.name,
          'logo_url', r.logo_url,
          'views_period', coalesce(period.views, 0),
          'unique_visitors_period', coalesce(period.unique_visitors, 0),
          'views_today', coalesce(today.views, 0),
          'unique_visitors_today', coalesce(today.unique_visitors, 0),
          'active_visitors_now', coalesce(active.active_visitors_now, 0)
        ) order by coalesce(today.views, 0) desc, r.name asc), '[]'::jsonb)
      from public.restaurants r
      left join (
        select restaurant_id, sum(page_views) as views, count(distinct visitor_id) as unique_visitors
        from public.visitor_sessions
        where started_at >= v_start
        group by restaurant_id
      ) period on period.restaurant_id = r.id
      left join (
        select restaurant_id, sum(page_views) as views, count(distinct visitor_id) as unique_visitors
        from public.visitor_sessions
        where started_at >= v_today_start
        group by restaurant_id
      ) today on today.restaurant_id = r.id
      left join (
        select restaurant_id, count(distinct visitor_id) as active_visitors_now
        from public.visitor_sessions
        where last_seen_at >= now() - interval '5 minutes'
        group by restaurant_id
      ) active on active.restaurant_id = r.id
      where r.is_public = true and r.status = 'active'
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
