-- Security hardening (audit finding L-05): merge_customers(p_source_id,
-- p_target_id) reassigns every order from the source customer to the
-- target, recomputes the target's aggregates, and deletes the source row
-- -- with no audit trail of who merged whom, into what, for which
-- restaurant, or when.
--
-- Reuses the existing generic audit mechanism verbatim -- no new table,
-- trigger, or logging function. public.log_audit_event(restaurant_id,
-- actor_user_id, entity_type, entity_id, action, metadata) already backs
-- public.audit_logs and is already the pattern used by ~13 other call
-- sites (order status changes, review moderation, restaurant settings
-- changes, super admin plan changes, etc.) -- this follows the exact same
-- convention: entity_type = the noun ('customer'), entity_id = the
-- surviving row (p_target_id, since that's what persists after the
-- source is deleted), action named in the same past-tense style as
-- 'order_cancelled' / 'status_changed' ('customer_merged'), metadata
-- carrying only the two customer ids and a count -- no PII (no name,
-- phone, address, or order contents logged).
--
-- Authorization is untouched: the existing auth.uid() IS NULL check,
-- same-restaurant check, and has_restaurant_access() check all run
-- exactly as before, before any data is touched -- log_audit_event() is
-- only ever reached after every existing guard has already passed, and
-- the actor recorded is auth.uid() itself (the verified JWT subject of
-- the caller), never a client-supplied value. log_audit_event() itself
-- stays grantable only to {postgres, service_role} (unchanged) -- an
-- unauthorized caller has no path to invoke it directly or fabricate an
-- audit_logs row (audit_logs has no INSERT/UPDATE/DELETE RLS policy for
-- any role; only the table owner, which SECURITY DEFINER functions run
-- as, bypasses RLS).
--
-- Atomicity: the log_audit_event() call is a plain statement inside the
-- same PL/pgSQL function body/transaction as the merge itself (no
-- dblink, no async dispatch) -- if anything above it raises, the whole
-- function's effects (including the would-be audit row) roll back
-- together; the audit row exists if and only if the merge fully
-- committed. No SECURITY DEFINER/INVOKER change, no search_path change,
-- no GRANT change, no change to any pre-existing business logic beyond
-- capturing the reassigned-orders count and this one added call.
create or replace function public.merge_customers(p_source_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_restaurant_id uuid;
  v_source_restaurant_id uuid;
  v_merged_orders_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_source_id = p_target_id then
    raise exception 'Impossible de fusionner un client avec lui-même';
  end if;

  select restaurant_id into v_restaurant_id from public.customers where id = p_target_id;
  select restaurant_id into v_source_restaurant_id from public.customers where id = p_source_id;

  if v_restaurant_id is null or v_source_restaurant_id is null or v_restaurant_id != v_source_restaurant_id then
    raise exception 'Clients introuvables ou appartenant à des restaurants différents';
  end if;
  if not public.has_restaurant_access(v_restaurant_id) then
    raise exception 'Forbidden';
  end if;

  update public.orders set customer_id = p_target_id where customer_id = p_source_id;
  get diagnostics v_merged_orders_count = row_count;

  update public.customers c
    set orders_count = agg.orders_count,
        total_spent = agg.total_spent,
        first_order_at = agg.first_order_at,
        last_order_at = agg.last_order_at,
        updated_at = now()
    from (
      select count(*)::integer as orders_count, coalesce(sum(total_amount), 0) as total_spent,
             min(created_at) as first_order_at, max(created_at) as last_order_at
      from public.orders where customer_id = p_target_id
    ) agg
    where c.id = p_target_id;

  delete from public.customers where id = p_source_id;

  perform public.log_audit_event(
    v_restaurant_id, auth.uid(), 'customer', p_target_id, 'customer_merged',
    jsonb_build_object(
      'source_customer_id', p_source_id,
      'target_customer_id', p_target_id,
      'merged_orders_count', v_merged_orders_count
    )
  );
end;
$$;
