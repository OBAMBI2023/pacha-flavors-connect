-- ---------------------------------------------------------------------------
-- SAOVIA Step 4 "Disponibilité & Horaires" -- Super Admin cross-tenant view.
--
-- Reuses the existing hours engine entirely (tenant_business_hours,
-- tenant_business_exceptions, restaurant_settings.manual_override/status,
-- get_restaurant_availability) -- no parallel schedule system is created.
--
-- The one genuinely new piece of data is "actual" status over time. Nothing
-- in this schema has ever recorded what a restaurant's real open/closed
-- state was at a past moment -- get_restaurant_availability is a pure,
-- stateless computation of "right now". To measure actual_open_hours /
-- unexpected_downtime honestly (no_mock_data), this migration adds a
-- lightweight, real, ongoing measurement:
--   - restaurant_availability_snapshots: an append-only log.
--   - compute_availability_status(): the single status-model computation,
--     reused by both the snapshot writer and the live "current_status" read.
--   - record_availability_snapshots(): a pg_cron job (same extension/pattern
--     already used by dispatch_expire_stale_proposals in
--     20260827000000_phase7_driver_dispatch.sql) ticking every 5 minutes,
--     snapshotting every public/non-archived restaurant's real computed
--     status. This is a measurement, not a duplicate hours system.
--
-- Consequence, stated plainly: "actual" metrics only exist from the moment
-- this migration is applied onward. A period that predates deployment has
-- no snapshots -- the RPC reports null (`has_monitoring_data: false`),
-- never a fabricated 0%. "scheduled" metrics have no such limitation: they
-- are derived directly from tenant_business_hours / tenant_business_exceptions,
-- which are real for any date, past or future.
-- ---------------------------------------------------------------------------

create table public.restaurant_availability_snapshots (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  checked_at timestamptz not null default now(),
  status text not null check (status in ('OPEN', 'CLOSED_SCHEDULED', 'CLOSED_UNEXPECTED', 'PAUSED', 'UNKNOWN')),
  is_open boolean not null,
  reason text not null,
  scheduled_open boolean not null
);

create index restaurant_availability_snapshots_restaurant_time_idx
  on public.restaurant_availability_snapshots (restaurant_id, checked_at desc);
create index restaurant_availability_snapshots_time_idx
  on public.restaurant_availability_snapshots (checked_at);

