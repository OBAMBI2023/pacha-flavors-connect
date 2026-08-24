-- Extends driver_profiles (per explicit decision: reuse this table and
-- assign_driver_to_order's pattern rather than a parallel table) to also
-- represent SAOVIA's own network-wide collection/delivery agents, who are
-- not owned by any single restaurant and must be dispatchable across
-- organizations. restaurant_id becomes nullable; exactly one of
-- restaurant_id / is_saovia_agent must hold, enforced by a check
-- constraint so a row can never be ambiguously owned.
--
-- Verified safe for existing RLS: has_restaurant_role/has_restaurant_access
-- both short-circuit on is_super_admin() before evaluating _restaurant_id,
-- and a NULL restaurant_id simply never matches the membership EXISTS
-- subquery for ordinary tenant staff (correct: restaurant staff must never
-- see SAOVIA network agents). driver_profiles_update's own-row branch
-- (`id = auth.uid()`) is unaffected either way. No RLS policy on
-- driver_profiles, vehicles, or driver_documents needs to change.
--
-- Out of scope for this migration: onboarding UI, vehicles/driver_documents
-- rows for SAOVIA agents, and any dispatch logic that actually pulls from
-- this pool -- those belong to a later phase once the API/RPC layer ships.
alter table public.driver_profiles
  alter column restaurant_id drop not null,
  add column is_saovia_agent boolean not null default false,
  add constraint driver_profiles_ownership_xor
    check ((restaurant_id is not null and not is_saovia_agent) or (restaurant_id is null and is_saovia_agent));
