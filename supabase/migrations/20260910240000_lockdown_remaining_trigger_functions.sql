-- Security hardening (audit finding L-02): the trigger functions below are
-- all RETURNS trigger (they read NEW/OLD, which only exist inside a real
-- trigger firing -- a direct RPC call to any of them already errors at the
-- Postgres level before doing anything). Each still had EXECUTE granted to
-- PUBLIC and/or anon/authenticated -- Supabase's default privileges grant
-- EXECUTE on every new function in schema public to anon/authenticated
-- unless explicitly revoked, and none of these had that revoke applied.
--
-- This matches the exact convention already established for the other
-- trigger functions in this project (driver_profiles_restrict_self_update,
-- validate_promo_code_row/target, sync_product_availability_from_inventory,
-- organizations_auto_create_for_restaurant, trg_log_restaurant_settings_change,
-- create_restaurant_subscription_default -- all already {postgres, service_role}
-- only) -- see 20260827000100_phase7_driver_dispatch_lockdown_trigger_fn.sql's
-- own reasoning, reused verbatim here: revoking EXECUTE does not affect the
-- trigger itself firing (trigger dispatch is not a privilege-checked
-- function call for the role performing the INSERT/UPDATE/DELETE -- it is
-- invoked directly by the executor regardless of the caller's own grants),
-- it only removes the function from the direct RPC surface.
--
-- Inventory verified against the remote project (pg_proc/pg_trigger), not
-- assumed from the audit text -- every one of these confirmed to be
-- attached to exactly the trigger(s) listed below and never called
-- directly from any other function body or the frontend (grepped across
-- supabase/migrations/*.sql and src/):
--   audit_review_moderation              -> reviews_audit_moderation (reviews)
--   audit_review_report_moderation       -> review_reports_audit_moderation (review_reports)
--   create_restaurant_settings_default   -> restaurants_create_settings (restaurants)
--   guard_orders_sensitive_columns       -> trg_guard_orders_sensitive_columns (orders)         [H-02]
--   guard_restaurant_status_change       -> trg_guard_restaurant_status (restaurants)            [H-01]
--   guard_review_status_change           -> reviews_guard_status_change (reviews)
--   handle_new_user                      -> on_auth_user_created (auth.users, AAFTER INSERT)
--   normalize_customer_phone             -> customers_normalize_phone (customers)
--   normalize_tenant_domain              -> tenant_domains_normalize (tenant_domains)            [L-01]
--   notify_client_order_status_change    -> orders_notify_client_status_change (orders)
--   notify_client_review_reply           -> review_replies_notify_client (review_replies)
--   notify_delivery_proposal_push        -> delivery_proposals_notify_push (delivery_proposals)
--   protect_super_admin_flag             -> profiles_protect_super_admin (profiles)
--   set_review_report_resolved_at        -> review_reports_set_resolved_at (review_reports)
--   set_updated_at                       -> *_set_updated_at on 24 tables (shared helper)
--   touch_business_exception_updated_at  -> tenant_business_exceptions_touch (tenant_business_exceptions)
--   trg_guard_commission_rate            -> restaurant_settings_guard_commission_rate (restaurant_settings)
--   validate_business_hours_slot         -> tenant_business_hours_validate (tenant_business_hours)
--   validate_product_promotion           -> product_promotions_validate (product_promotions)
--
-- Not touched here (out of L-02 scope): function bodies, SECURITY
-- DEFINER/INVOKER mode, search_path, RLS policies, and every business RPC
-- -- this migration is GRANT/REVOKE only.
revoke all on function public.audit_review_moderation() from public, anon, authenticated;
revoke all on function public.audit_review_report_moderation() from public, anon, authenticated;
revoke all on function public.create_restaurant_settings_default() from public, anon, authenticated;
revoke all on function public.guard_orders_sensitive_columns() from public, anon, authenticated;
revoke all on function public.guard_restaurant_status_change() from public, anon, authenticated;
revoke all on function public.guard_review_status_change() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.normalize_customer_phone() from public, anon, authenticated;
revoke all on function public.normalize_tenant_domain() from public, anon, authenticated;
revoke all on function public.notify_client_order_status_change() from public, anon, authenticated;
revoke all on function public.notify_client_review_reply() from public, anon, authenticated;
revoke all on function public.notify_delivery_proposal_push() from public, anon, authenticated;
revoke all on function public.protect_super_admin_flag() from public, anon, authenticated;
revoke all on function public.set_review_report_resolved_at() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.touch_business_exception_updated_at() from public, anon, authenticated;
revoke all on function public.trg_guard_commission_rate() from public, anon, authenticated;
revoke all on function public.validate_business_hours_slot() from public, anon, authenticated;
revoke all on function public.validate_product_promotion() from public, anon, authenticated;
