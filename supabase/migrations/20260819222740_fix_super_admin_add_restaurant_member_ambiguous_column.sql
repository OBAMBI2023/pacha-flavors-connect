-- Fix: public.super_admin_add_restaurant_member always failed with
-- "column reference "restaurant_id" is ambiguous" because its
-- `RETURNS TABLE (user_id uuid, restaurant_id uuid, role ...)` output
-- parameters are exposed as plpgsql variables inside the function body,
-- shadowing the `restaurant_id` column referenced (unqualified, as
-- required by Postgres) in `ON CONFLICT (restaurant_id, user_id)`.
-- Renaming the output columns removes the collision; callers only read
-- the `error` field from this RPC today, so the column rename is safe.

drop function if exists public.super_admin_add_restaurant_member(uuid, text, public.restaurant_role);

create function public.super_admin_add_restaurant_member(
  _restaurant_id uuid,
  _email text,
  _role public.restaurant_role
)
returns table (out_user_id uuid, out_restaurant_id uuid, out_role public.restaurant_role)
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
    raise exception 'Aucun compte inscrit avec cet e-mail: %', _email;
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
