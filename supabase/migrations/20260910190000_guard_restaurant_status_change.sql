-- Security hardening (audit finding H-01): restaurants_update_owner_manager
-- lets an owner/manager UPDATE any column on their own restaurant row,
-- `status` included -- with no server-side guard, a suspended tenant's
-- owner could simply PATCH their own status back to 'active' via a direct
-- REST call, silently undoing a Super Admin suspension. Mirrors the exact
-- pattern already used for restaurant_settings.commission_rate
-- (trg_guard_commission_rate): a narrow BEFORE UPDATE OF <column> trigger,
-- not a change to the RLS policy itself, so every other legitimate
-- owner/manager UPDATE on restaurants (name, address, logo_url, is_public,
-- theme colors, etc.) is completely unaffected.
--
-- No RPC currently sets restaurants.status (verified: only INSERT touching
-- restaurants is create_order(), which only bumps next_order_number). The
-- only existing write path is the direct table UPDATE from the Super Admin
-- fiche tenant page, already gated by is_super_admin() via the
-- restaurants_update_super_admin policy -- this trigger simply makes that
-- boundary non-bypassable at the database level too.

-- SECURITY INVOKER (the default) is required here, not SECURITY DEFINER:
-- inside a SECURITY DEFINER function, current_user switches to that
-- function's OWNER (postgres) for the duration of the call, so a
-- current_user check performed *inside* a security-definer trigger would
-- always see its own owner and never the real caller -- silently
-- neutralizing the guard regardless of who actually fired the UPDATE.
-- With SECURITY INVOKER, current_user correctly reflects the actual
-- execution context: 'postgres' when the UPDATE originates from inside an
-- approved SECURITY DEFINER RPC (also owned by postgres), 'authenticated'
-- when it comes directly from PostgREST. is_super_admin() itself stays
-- SECURITY DEFINER (it needs to read profiles.is_super_admin regardless of
-- the caller's own RLS), so it is unaffected by this function's own mode.
create or replace function public.guard_restaurant_status_change()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.status is distinct from old.status
     and current_user <> 'postgres'
     and not public.is_super_admin() then
    raise exception 'Seul le Super Admin peut modifier le statut du restaurant';
  end if;
  return new;
end;
$function$;

create trigger trg_guard_restaurant_status
  before update of status on public.restaurants
  for each row execute function public.guard_restaurant_status_change();
