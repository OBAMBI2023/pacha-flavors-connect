-- organizations_select_scoped predates has_organization_access() gaining
-- its organization_memberships branch and never delegated to that
-- function -- it had its own inline condition. Without this fix, a new
-- org owner (no restaurant) could act via SECURITY DEFINER RPCs but could
-- never directly SELECT their own organizations row (blocking any
-- dashboard read that isn't routed through an RPC). Drop-in replacement
-- using the now-complete has_organization_access() as the single source
-- of truth, instead of duplicating its logic inline a second time.
drop policy organizations_select_scoped on public.organizations;

create policy organizations_select_scoped on public.organizations
  for select to authenticated
  using (public.has_organization_access(id));
