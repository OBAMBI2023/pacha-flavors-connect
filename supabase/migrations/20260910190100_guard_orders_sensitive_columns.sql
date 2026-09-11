-- Security hardening (audit finding H-02): orders_update_members grants
-- UPDATE on the whole orders row to any active restaurant member --
-- owner, manager, AND staff (has_restaurant_access() is role-agnostic).
-- Verified: zero direct `.update()` call on the orders table exists
-- anywhere in the frontend today -- every mutation already goes through a
-- SECURITY DEFINER RPC (update_order_status, create_refund,
-- mark_cash_payment_received, assign_driver_to_order,
-- dispatch_find_and_propose_driver, driver_advance_delivery_status,
-- driver_confirm_cash_payment, driver_respond_to_proposal,
-- verify_pickup_code, merge_customers), all owned by `postgres`. So a
-- direct REST PATCH to /rest/v1/orders is not how the app works today --
-- it is only how a compromised/malicious staff session could bypass the
-- business rules those RPCs enforce (payment status transitions, refund
-- remaining-amount checks, dispatch state machine, audit logging).
--
-- This trigger blocks direct writes to the sensitive columns below unless
-- the call originates from one of those trusted SECURITY DEFINER RPCs
-- (current_user = 'postgres', their owner -- current_user reflects the
-- function owner for the duration of a SECURITY DEFINER call, while a
-- direct PostgREST call always executes as `authenticated`/`anon`,
-- regardless of the caller's own JWT identity) or from a Super Admin
-- (is_super_admin(), consistent with every other admin override in this
-- schema). auth.uid()/is_super_admin() read a session-level GUC set once
-- per request, so they resolve correctly even from inside a trigger fired
-- by a nested SECURITY DEFINER call -- same mechanism already relied on by
-- trg_guard_commission_rate.
--
-- BEFORE UPDATE OF <columns> only fires when one of these columns is part
-- of the UPDATE's SET list, so it adds no overhead to updates that never
-- touch them, and every existing RPC above continues to write exactly the
-- columns it already writes today. Non-financial/logistics columns
-- (delivery_address, delivery_instructions, customer_notes, driver_note,
-- allergy_information, cutlery_requested, cancel_reason, recipient_*,
-- scheduled_for, delivery coordinates, etc.) are deliberately left
-- unguarded -- out of scope for this fix.

-- SECURITY INVOKER (the default) is required here, not SECURITY DEFINER:
-- inside a SECURITY DEFINER function, current_user switches to that
-- function's OWNER (postgres) for the duration of the call, so the
-- current_user = 'postgres' check below, if evaluated *inside* a
-- security-definer trigger, would always be true regardless of who
-- actually fired the UPDATE -- silently neutralizing the guard entirely.
-- With SECURITY INVOKER, current_user correctly reflects the actual
-- execution context: 'postgres' only when the UPDATE genuinely originates
-- from inside one of the approved SECURITY DEFINER RPCs (also owned by
-- postgres), 'authenticated' when it comes directly from PostgREST.
-- is_super_admin() itself stays SECURITY DEFINER (it needs to read
-- profiles.is_super_admin regardless of the caller's own RLS), so it is
-- unaffected by this function's own mode.
create or replace function public.guard_orders_sensitive_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user = 'postgres' or public.is_super_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.payment_status is distinct from old.payment_status
     or new.payment_method is distinct from old.payment_method
     or new.payment_reference is distinct from old.payment_reference
     or new.paid_at is distinct from old.paid_at
     or new.subtotal_amount is distinct from old.subtotal_amount
     or new.delivery_fee_amount is distinct from old.delivery_fee_amount
     or new.discount_amount is distinct from old.discount_amount
     or new.total_amount is distinct from old.total_amount
     or new.restaurant_id is distinct from old.restaurant_id
     or new.customer_id is distinct from old.customer_id
     or new.assigned_driver_id is distinct from old.assigned_driver_id
     or new.delivery_dispatch_status is distinct from old.delivery_dispatch_status
     or new.driver_delivery_status is distinct from old.driver_delivery_status
     or new.promo_code_id is distinct from old.promo_code_id
     or new.promo_code_snapshot is distinct from old.promo_code_snapshot
     or new.offer_id is distinct from old.offer_id
     or new.pickup_code is distinct from old.pickup_code
     or new.pickup_code_verified_at is distinct from old.pickup_code_verified_at
     or new.pickup_code_verified_by is distinct from old.pickup_code_verified_by
     or new.order_number is distinct from old.order_number
  then
    raise exception 'Modification directe des champs financiers/de contrôle de la commande non autorisée -- utilisez les fonctions dédiées (update_order_status, create_refund, mark_cash_payment_received, assign_driver_to_order, etc.)';
  end if;

  return new;
end;
$function$;

create trigger trg_guard_orders_sensitive_columns
  before update of
    status, payment_status, payment_method, payment_reference, paid_at,
    subtotal_amount, delivery_fee_amount, discount_amount, total_amount,
    restaurant_id, customer_id, assigned_driver_id,
    delivery_dispatch_status, driver_delivery_status,
    promo_code_id, promo_code_snapshot, offer_id,
    pickup_code, pickup_code_verified_at, pickup_code_verified_by,
    order_number
  on public.orders
  for each row execute function public.guard_orders_sensitive_columns();
