-- Supabase grants EXECUTE to anon/authenticated directly at function-creation
-- time (not via the PUBLIC pseudo-role), so "revoke ... from public" in the
-- previous migration was a no-op for anon. Revoke explicitly here instead.
revoke execute on function public.set_inventory_tracking(uuid, uuid, boolean, integer, integer) from anon;
revoke execute on function public.set_inventory_alert_threshold(uuid, uuid, integer) from anon;
revoke execute on function public.record_inventory_movement(uuid, uuid, text, integer, text, text) from anon;

-- Trigger function: never meant to be called directly by any client role.
revoke execute on function public.sync_product_availability_from_inventory() from anon, authenticated;

revoke execute on function public.consume_inventory_for_order(uuid, uuid) from anon, authenticated;
revoke execute on function public.restore_inventory_for_order(uuid, uuid) from anon, authenticated;
