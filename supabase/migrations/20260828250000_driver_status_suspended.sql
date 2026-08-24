-- Adds 'suspended' to driver_status. This alone makes suspended drivers
-- invisible to dispatch_find_and_propose_driver's candidate filter
-- (status = 'available') -- no change to the dispatch algorithm needed to
-- enforce "suspended drivers get no automatic work" (is_active already
-- works the same way today for deactivated drivers).
-- Must be its own migration: ALTER TYPE ... ADD VALUE cannot be used in the
-- same transaction that adds it.
alter type public.driver_status add value 'suspended';
