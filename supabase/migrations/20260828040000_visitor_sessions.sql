-- Anonymous visitor tracking for the "Visiteurs" admin module. No existing
-- table covers this (grepped for visitor/analytics/tracking beforehand).
-- Sessions are the only unit stored: one row per (restaurant, visitor_id)
-- "burst" of activity, closed by a 30-minute inactivity gap and re-opened
-- as a new row afterwards. No name/phone/email/address/precise location is
-- ever collected -- visitor_id is a client-generated anonymous token.

create table if not exists public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  visitor_id text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists visitor_sessions_restaurant_id_idx on public.visitor_sessions (restaurant_id);
create index if not exists visitor_sessions_visitor_id_idx on public.visitor_sessions (visitor_id);
create index if not exists visitor_sessions_started_at_idx on public.visitor_sessions (started_at);
create index if not exists visitor_sessions_last_seen_at_idx on public.visitor_sessions (last_seen_at);
-- Speeds up the "reuse an open session" lookup in track_visitor_session.
create index if not exists visitor_sessions_restaurant_visitor_last_seen_idx
  on public.visitor_sessions (restaurant_id, visitor_id, last_seen_at desc);

-- RLS enabled with *no* policies at all: every read and write goes through
-- the SECURITY DEFINER functions below (which bypass RLS as the function
-- owner). There is deliberately no path for a client -- anon or
-- authenticated -- to select raw rows, matching "no visitor list, no
-- visitor_id in the UI, ever" from the spec.
alter table public.visitor_sessions enable row level security;

revoke all on public.visitor_sessions from anon, authenticated;

-- Public, anonymous write path: touches (or opens) the caller's session for
-- the tenant identified by slug. Mirrors create_order's restaurant lookup
-- (slug + is_public + status = 'active') -- never trusts a client-supplied
-- restaurant/tenant id. A slug that doesn't resolve is a silent no-op
-- (tracking must never surface an error or break the storefront).
create or replace function public.track_visitor_session(p_slug text, p_visitor_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_session_id uuid;
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
    insert into public.visitor_sessions (restaurant_id, visitor_id, started_at, last_seen_at)
    values (v_restaurant_id, p_visitor_id, now(), now());
  end if;
end;
$function$;

revoke all on function public.track_visitor_session(text, text) from public;
grant execute on function public.track_visitor_session(text, text) to anon, authenticated;

-- Admin-only reads. Both resolve the tenant from the authenticated caller's
-- own membership (same pattern as get_restaurant_dashboard_stats) -- never
-- from a client-supplied id -- so a tenant_admin can only ever see their
-- own restaurant's numbers.
create or replace function public.get_visitor_realtime_count()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_count integer;
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

  select count(distinct visitor_id) into v_count
    from public.visitor_sessions
    where restaurant_id = v_restaurant_id
      and last_seen_at >= now() - interval '5 minutes';

  return coalesce(v_count, 0);
end;
$function$;

revoke all on function public.get_visitor_realtime_count() from public;
grant execute on function public.get_visitor_realtime_count() to authenticated;

-- "today" is the tenant's own calendar day; "7 jours"/"30 jours" are
-- rolling windows ending now, matching the segmented control's literal
-- labels (the alternative -- calendar week/month-to-date -- would silently
-- mismatch a UI that says "7 jours").
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

  return jsonb_build_object(
    'today', coalesce(v_today_count, 0),
    'week', coalesce(v_week_count, 0),
    'month', coalesce(v_month_count, 0)
  );
end;
$function$;

revoke all on function public.get_visitor_stats() from public;
grant execute on function public.get_visitor_stats() to authenticated;
