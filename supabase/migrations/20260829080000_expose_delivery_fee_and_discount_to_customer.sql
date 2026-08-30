-- Additive: exposes the already-authoritative delivery_fee_amount and
-- discount_amount columns to the customer-facing order read RPCs, so the
-- client-facing order summary (confirmation page) can show Sous-total /
-- Frais de livraison / Total distinctly instead of jumping straight from
-- products to a single Total. No calculation changes -- these columns are
-- already computed and stored by create_order; this only surfaces them.

CREATE OR REPLACE FUNCTION public.get_customer_order(p_order_id uuid, p_customer_phone text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', ord.id,
    'order_number', ord.order_number,
    'status', ord.status,
    'fulfillment_type', ord.fulfillment_type,
    'customer_name', ord.customer_name,
    'customer_phone', ord.customer_phone,
    'delivery_address', ord.delivery_address,
    'delivery_instructions', ord.delivery_instructions,
    'estimated_preparation_minutes', ord.estimated_preparation_minutes,
    'currency', ord.currency,
    'subtotal_amount', ord.subtotal_amount,
    'delivery_fee_amount', ord.delivery_fee_amount,
    'discount_amount', ord.discount_amount,
    'total_amount', ord.total_amount,
    'created_at', ord.created_at,
    'driver_delivery_status', ord.driver_delivery_status,
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug),
    'items', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name_snapshot,
          'unit_price', oi.unit_price_snapshot,
          'quantity', oi.quantity,
          'line_total', oi.line_total
        ) order by oi.created_at asc
      ), '[]'::jsonb)
      from public.order_items oi
      where oi.order_id = ord.id
    )
  )
  from public.orders ord
  join public.restaurants r on r.id = ord.restaurant_id
  where ord.id = p_order_id
    and ord.customer_phone = p_customer_phone;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_orders(p_restaurant_slug text, p_customer_phone text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ord.id,
      'order_number', ord.order_number,
      'status', ord.status,
      'fulfillment_type', ord.fulfillment_type,
      'customer_name', ord.customer_name,
      'customer_phone', ord.customer_phone,
      'delivery_address', ord.delivery_address,
      'delivery_instructions', ord.delivery_instructions,
      'estimated_preparation_minutes', ord.estimated_preparation_minutes,
      'currency', ord.currency,
      'subtotal_amount', ord.subtotal_amount,
      'delivery_fee_amount', ord.delivery_fee_amount,
      'discount_amount', ord.discount_amount,
      'total_amount', ord.total_amount,
      'created_at', ord.created_at,
      'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug),
      'items', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name_snapshot,
            'unit_price', oi.unit_price_snapshot,
            'quantity', oi.quantity,
            'line_total', oi.line_total
          ) order by oi.created_at asc
        ), '[]'::jsonb)
        from public.order_items oi
        where oi.order_id = ord.id
      )
    ) order by ord.created_at desc
  ), '[]'::jsonb)
  from public.orders ord
  join public.restaurants r on r.id = ord.restaurant_id
  where r.slug = p_restaurant_slug
    and ord.customer_phone = p_customer_phone;
$function$;
