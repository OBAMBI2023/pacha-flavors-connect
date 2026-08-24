-- SAOVIA Delivery Phase 2B -- organization_memberships mirrors
-- restaurant_memberships exactly (same enums reused: restaurant_role,
-- membership_status -- no new type). This is the missing link that lets a
-- user own/manage an organization that has no restaurant at all.
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role restaurant_role not null,
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create trigger organization_memberships_set_updated_at
  before update on public.organization_memberships
  for each row execute function public.set_updated_at();

-- Mirrors has_restaurant_role() exactly, same STABLE SECURITY DEFINER shape
-- (bypasses organization_memberships' own RLS when evaluated from inside a
-- policy, exactly like has_restaurant_role does for restaurant_memberships --
-- avoids relying on the table's own SELECT policy to resolve a write check).
create or replace function public.has_organization_role(_organization_id uuid, _roles restaurant_role[])
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.is_super_admin() or exists (
    select 1 from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(_roles)
  );
$function$;

revoke all on function public.has_organization_role(uuid, restaurant_role[]) from public;
grant execute on function public.has_organization_role(uuid, restaurant_role[]) to authenticated, anon;

alter table public.organization_memberships enable row level security;

create policy org_memberships_select_scoped on public.organization_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.has_organization_role(organization_id, array['owner']::restaurant_role[]) or public.is_super_admin());

create policy org_memberships_insert_owner_or_super_admin on public.organization_memberships
  for insert to authenticated
  with check (public.has_organization_role(organization_id, array['owner']::restaurant_role[]) or public.is_super_admin());

create policy org_memberships_update_owner_or_super_admin on public.organization_memberships
  for update to authenticated
  using (public.has_organization_role(organization_id, array['owner']::restaurant_role[]) or public.is_super_admin())
  with check (public.has_organization_role(organization_id, array['owner']::restaurant_role[]) or public.is_super_admin());

create policy org_memberships_delete_owner_or_super_admin on public.organization_memberships
  for delete to authenticated
  using (public.has_organization_role(organization_id, array['owner']::restaurant_role[]) or public.is_super_admin());