-- Same access pattern as visitor_sessions: RLS enabled, zero policies, no
-- table grant to anon/authenticated. Every read/write goes through the
-- SECURITY DEFINER functions below -- no client path ever selects raw rows.
alter table public.restaurant_availability_snapshots enable row level security;
revoke all on public.restaurant_availability_snapshots from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- compute_scheduled_spans: for one restaurant and one tenant-local calendar
-- date, what the *schedule alone* says (date exception, if any, else the
-- weekly template) -- ignoring manual override entirely, since "scheduled"
-- must reflect the published hours, not a one-off manual action. Sums every
-- slot's clipped overlap with [date, date+1) so split shifts and slots that
-- cross midnight (from today's own row, or spilling in from yesterday's) are
-- counted correctly -- mirrors the today/yesterday check in
-- get_restaurant_availability itself.
--
-- first_opens_at/last_closes_at are earliest-open/latest-close for display
-- (the dashboard's opening_time/closing_time columns); for a tenant running
-- split shifts this is a reasonable "spans the whole day" summary, not a
-- precise multi-slot listing -- documented limitation, not a defect.
-- has_schedule reflects whether this tenant has configured hours at all
-- (any tenant_business_hours row), independent of whether that date happens
-- to be closed.
-- ---------------------------------------------------------------------------
create or replace function public.compute_scheduled_spans(p_restaurant_id uuid, p_date date)
returns table(scheduled_minutes integer, first_opens_at timestamptz, last_closes_at timestamptz, has_schedule boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_exception record;
begin
  select timezone into v_tz from public.restaurants where id = p_restaurant_id;
  if v_tz is null then
    return query select 0, null::timestamptz, null::timestamptz, false;
    return;
  end if;

  select * into v_exception
    from public.tenant_business_exceptions e
    where e.restaurant_id = p_restaurant_id
      and p_date between e.date and coalesce(e.end_date, e.date)
    order by e.updated_at desc
    limit 1;

  if v_exception.id is not null then
    if not v_exception.is_open then
      return query select 0, null::timestamptz, null::timestamptz, true;
      return;
    end if;

    return query select
      greatest((extract(epoch from (
        (case when v_exception.closing_time <= v_exception.opening_time
          then (p_date + 1 + v_exception.closing_time) else (p_date + v_exception.closing_time) end) at time zone v_tz
        - (p_date + v_exception.opening_time) at time zone v_tz
      )) / 60)::integer, 0),
      (p_date + v_exception.opening_time) at time zone v_tz,
      (case when v_exception.closing_time <= v_exception.opening_time
        then (p_date + 1 + v_exception.closing_time) else (p_date + v_exception.closing_time) end) at time zone v_tz,
      true;
    return;
  end if;

  return query
  with slots as (
    select h.opening_time, h.closing_time,
      (h.day_of_week = extract(dow from p_date)::int) as is_today
    from public.tenant_business_hours h
    where h.restaurant_id = p_restaurant_id
      and h.is_open = true
      and h.day_of_week in (extract(dow from p_date)::int, extract(dow from p_date - 1)::int)
  ),
  spans as (
    select
      (case when is_today then p_date else p_date - 1 end + opening_time) at time zone v_tz as starts_at,
      (case
        when closing_time <= opening_time then (case when is_today then p_date + 1 else p_date end + closing_time)
        else (case when is_today then p_date else p_date - 1 end + closing_time)
      end) at time zone v_tz as ends_at
    from slots
  ),
  clipped as (
    select
      greatest(starts_at, p_date at time zone v_tz) as c_start,
      least(ends_at, (p_date + 1) at time zone v_tz) as c_end
    from spans
    where ends_at > (p_date at time zone v_tz) and starts_at < ((p_date + 1) at time zone v_tz)
  )
  select
    coalesce(sum(extract(epoch from (c_end - c_start)) / 60)::integer, 0),
    min(c_start),
    max(c_end),
    exists(select 1 from public.tenant_business_hours where restaurant_id = p_restaurant_id)
  from clipped;
end;
$$;

revoke all on function public.compute_scheduled_spans(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- compute_availability_status: the single source of truth for the 5-state
-- status model (OPEN / CLOSED_SCHEDULED / CLOSED_UNEXPECTED / PAUSED /
-- UNKNOWN), built on top of get_restaurant_availability rather than
-- reimplementing "is it open" -- only the mapping to a status label is new.
--
-- Mapping:
--   is_open = true                          -> OPEN
--   is_open = false, reason = 'exception'    -> CLOSED_SCHEDULED (a dated,
--     configured closure -- e.g. a holiday -- is a planned closure, not an
--     anomaly)
--   is_open = false, reason = 'schedule'     -> CLOSED_SCHEDULED
--   is_open = false, reason = 'manual'       -> CLOSED_UNEXPECTED if the
--     weekly template alone says this instant should be open (a human
--     manually closed the tenant during its own published hours -- exactly
--     the "closed during scheduled hours" anomaly), else PAUSED (a
--     voluntary closure that doesn't contradict the published schedule).
--   reason = 'unknown' (bad/missing timezone) -> UNKNOWN
--
-- scheduled_open mirrors get_restaurant_availability's own step-3 weekly
-- check exactly (today + yesterday's day_of_week, midnight-crossing
-- handled the same way) but deliberately skips exceptions/manual override,
-- since it exists purely to answer "what would the *weekly template alone*
-- say right now" for the mapping above and the open-outside-hours anomaly.
-- ---------------------------------------------------------------------------
create or replace function public.compute_availability_status(p_restaurant_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_availability jsonb;
  v_is_open boolean;
  v_reason text;
  v_today date;
  v_span record;
  v_scheduled_open boolean := false;
  v_offsets int[] := array[0, -1];
  v_offset int;
  v_check_date date;
  v_day int;
  v_slot record;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_status text;
begin
  select timezone into v_tz from public.restaurants where id = p_restaurant_id;
  if v_tz is null then
    return jsonb_build_object(
      'status', 'UNKNOWN', 'is_open', false, 'reason', 'unknown', 'scheduled_open', false,
      'closes_at', null, 'next_opens_at', null, 'opening_time', null, 'closing_time', null
    );
  end if;

  v_availability := public.get_restaurant_availability(p_restaurant_id, p_now);
  v_is_open := coalesce((v_availability->>'is_open')::boolean, false);
  v_reason := v_availability->>'reason';
  v_today := (p_now at time zone v_tz)::date;

  foreach v_offset in array v_offsets loop
    v_check_date := v_today + v_offset;
    v_day := extract(dow from v_check_date)::int;
    for v_slot in
      select opening_time, closing_time from public.tenant_business_hours
      where restaurant_id = p_restaurant_id and day_of_week = v_day and is_open = true
    loop
      v_starts_at := (v_check_date + v_slot.opening_time) at time zone v_tz;
      v_ends_at := case when v_slot.closing_time <= v_slot.opening_time
        then (v_check_date + 1 + v_slot.closing_time) at time zone v_tz
        else (v_check_date + v_slot.closing_time) at time zone v_tz
      end;
      if p_now >= v_starts_at and p_now < v_ends_at then
        v_scheduled_open := true;
      end if;
    end loop;
  end loop;

  if v_reason = 'unknown' then
    v_status := 'UNKNOWN';
  elsif v_is_open then
    v_status := 'OPEN';
  elsif v_reason = 'exception' then
    v_status := 'CLOSED_SCHEDULED';
  elsif v_reason = 'manual' then
    v_status := case when v_scheduled_open then 'CLOSED_UNEXPECTED' else 'PAUSED' end;
  elsif v_reason = 'schedule' then
    v_status := 'CLOSED_SCHEDULED';
  else
    v_status := 'UNKNOWN';
  end if;

  select * into v_span from public.compute_scheduled_spans(p_restaurant_id, v_today);

  return jsonb_build_object(
    'status', v_status,
    'is_open', v_is_open,
    'reason', v_reason,
    'scheduled_open', v_scheduled_open,
    'closes_at', v_availability->>'closes_at',
    'next_opens_at', v_availability->>'next_opens_at',
    'opening_time', v_span.first_opens_at,
    'closing_time', v_span.last_closes_at
  );
end;
$$;

revoke all on function public.compute_availability_status(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- record_availability_snapshots: the pg_cron target. Snapshots every
-- public, non-archived restaurant's real computed status every 5 minutes,
-- and prunes anything older than 35 days (bounds table growth; comfortably
-- covers the dashboard's 30-day filter).
-- ---------------------------------------------------------------------------
create or replace function public.record_availability_snapshots()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant record;
  v_status jsonb;
begin
  for v_restaurant in
    select id from public.restaurants where is_public = true and status <> 'archived'
  loop
    v_status := public.compute_availability_status(v_restaurant.id, now());
    insert into public.restaurant_availability_snapshots (restaurant_id, checked_at, status, is_open, reason, scheduled_open)
    values (
      v_restaurant.id, now(),
      v_status->>'status',
      coalesce((v_status->>'is_open')::boolean, false),
      coalesce(v_status->>'reason', 'unknown'),
      coalesce((v_status->>'scheduled_open')::boolean, false)
    );
  end loop;

  delete from public.restaurant_availability_snapshots where checked_at < now() - interval '35 days';
end;
$$;

revoke all on function public.record_availability_snapshots() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'availability-snapshot-tick',
  '*/5 * * * *',
  $$select public.record_availability_snapshots();$$
);

-- ---------------------------------------------------------------------------
-- get_super_admin_availability_overview: the one read RPC for the
-- /super-admin/availability dashboard. Same pattern as
-- get_super_admin_orders/get_super_admin_driver_locations/
-- get_super_admin_acquisition_overview -- SECURITY DEFINER, re-checks
-- is_super_admin() itself, never grants the Super Admin role direct table
-- access, touches no existing RLS policy.
--
-- Returns every in-scope tenant's row (status/tenant filtering happens
-- client-side, same convention as the acquisition page's client-side
-- top-N/filter lists) plus platform-wide KPIs for the period. KPIs and every
-- "actual"/"unexpected_downtime"/"availability_rate" figure are null when a
-- tenant (or the whole platform) has zero snapshot coverage for the period
-- -- "insufficient data", never a fabricated 0 (no_alert_without_real_data,
-- never_negative, no_nan).
-- ---------------------------------------------------------------------------
create or replace function public.get_super_admin_availability_overview(
  p_period_days integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_period_days integer := least(greatest(coalesce(p_period_days, 1), 1), 30);
  v_restaurant record;
  v_today date;
  v_current jsonb;
  v_span record;
  v_day date;
  v_day_span record;
  v_period_scheduled integer;
  v_period_actual integer;
  v_period_downtime integer;
  v_period_snapshots integer;
  v_open_cnt integer;
  v_unexpected_cnt integer;
  v_total_cnt integer;
  v_outside_cnt integer;
  v_snap_first_open timestamptz;
  v_snap_last_open timestamptz;
  v_late_opening boolean;
  v_early_closing boolean;
  v_open_outside_total integer;
  v_long_downtime_minutes integer;
  v_rate numeric;
  v_rows jsonb := '[]'::jsonb;
  v_open_now_count integer := 0;
  v_closed_now_count integer := 0;
  v_kpi_scheduled numeric := 0;
  v_kpi_actual numeric := 0;
  v_kpi_downtime numeric := 0;
  v_kpi_data_tenants integer := 0;
  v_kpi_rate_sum numeric := 0;
  v_kpi_rate_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  for v_restaurant in
    select r.id, r.name, r.timezone
    from public.restaurants r
    where r.is_public = true and r.status <> 'archived'
    order by r.name
  loop
    v_today := (now() at time zone v_restaurant.timezone)::date;
    v_current := public.compute_availability_status(v_restaurant.id, now());
    select * into v_span from public.compute_scheduled_spans(v_restaurant.id, v_today);

    v_period_scheduled := 0;
    v_period_actual := 0;
    v_period_downtime := 0;
    v_period_snapshots := 0;
    v_late_opening := false;
    v_early_closing := false;
    v_open_outside_total := 0;

    for v_day in
      select generate_series(v_today - (v_period_days - 1), v_today, interval '1 day')::date
    loop
      select * into v_day_span from public.compute_scheduled_spans(v_restaurant.id, v_day);
      v_period_scheduled := v_period_scheduled + coalesce(v_day_span.scheduled_minutes, 0);

      select
        count(*) filter (where status = 'OPEN'),
        count(*) filter (where status = 'CLOSED_UNEXPECTED'),
        count(*),
        count(*) filter (where is_open and reason = 'manual' and not scheduled_open),
        min(checked_at) filter (where status = 'OPEN'),
        max(checked_at) filter (where status = 'OPEN')
      into v_open_cnt, v_unexpected_cnt, v_total_cnt, v_outside_cnt, v_snap_first_open, v_snap_last_open
      from public.restaurant_availability_snapshots
      where restaurant_id = v_restaurant.id
        and checked_at >= (v_day at time zone v_restaurant.timezone)
        and checked_at < ((v_day + 1) at time zone v_restaurant.timezone);

      v_period_actual := v_period_actual + coalesce(v_open_cnt, 0) * 5;
      v_period_downtime := v_period_downtime + coalesce(v_unexpected_cnt, 0) * 5;
      v_period_snapshots := v_period_snapshots + coalesce(v_total_cnt, 0);
      v_open_outside_total := v_open_outside_total + coalesce(v_outside_cnt, 0);

      if v_day_span.has_schedule and v_day_span.first_opens_at is not null and v_snap_first_open is not null
         and v_snap_first_open > v_day_span.first_opens_at + interval '15 minutes' then
        v_late_opening := true;
      end if;
      if v_day_span.has_schedule and v_day_span.last_closes_at is not null and v_snap_last_open is not null
         and v_snap_last_open < v_day_span.last_closes_at - interval '20 minutes' then
        v_early_closing := true;
      end if;
    end loop;

    -- Longest unbroken CLOSED_UNEXPECTED streak in the period (gaps-and-
    -- islands over the evenly-spaced 5-minute snapshot log).
    select coalesce(max(streak_minutes), 0) into v_long_downtime_minutes
    from (
      select count(*) * 5 as streak_minutes
      from (
        select checked_at, status,
          row_number() over (order by checked_at) - row_number() over (partition by status order by checked_at) as grp
        from public.restaurant_availability_snapshots
        where restaurant_id = v_restaurant.id
          and checked_at >= (v_today - (v_period_days - 1)) at time zone v_restaurant.timezone
          and status = 'CLOSED_UNEXPECTED'
      ) t
      group by grp
    ) streaks;

    if v_period_snapshots = 0 or v_period_scheduled = 0 then
      v_rate := null;
    else
      v_rate := round(least(greatest(v_period_actual::numeric / v_period_scheduled::numeric * 100, 0), 100), 1);
    end if;

    if (v_current->>'status') = 'OPEN' then
      v_open_now_count := v_open_now_count + 1;
    else
      v_closed_now_count := v_closed_now_count + 1;
    end if;

    v_kpi_scheduled := v_kpi_scheduled + v_period_scheduled;
    if v_period_snapshots > 0 then
      v_kpi_actual := v_kpi_actual + v_period_actual;
      v_kpi_downtime := v_kpi_downtime + v_period_downtime;
      v_kpi_data_tenants := v_kpi_data_tenants + 1;
    end if;
    if v_rate is not null then
      v_kpi_rate_sum := v_kpi_rate_sum + v_rate;
      v_kpi_rate_count := v_kpi_rate_count + 1;
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'restaurant_id', v_restaurant.id,
      'restaurant_name', v_restaurant.name,
      'timezone', v_restaurant.timezone,
      'current_status', v_current->>'status',
      'is_open', (v_current->>'is_open')::boolean,
      'opening_time', v_span.first_opens_at,
      'closing_time', v_span.last_closes_at,
      'scheduled_hours_today', round(coalesce(v_span.scheduled_minutes, 0) / 60.0, 1),
      'scheduled_hours', round(v_period_scheduled / 60.0, 1),
      'actual_open_hours', case when v_period_snapshots > 0 then round(v_period_actual / 60.0, 1) else null end,
      'unexpected_downtime_hours', case when v_period_snapshots > 0 then round(v_period_downtime / 60.0, 1) else null end,
      'availability_rate', v_rate,
      'has_monitoring_data', v_period_snapshots > 0,
      'anomalies', jsonb_build_object(
        'closed_during_scheduled_hours', v_period_downtime > 0,
        'open_outside_scheduled_hours', v_open_outside_total > 0,
        'late_opening', v_late_opening,
        'early_closing', v_early_closing,
        'long_unexpected_downtime', v_long_downtime_minutes >= 60
      )
    ));
  end loop;

  return jsonb_build_object(
    'period_days', v_period_days,
    'rows', v_rows,
    'kpis', jsonb_build_object(
      'restaurants_open_now', v_open_now_count,
      'restaurants_closed_now', v_closed_now_count,
      'scheduled_hours', round(v_kpi_scheduled / 60.0, 1),
      'actual_open_hours', case when v_kpi_data_tenants > 0 then round(v_kpi_actual / 60.0, 1) else null end,
      'unexpected_downtime', case when v_kpi_data_tenants > 0 then round(v_kpi_downtime / 60.0, 1) else null end,
      'average_availability_rate', case when v_kpi_rate_count > 0 then round(v_kpi_rate_sum / v_kpi_rate_count, 1) else null end
    )
  );
end;
$function$;

revoke all on function public.get_super_admin_availability_overview(integer) from public, anon;
grant execute on function public.get_super_admin_availability_overview(integer) to authenticated;
