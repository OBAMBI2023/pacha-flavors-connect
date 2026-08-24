-- CREATE OR REPLACE with an added parameter does not replace in place when
-- the old signature's positional arg count differs (Postgres treats it as a
-- distinct overload). Drop the pre-promo-code 31-arg signature so only the
-- 32-arg (with p_promo_code) create_order remains -- mirrors how
-- 20260828080000_drop_stale_create_order_overload_offers.sql already handled
-- this exact situation for p_offer_id.
drop function public.create_order(
  p_slug text, p_fulfillment_type order_fulfillment_type, p_customer_name text, p_customer_phone text,
  p_items jsonb, p_delivery_commune text, p_delivery_address text, p_delivery_instructions text,
  p_customer_notes text, p_order_source text, p_source_metadata jsonb, p_payment_method text,
  p_delivery_latitude double precision, p_delivery_longitude double precision, p_delivery_neighborhood text,
  p_delivery_city text, p_delivery_landmark text, p_offer_id uuid, p_visitor_id text,
  p_is_for_someone_else boolean, p_recipient_name text, p_recipient_phone text, p_recipient_address text,
  p_recipient_city text, p_recipient_neighborhood text, p_recipient_landmark text,
  p_recipient_additional_info text, p_allergy_information text, p_driver_note text,
  p_customer_profile_address text, p_cutlery_requested boolean
);
