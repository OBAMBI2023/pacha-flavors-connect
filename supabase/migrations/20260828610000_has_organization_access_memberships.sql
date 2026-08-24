-- Additive only: existing branches (is_super_admin, restaurant_id-backed
-- access) stay byte-identical. One new OR branch checks direct
-- organization_memberships -- the missing link for organizations with no
-- restaurant. Same signature (_organization_id uuid) -> replaces in place.
create or replace function public.has_organization_access(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.is_super_admin() or exists (
    select 1 from public.organizations o
    where o.id = _organization_id
      and o.restaurant_id is not null
      and public.has_restaurant_access(o.restaurant_id)
  ) or exists (
    select 1 from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$function$;
