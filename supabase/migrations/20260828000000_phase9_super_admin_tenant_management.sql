-- Phase 9: Super Admin tenant management, theme columns, restaurant-status
-- access gate, and the RPCs backing tenant creation / listing.

-- a) Restaurant-status gate, added to the two shared authorization helpers
-- used across ~15 tables (never duplicated per-table). A restaurant that is
-- suspended/archived stops granting its members access; super_admin keeps
-- full access via the unchanged first branch of the `or`. `trial` and
-- `active` restaurants are unaffected -- existing tenants keep working.
create or replace function public.has_restaurant_access(_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.restaurant_memberships m
    join public.restaurants r on r.id = m.restaurant_id
    where m.restaurant_id = _restaurant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and r.status not in ('suspended', 'archived')
  );
$$;

create or replace function public.has_restaurant_role(_restaurant_id uuid, _roles restaurant_role[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.restaurant_memberships m
    join public.restaurants r on r.id = m.restaurant_id
    where m.restaurant_id = _restaurant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(_roles)
      and r.status not in ('suspended', 'archived')
  );
$$;

-- b) Theme columns. Nullable everywhere -- null means "inherit the
-- platform's default official theme" client-side (src/lib/theme.ts).
alter table public.restaurant_settings
  add column secondary_color text,
  add column accent_color text,
  add column background_color text,
  add column surface_color text,
  add column text_color text,
  add column font_family text,
  add column border_radius text;

alter table public.restaurants
  add column favicon_url text;

-- c) Atomic tenant finalization, called by the Edge Function with the
-- calling super admin's own JWT (never service_role) right after the Auth
-- user has been created via the Admin API. restaurant_settings is already
-- created by the existing create_restaurant_settings_default trigger fired
-- by the restaurants insert below -- this just fills in its theme columns.
create or replace function public.super_admin_create_tenant(
  _owner_user_id uuid,
  _name text,
  _slug text,
  _phone text,
  _whatsapp_phone text,
  _email text,
  _address text,
  _commune text,
  _city text,
  _status public.restaurant_status default 'active',
  _primary_color text default null,
  _secondary_color text default null,
  _accent_color text default null,
  _background_color text default null,
  _surface_color text default null,
  _text_color text default null,
  _font_family text default null,
  _border_radius text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _restaurant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  insert into public.restaurants (name, slug, phone, whatsapp_phone, email, address, commune, city, status)
  values (_name, _slug, _phone, _whatsapp_phone, _email, _address, _commune, _city, _status)
  returning id into _restaurant_id;

  update public.restaurant_settings set
    primary_color = coalesce(_primary_color, primary_color),
    secondary_color = _secondary_color,
    accent_color = _accent_color,
    background_color = _background_color,
    surface_color = _surface_color,
    text_color = _text_color,
    font_family = _font_family,
    border_radius = _border_radius
  where restaurant_id = _restaurant_id;

  insert into public.profiles (id)
  values (_owner_user_id)
  on conflict (id) do nothing;

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (_restaurant_id, _owner_user_id, 'owner', 'active');

  return _restaurant_id;
end;
$$;

-- d) Tenant listing for the Super Admin table -- needs auth.users.email,
-- which is never exposed to the client directly (mirrors the existing
-- super_admin_list_restaurant_members pattern).
create or replace function public.super_admin_list_tenants()
returns table(
  id uuid,
  name text,
  slug text,
  status public.restaurant_status,
  created_at timestamptz,
  owner_user_id uuid,
  owner_email text,
  owner_name text,
  primary_color text,
  secondary_color text,
  accent_color text
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  return query
    select
      r.id,
      r.name,
      r.slug,
      r.status,
      r.created_at,
      m.user_id,
      u.email::text,
      p.full_name,
      s.primary_color,
      s.secondary_color,
      s.accent_color
    from public.restaurants r
    left join public.restaurant_memberships m on m.restaurant_id = r.id and m.role = 'owner'
    left join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    left join public.restaurant_settings s on s.restaurant_id = r.id
    order by r.created_at desc;
end;
$$;

-- e) Password reset target validation -- confirms a user_id is really the
-- owner of the given restaurant before the Edge Function is allowed to call
-- the Admin API against it. Runs with the calling super admin's own JWT.
create or replace function public.super_admin_get_tenant_owner(_restaurant_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _owner_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  select m.user_id
    into _owner_user_id
  from public.restaurant_memberships m
  where m.restaurant_id = _restaurant_id
    and m.role = 'owner'
  order by m.created_at asc
  limit 1;

  if _owner_user_id is null then
    raise exception 'No owner membership found for restaurant: %', _restaurant_id;
  end if;

  return _owner_user_id;
end;
$$;
