-- Security fix: public.enqueue_notification() was created (in
-- 20260912120000_notification_engine.sql) without the revoke/grant pair
-- every other internal-only SECURITY DEFINER function in that same
-- migration got (send_restaurant_message_notification, notify_driver_nearby,
-- etc.) -- an oversight, confirmed via a production config audit: EXECUTE
-- was left open to PUBLIC/anon/authenticated by Postgres's default grant.
--
-- This let any anon or authenticated caller invoke
-- supabase.rpc('enqueue_notification', {...}) directly with an arbitrary
-- user_id/visitor_id/tenant_id/order_id/type/title/body/url -- inserting
-- forged notification_events rows and triggering a real Push/Realtime send
-- impersonating any target. enqueue_notification was always meant to be
-- internal-only, called exclusively from the two trigger functions
-- (notify_customer_order_status_push, notify_customer_driver_assigned_push)
-- that already run as SECURITY DEFINER.
--
-- Ownership check performed before writing this migration: enqueue_notification
-- and both trigger functions are all owned by the same role (postgres). A
-- SECURITY DEFINER function's body executes as its OWNER, and a function's
-- owner always retains implicit EXECUTE on it regardless of REVOKE FROM
-- PUBLIC/anon/authenticated -- ownership grants privileges independently of
-- the ACL/grant system. The triggers therefore keep working unchanged after
-- this revoke; no GRANT to postgres/service_role is needed or added.
--
-- Nothing else changes: no new function, no new table, no RLS change, no
-- change to create_order/update_order_status/dispatch/send-notification/
-- send-push/push_subscriptions/the Service Worker/Realtime/auth.

revoke all on function public.enqueue_notification(
  uuid, text, uuid, uuid, text, text, text, text
) from public, anon, authenticated;
