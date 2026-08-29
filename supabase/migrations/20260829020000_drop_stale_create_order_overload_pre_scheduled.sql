-- CREATE OR REPLACE in the scheduled_orders migration added a NEW overload
-- (32 args, with p_scheduled_for) instead of replacing the function, because
-- Postgres only replaces on an EXACT parameter-list match -- appending even
-- a defaulted trailing param changes the signature's identity. This left
-- two create_order candidates, both callable with the same 31 named
-- params, which PostgREST/plain SQL can no longer resolve unambiguously.
-- Drop the stale 31-arg overload so only the scheduled-order-aware one remains.
drop function if exists public.create_order(
  text, order_fulfillment_type, text, text, jsonb, text, text, text, text, text,
  jsonb, text, double precision, double precision, text, text, text, uuid, text,
  boolean, text, text, text, text, text, text, text, text, text, text, boolean, text
);
