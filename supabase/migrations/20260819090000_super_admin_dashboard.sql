create or replace function public.create_restaurant_settings_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  insert into public.restaurant_settings (restaurant_id)
  values (new.id)
  on conflict (restaurant_id) do nothing;
  return new;
end;
$fn$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'restaurants_create_settings'
  ) then
    create trigger restaurants_create_settings
      after insert on public.restaurants
      for each row execute function public.create_restaurant_settings_default();
  end if;
end $$;

create or replace function public.super_admin_add_restaurant_member(
  _restaurant_id uuid,
  _email text,
  _role public.restaurant_role
)
returns table (user_id uuid, restaurant_id uuid, role public.restaurant_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  normalized_email text := lower(trim(_email));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_super_admin() then
    raise exception 'Forbidden: super_admin only';
  end if;

  if not exists (
    select 1
    from public.restaurants r
    where r.id = _restaurant_id
  ) then
    raise exception 'Restaurant not found: %', _restaurant_id;
  end if;

  select u.id
    into target_user_id
  from auth.users u
  where lower(trim(u.email)) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'No auth user found for email %', _email;
  end if;

  insert into public.profiles (id)
  values (target_user_id)
  on conflict (id) do nothing;

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (_restaurant_id, target_user_id, _role, 'active')
  on conflict (restaurant_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    updated_at = now();

  return query
    select
      target_user_id,
      _restaurant_id,
      _role;
end;
$$;

revoke all on function public.super_admin_add_restaurant_member(uuid, text, public.restaurant_role) from public, anon;
grant execute on function public.super_admin_add_restaurant_member(uuid, text, public.restaurant_role) to authenticated;

create or replace function public.super_admin_list_restaurant_members(_restaurant_id uuid)
returns table (user_id uuid, restaurant_id uuid, role public.restaurant_role, status text, email text)
language plpgsql
security definer
set search_path = ''
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
      m.user_id,
      m.restaurant_id,
      m.role,
      m.status::text,
      u.email::text
    from public.restaurant_memberships m
    join auth.users u on u.id = m.user_id
    where m.restaurant_id = _restaurant_id
    order by u.email nulls last, m.role;
end;
$$;

revoke all on function public.super_admin_list_restaurant_members(uuid) from public, anon;
grant execute on function public.super_admin_list_restaurant_members(uuid) to authenticated;
