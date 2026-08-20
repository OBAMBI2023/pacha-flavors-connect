-- Phase 2 "Dashboard temps réel": enables Supabase Realtime (postgres_changes)
-- on the orders table so a restaurant's dashboard can receive new orders and
-- status changes without polling. Realtime does NOT bypass RLS: the client
-- subscribes with restaurant_id=eq.<tenant> as defense-in-depth, and the
-- existing orders_select_members policy still governs what each connected
-- user's socket is actually allowed to receive.
alter publication supabase_realtime add table public.orders;
