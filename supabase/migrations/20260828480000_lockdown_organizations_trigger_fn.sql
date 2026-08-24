-- organizations_auto_create_for_restaurant is a trigger-only function (like
-- log_audit_event/create_notification) -- it must never be directly
-- RPC-callable. REVOKE doesn't affect its own trigger firing.
revoke all on function public.organizations_auto_create_for_restaurant() from public, anon, authenticated;
