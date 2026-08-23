-- CREATE OR REPLACE FUNCTION does not replace a function whose parameter
-- list changed (a new trailing default param counts as a different
-- signature) -- it creates a second overload instead. 20260828070000's
-- create_order redefinition (adding p_offer_id) left the old 17-arg
-- overload behind alongside the new 18-arg one. Drop it explicitly so only
-- one create_order exists, matching every other single-signature RPC in
-- this schema. (This same failure mode happened once before, at
-- product_promotions -- see 20260823103826_drop_stale_create_order_overload
-- in the remote migration history.)
drop function if exists public.create_order(text, order_fulfillment_type, text, text, jsonb, text, text, text, text, text, jsonb, text, double precision, double precision, text, text, text);
